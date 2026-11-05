import jwt from 'jsonwebtoken';
import db from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'foundersgate-super-secret-key-2026';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
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

