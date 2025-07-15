import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
  id: string;
  filename: string;
  executed_at?: string;
}

class MigrationRunner {
  private readonly db: Database.Database;
  private readonly migrationsPath: string;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.migrationsPath = path.join(__dirname, 'migrations');
    this.initMigrationsTable();
  }

  private initMigrationsTable() {
    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        executed_at INTEGER NOT NULL
      )
    `);
  }

  private getExecutedMigrations(): string[] {
    const result = this.db.prepare('SELECT id FROM migrations ORDER BY id').all() as Migration[];
    return result.map(row => row.id);
  }

  private getAllMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsPath)) {
      console.log('No migrations directory found');
      return [];
    }

    return fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));
  }

  private extractMigrationId(filename: string): string {
    // Extract migration ID from filename (e.g., '001_add_metadata_to_budgets.sql' -> '001')
    const regex = /^(\d+)_/;
    const match = regex.exec(filename);
    return match ? match[1] : filename;
  }

  private executeMigration(filename: string): boolean {
    try {
      const migrationPath = path.join(this.migrationsPath, filename);
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      
      // Skip comment lines and empty lines
      const statements = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
        .join('\n');

      if (statements.trim()) {
        console.log(`Executing migration: ${filename}`);
        this.db.exec(statements);
        
        // Record migration execution
        const migrationId = this.extractMigrationId(filename);
        const now = Math.floor(Date.now() / 1000);
        
        this.db.prepare('INSERT INTO migrations (id, filename, executed_at) VALUES (?, ?, ?)')
          .run(migrationId, filename, now);
        
        console.log(`✅ Migration ${filename} executed successfully`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Error executing migration ${filename}:`, error);
      throw error;
    }
  }

  public async runMigrations(): Promise<void> {
    console.log('🚀 Starting database migrations...');
    
    const executedMigrations = this.getExecutedMigrations();
    const allMigrations = this.getAllMigrationFiles();
    
    const pendingMigrations = allMigrations.filter(filename => {
      const migrationId = this.extractMigrationId(filename);
      return !executedMigrations.includes(migrationId);
    });

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(migration => console.log(`  - ${migration}`));

    let executedCount = 0;
    for (const migration of pendingMigrations) {
      if (this.executeMigration(migration)) {
        executedCount++;
      }
    }

    console.log(`🎉 Successfully executed ${executedCount} migration(s)`);
  }

  public async rollback(steps: number = 1): Promise<void> {
    console.log(`🔄 Rolling back ${steps} migration(s)...`);
    
    const executedMigrations = this.db.prepare(
      'SELECT * FROM migrations ORDER BY id DESC LIMIT ?'
    ).all(steps) as Migration[];

    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    // Note: This is a basic rollback - you'd need to create rollback SQL files
    // for more complex rollbacks
    console.log('⚠️  Rollback functionality requires manual intervention');
    console.log('Migrations to rollback:');
    executedMigrations.forEach(migration => {
      console.log(`  - ${migration.filename}`);
    });
  }

  public showStatus(): void {
    console.log('\n📊 Migration Status:');
    console.log('===================');
    
    const executedMigrations = this.db.prepare(
      'SELECT * FROM migrations ORDER BY id'
    ).all() as Migration[];
    
    const allMigrations = this.getAllMigrationFiles();
    
    console.log(`Total migrations: ${allMigrations.length}`);
    console.log(`Executed: ${executedMigrations.length}`);
    console.log(`Pending: ${allMigrations.length - executedMigrations.length}`);
    
    if (executedMigrations.length > 0) {
      console.log('\n✅ Executed migrations:');
      executedMigrations.forEach(migration => {
        const timestamp = Number(migration.executed_at) * 1000;
        const date = new Date(timestamp).toISOString();
        console.log(`  ${migration.id}: ${migration.filename} (${date})`);
      });
    }
    
    const pendingMigrations = allMigrations.filter(filename => {
      const migrationId = this.extractMigrationId(filename);
      return !executedMigrations.some(exec => exec.id === migrationId);
    });
    
    if (pendingMigrations.length > 0) {
      console.log('\n⏳ Pending migrations:');
      pendingMigrations.forEach(migration => {
        console.log(`  ${this.extractMigrationId(migration)}: ${migration}`);
      });
    }
  }

  public close(): void {
    this.db.close();
  }
}

export default MigrationRunner;
