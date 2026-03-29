import fs from 'fs';
import path from 'path';
import express from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import expressWinston from 'express-winston';
import winston from 'winston';

import config from './config';
import logger from './logger';
import * as db from './db';
import { GroupEventNotifier } from './notifier';
import { UpdateBatcher } from './update-batcher';
import { unauthedRouter, authedRouter, startOsrsNewsRefresher, startOsrsYtRefresher, startTwitchRefresher } from './routes';
import * as externalServices from './external-services';
import { startEventScheduler } from './event-scheduler';

const app = express();

// ── Logging ──
app.use(
  expressWinston.logger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    meta: false,
    msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}}',
    expressFormat: false,
    colorize: true,
    metaField: null as unknown as string,
  })
);

// ── Middleware ──
app.use(compression());
app.use(express.json({ limit: 100000 }));

// ── Rate limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const pageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// ── Shared state ──
const notifier = new GroupEventNotifier();
const batcher = new UpdateBatcher(notifier);
app.locals.notifier = notifier;
app.locals.batcher = batcher;

// ── CORS ──
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Accept, Content-Type, Content-Length');
  res.header('Access-Control-Max-Age', '3600');
  next();
});
app.options('*', pageLimiter, (_req, res) => res.sendStatus(204));

// ── API routes ──
app.use('/api/group/:group_name', authedRouter);
app.use('/api', unauthedRouter);

// ── Static frontend ──
function resolveSitePublicDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src', 'site', 'public'),
    path.resolve(process.cwd(), 'dist', 'site', 'public'),
    path.resolve(__dirname, '..', 'site', 'public'),
    path.resolve(__dirname, '..', '..', 'src', 'site', 'public'),
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error('Could not find built site assets in src/site/public or dist/site/public');
  }

  return resolved;
}

const sitePublicDir = resolveSitePublicDir();
app.use(express.static(sitePublicDir));

// SPA catch-all: serve index.html for any non-API, non-map-PNG route
app.get('*', pageLimiter, (req, res) => {
  if (req.path.includes('/map') && req.path.includes('.png')) {
    return res.sendStatus(404);
  }
  res.sendFile(path.join(sitePublicDir, 'index.html'));
});

// ── Startup ──
async function start(): Promise<void> {
  try {
    logger.info('Running database migrations...');
    await db.updateSchema();
    logger.info('Database migrations complete');
  } catch (err) {
    logger.error('Failed to run database migrations: ' + (err as Error).message);
    process.exit(1);
  }

  externalServices.startGeUpdater();
  externalServices.startSkillsAggregator();
  startEventScheduler();
  startOsrsNewsRefresher();
  startOsrsYtRefresher();
  startTwitchRefresher();

  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Unified server listening on http://0.0.0.0:${config.port}`);
  });
}

start();
