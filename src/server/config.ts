import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface Config {
  pg: {
    user: string;
    password: string;
    host: string;
    port: number;
    database: string;
    max: number;
  };
  hcaptcha: {
    enabled: boolean;
    sitekey: string;
    secret: string;
  };
  backendSecret: string;
  port: number;
  logLevel: string;
}

const config: Config = {
  pg: {
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DB || 'postgres',
    max: 16,
  },
  hcaptcha: {
    enabled: !!(process.env.HCAPTCHA_SECRET && process.env.HCAPTCHA_SECRET.length > 0),
    sitekey: process.env.HCAPTCHA_SITEKEY || '',
    secret: process.env.HCAPTCHA_SECRET || '',
  },
  backendSecret: process.env.BACKEND_SECRET || '',
  port: parseInt(process.env.PORT || '4000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
