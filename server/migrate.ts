#!/usr/bin/env node

import path from 'path';
import MigrationRunner from './migration-runner.js';

const DB_PATH = path.join(process.cwd(), 'database.db');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  const migrationRunner = new MigrationRunner(DB_PATH);

  try {
    switch (command) {
      case 'run':
      case 'migrate':
        await migrationRunner.runMigrations();
        break;
        
      case 'status':
        migrationRunner.showStatus();
        break;
        
      case 'rollback': {
        const steps = parseInt(args[1]) || 1;
        await migrationRunner.rollback(steps);
        break;
      }
        
      case 'help':
      case '--help':
      case '-h':
        console.log(`
🗃️  Database Migration Tool

Usage:
  npm run migrate [command] [options]

Commands:
  run, migrate    Run pending migrations (default)
  status          Show migration status
  rollback [n]    Rollback n migrations (default: 1)
  help            Show this help message

Examples:
  npm run migrate                 # Run all pending migrations
  npm run migrate status          # Show migration status
  npm run migrate rollback        # Rollback last migration
  npm run migrate rollback 3      # Rollback last 3 migrations
        `);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Use "npm run migrate help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    migrationRunner.close();
  }
}

main();
