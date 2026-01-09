import { APIServer } from './api/server';
import { logger } from './utils/logger';
import { runMigrations } from './database/migrations/run';

async function main() {
  try {
    logger.info('Starting Arbitrage Sensei Backend...');

    // Run database migrations
    logger.info('Running database migrations...');
    await runMigrations();

    // Start API server
    const server = new APIServer();
    await server.start();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();

