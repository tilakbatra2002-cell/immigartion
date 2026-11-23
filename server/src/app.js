import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import env from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { sanitizeInput, verifyOrigin, requestId } from './middleware/security.js';
import { corsOrigin } from './services/corsOrigins.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import clientRoutes from './routes/clients.js';
import caseRoutes from './routes/cases.js';
import documentRoutes from './routes/documents.js';
import fileRoutes from './routes/files.js';
import appointmentRoutes from './routes/appointments.js';
import taskRoutes from './routes/tasks.js';
import invoiceRoutes from './routes/invoices.js';
import communicationRoutes from './routes/communications.js';
import aiRoutes from './routes/ai.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import organizationRoutes from './routes/organization.js';
import billingRoutes from './routes/billing.js';
import notificationRoutes from './routes/notifications.js';
import portalRoutes from './routes/portal.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';

const app = express();

app.set('trust proxy', Number(env.TRUST_PROXY) || 1);
app.disable('x-powered-by');

// Stripe/Razorpay need the raw body for signature verification
app.use('/api/webhooks', webhookRoutes);

app.use(helmet({
  contentSecurityPolicy: false, // SPA is served by its own host; API returns JSON only
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
  maxAge: 86400,
}));

app.use(compression());
app.use(cookieParser());
app.use(requestId);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', apiLimiter);
app.use('/api', verifyOrigin);
app.use('/api', sanitizeInput);

// Health endpoint does not require auth
app.get('/api/health', (_req, res) => {
  const mongoose = globalThis.__mongoose;
  res.json({
    status: 'ok',
    service: 'immigrationflow-api',
    version: '1.0.0',
    time: new Date().toISOString(),
    db: mongoose?.connection?.readyState === 1 ? 'connected' : 'unknown',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
