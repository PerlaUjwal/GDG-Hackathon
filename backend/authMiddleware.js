import jwt from 'jsonwebtoken';
import db from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'foundersgate-super-secret-key-2026';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication token required' });
  }

  // 1. Support mock tokens (mock-token-*)
  if (token.startsWith('mock-token-')) {
    const rawId = token.replace(/^mock-token-/, '');

    // Check if user exists by exact ID or email
    let user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE id = ? OR email = ?').get(rawId, rawId);

    // Map known demo IDs if not directly found
    if (!user) {
      if (rawId.includes('founder') || rawId === 'alex-founder' || rawId.startsWith('f1111111')) {
        user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE role = "founder"').get();
      } else if (rawId.includes('investor') || rawId.startsWith('i1111111')) {
        user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE role = "investor"').get();
      } else if (rawId.includes('normal') || rawId.includes('shop') || rawId.startsWith('n1111111') || rawId.startsWith('n2222222')) {
        user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE role = "normal"').get();
      }
    }

    // If user is from a fresh session or Firebase UID that hasn't been saved to DB yet, auto-create in DB so foreign keys / JOINs never fail
    if (!user) {
      const fallbackRole = req.body?.role || (req.baseUrl?.includes('startups') || req.path?.includes('startups') ? 'founder' : req.path?.includes('products') ? 'normal' : 'founder');
      const fallbackName = req.body?.founder_name || req.body?.vendor_name || 'FoundersGate User';
      const fallbackEmail = `${rawId}@foundersgate.app`;
      const now = Date.now();
      try {
        db.prepare(`
          INSERT INTO users (id, email, password_hash, full_name, role, country_code, phone_number, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(rawId, fallbackEmail, 'hashed', fallbackName, fallbackRole, '+1', '5550100', now);
        user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE id = ?').get(rawId);
      } catch {
        user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE id = ?').get(rawId);
      }
    }

    if (user) {
      req.user = user;
      return next();
    }
  }

  // 2. Standard JWT verification
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // Check if token itself is a known user ID (UUID)
      let user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE id = ?').get(token);
      if (user) {
        req.user = user;
        return next();
      }
      return res.status(403).json({ error: 'INVALID_TOKEN', message: 'Token is invalid or expired' });
    }

    // Verify user still exists in database
    const user = db.prepare('SELECT id, email, role, full_name, country_code, phone_number FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(403).json({ error: 'USER_NOT_FOUND', message: 'User account no longer exists' });
    }

    req.user = user;
    next();
  });
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN_ROLE',
        message: `Action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
}
