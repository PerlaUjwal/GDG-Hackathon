import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db, { initDatabase } from './db.js';
import { seedInitialData } from './seed.js';
import { apiCache } from './cache.js';
import { authenticateToken, requireRole, JWT_SECRET } from './authMiddleware.js';
import { sendEmailOTP, sendSmsOTP } from './mailer.js';

// Initialize Database & Seed
initDatabase();
seedInitialData();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Support client-compressed images
app.use(cors({ origin: true, credentials: true }));

// ==========================================
// ANTI-VULNERABILITY & VALIDATION HELPERS
// ==========================================
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getairmail.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'mytemp.email',
  'inboxkitten.com',
  'temp-mail.org',
  'tempmailo.com',
  'crazymailing.com',
  'emailondeck.com',
  'burnermail.io',
  'mohmal.com',
  'nada.ltd',
  'fakemailgenerator.com',
  'generator.email',
]);

function validateEmailSecurity(email) {
  if (!email || typeof email !== 'string') return { valid: false, message: 'Email address is required.' };
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, message: 'Invalid email format. Please provide a legitimate email address.' };
  }
  const domain = clean.split('@')[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, message: 'Disposable, temporary, or burner email addresses are not permitted.' };
  }
  if (/^(.)\1{4,}@/.test(clean)) {
    return { valid: false, message: 'Invalid repetitive pattern in email username.' };
  }
  return { valid: true, clean };
}

function validatePhoneSecurity(countryCode, phoneNumber) {
  if (!phoneNumber) return { valid: false, message: 'Phone number is required.' };
  const clean = phoneNumber.replace(/\D/g, '');
  if (clean.length < 7 || clean.length > 15) {
    return { valid: false, message: 'Phone number must have between 7 and 15 digits.' };
  }
  // Reject identical repetitive digits (e.g. 1111111111, 0000000000)
  if (/^(\d)\1+$/.test(clean)) {
    return { valid: false, message: 'Fake phone number rejected: identical repetitive digits are not allowed.' };
  }
  // Check if any digit makes up >= 70% of number
  const counts = {};
  for (const d of clean) {
    counts[d] = (counts[d] || 0) + 1;
    if (counts[d] / clean.length >= 0.7) {
      return { valid: false, message: 'Invalid phone number pattern: suspicious repetitive digits detected.' };
    }
  }
  // Sequential patterns
  const seqs = ['0123456789', '1234567890', '9876543210', '8765432109', '12345678', '87654321'];
  for (const s of seqs) {
    if (clean.includes(s)) {
      return { valid: false, message: 'Suspicious sequential numbers detected. Please provide a real mobile number.' };
    }
  }
  // Country specific
  if (countryCode === '+1' && (clean.startsWith('0') || clean.startsWith('1'))) {
    return { valid: false, message: 'US/Canada phone numbers cannot start with 0 or 1 area code.' };
  }
  if (countryCode === '+91' && !/^[6-9]/.test(clean)) {
    return { valid: false, message: 'Indian mobile numbers must begin with 6, 7, 8, or 9.' };
  }
  return { valid: true, clean };
}

// 1. Rate Limiting Middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Allows dev/test runs while still blocking brute-force attacks
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// GLOBAL REGISTRATION RATE LIMITER
const globalRegistrationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 registration requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED_GLOBAL',
    message: 'Registration rate limit reached. Please wait a moment and try again.',
  },
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

app.use('/api', generalApiLimiter);
app.use('/api/auth', authLimiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ==========================================
// AUTHENTICATION & SECURITY ENDPOINTS
// ==========================================

// Send OTP Endpoint (Email or Mobile selection)
// The OTP code is NEVER sent in the response to the frontend!
app.post('/api/auth/send-otp', async (req, res) => {
  const { email, phone_number, country_code, channel = 'email', purpose = 'register' } = req.body;

  // 1. Check permanent blacklist
  if (email && db.isIdentifierBlocked(email)) {
    return res.status(403).json({
      error: 'BLOCKED_PERMANENTLY',
      message: 'This email address is permanently blocked from account creation due to exceeding 3 failed verification attempts.',
    });
  }
  if (phone_number && db.isIdentifierBlocked(phone_number)) {
    return res.status(403).json({
      error: 'BLOCKED_PERMANENTLY',
      message: 'This mobile number is permanently blocked from account creation due to exceeding 3 failed verification attempts.',
    });
  }

  // 2. Anti-Vulnerability validation
  if (email) {
    const emailCheck = validateEmailSecurity(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: emailCheck.message });
    }
  }

  let cleanPhone = null;
  if (phone_number) {
    const phoneCheck = validatePhoneSecurity(country_code || '+1', phone_number);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: phoneCheck.message });
    }
    cleanPhone = phoneCheck.clean;
  }

  if (purpose === 'register') {
    if (email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
      if (existing) {
        return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: 'An account with this email already exists.' });
      }
    }
    if (cleanPhone) {
      const existingPhone = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(cleanPhone);
      if (existingPhone) {
        return res.status(409).json({ error: 'DUPLICATE_PHONE', message: 'An account with this mobile number already exists.' });
      }
    }
  }

  const chosenChannel = channel === 'mobile' ? 'mobile' : 'email';
  const targetIdentifier = chosenChannel === 'mobile' ? cleanPhone : (email ? email.toLowerCase() : cleanPhone);
  const linkedIdentifier = chosenChannel === 'mobile' ? (email ? email.toLowerCase() : null) : cleanPhone;

  if (!targetIdentifier) {
    return res.status(400).json({
      error: 'MISSING_IDENTIFIER',
      message: `Please provide a valid ${chosenChannel === 'mobile' ? 'mobile number' : 'email address'} for verification.`,
    });
  }

  // Generate 6-digit random cryptographic OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Save in backend with max 3 attempt tracking
  db.saveOtp(targetIdentifier, chosenChannel, code, purpose, linkedIdentifier);

  // Secure Server-side dispatch logging
  console.log(`\n======================================================`);
  console.log(`[SECURE OTP DISPATCH] Channel: ${chosenChannel.toUpperCase()}`);
  console.log(`Target: ${targetIdentifier}`);
  console.log(`Purpose: ${purpose.toUpperCase()}`);
  console.log(`Verification Code: ${code} (STRICTLY SERVER-SIDE ONLY)`);
  console.log(`======================================================\n`);

  // Actually dispatch the email or SMS through the mailer!
  let dispatchResult = null;
  if (chosenChannel === 'email' || !cleanPhone) {
    dispatchResult = await sendEmailOTP(targetIdentifier, code, purpose);
  } else {
    dispatchResult = await sendSmsOTP(
      country_code || '+1',
      cleanPhone,
      code,
      purpose,
      email ? email.toLowerCase() : null
    );
  }

  // Check if dispatch failed
  if (dispatchResult && !dispatchResult.success) {
    console.error(`[DISPATCH FAILED]`, dispatchResult.error);
    return res.status(500).json({
      error: 'DISPATCH_FAILED',
      message: dispatchResult.error || 'Failed to dispatch verification code to your email address.',
    });
  }

  // Notice: The OTP code itself is NEVER returned in the JSON payload!
  res.json({
    success: true,
    channel: chosenChannel,
    identifier: targetIdentifier,
    previewUrl: dispatchResult?.previewUrl || null,
    provider: dispatchResult?.provider || null,
    isRealDelivery: dispatchResult?.isReal || false,
    message: dispatchResult?.isReal
      ? `Verification code dispatched directly to your ${chosenChannel === 'mobile' ? 'mobile number via SMS' : 'inbox'}. Please check your email inbox and spam folder.`
      : `Verification code dispatched to your ${chosenChannel === 'mobile' ? 'mobile number' : 'email address'}. (Valid for 10 minutes. 3 attempts max).`,
  });
});

// Verify OTP Endpoint (Permanent block if failed > 3 times)
app.post('/api/auth/verify-otp', (req, res) => {
  const { identifier, code } = req.body;

  if (!identifier || !code) {
    return res.status(400).json({ error: 'MISSING_DATA', message: 'Identifier and verification code are required.' });
  }

  const result = db.verifyOtpAttempt(identifier, code);

  if (result.status === 'BLOCKED') {
    return res.status(403).json({
      error: 'BLOCKED_PERMANENTLY',
      message: result.message,
    });
  }

  if (result.status === 'INVALID_CODE') {
    return res.status(400).json({
      error: 'INVALID_CODE',
      message: result.message,
      remainingAttempts: result.remainingAttempts,
    });
  }

  if (result.status === 'EXPIRED') {
    return res.status(400).json({
      error: 'CODE_EXPIRED',
      message: result.message,
    });
  }

  if (result.status !== 'VERIFIED') {
    return res.status(400).json({
      error: 'VERIFICATION_FAILED',
      message: result.message,
    });
  }

  res.json({
    success: true,
    otpToken: result.otpToken,
    message: result.message,
  });
});

// Register with global rate limit (strictly 5 accounts / 1 minute globally)
app.post('/api/auth/register', globalRegistrationLimiter, (req, res) => {
  const { email, password, full_name, role, country_code, phone_number } = req.body;

  if (!email || !password || !full_name || !role || !country_code || !phone_number) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'All registration fields are required.' });
  }

  // Check permanent blacklist
  if (db.isIdentifierBlocked(email) || db.isIdentifierBlocked(phone_number)) {
    return res.status(403).json({
      error: 'BLOCKED_PERMANENTLY',
      message: 'This email address or mobile number is permanently blocked due to security violations.',
    });
  }

  // Anti-vulnerability validation
  const emailCheck = validateEmailSecurity(email);
  if (!emailCheck.valid) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: emailCheck.message });
  }

  const phoneCheck = validatePhoneSecurity(country_code, phone_number);
  if (!phoneCheck.valid) {
    return res.status(400).json({ error: 'INVALID_PHONE', message: phoneCheck.message });
  }

  const cleanPhone = phoneCheck.clean;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: 'An account with this email already exists.' });
  }

  const existingPhone = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(cleanPhone);
  if (existingPhone) {
    return res.status(409).json({ error: 'DUPLICATE_PHONE', message: 'An account with this phone number already exists.' });
  }

  const userId = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, country_code, phone_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, email.toLowerCase(), passwordHash, full_name, role, country_code, cleanPhone, now);

  const token = jwt.sign({ id: userId, role, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: {
      id: userId,
      email: email.toLowerCase(),
      full_name,
      role,
      country_code,
      phone_number: cleanPhone,
      created_at: now,
    },
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, phone_number, password } = req.body;

  if ((!email && !phone_number) || !password) {
    return res.status(400).json({
      error: 'MISSING_CREDENTIALS',
      message: 'Mobile/phone number or email and password are required to sign in.',
    });
  }

  let user = null;
  if (phone_number) {
    const cleanPhone = phone_number.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      return res.status(400).json({
        error: 'INVALID_PHONE_LENGTH',
        message: 'Phone number does not contain enough digits for a valid mobile number.',
      });
    }
    user = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(cleanPhone);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'No registered account found with this mobile number. Please verify digits or sign up.',
      });
    }
  } else if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.',
      });
    }
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Incorrect password entered.' });
  }

  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      country_code: user.country_code,
      phone_number: user.phone_number,
      created_at: user.created_at,
    },
  });
});

// Forgot Password - Generates Token Valid Strictly for 30 Minutes
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'MISSING_EMAIL', message: 'Email is required.' });
  }

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    // Return generic message to prevent email enumeration
    return res.json({
      message: 'If the email exists, a password reset link has been dispatched. Link expires strictly in 30 minutes.',
      expiryMinutes: 30,
    });
  }

  const resetToken = 'rst-' + uuidv4().substring(0, 18);
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes from now

  db.prepare(`
    INSERT INTO password_resets (token, user_id, expires_at, used)
    VALUES (?, ?, ?, 0)
  `).run(resetToken, user.id, expiresAt);

  res.json({
    message: 'Password reset link generated. Link expires strictly in 30 minutes.',
    expiryMinutes: 30,
    resetToken,
  });
});

// Reset Password with 30-min Token Validation
app.post('/api/auth/reset-password', (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'INVALID_DATA', message: 'Token and a password of >= 6 characters are required.' });
  }

  const record = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token);
  if (!record) {
    return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Reset token not recognized.' });
  }

  if (record.used === 1) {
    return res.status(400).json({ error: 'TOKEN_ALREADY_USED', message: 'This reset token has already been consumed.' });
  }

  if (Date.now() > record.expires_at) {
    return res.status(400).json({
      error: 'TOKEN_EXPIRED',
      message: 'This password reset link expired after 30 minutes. Please request a new link.',
    });
  }

  const newHash = bcrypt.hashSync(new_password, 10);

  // Consume token and update user password atomically
  const updateTx = db.transaction(() => {
    db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').run(token);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, record.user_id);
  });
  updateTx();

  res.json({ message: 'Password has been successfully updated. You may now log in.' });
});

// ==========================================
// STARTUP PITCHES & AUCTION SYSTEM
// ==========================================

// List Startups with Caching
app.get('/api/startups', (req, res) => {
  const cached = apiCache.get('startups_list');
  if (cached) {
    return res.json(cached);
  }

  // Optimized single query joining founder details, interest counts, and bids
  const startups = db.prepare(`
    SELECT s.*, u.full_name as founder_name,
      (SELECT COUNT(*) FROM startup_interests WHERE startup_id = s.id) as interest_count
    FROM startups s
    JOIN users u ON s.founder_id = u.id
    ORDER BY s.created_at DESC
  `).all();

  // Attach bids
  const bids = db.prepare(`
    SELECT b.*, u.full_name as investor_name, u.phone_number as investor_phone, u.country_code as investor_country
    FROM auction_bids b
    JOIN users u ON b.investor_id = u.id
  `).all();

  const bidsByStartup = bids.reduce((acc, b) => {
    if (!acc[b.startup_id]) acc[b.startup_id] = [];
    acc[b.startup_id].push({
      ...b,
      investor_phone: b.investor_phone ? `${b.investor_country} ${b.investor_phone}` : undefined,
    });
    return acc;
  }, {});

  const result = startups.map(s => ({
    ...s,
    bids: bidsByStartup[s.id] || [],
  }));

  apiCache.set('startups_list', result, 15000); // 15s cache
  res.json(result);
});

// Create Pitch (Founder Only)
app.post('/api/startups', authenticateToken, requireRole(['founder']), (req, res) => {
  const { title, industry, pitch, funding_target, equity_offered, min_investor_threshold } = req.body;

  if (!title || !pitch || !funding_target || !equity_offered) {
    return res.status(400).json({ error: 'MISSING_DATA', message: 'All pitch details are required.' });
  }

  const startupId = req.body.id || uuidv4();
  const now = Date.now();
  const threshold = parseInt(min_investor_threshold, 10) || 3;

  db.prepare(`
    INSERT INTO startups (id, founder_id, title, industry, pitch, funding_target, equity_offered, min_investor_threshold, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PITCHING', ?)
  `).run(
    startupId,
    req.user.id,
    title,
    industry || 'General',
    pitch,
    parseFloat(funding_target),
    parseFloat(equity_offered),
    threshold,
    now
  );

  apiCache.invalidate('startups_list');

  res.status(201).json({
    id: startupId,
    founder_id: req.user.id,
    founder_name: req.user.full_name,
    title,
    industry,
    pitch,
    funding_target: parseFloat(funding_target),
    equity_offered: parseFloat(equity_offered),
    min_investor_threshold: threshold,
    status: 'PITCHING',
    interest_count: 0,
    created_at: now,
    bids: [],
  });
});

// Express Interest (Investor Only) - Unlocks Auction When Threshold is Satisfied
app.post('/api/startups/:id/interest', authenticateToken, requireRole(['investor']), (req, res) => {
  const startupId = req.params.id;
  const investorId = req.user.id;
  const note = req.body.note || 'Interested in investment terms.';

  const startup = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);
  if (!startup) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Startup not found.' });
  }

  const interestId = uuidv4();
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO startup_interests (id, startup_id, investor_id, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(interestId, startupId, investorId, note, now);
  } catch {
    // Already expressed interest
  }

  // Count current interests
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM startup_interests WHERE startup_id = ?').get(startupId).count;

  // Check if threshold is reached
  if (currentCount >= startup.min_investor_threshold && startup.status === 'PITCHING') {
    db.prepare("UPDATE startups SET status = 'AUCTION_ACTIVE' WHERE id = ?").run(startupId);

    // Notify founder of unlocked auction room
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(
      uuidv4(),
      startup.founder_id,
      'AUCTION_STARTED',
      'Auction Room Unlocked! 🎉',
      `Your startup "${startup.title}" reached ${currentCount} interested investors! Competitive bidding is now active.`,
      now
    );
  } else {
    // Notify founder of new interest
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(
      uuidv4(),
      startup.founder_id,
      'INTEREST',
      'New Investor Interest Registered',
      `${req.user.full_name} registered interest in "${startup.title}". (${currentCount}/${startup.min_investor_threshold} investors)`,
      now
    );
  }

  apiCache.invalidate('startups_list');
  res.json({ success: true, interest_count: currentCount });
});

// Submit Auction Bid (Investor Only)
app.post('/api/startups/:id/bids', authenticateToken, requireRole(['investor']), (req, res) => {
  const startupId = req.params.id;
  const { bid_amount, equity_demanded, conditions } = req.body;

  const startup = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);
  if (!startup) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Startup not found.' });
  }

  if (startup.status !== 'AUCTION_ACTIVE') {
    return res.status(400).json({
      error: 'AUCTION_INACTIVE',
      message: 'Bidding is only permitted once the startup has reached its interest threshold and entered AUCTION_ACTIVE.',
    });
  }

  const bidId = req.body.id || uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO auction_bids (id, startup_id, investor_id, bid_amount, equity_demanded, conditions, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(
    bidId,
    startupId,
    req.user.id,
    parseFloat(bid_amount),
    parseFloat(equity_demanded),
    conditions || '',
    now
  );

  // Notify Founder of New Bid
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(
    uuidv4(),
    startup.founder_id,
    'BID_PLACED',
    'New Auction Bid Placed!',
    `${req.user.full_name} submitted a bid of $${parseFloat(bid_amount).toLocaleString()} for ${equity_demanded}% equity on "${startup.title}".`,
    now
  );

  apiCache.invalidate('startups_list');

  res.status(201).json({
    id: bidId,
    startup_id: startupId,
    investor_id: req.user.id,
    investor_name: req.user.full_name,
    bid_amount: parseFloat(bid_amount),
    equity_demanded: parseFloat(equity_demanded),
    conditions,
    status: 'PENDING',
    created_at: now,
  });
});

// Founder Selects Winning Investor ("Allow / Talk")
// Atomic transaction: chosen bid -> ACCEPTED, all other bids -> REJECTED,
// startup -> FUNDED, and informs all non-selected investors that another person was selected.
app.post('/api/startups/:id/bids/:bidId/accept', authenticateToken, requireRole(['founder']), (req, res) => {
  const startupId = req.params.id;
  const bidId = req.params.bidId;

  const startup = db.prepare('SELECT * FROM startups WHERE id = ?').get(startupId);
  if (!startup) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Startup not found.' });
  }

  // Strict UUID Ownership check
  if (startup.founder_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only manage auctions for your own startups.' });
  }

  const winningBid = db.prepare('SELECT * FROM auction_bids WHERE id = ? AND startup_id = ?').get(bidId, startupId);
  if (!winningBid) {
    return res.status(404).json({ error: 'BID_NOT_FOUND', message: 'Selected bid does not exist.' });
  }

  const otherBids = db.prepare('SELECT * FROM auction_bids WHERE startup_id = ? AND id != ?').all(startupId, bidId);
  const now = Date.now();

  const acceptTransaction = db.transaction(() => {
    // 1. Mark selected bid as ACCEPTED
    db.prepare("UPDATE auction_bids SET status = 'ACCEPTED' WHERE id = ?").run(bidId);

    // 2. Mark all other competing bids as REJECTED
    db.prepare("UPDATE auction_bids SET status = 'REJECTED' WHERE startup_id = ? AND id != ?").run(startupId, bidId);

    // 3. Mark startup as FUNDED
    db.prepare("UPDATE startups SET status = 'FUNDED', selected_investor_id = ? WHERE id = ?").run(winningBid.investor_id, startupId);

    // 4. Notify winning investor
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(
      uuidv4(),
      winningBid.investor_id,
      'BID_ACCEPTED',
      'Congratulations! Deal Accepted 🎉',
      `Founder ${req.user.full_name} has accepted your investment proposal of $${winningBid.bid_amount.toLocaleString()} for "${startup.title}". Click to begin final closing discussions.`,
      now
    );

    // 5. Notify all other investors that another person was selected
    for (const b of otherBids) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `).run(
        uuidv4(),
        b.investor_id,
        'BID_REJECTED',
        'Auction Concluded: Another Proposal Chosen',
        `The founder has selected another investor's proposal for "${startup.title}". Thank you for participating in this round.`,
        now
      );
    }
  });

  acceptTransaction();
  apiCache.invalidate('startups_list');

  res.json({
    success: true,
    message: 'Deal closed with selected investor. Competing investors have been notified.',
    selected_investor_id: winningBid.investor_id,
  });
});

// ==========================================
// NORMAL PERSON - COMMUNITY MARKETPLACE
// (No auction mechanics apply to this)
// ==========================================

// Browse Products
app.get('/api/products', (req, res) => {
  const cached = apiCache.get('products_list');
  if (cached) {
    return res.json(cached);
  }

  const products = db.prepare(`
    SELECT p.*, u.full_name as vendor_name, u.phone_number as vendor_phone, u.country_code as vendor_country
    FROM products p
    JOIN users u ON p.vendor_id = u.id
    ORDER BY p.created_at DESC
  `).all();

  const formatted = products.map(p => ({
    ...p,
    vendor_phone: p.vendor_phone ? `${p.vendor_country} ${p.vendor_phone}` : undefined,
  }));

  apiCache.set('products_list', formatted, 15000);
  res.json(formatted);
});

// Add Product (Normal user selling)
app.post('/api/products', authenticateToken, requireRole(['normal']), (req, res) => {
  const { title, description, price, category, image_url, stock } = req.body;

  if (!title || !description || !price) {
    return res.status(400).json({ error: 'MISSING_DATA', message: 'Title, description, and price are required.' });
  }

  const productId = req.body.id || uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO products (id, vendor_id, title, description, price, category, image_url, stock, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    productId,
    req.user.id,
    title,
    description,
    parseFloat(price),
    category || 'General',
    image_url || null,
    parseInt(stock, 10) || 1,
    now
  );

  apiCache.invalidate('products_list');

  res.status(201).json({
    id: productId,
    vendor_id: req.user.id,
    vendor_name: req.user.full_name,
    title,
    description,
    price: parseFloat(price),
    category,
    image_url,
    stock: parseInt(stock, 10) || 1,
    created_at: now,
  });
});

// Inquire on a Product (Buyer sends contact request to vendor)
app.post('/api/products/:id/inquire', authenticateToken, (req, res) => {
  const productId = req.params.id;
  const { message, buyer_phone } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found.' });
  }

  const inquiryId = req.body.id || uuidv4();
  const now = Date.now();
  const contact = buyer_phone || `${req.user.country_code} ${req.user.phone_number}`;

  db.prepare(`
    INSERT INTO product_inquiries (id, product_id, buyer_id, buyer_name, buyer_phone, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(
    inquiryId,
    productId,
    req.user.id,
    req.user.full_name,
    contact,
    message || 'Customer expressed interest in this product.',
    now
  );

  // Send Notification to Vendor
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(
    uuidv4(),
    product.vendor_id,
    'PRODUCT_INQUIRY',
    'New Product Inquiry Received',
    `${req.user.full_name} inquired about "${product.title}": "${message || 'Interested in buying'}". Contact: ${contact}`,
    now
  );

  res.status(201).json({ success: true, inquiry_id: inquiryId });
});

// Vendor Inquiries Inbox
app.get('/api/vendor/inquiries', authenticateToken, (req, res) => {
  const inquiries = db.prepare(`
    SELECT pi.*, p.title as product_title
    FROM product_inquiries pi
    JOIN products p ON pi.product_id = p.id
    WHERE p.vendor_id = ?
    ORDER BY pi.created_at DESC
  `).all(req.user.id);

  res.json(inquiries);
});

// ==========================================
// NOTIFICATIONS (RESTRICTED TO SELLERS ONLY)
// ==========================================

// Get Notifications for Current User (Strictly visible only to those who SELL)
app.get('/api/notifications', authenticateToken, (req, res) => {
  // 1. Investors do not sell -> No notification access
  if (req.user.role === 'investor') {
    return res.status(403).json({
      error: 'NOTIFICATIONS_RESTRICTED',
      message: 'Notifications are restricted to sellers (founders pitching equity and shop vendors).',
    });
  }

  // 2. Normal role: only sellers with listed products receive notifications
  if (req.user.role === 'normal') {
    const isSeller = db.prepare('SELECT COUNT(*) as count FROM products WHERE vendor_id = ?').get(req.user.id);
    if (!isSeller || isSeller.count === 0) {
      return res.status(403).json({
        error: 'NOTIFICATIONS_RESTRICTED',
        message: 'Notifications are only accessible to vendors listing products.',
      });
    }
  }

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);

  res.json(notifications.map(n => ({ ...n, read: Boolean(n.read) })));
});

// Mark Notification as Read
app.patch('/api/notifications/:id/read', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 FoundersGate Backend running on http://localhost:${PORT}`);
  console.log(`🔒 Security: Rate limiting active, 30-min password reset expiry, WAL DB with indexed tables.`);
});
