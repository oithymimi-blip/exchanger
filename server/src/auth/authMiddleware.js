import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import db from '../db.js';

const selectPermissionsStmt = db.prepare('SELECT permissions FROM admin_permissions WHERE user_id = ?');

function getPermissionsForUser(userId) {
  if (!Number.isInteger(userId)) return [];
  const row = selectPermissionsStmt.get(userId);
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.permissions || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdminRole(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role === 'admin') {
      return next();
    }
    if (req.user.role === 'subadmin') {
      if (!permission) {
        return next();
      }
      const perms = getPermissionsForUser(req.user.id);
      if (perms.includes('all') || perms.includes(permission)) {
        return next();
      }
      return res.status(403).json({ error: 'Permission denied' });
    }
    return res.status(403).json({ error: 'Forbidden' });
  };
}

export function requireAdmin(req, res, next) {
  return requireAdminRole()(req, res, next);
}
