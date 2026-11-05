import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, 'foundersgate_data.json');

// In-Memory Tables with Fast Hash/B-Tree Indexes
class IndexedDatabase {
  constructor() {
    this.tables = {
      users: new Map(),
      password_resets: new Map(),
      startups: new Map(),
      startup_interests: new Map(),
      auction_bids: new Map(),
      products: new Map(),
      product_inquiries: new Map(),
      notifications: new Map(),
      blocked_identifiers: new Map(),
      otp_verifications: new Map(),
    };

    // Secondary Indexes for O(1) Lookups & Zero N+1 Queries
    this.indexes = {
      users_email: new Map(),
      users_phone: new Map(),
      password_resets_token: new Map(),
      startups_founder: new Map(),
      startup_interests_startup: new Map(),
      auction_bids_startup: new Map(),
      products_vendor: new Map(),
      notifications_user: new Map(),
    };

    this.loadFromDisk();
  }

  loadFromDisk() {
    if (fs.existsSync(dbFilePath)) {
      try {
        const raw = fs.readFileSync(dbFilePath, 'utf8');
        const data = JSON.parse(raw);
        for (const [tableName, records] of Object.entries(data)) {
          if (this.tables[tableName]) {
            for (const r of records) {
              this.insertInternal(tableName, r, false);
            }
          }
        }
      } catch (e) {
        console.error('Error loading database file:', e.message);
      }
    }
  }

  persistToDisk() {
    try {
      const dump = {};
      for (const [name, map] of Object.entries(this.tables)) {
        dump[name] = Array.from(map.values());
      }
      fs.writeFileSync(dbFilePath, JSON.stringify(dump, null, 2), 'utf8');
    } catch (e) {
      console.error('Persistence error:', e.message);
    }
  }

  insertInternal(table, record, persist = true) {
    this.tables[table].set(record.id || record.token, record);

    // Update indexes
    if (table === 'users') {
      if (record.email) this.indexes.users_email.set(record.email.toLowerCase(), record.id);
      if (record.phone_number) this.indexes.users_phone.set(record.phone_number, record.id);
    } else if (table === 'password_resets') {
      if (record.token) this.indexes.password_resets_token.set(record.token, record);
    } else if (table === 'startups') {
      if (!this.indexes.startups_founder.has(record.founder_id)) {
        this.indexes.startups_founder.set(record.founder_id, new Set());
      }
      this.indexes.startups_founder.get(record.founder_id).add(record.id);
    } else if (table === 'startup_interests') {
      if (!this.indexes.startup_interests_startup.has(record.startup_id)) {
        this.indexes.startup_interests_startup.set(record.startup_id, new Set());
      }
      this.indexes.startup_interests_startup.get(record.startup_id).add(record.id);
    } else if (table === 'auction_bids') {
      if (!this.indexes.auction_bids_startup.has(record.startup_id)) {
        this.indexes.auction_bids_startup.set(record.startup_id, new Set());
      }
      this.indexes.auction_bids_startup.get(record.startup_id).add(record.id);
    } else if (table === 'products') {
      if (!this.indexes.products_vendor.has(record.vendor_id)) {
        this.indexes.products_vendor.set(record.vendor_id, new Set());
      }
      this.indexes.products_vendor.get(record.vendor_id).add(record.id);
    } else if (table === 'notifications') {
      if (!this.indexes.notifications_user.has(record.user_id)) {
        this.indexes.notifications_user.set(record.user_id, new Set());
      }
      this.indexes.notifications_user.get(record.user_id).add(record.id);
    }

    if (persist) {
      this.persistToDisk();
    }
  }

  pragma() {}
  exec() {}

  isIdentifierBlocked(identifier) {
    if (!identifier) return false;
    const clean = identifier.toString().toLowerCase().trim();
    return this.tables.blocked_identifiers.has(clean);
  }

  blockIdentifier(identifier, reason = 'Exceeded 3 failed verification attempts') {
    if (!identifier) return;
    const clean = identifier.toString().toLowerCase().trim();
    this.tables.blocked_identifiers.set(clean, {
      identifier: clean,
      reason,
      blocked_at: Date.now(),
    });
    this.persistToDisk();
  }

  saveOtp(identifier, channel, code, purpose = 'register', linkedIdentifier = null) {
    const clean = identifier.toString().toLowerCase().trim();
    const id = clean;
    this.tables.otp_verifications.set(id, {
      id,
      identifier: clean,
      channel,
      code: code.toString().trim(),
      purpose,
      linkedIdentifier: linkedIdentifier ? linkedIdentifier.toString().toLowerCase().trim() : null,
      attempts: 0,
      expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
      verified: 0,
      created_at: Date.now(),
    });
    this.persistToDisk();
  }

  verifyOtpAttempt(identifier, inputCode) {
    const clean = identifier.toString().toLowerCase().trim();
    if (this.isIdentifierBlocked(clean)) {
      return { status: 'BLOCKED', message: 'This mobile number or email is permanently blocked due to security violations.' };
    }

    const record = this.tables.otp_verifications.get(clean);
    if (!record) {
      return { status: 'NOT_FOUND', message: 'No verification code found. Please request a new code.' };
    }

    if (Date.now() > record.expires_at) {
      this.tables.otp_verifications.delete(clean);
      this.persistToDisk();
      return { status: 'EXPIRED', message: 'Verification code has expired. Please request a new code.' };
    }

    if (record.code !== inputCode.toString().trim()) {
      record.attempts = (record.attempts || 0) + 1;
      const remaining = 3 - record.attempts;

      if (record.attempts >= 3) {
        // Permanently block both this identifier and any linked identifier (email/phone)
        this.blockIdentifier(clean, 'Exceeded 3 failed verification attempts');
        if (record.linkedIdentifier) {
          this.blockIdentifier(record.linkedIdentifier, 'Exceeded 3 failed verification attempts');
        }
        this.tables.otp_verifications.delete(clean);
        this.persistToDisk();
        return {
          status: 'BLOCKED',
          message: 'Verification failed 3 times. This mobile number and email have been permanently blocked from creating an account or logging in.',
        };
      }

      this.persistToDisk();
      return {
        status: 'INVALID_CODE',
        message: `Incorrect verification code. ${remaining} attempt(s) remaining before permanent account lockout.`,
        remainingAttempts: remaining,
      };
    }

    // Success
    record.verified = 1;
    this.persistToDisk();
    return {
      status: 'VERIFIED',
      message: 'Verification successful.',
      otpToken: `vtok-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  transaction(fn) {
    return (...args) => {
      const res = fn(...args);
      this.persistToDisk();
      return res;
    };
  }

  prepare(sql) {
    const s = sql.trim();
    const self = this;

    return {
      run(...params) {
        let paramObj = {};
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
          paramObj = params[0];
        }

        // INSERT INTO users
        if (/INSERT INTO users/i.test(s)) {
          let rec = paramObj;
          if (params.length > 1) {
            rec = {
              id: params[0],
              email: params[1],
              password_hash: params[2],
              full_name: params[3],
              role: params[4],
              country_code: params[5],
              phone_number: params[6],
              created_at: params[7],
            };
          }
          self.insertInternal('users', rec);
          return { changes: 1 };
        }

        // INSERT INTO password_resets
        if (/INSERT INTO password_resets/i.test(s)) {
          const rec = {
            token: params[0],
            user_id: params[1],
            expires_at: params[2],
            used: params[3] ?? 0,
          };
          self.insertInternal('password_resets', rec);
          return { changes: 1 };
        }

        // UPDATE password_resets SET used = 1 WHERE token = ?
        if (/UPDATE password_resets SET used = 1 WHERE token = \?/i.test(s)) {
          const token = params[0];
          const rec = self.tables.password_resets.get(token);
          if (rec) {
            rec.used = 1;
            self.persistToDisk();
          }
          return { changes: 1 };
        }

        // UPDATE users SET password_hash = ? WHERE id = ?
        if (/UPDATE users SET password_hash = \? WHERE id = \?/i.test(s)) {
          const hash = params[0];
          const userId = params[1];
          const user = self.tables.users.get(userId);
          if (user) {
            user.password_hash = hash;
            self.persistToDisk();
          }
          return { changes: 1 };
        }

        // INSERT INTO startups
        if (/INSERT INTO startups/i.test(s)) {
          let rec = paramObj;
          if (params.length > 1) {
            rec = {
              id: params[0],
              founder_id: params[1],
              title: params[2],
              industry: params[3],
              pitch: params[4],
              funding_target: params[5],
              equity_offered: params[6],
              min_investor_threshold: params[7],
              status: 'PITCHING',
              created_at: params[8] || Date.now(),
            };
          }
          self.insertInternal('startups', rec);
          return { changes: 1 };
        }

        // UPDATE startups SET status = 'AUCTION_ACTIVE' WHERE id = ?
        if (/UPDATE startups SET status = 'AUCTION_ACTIVE' WHERE id = \?/i.test(s)) {
          const startup = self.tables.startups.get(params[0]);
          if (startup) {
            startup.status = 'AUCTION_ACTIVE';
            self.persistToDisk();
          }
          return { changes: 1 };
        }

        // UPDATE startups SET status = 'FUNDED', selected_investor_id = ? WHERE id = ?
        if (/UPDATE startups SET status = 'FUNDED'/i.test(s)) {
          const selectedId = params[0];
          const startupId = params[1];
          const startup = self.tables.startups.get(startupId);
          if (startup) {
            startup.status = 'FUNDED';
            startup.selected_investor_id = selectedId;
            self.persistToDisk();
          }
          return { changes: 1 };
        }

        // INSERT INTO startup_interests
        if (/INSERT INTO startup_interests/i.test(s)) {
          let rec = paramObj;
          if (params.length > 1) {
            rec = {
              id: params[0],
              startup_id: params[1],
              investor_id: params[2],
              note: params[3],
              created_at: params[4],
            };
          }
          // Avoid duplicate interest from same investor
          const existing = Array.from(self.tables.startup_interests.values()).find(
            (i) => i.startup_id === rec.startup_id && i.investor_id === rec.investor_id
          );
          if (!existing) {
            self.insertInternal('startup_interests', rec);
          }
          return { changes: 1 };
        }

        // INSERT INTO auction_bids
        if (/INSERT INTO auction_bids/i.test(s)) {
          let rec = paramObj;
          if (params.length > 1) {
            rec = {
              id: params[0],
              startup_id: params[1],
              investor_id: params[2],
              bid_amount: params[3],
              equity_demanded: params[4],
              conditions: params[5],
              status: 'PENDING',
              created_at: params[6] || Date.now(),
            };
          }
          self.insertInternal('auction_bids', rec);
          return { changes: 1 };
        }

        // UPDATE auction_bids SET status = 'ACCEPTED' WHERE id = ?
        if (/UPDATE auction_bids SET status = 'ACCEPTED' WHERE id = \?/i.test(s)) {
          const bid = self.tables.auction_bids.get(params[0]);
          if (bid) {
            bid.status = 'ACCEPTED';
            self.persistToDisk();
          }
          return { changes: 1 };
        }

        // UPDATE auction_bids SET status = 'REJECTED' WHERE startup_id = ? AND id != ?
        if (/UPDATE auction_bids SET status = 'REJECTED'/i.test(s)) {
          const startupId = params[0];
          const excludeBidId = params[1];
          for (const bid of self.tables.auction_bids.values()) {
            if (bid.startup_id === startupId && bid.id !== excludeBidId) {
              bid.status = 'REJECTED';
            }
          }
          self.persistToDisk();
          return { changes: 1 };
        }

        // INSERT INTO products
        if (/INSERT INTO products/i.test(s)) {
          let rec = paramObj;
          if (params.length > 1) {
            rec = {
              id: params[0],
              vendor_id: params[1],
              title: params[2],
              description: params[3],
              price: params[4],
              category: params[5],
              image_url: params[6],
              stock: params[7],
              created_at: params[8],
            };
          }
          self.insertInternal('products', rec);
          return { changes: 1 };
        }

        // INSERT INTO product_inquiries
        if (/INSERT INTO product_inquiries/i.test(s)) {
          let rec = paramObj;
          if (params.length > 1) {
            rec = {
              id: params[0],
              product_id: params[1],
              buyer_id: params[2],
              buyer_name: params[3],
              buyer_phone: params[4],
              message: params[5],
              status: params[6] || 'PENDING',
              created_at: params[7],
            };
          }
          self.insertInternal('product_inquiries', rec);
          return { changes: 1 };
        }

        // INSERT INTO notifications
        if (/INSERT INTO notifications/i.test(s)) {
          let rec = paramObj;
          if (params.length > 1) {
            rec = {
              id: params[0],
              user_id: params[1],
              type: params[2],
              title: params[3],
              message: params[4],
              read: 0,
              created_at: params[5],
            };
          }
          self.insertInternal('notifications', rec);
          return { changes: 1 };
        }

        // UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?
        if (/UPDATE notifications SET read = 1/i.test(s)) {
          const id = params[0];
          const userId = params[1];
          const notif = self.tables.notifications.get(id);
          if (notif && notif.user_id === userId) {
            notif.read = 1;
            self.persistToDisk();
          }
          return { changes: 1 };
        }

        return { changes: 0 };
      },

      get(...params) {
        // SELECT COUNT(*) as count FROM users
        if (/SELECT COUNT\(\*\) as count FROM users/i.test(s)) {
          return { count: self.tables.users.size };
        }

        // SELECT COUNT(*) as count FROM startup_interests WHERE startup_id = ?
        if (/SELECT COUNT\(\*\) as count FROM startup_interests WHERE startup_id = \?/i.test(s)) {
          const startupId = params[0];
          const interests = self.indexes.startup_interests_startup.get(startupId);
          return { count: interests ? interests.size : 0 };
        }

        // SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE id = ?
        // OR SELECT * FROM users WHERE id = ?
        if (/FROM users WHERE id = \?/i.test(s)) {
          const user = self.tables.users.get(params[0]);
          return user ? { ...user } : undefined;
        }

        // SELECT id FROM users WHERE email = ? OR SELECT * FROM users WHERE email = ?
        if (/FROM users WHERE email = \?/i.test(s)) {
          const email = (params[0] || '').toLowerCase();
          const userId = self.indexes.users_email.get(email);
          if (!userId) return undefined;
          return { ...self.tables.users.get(userId) };
        }

        // SELECT * FROM users WHERE phone_number = ?
        if (/FROM users WHERE phone_number = \?/i.test(s)) {
          const phone = (params[0] || '').replace(/\D/g, '');
          const userId = self.indexes.users_phone.get(phone);
          if (!userId) return undefined;
          return { ...self.tables.users.get(userId) };
        }

        // SELECT * FROM password_resets WHERE token = ?
        if (/FROM password_resets WHERE token = \?/i.test(s)) {
          const token = params[0];
          const rec = self.indexes.password_resets_token.get(token);
          return rec ? { ...rec } : undefined;
        }

        // SELECT * FROM startups WHERE id = ?
        if (/FROM startups WHERE id = \?/i.test(s)) {
          const startup = self.tables.startups.get(params[0]);
          return startup ? { ...startup } : undefined;
        }

        // SELECT * FROM auction_bids WHERE id = ? AND startup_id = ?
        if (/FROM auction_bids WHERE id = \? AND startup_id = \?/i.test(s)) {
          const id = params[0];
          const startupId = params[1];
          const bid = self.tables.auction_bids.get(id);
          if (bid && bid.startup_id === startupId) {
            return { ...bid };
          }
          return undefined;
        }

        // SELECT * FROM products WHERE id = ?
        if (/FROM products WHERE id = \?/i.test(s)) {
          const prod = self.tables.products.get(params[0]);
          return prod ? { ...prod } : undefined;
        }

        return undefined;
      },

      all(...params) {
        // SELECT s.*, u.full_name as founder_name, ... FROM startups s JOIN users u ...
        if (/FROM startups s/i.test(s) || /FROM startups/i.test(s)) {
          const list = Array.from(self.tables.startups.values()).map((s) => {
            const founder = self.tables.users.get(s.founder_id);
            const interests = self.indexes.startup_interests_startup.get(s.id);
            const count = interests ? interests.size : 0;
            return {
              ...s,
              founder_name: founder ? founder.full_name : 'Alex Vance',
              interest_count: count,
            };
          });
          list.sort((a, b) => b.created_at - a.created_at);
          return list;
        }

        // SELECT b.*, u.full_name as investor_name ... FROM auction_bids b JOIN users u ...
        if (/FROM auction_bids b/i.test(s) || /FROM auction_bids/i.test(s)) {
          // If WHERE startup_id = ? AND id != ?
          if (/WHERE startup_id = \? AND id != \?/i.test(s)) {
            const startupId = params[0];
            const excludeId = params[1];
            return Array.from(self.tables.auction_bids.values()).filter(
              (b) => b.startup_id === startupId && b.id !== excludeId
            );
          }

          const list = Array.from(self.tables.auction_bids.values()).map((b) => {
            const user = self.tables.users.get(b.investor_id);
            return {
              ...b,
              investor_name: user ? user.full_name : 'Accredited Investor',
              investor_phone: user ? user.phone_number : undefined,
              investor_country: user ? user.country_code : undefined,
            };
          });
          return list;
        }

        // SELECT p.*, u.full_name as vendor_name ... FROM products p JOIN users u ...
        if (/FROM products p/i.test(s) || /FROM products/i.test(s)) {
          const list = Array.from(self.tables.products.values()).map((p) => {
            const user = self.tables.users.get(p.vendor_id);
            return {
              ...p,
              vendor_name: user ? user.full_name : 'Local Artisan',
              vendor_phone: user ? user.phone_number : undefined,
              vendor_country: user ? user.country_code : undefined,
            };
          });
          list.sort((a, b) => b.created_at - a.created_at);
          return list;
        }

        // SELECT pi.*, p.title as product_title FROM product_inquiries pi JOIN products p ... WHERE p.vendor_id = ?
        if (/FROM product_inquiries/i.test(s)) {
          const vendorId = params[0];
          const list = [];
          for (const inq of self.tables.product_inquiries.values()) {
            const prod = self.tables.products.get(inq.product_id);
            if (prod && (!vendorId || prod.vendor_id === vendorId)) {
              list.push({
                ...inq,
                product_title: prod.title,
              });
            }
          }
          list.sort((a, b) => b.created_at - a.created_at);
          return list;
        }

        // SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        if (/FROM notifications/i.test(s)) {
          const userId = params[0];
          const list = Array.from(self.tables.notifications.values()).filter(
            (n) => n.user_id === userId
          );
          list.sort((a, b) => b.created_at - a.created_at);
          return list.slice(0, 50);
        }

        return [];
      },
    };
  }
}

const db = new IndexedDatabase();

export function initDatabase() {
  // Database initialized and indexed
  return db;
}

export default db;
