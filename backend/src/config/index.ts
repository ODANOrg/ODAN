import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string(),

  // ElasticSearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().default('9000'),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('odan-uploads'),
  MINIO_USE_SSL: z.string().default('false'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // URLs
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),

  // OAuth - Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // OAuth - GitHub
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // OAuth - Twitter
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach((err) => {
      console.error(`   ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export const CONFIG = {
  server: {
    env: config.NODE_ENV,
    port: parseInt(config.PORT, 10),
    host: config.HOST,
    isDev: config.NODE_ENV === 'development',
    isProd: config.NODE_ENV === 'production',
  },

  database: {
    url: config.DATABASE_URL,
  },

  redis: {
    url: config.REDIS_URL,
  },

  elasticsearch: {
    url: config.ELASTICSEARCH_URL,
  },

  minio: {
    endpoint: config.MINIO_ENDPOINT,
    port: parseInt(config.MINIO_PORT, 10),
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY,
    bucket: config.MINIO_BUCKET,
    useSSL: config.MINIO_USE_SSL === 'true',
  },

  jwt: {
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
  },

  urls: {
    frontend: config.FRONTEND_URL,
    aiService: config.AI_SERVICE_URL,
  },

  oauth: {
    google: {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackUrl: `${config.FRONTEND_URL}/api/auth/callback/google`,
    },
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
      callbackUrl: `${config.FRONTEND_URL}/api/auth/callback/github`,
    },
    twitter: {
      clientId: config.TWITTER_CLIENT_ID,
      clientSecret: config.TWITTER_CLIENT_SECRET,
      callbackUrl: `${config.FRONTEND_URL}/api/auth/callback/twitter`,
    },
  },

  telegram: {
    botToken: config.TELEGRAM_BOT_TOKEN,
  },

  blockchain: {
    dataPath: process.env.BLOCKCHAIN_DATA_PATH || './data/blockchain',
  },
} as const;

export type Config = typeof CONFIG;
