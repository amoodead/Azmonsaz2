import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser, verifyLocalAuthToken } from '../db/users.ts';

export interface AuthPrincipal {
  uid: string;
  email: string;
  provider: 'firebase' | 'local';
}

export interface AuthRequest extends Request {
  authUser?: AuthPrincipal;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' });
  }

  const token = authHeader.slice(7).trim();

  // First try Firebase ID token (for Google Sign-In sessions)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@azmona.local`;
    await getOrCreateUser(decoded.uid, email);
    req.authUser = {
      uid: decoded.uid,
      email,
      provider: 'firebase',
    };
    return next();
  } catch {
    // Not a Firebase ID token; verify signed PostgreSQL session token
  }

  const localUser = verifyLocalAuthToken(token);
  if (localUser) {
    req.authUser = {
      uid: localUser.uid,
      email: localUser.email,
      provider: 'local',
    };
    return next();
  }

  return res.status(401).json({ error: 'نشست کاربری معتبر نیست یا منقضی شده است.' });
};
