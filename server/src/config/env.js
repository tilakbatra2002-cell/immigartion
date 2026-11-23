import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // Dedicated key for AES-256-GCM field encryption (passport numbers, ID data).
  // Kept separate from the JWT secret so rotating signing keys never orphans PII.
  DATA_ENCRYPTION_KEY: z.string().min(32, 'DATA_ENCRYPTION_KEY must be at least 32 characters').optional(),
  ACCESS_TOKEN_TTL: z.coerce.number().default(900), // 15 minutes
  REFRESH_TOKEN_DAYS: z.coerce.number().default(7),
  COOKIE_DOMAIN: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('1'),

  // Storage: local | s3 (S3-compatible: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO)
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().default('true'),

  // SMTP (optional — email is skipped and queued as FAILED/UNCONFIGURED if absent)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('ImmigrationFlow <no-reply@immigrationflow.app>'),

  // WhatsApp Cloud API (optional)
  WHATSAPP_PROVIDER: z.enum(['meta', 'none']).default('none'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),

  // AI (optional, OpenAI-compatible)
  AI_ENABLED: z.string().default('auto'),
  AI_PROVIDER: z.string().default('openai'),
  AI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_MAX_INPUT_CHARS: z.coerce.number().default(12000),

  // Payments (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional(),
  STRIPE_PRICE_BUSINESS: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_STARTER: z.string().optional(),
  RAZORPAY_PLAN_PROFESSIONAL: z.string().optional(),
  RAZORPAY_PLAN_BUSINESS: z.string().optional(),
  BILLING_CURRENCY: z.string().default('INR'),

  // Socket.IO
  SOCKET_CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_WINDOW_MIN: z.coerce.number().default(15),
  RATE_LIMIT_MAX: z.coerce.number().default(600),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(12),
  REQUIRE_EMAIL_VERIFICATION: z.string().default('false'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n[ImmigrationFlow] Invalid environment configuration:\n${issues}\n\nCopy server/.env.example to server/.env and fill the required values.\n`);
  process.exit(1);
}

const env = parsed.data;

// Production hard-stop: refuse weak secrets.
if (isProd) {
  const weak = ['dev-access-secret-change-me-000000000000', 'dev-refresh-secret-change-me-00000000000'];
  if (weak.includes(env.JWT_ACCESS_SECRET) || weak.includes(env.JWT_REFRESH_SECRET)) {
    // eslint-disable-next-line no-console
    console.error('[ImmigrationFlow] Refusing to start in production with development JWT secrets. Generate strong values (e.g. `openssl rand -hex 32`).');
    process.exit(1);
  }
  if (env.STORAGE_DRIVER === 's3' && (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
    // eslint-disable-next-line no-console
    console.error('[ImmigrationFlow] STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
    process.exit(1);
  }
}

export const flags = {
  smtp: Boolean(env.SMTP_HOST && env.SMTP_PORT),
  whatsapp: env.WHATSAPP_PROVIDER === 'meta' && Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN),
  ai: env.AI_ENABLED !== 'false' && Boolean(env.AI_API_KEY),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  s3: env.STORAGE_DRIVER === 's3',
};

export default env;
