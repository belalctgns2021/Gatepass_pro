import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { queryOne, hashPassword } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'factory_pass_super_secret_jwt_key_2026';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'SECURITY';
  status: string;
  assignedGateId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Simple signed token (header.payload.signature)
export function createToken(user: AuthUser): string {
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedGateId: user.assignedGateId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(base64Payload).digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: 'ACTIVE',
      assignedGateId: payload.assignedGateId,
    };
  } catch {
    return null;
  }
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required. No authorization header provided.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  // Check if user still exists and active in DB
  const dbUser = queryOne('SELECT id, name, email, role, status FROM users WHERE id = ?', [user.id]);
  if (!dbUser || dbUser.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'User account is inactive or no longer exists.' });
  }

  req.user = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role as any,
    status: dbUser.status,
    assignedGateId: user.assignedGateId,
  };
  next();
}

export function requireRoles(roles: Array<'ADMIN' | 'MANAGER' | 'RECEPTION' | 'SECURITY'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: [${roles.join(', ')}]. Current role: ${req.user.role}`,
      });
    }
    next();
  };
}
