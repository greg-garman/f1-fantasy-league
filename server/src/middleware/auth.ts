import { Request, Response, NextFunction } from 'express';
import db from '../db/connection.js';
import { Session, User } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const session = db.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime(\'now\')'
  ).get(sessionId) as Session | undefined;

  if (!session) {
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as User | undefined;
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.user = user;
  req.sessionId = sessionId;
  next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
