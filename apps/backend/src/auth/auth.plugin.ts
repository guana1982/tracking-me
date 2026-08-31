import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import oauth2 from '@fastify/oauth2';
import { FastifyInstance } from 'fastify';

async function authPlugin(fastify: FastifyInstance) {
  // Register cookie support (needed for OAuth state)
  await fastify.register(cookie, {
    secret: process.env.JWT_SECRET || 'fallback-cookie-secret',
  });

  // Register JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production',
    sign: {
      expiresIn: '7d', // Token expires in 7 days
    },
  });

  // Register Google OAuth2
  await fastify.register(oauth2, {
    name: 'googleOAuth2',
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID || '',
        secret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    scope: ['profile', 'email'],
    startRedirectPath: '/auth/google',
    callbackUri: `${process.env.BACKEND_URL || 'http://localhost:3001'}/auth/google/callback`,
  });

  // Decorate request with authUser (will be set by middleware)
  fastify.decorateRequest('authUser', null);
}

export default fp(authPlugin, {
  name: 'auth-plugin',
});
