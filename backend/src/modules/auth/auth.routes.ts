import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { CONFIG } from '../../config/index.js';
import { verifyTelegramAuth, generateRandomString } from '../../utils/crypto.js';
import { UnauthorizedError, BadRequestError } from '../../utils/errors.js';
import { Provider } from '@prisma/client';

// Schemas
const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

const oauthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

// const providerSchema = z.enum(['google', 'github', 'twitter', 'telegram']);

export default async function authRoutes(server: FastifyInstance) {
  // Get available providers
  server.get('/providers', async () => {
    const providers = [];
    
    if (CONFIG.telegram.botToken) {
      providers.push({ id: 'telegram', name: 'Telegram', primary: true });
    }
    if (CONFIG.oauth.google.clientId) {
      providers.push({ id: 'google', name: 'Google', primary: false });
    }
    if (CONFIG.oauth.github.clientId) {
      providers.push({ id: 'github', name: 'GitHub', primary: false });
    }
    if (CONFIG.oauth.twitter.clientId) {
      providers.push({ id: 'twitter', name: 'X (Twitter)', primary: false });
    }

    return { success: true, data: providers };
  });

  // Telegram authentication
  server.post('/telegram', async (request: FastifyRequest, _reply: FastifyReply) => {
    const body = telegramAuthSchema.parse(request.body);

    if (!CONFIG.telegram.botToken) {
      throw new BadRequestError('Telegram authentication is not configured');
    }

    // Verify Telegram auth data
    const authData: Record<string, string> = {
      id: body.id.toString(),
      first_name: body.first_name,
      auth_date: body.auth_date.toString(),
      hash: body.hash,
    };

    if (body.last_name) authData.last_name = body.last_name;
    if (body.username) authData.username = body.username;
    if (body.photo_url) authData.photo_url = body.photo_url;

    const isValid = verifyTelegramAuth(authData, CONFIG.telegram.botToken);

    if (!isValid) {
      throw new UnauthorizedError('Invalid Telegram authentication');
    }

    // Check auth_date is not too old (24 hours)
    const authDate = new Date(body.auth_date * 1000);
    const now = new Date();
    const diff = now.getTime() - authDate.getTime();
    if (diff > 24 * 60 * 60 * 1000) {
      throw new UnauthorizedError('Telegram authentication expired');
    }

    // Find or create user
    const name = body.last_name 
      ? `${body.first_name} ${body.last_name}` 
      : body.first_name;

    const user = await prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: Provider.TELEGRAM,
          providerId: body.id.toString(),
        },
      },
      create: {
        name,
        avatar: body.photo_url,
        provider: Provider.TELEGRAM,
        providerId: body.id.toString(),
      },
      update: {
        name,
        avatar: body.photo_url,
      },
    });

    // Check if user is banned
    if (user.isBanned) {
      if (user.bannedUntil && new Date() > user.bannedUntil) {
        // Unban user
        await prisma.user.update({
          where: { id: user.id },
          data: { isBanned: false, bannedUntil: null, banReason: null },
        });
      } else {
        throw new UnauthorizedError(
          user.banReason || 'Your account has been suspended'
        );
      }
    }

    // Generate JWT token
    const token = server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider,
    });

    // Create session
    const sessionToken = generateRandomString(64);
    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          locale: user.locale,
        },
      },
    };
  });

  // Google OAuth - Get authorization URL
  server.get('/google', async (_request: FastifyRequest) => {
    if (!CONFIG.oauth.google.clientId) {
      throw new BadRequestError('Google authentication is not configured');
    }

    const state = generateRandomString(32);
    
    const params = new URLSearchParams({
      client_id: CONFIG.oauth.google.clientId,
      redirect_uri: CONFIG.oauth.google.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    return { success: true, data: { url, state } };
  });

  // Google OAuth callback
  server.post('/google/callback', async (request: FastifyRequest) => {
    const { code } = oauthCallbackSchema.parse(request.body);

    if (!CONFIG.oauth.google.clientId || !CONFIG.oauth.google.clientSecret) {
      throw new BadRequestError('Google authentication is not configured');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CONFIG.oauth.google.clientId,
        client_secret: CONFIG.oauth.google.clientSecret,
        redirect_uri: CONFIG.oauth.google.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as { access_token?: string; error?: string };

    if (!tokens.access_token) {
      throw new UnauthorizedError('Failed to authenticate with Google');
    }

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json() as {
      id: string;
      name: string;
      email?: string;
      picture?: string;
    };

    // Find or create user
    const user = await prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: Provider.GOOGLE,
          providerId: userInfo.id,
        },
      },
      create: {
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.picture,
        provider: Provider.GOOGLE,
        providerId: userInfo.id,
      },
      update: {
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.picture,
      },
    });

    // Generate JWT
    const token = server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider,
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          locale: user.locale,
        },
      },
    };
  });

  // GitHub OAuth - Get authorization URL
  server.get('/github', async (_request: FastifyRequest) => {
    if (!CONFIG.oauth.github.clientId) {
      throw new BadRequestError('GitHub authentication is not configured');
    }

    const state = generateRandomString(32);
    
    const params = new URLSearchParams({
      client_id: CONFIG.oauth.github.clientId,
      redirect_uri: CONFIG.oauth.github.callbackUrl,
      scope: 'read:user user:email',
      state,
    });

    const url = `https://github.com/login/oauth/authorize?${params}`;

    return { success: true, data: { url, state } };
  });

  // GitHub OAuth callback
  server.post('/github/callback', async (request: FastifyRequest) => {
    const { code } = oauthCallbackSchema.parse(request.body);

    if (!CONFIG.oauth.github.clientId || !CONFIG.oauth.github.clientSecret) {
      throw new BadRequestError('GitHub authentication is not configured');
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: CONFIG.oauth.github.clientId,
        client_secret: CONFIG.oauth.github.clientSecret,
        code,
      }),
    });

    const tokens = await tokenResponse.json() as { access_token?: string; error?: string };

    if (!tokens.access_token) {
      throw new UnauthorizedError('Failed to authenticate with GitHub');
    }

    // Get user info
    const userInfoResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json() as {
      id: number;
      login: string;
      name?: string;
      email?: string;
      avatar_url?: string;
    };

    // Find or create user
    const user = await prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: Provider.GITHUB,
          providerId: userInfo.id.toString(),
        },
      },
      create: {
        name: userInfo.name || userInfo.login,
        email: userInfo.email,
        avatar: userInfo.avatar_url,
        provider: Provider.GITHUB,
        providerId: userInfo.id.toString(),
      },
      update: {
        name: userInfo.name || userInfo.login,
        email: userInfo.email,
        avatar: userInfo.avatar_url,
      },
    });

    // Generate JWT
    const token = server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider,
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          locale: user.locale,
        },
      },
    };
  });

  // Twitter/X OAuth - Get authorization URL
  server.get('/twitter', async (_request: FastifyRequest) => {
    if (!CONFIG.oauth.twitter.clientId) {
      throw new BadRequestError('Twitter authentication is not configured');
    }

    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    
    // Store code verifier in Redis for later use
    const { cache } = await import('../../plugins/redis.js');
    await cache.set(`twitter_verifier:${state}`, codeVerifier, 600); // 10 minutes

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CONFIG.oauth.twitter.clientId,
      redirect_uri: CONFIG.oauth.twitter.callbackUrl,
      scope: 'users.read tweet.read',
      state,
      code_challenge: codeVerifier,
      code_challenge_method: 'plain',
    });

    const url = `https://twitter.com/i/oauth2/authorize?${params}`;

    return { success: true, data: { url, state } };
  });

  // Twitter/X OAuth callback
  server.post('/twitter/callback', async (request: FastifyRequest) => {
    const { code, state } = oauthCallbackSchema.parse(request.body);

    if (!CONFIG.oauth.twitter.clientId || !CONFIG.oauth.twitter.clientSecret) {
      throw new BadRequestError('Twitter authentication is not configured');
    }

    // Get code verifier from Redis
    const { cache } = await import('../../plugins/redis.js');
    const codeVerifier = await cache.get<string>(`twitter_verifier:${state}`);

    if (!codeVerifier) {
      throw new UnauthorizedError('Invalid or expired state');
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${CONFIG.oauth.twitter.clientId}:${CONFIG.oauth.twitter.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: CONFIG.oauth.twitter.callbackUrl,
        code_verifier: codeVerifier,
      }),
    });

    const tokens = await tokenResponse.json() as { access_token?: string; error?: string };

    if (!tokens.access_token) {
      throw new UnauthorizedError('Failed to authenticate with Twitter');
    }

    // Get user info
    const userInfoResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const { data: userInfo } = await userInfoResponse.json() as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
      };
    };

    // Find or create user
    const user = await prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: Provider.TWITTER,
          providerId: userInfo.id,
        },
      },
      create: {
        name: userInfo.name,
        avatar: userInfo.profile_image_url,
        provider: Provider.TWITTER,
        providerId: userInfo.id,
      },
      update: {
        name: userInfo.name,
        avatar: userInfo.profile_image_url,
      },
    });

    // Generate JWT
    const token = server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider,
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          locale: user.locale,
        },
      },
    };
  });

  // Get current user
  server.get('/me', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest) => {
    const payload = request.user as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        locale: true,
        createdAt: true,
        totalTimeSpent: true,
        ticketsCreated: true,
        ticketsResolved: true,
        peopleHelped: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return { success: true, data: user };
  });

  // Logout
  server.post('/logout', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest) => {
    const payload = request.user as { id: string };

    // Delete all sessions for user
    await prisma.session.deleteMany({
      where: { userId: payload.id },
    });

    return { success: true, message: 'Logged out successfully' };
  });
}

// Extend Fastify with authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
