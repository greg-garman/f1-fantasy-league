import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, executeReturning } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { User } from '../types/index.js';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, displayName, password, inviteCode } = req.body;

  if (!username || !displayName || !password || !inviteCode) {
    res.status(400).json({ error: 'All fields required' });
    return;
  }

  const storedCode = await queryOne<{ value: string }>("SELECT value FROM league_settings WHERE key = 'invite_code'");
  if (!storedCode || storedCode.value !== inviteCode) {
    res.status(403).json({ error: 'Invalid invite code' });
    return;
  }

  const existing = await queryOne<{ id: number }>('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const userCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userCount!.count >= 9) {
    res.status(403).json({ error: 'League is full (max 9 players)' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const isAdmin = userCount!.count === 0 ? 1 : 0;

  const inserted = await executeReturning<{ id: number }>(
    'INSERT INTO users (username, display_name, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id',
    [username, displayName, passwordHash, isAdmin]
  );

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await execute('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [sessionId, inserted.id, expiresAt]);

  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: inserted.id,
      username,
      display_name: displayName,
      is_admin: isAdmin,
      budget: 100.0,
    },
  });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = await queryOne<User>('SELECT * FROM users WHERE username = $1', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await execute('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [sessionId, user.id, expiresAt]);

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

router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  await execute('DELETE FROM sessions WHERE id = $1', [req.sessionId]);
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
