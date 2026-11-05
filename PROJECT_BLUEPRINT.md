# PROJECT_BLUEPRINT.md - Technical Architecture & API Specification

## 1. SYSTEM OVERVIEW
**FoundersGate** is a three-tiered platform:
1. **Startup Engine**: Founders list pitches, investors express interest, reaching a threshold triggers an auction where investors submit term bids and the founder selects one winning investor, instantly notifying outbid investors.
2. **Community Marketplace**: Independent vendors sell local goods; buyers browse and send contact inquiries without auction mechanics.
3. **Notification & Auth Core**: Secure authentication, strict UUID isolation, country-code phone validation, 30-min password reset expiration, and comprehensive notification dispatch.

---

## 2. DATABASE SCHEMA (SQL / SQLite with Strict Indexing)

```sql
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- UUID v4
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK(role IN ('founder', 'investor', 'normal')) NOT NULL,
  country_code TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);

-- Password Resets Table (30-Minute Expiry)
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pwd_resets_user ON password_resets(user_id);

-- Startups Table
CREATE TABLE IF NOT EXISTS startups (
  id TEXT PRIMARY KEY, -- UUID v4
  founder_id TEXT NOT NULL,
  title TEXT NOT NULL,
  industry TEXT NOT NULL,
  pitch TEXT NOT NULL,
  funding_target REAL NOT NULL,
  equity_offered REAL NOT NULL,
  min_investor_threshold INTEGER DEFAULT 3,
  status TEXT CHECK(status IN ('PITCHING', 'AUCTION_ACTIVE', 'FUNDED', 'CLOSED')) DEFAULT 'PITCHING',
  selected_investor_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (founder_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_investor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_startups_founder ON startups(founder_id);
CREATE INDEX IF NOT EXISTS idx_startups_status ON startups(status);

-- Startup Interests (Investors expressing interest)
CREATE TABLE IF NOT EXISTS startup_interests (
  id TEXT PRIMARY KEY,
  startup_id TEXT NOT NULL,
  investor_id TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(startup_id, investor_id),
  FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE,
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_interests_startup ON startup_interests(startup_id);
CREATE INDEX IF NOT EXISTS idx_interests_investor ON startup_interests(investor_id);

-- Auction Bids
CREATE TABLE IF NOT EXISTS auction_bids (
  id TEXT PRIMARY KEY,
  startup_id TEXT NOT NULL,
  investor_id TEXT NOT NULL,
  bid_amount REAL NOT NULL,
  equity_demanded REAL NOT NULL,
  conditions TEXT,
  status TEXT CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (startup_id) REFERENCES startups(id) ON DELETE CASCADE,
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bids_startup ON auction_bids(startup_id);
CREATE INDEX IF NOT EXISTS idx_bids_investor ON auction_bids(investor_id);

-- Products Table (Normal - Sell)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  stock INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Product Inquiries (Normal - Buy Requests)
CREATE TABLE IF NOT EXISTS product_inquiries (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK(status IN ('PENDING', 'RESOLVED')) DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inquiries_product ON product_inquiries(product_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_buyer ON product_inquiries(buyer_id);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'INTEREST', 'AUCTION_STARTED', 'BID_PLACED', 'BID_ACCEPTED', 'BID_REJECTED', 'PRODUCT_INQUIRY'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifs_user_read ON notifications(user_id, read);

-- OTP Verifications (Two-step verification with attempt counting)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL, -- 'EMAIL' | 'SMS'
  identifier TEXT NOT NULL, -- email or full phone
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_verifications(identifier);

-- Blocked Identifiers (Permanent lockout after 3 failed OTP attempts)
CREATE TABLE IF NOT EXISTS blocked_identifiers (
  id TEXT PRIMARY KEY,
  identifier TEXT UNIQUE NOT NULL, -- email or full phone
  reason TEXT NOT NULL,
  blocked_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocked_identifier ON blocked_identifiers(identifier);
```

---

## 3. STATE MACHINE: STARTUP FUNDING LIFECYCLE

```
[ PITCHING ]
      |
      | (count(startup_interests) >= min_investor_threshold)
      v
[ AUCTION_ACTIVE ]  <--- Investors place bids (PENDING)
      |
      | Founder clicks "Select / Allow Talk" on winning bid
      v
[ FUNDED ]
      ├── Winning Bid -> ACCEPTED
      ├── All other Bids -> REJECTED
      └── Notifications sent to all bidders
```

---

## 4. API SPECIFICATION CONTRACT

### Anti-Vulnerability & OTP Endpoints
- `POST /api/auth/send-otp`
  - Body: `{ channel: 'EMAIL' | 'SMS', identifier: string, purpose: string }`
  - Checks permanent blacklist. Rejects fake/repetitive phones or burner emails.
  - Generates secure code logged strictly server-side. **NEVER returns code in client JSON response.**
- `POST /api/auth/verify-otp`
  - Body: `{ identifier: string, code: string }`
  - Increments failure attempt counter.
  - If attempts exceed 3, permanently writes identifier to `blocked_identifiers` (`BLOCKED_PERMANENTLY`).
  - Returns: `{ success: true, verified: true }`

### Auth Endpoints
- `POST /api/auth/register` (Rate limited: strictly 5 requests per 1 minute globally)
  - Body: `{ email, password, full_name, role, country_code, phone_number, verification_code }`
  - Validates anti-vulnerability phone patterns & disposable email domains.
  - Returns: `{ token, user: { id, email, full_name, role, country_code, phone_number } }`
- `POST /api/auth/login`
  - Body: `{ identifier, password }` (Accepts either mobile phone with country code OR email address).
  - Returns: `{ token, user }`
- `POST /api/auth/forgot-password`
  - Body: `{ email }`
  - Generates token expiring in 30 minutes. Returns reset instructions.
- `POST /api/auth/reset-password`
  - Body: `{ token, new_password }`
  - Validates `< 30 mins` and not used.

### Startup & Auction Endpoints
- `GET /api/startups` - List pitches with caching & interest metrics.
- `POST /api/startups` - (Founder only) Create new pitch.
- `POST /api/startups/:id/interest` - (Investor only) Express interest.
- `GET /api/startups/:id/bids` - Retrieve active auction bids.
- `POST /api/startups/:id/bids` - (Investor only) Submit auction bid.
- `POST /api/startups/:id/bids/:bidId/accept` - (Founder only) Accept winning bid; auto-rejects others and broadcasts notifications.

### Marketplace (Normal) Endpoints
- `GET /api/products` - Browse marketplace products (supports category, search, pagination).
- `POST /api/products` - (Normal role only) Add product listing.
- `POST /api/products/:id/inquire` - (Normal / any buyer) Submit purchase inquiry to vendor.
- `GET /api/vendor/inquiries` - (Vendor only) View customer inquiry inbox.

### Notifications Endpoints (Sellers Only)
- `GET /api/notifications` - Paginated notifications strictly restricted to sellers (Founders and Normal vendors). Returns 403 `NOTIFICATIONS_RESTRICTED` for Investors and Buyers.
- `PATCH /api/notifications/:id/read` - Mark notification as read.

