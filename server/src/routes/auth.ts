import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { User } from '../types/index.js';

const router = Router();

router.post('/register', (req: Request, res: Response): void => {
  const { username, displayName, password, inviteCode } = req.body;

  if (!username || !displayName || !password || !inviteCode) {
    res.status(400).json({ error: 'All fields required' });
    return;
  }

  const storedCode = db.prepare("SELECT value FROM league_settings WHERE key = 'invite_code'").get() as { value: string } | undefined;
  if (!storedCode || storedCode.value !== inviteCode) {
    res.status(403).json({ error: 'Invalid invite code' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count >= 9) {
    res.status(403).json({ error: 'League is full (max 9 players)' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const isAdmin = userCount.count === 0 ? 1 : 0;

  const result = db.prepare(
    'INSERT INTO users (username, display_name, password_hash, is_admin) VALUES (?, ?, ?, ?)'
  ).run(username, displayName, passwordHash, isAdmin);

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, result.lastInsertRowid, expiresAt);

  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: result.lastInsertRowid,
      username,
      display_name: displayName,
      is_admin: isAdmin,
      budget: 100.0,
    },
  });
});

router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);

  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      is_admin: user.is_admin,
      budget: user.budget,
    },
  });
});

router.post('/logout', authMiddleware, (req: Request, res: Response): void => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  res.clearCookie('session_id');
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req: Request, res: Response): void => {
  const user = req.user!;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      is_admin: user.is_admin,
      budget: user.budget,
    },
  });
});

export default router;
