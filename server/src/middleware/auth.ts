import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/connection.js';
import { Session, User } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const session = await queryOne<Session>(
      'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [sessionId]
    );

    if (!session) {
      res.clearCookie('session_id');
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [session.user_id]);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
