import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser, isOwnerEmail, isOwnerPrincipal, verifyLocalAuthToken } from '../db/users.ts';

export interface AuthPrincipal {
  uid: string;
  email: string;
  provider: 'firebase' | 'local';
  isOwner: boolean;
}

export interface AuthRequest extends Request {
  authUser?: AuthPrincipal;
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    if (key === name) {
      const val = pair.slice(eqIdx + 1).trim();
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}

export async function resolveAuthPrincipal(req: Request): Promise<AuthPrincipal | null> {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = readCookie(req.headers.cookie, 'azmoona_session') || '';
  const token = bearerToken || cookieToken;

  if (!token) return null;

  // First try Firebase ID token (for Google Sign-In sessions)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@azmona.local`;
    await getOrCreateUser(decoded.uid, email);
    return {
      uid: decoded.uid,
      email,
      provider: 'firebase',
      isOwner: isOwnerEmail(email),
    };
  } catch {
    // Not a Firebase ID token; verify signed PostgreSQL session token
  }

  const localUser = verifyLocalAuthToken(token);
  if (localUser) {
    return {
      uid: localUser.uid,
      email: localUser.email,
      provider: 'local',
      isOwner: isOwnerEmail(localUser.email),
    };
  }

  return null;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const principal = await resolveAuthPrincipal(req);
  if (!principal) {
    return res.status(401).json({ error: 'نشست کاربری معتبر نیست یا منقضی شده است.' });
  }
  req.authUser = principal;
  return next();
};

export const requireOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const principal = await resolveAuthPrincipal(req);
  if (!principal) {
    return res.status(401).json({ error: 'لطفاً ابتدا با حساب مالک وارد شوید.' });
  }
  const verifiedOwner = await isOwnerPrincipal(principal.uid, principal.email);
  if (!verifiedOwner) {
    return res.status(403).json({
      error: 'دسترسی غیرمجاز: فقط حساب مالک سایت مجاز به دسترسی به دیتابیس است.',
    });
  }
  req.authUser = { ...principal, isOwner: true };
  return next();
};
