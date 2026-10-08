import { FastifyPluginAsync } from 'fastify';
import { authService } from './auth.service.js';
import { authMiddleware, AuthUser } from './auth.middleware.js';
import { AppError } from '../lib/error-handler.js';

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Google OAuth callback
   * This is called by Google after user authenticates
   */
  fastify.get('/google/callback', async (request, reply) => {
    try {
      // Get access token from Google
      const { token } = await (fastify as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      // Fetch user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });

      if (!userInfoResponse.ok) {
        throw new AppError('Impossibile ottenere informazioni utente da Google', 500, 'GOOGLE_AUTH_ERROR');
      }

      const googleUser: GoogleUserInfo = await userInfoResponse.json();

      // Find or create user in our database
      const user = await authService.findOrCreateUser({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      });

      // Generate JWT token
      const jwtPayload: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      const jwtToken = fastify.jwt.sign(jwtPayload);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      reply.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(jwtToken)}`);
    } catch (error) {
      console.error('Google OAuth error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      reply.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  });

  /**
   * Get current authenticated user
   */
  fastify.get('/me', {
    preHandler: [authMiddleware],
    handler: async (request) => {
      const user = await authService.getUserById(request.authUser!.id);

      if (!user) {
        throw new AppError('Utente non trovato', 404, 'USER_NOT_FOUND');
      }

      return { success: true, data: user };
    },
  });

  /**
   * Refresh JWT token
   */
  fastify.post('/refresh', {
    preHandler: [authMiddleware],
    handler: async (request) => {
      // Generate new token with same payload
      const newToken = fastify.jwt.sign({
        id: request.authUser!.id,
        email: request.authUser!.email,
        name: request.authUser!.name,
      });

      return {
        success: true,
        data: { token: newToken },
      };
    },
  });

  /**
   * Logout (client-side token removal, server just confirms)
   */
  fastify.post('/logout', async () => {
    return {
      success: true,
      message: 'Logout effettuato',
    };
  });
};
