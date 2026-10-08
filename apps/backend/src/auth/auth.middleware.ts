import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/error-handler.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

/**
 * Middleware that requires authentication
 * Extracts and verifies JWT from Authorization header
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Token non fornito', 401, 'UNAUTHORIZED');
    }

    // Verify JWT and extract payload
    const decoded = await request.jwtVerify<AuthUser>();
    request.authUser = decoded;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('Token non valido o scaduto', 401, 'UNAUTHORIZED');
  }
}

/**
 * Optional auth middleware - sets user if token present, doesn't fail if missing
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await request.jwtVerify<AuthUser>();
      request.authUser = decoded;
    } catch {
      // Ignore invalid tokens for optional auth
      request.authUser = null;
    }
  } else {
    request.authUser = null;
  }
}
