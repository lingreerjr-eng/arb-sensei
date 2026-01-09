import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from '../connection';
import { logger } from '../../utils/logger';

async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Read migration file
    const migrationPath = join(__dirname, '001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    logger.info('Running database migrations...');
    await client.query(migrationSQL);
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed', { error });
      process.exit(1);
    });
}

export { runMigrations };

