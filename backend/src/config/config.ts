import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

export interface Config {
  // Opinion.trade
  opinion: {
    wsUrl: string;
    apiUrl: string;
    apiKey: string;
    privateKey: string;
  };
  // Polymarket
  polymarket: {
    wsUrl: string;
    apiUrl: string;
    apiKey: string;
    privateKey: string;
  };
  // Database
  database: {
    url: string;
  };
  // Arbitrage settings
  arbitrage: {
    threshold: number;
    minLiquidity: number;
    autoExecute: boolean;
    maxPositionSize: number;
  };
  // Server
  server: {
    port: number;
    env: string;
  };
  // Logging
  logging: {
    level: string;
  };
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getOptionalNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

function getOptionalBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function loadConfig(): Config {
  try {
    const config: Config = {
      opinion: {
        wsUrl: getRequiredEnv('OPINION_WS_URL'),
        apiUrl: getRequiredEnv('OPINION_API_URL'),
        apiKey: getRequiredEnv('OPINION_API_KEY'),
        privateKey: getRequiredEnv('OPINION_PRIVATE_KEY'),
      },
      polymarket: {
        wsUrl: getRequiredEnv('POLYMARKET_WS_URL'),
        apiUrl: getRequiredEnv('POLYMARKET_API_URL'),
        apiKey: getRequiredEnv('POLYMARKET_API_KEY'),
        privateKey: getRequiredEnv('POLYMARKET_PRIVATE_KEY'),
      },
      database: {
        url: getRequiredEnv('DATABASE_URL'),
      },
      arbitrage: {
        threshold: getOptionalNumber('ARB_THRESHOLD', 0.98),
        minLiquidity: getOptionalNumber('MIN_LIQUIDITY', 1000),
        autoExecute: getOptionalBoolean('AUTO_EXECUTE', false),
        maxPositionSize: getOptionalNumber('MAX_POSITION_SIZE', 10000),
      },
      server: {
        port: getOptionalNumber('PORT', 3001),
        env: getOptionalEnv('NODE_ENV', 'development'),
      },
      logging: {
        level: getOptionalEnv('LOG_LEVEL', 'info'),
      },
    };

    logger.info('Configuration loaded successfully');
    return config;
  } catch (error) {
    logger.error('Failed to load configuration', { error });
    throw error;
  }
}

export const config = loadConfig();

