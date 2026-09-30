import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let dbInstance: Database | null = null;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'factorypass.sqlite');

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'factory_salt_2026').digest('hex');
}

export function saveDatabase() {
  if (!dbInstance) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch {
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Schema creation
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gates (
      id TEXT PRIMARY KEY,
      gate_name TEXT NOT NULL,
      gate_code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      company TEXT,
      designation TEXT,
      photo TEXT,
      id_type TEXT,
      id_number TEXT,
      address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitor_passes (
      id TEXT PRIMARY KEY,
      pass_number TEXT UNIQUE NOT NULL,
      visitor_id TEXT NOT NULL,
      host_name TEXT NOT NULL,
      host_department TEXT,
      purpose TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      expected_arrival TEXT,
      expected_departure TEXT,
      number_of_visitors INTEGER DEFAULT 1,
      vehicle_type TEXT DEFAULT 'NONE',
      vehicle_number TEXT,
      remarks TEXT,
      qr_token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      cancel_reason TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT,
      FOREIGN KEY (visitor_id) REFERENCES visitors(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS entry_exit_logs (
      id TEXT PRIMARY KEY,
      visitor_pass_id TEXT NOT NULL,
      action TEXT NOT NULL,
      gate_id TEXT NOT NULL,
      security_user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      device_information TEXT,
      remarks TEXT,
      duration_minutes INTEGER,
      FOREIGN KEY (visitor_pass_id) REFERENCES visitor_passes(id),
      FOREIGN KEY (gate_id) REFERENCES gates(id),
      FOREIGN KEY (security_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  return dbInstance;
}

export function queryAll(sql: string, params: any[] = []): any[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  saveDatabase();
}
