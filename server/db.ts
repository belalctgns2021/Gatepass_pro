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
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist database file:', err);
  }
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Could not read existing database file, creating fresh database:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Create tables
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
      requires_approval INTEGER DEFAULT 1,
      approved_by TEXT,
      approved_by_name TEXT,
      approved_at TEXT,
      approval_remarks TEXT,
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

  // Migrations for approval columns if database was previously created
  try { dbInstance.run(`ALTER TABLE visitor_passes ADD COLUMN requires_approval INTEGER DEFAULT 1`); } catch {}
  try { dbInstance.run(`ALTER TABLE visitor_passes ADD COLUMN approved_by TEXT`); } catch {}
  try { dbInstance.run(`ALTER TABLE visitor_passes ADD COLUMN approved_by_name TEXT`); } catch {}
  try { dbInstance.run(`ALTER TABLE visitor_passes ADD COLUMN approved_at TEXT`); } catch {}
  try { dbInstance.run(`ALTER TABLE visitor_passes ADD COLUMN approval_remarks TEXT`); } catch {}

  // Check if users exist, otherwise seed
  const userCheck = dbInstance.exec("SELECT COUNT(*) as count FROM users");
  const count = userCheck[0]?.values[0]?.[0] as number;

  if (!count || count === 0) {
    seedDatabase(dbInstance);
  } else {
    // Ensure manager user exists
    const managerCheck = dbInstance.exec("SELECT id FROM users WHERE role = 'MANAGER' OR email = 'manager@example.com'");
    if (!managerCheck[0] || managerCheck[0].values.length === 0) {
      const now = new Date().toISOString();
      dbInstance.run(
        `INSERT INTO users (id, name, email, mobile, password_hash, role, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, 'MANAGER', 'ACTIVE', ?, ?)`,
        ['u_mgr_001', 'Operations Manager', 'manager@example.com', '+1 (555) 019-2834', hashPassword('manager123'), now, now]
      );
    }
  }

  saveDatabase();
  return dbInstance;
}

function seedDatabase(db: Database) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Seed Users
  const adminId = 'u_admin_001';
  const managerId = 'u_mgr_001';
  const receptionId = 'u_recep_001';
  const securityId = 'u_sec_001';

  db.run(
    `INSERT INTO users (id, name, email, mobile, password_hash, role, status, created_at, updated_at) VALUES 
    (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?),
    (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?),
    (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?),
    (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [
      adminId, 'Factory Director (Admin)', 'admin@example.com', '+1 (555) 019-2831', hashPassword('admin123'), 'ADMIN', now, now,
      managerId, 'Operations Manager', 'manager@example.com', '+1 (555) 019-2834', hashPassword('manager123'), 'MANAGER', now, now,
      receptionId, 'Reception & HR Desk', 'reception@example.com', '+1 (555) 019-2832', hashPassword('reception123'), 'RECEPTION', now, now,
      securityId, 'Security Officer 01', 'security@example.com', '+1 (555) 019-2833', hashPassword('security123'), 'SECURITY', now, now,
    ]
  );

  // Seed Gates
  const gateMain = 'gate_main';
  const gateNorth = 'gate_north';
  const gateSouth = 'gate_south';
  const gateLoading = 'gate_loading';

  db.run(
    `INSERT INTO gates (id, gate_name, gate_code, status, created_at) VALUES 
    (?, ?, ?, 'ACTIVE', ?),
    (?, ?, ?, 'ACTIVE', ?),
    (?, ?, ?, 'ACTIVE', ?),
    (?, ?, ?, 'ACTIVE', ?)`,
    [
      gateMain, 'Main Gate (Gate 1)', 'GATE-01', now,
      gateNorth, 'North Gate - Logistics (Gate 2)', 'GATE-02', now,
      gateSouth, 'South Gate - Staff & Contractors (Gate 3)', 'GATE-03', now,
      gateLoading, 'Loading Bay Gate (Gate 4)', 'GATE-04', now,
    ]
  );

  // Seed Visitors
  const v1 = 'vis_001';
  const v2 = 'vis_002';
  const v3 = 'vis_003';
  const v4 = 'vis_004';
  const v5 = 'vis_005';

  db.run(
    `INSERT INTO visitors (id, name, mobile, email, company, designation, photo, id_type, id_number, address, created_at, updated_at) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      v1, 'Md. Rahim Ahmed', '+1 555-234-5678', 'rahim.ahmed@abctrading.com', 'ABC Trading Ltd.', 'Procurement Specialist', '', 'NATIONAL_ID', 'NID-98234-8172', '124 Industrial Avenue, Sector 4', now, now,
      v2, 'Sarah Jenkins', '+1 555-876-5432', 'sarah.j@fengqun.com', 'Feng Qun Robotics', 'Senior Automation Engineer', '', 'PASSPORT', 'P-82910482', '80 Tech Valley Parkway', now, now,
      v3, 'David Tanaka', '+1 555-432-1098', 'david.t@kantopower.com', 'Kanto Power Systems', 'Electrical Safety Inspector', '', 'DRIVING_LICENSE', 'DL-8172901-K', '45 Power Station Rd', now, now,
      v4, 'Michael Chen', '+1 555-321-9876', 'mchen@vertexchem.org', 'Vertex Chemical Audits', 'EHS Compliance Lead', '', 'COMPANY_ID', 'CID-V9921', '12 Harbour View Center', now, now,
      v5, 'Elena Rostova', '+1 555-654-7890', 'elena@ecovolt.energy', 'EcoEnergy Solutions', 'Solar Grid Specialist', '', 'NATIONAL_ID', 'NID-33412-9901', '77 Greenway Boulevard', now, now,
    ]
  );

  // Seed Passes
  const p1 = 'pass_001'; // VP-2026-000125 - ACTIVE (NOT ENTERED YET, scenario test pass!)
  const p2 = 'pass_002'; // VP-2026-000124 - INSIDE
  const p3 = 'pass_003'; // VP-2026-000123 - EXITED
  const p4 = 'pass_004'; // VP-2026-000122 - CANCELLED
  const p5 = 'pass_005'; // VP-2026-000121 - EXPIRED

  const token1 = 'token_vp_2026_000125';
  const token2 = 'token_vp_2026_000124';
  const token3 = 'token_vp_2026_000123';
  const token4 = 'token_vp_2026_000122';
  const token5 = 'token_vp_2026_000121';

  db.run(
    `INSERT INTO visitor_passes (
      id, pass_number, visitor_id, host_name, host_department, purpose, visit_date, 
      expected_arrival, expected_departure, number_of_visitors, vehicle_type, vehicle_number, 
      remarks, qr_token, status, created_by, created_at, updated_at, expires_at
    ) VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p1, 'VP-2026-000125', v1, 'Mr. Karim', 'Purchase', 'Business Meeting', today, '10:30', '16:00', 1, 'CAR', 'DHAKA-METRO-GA-12-3456', 'Meeting regarding raw materials supply line', token1, 'ACTIVE', adminId, now, now, `${today} 23:59:59`,
      p2, 'VP-2026-000124', v2, 'Engr. Faisal', 'Engineering', 'Assembly Line Robot Calibration', today, '09:00', '17:00', 2, 'VAN', 'CAL-ROBO-9901', 'Bring specialized calibration test rig', token2, 'INSIDE', receptionId, now, now, `${today} 23:59:59`,
      p3, 'VP-2026-000123', v3, 'Mr. Henderson', 'Operations', 'Emergency Switchgear Inspection', today, '08:00', '11:00', 1, 'NONE', '', 'High voltage area pass', token3, 'EXITED', adminId, now, now, `${today} 23:59:59`,
      p4, 'VP-2026-000122', v4, 'Dr. Aris Thorne', 'Quality Assurance', 'Chemical Safety Audit', today, '13:00', '16:30', 1, 'CAR', 'TEX-QMS-4412', 'Audit postponed to next week', token4, 'CANCELLED', adminId, now, now, `${today} 23:59:59`,
      p5, 'VP-2026-000121', v5, 'Solar Team Lead', 'Facilities', 'Rooftop Inverter Check', '2026-09-25', '10:00', '14:00', 1, 'NONE', '', 'Pass validity ended last week', token5, 'EXPIRED', receptionId, '2026-09-25T08:00:00.000Z', '2026-09-25T08:00:00.000Z', '2026-09-25 23:59:59',
    ]
  );

  // Set cancel reason for p4
  db.run(`UPDATE visitor_passes SET cancel_reason = 'Cancelled by Host: Audit postponed to next week' WHERE id = ?`, [p4]);

  // Seed Entry/Exit Logs for p2 (INSIDE) and p3 (EXITED)
  const entryP2Time = `${today}T09:14:22.000Z`;
  const entryP3Time = `${today}T08:12:05.000Z`;
  const exitP3Time = `${today}T10:48:30.000Z`;

  db.run(
    `INSERT INTO entry_exit_logs (id, visitor_pass_id, action, gate_id, security_user_id, timestamp, device_information, remarks, duration_minutes) VALUES
    ('log_001', ?, 'ENTRY', ?, ?, ?, 'Zebra Handheld Scanner Terminal #1', 'Safety gear & badges issued', NULL),
    ('log_002', ?, 'ENTRY', ?, ?, ?, 'Samsung Galaxy Tab Security Station', 'Visitor badge #04 provided', NULL),
    ('log_003', ?, 'EXIT', ?, ?, ?, 'Samsung Galaxy Tab Security Station', 'Visitor badge returned', 156)`,
    [
      p2, gateMain, securityId, entryP2Time,
      p3, gateMain, securityId, entryP3Time,
      p3, gateMain, securityId, exitP3Time,
    ]
  );

  // Seed Audit Logs
  db.run(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp) VALUES
    ('aud_001', ?, 'Factory Director (Admin)', 'CREATE_PASS', 'VISITOR_PASS', ?, '', 'VP-2026-000125 created for Md. Rahim Ahmed', '192.168.1.100', ?),
    ('aud_002', ?, 'Security Officer 01', 'RECORD_ENTRY', 'VISITOR_PASS', ?, 'ACTIVE', 'INSIDE (Main Gate)', '192.168.1.50', ?),
    ('aud_003', ?, 'Security Officer 01', 'RECORD_EXIT', 'VISITOR_PASS', ?, 'INSIDE', 'EXITED (Duration 2h 36m)', '192.168.1.50', ?)`,
    [
      adminId, p1, now,
      securityId, p2, entryP2Time,
      securityId, p3, exitP3Time,
    ]
  );
}

// Database helper functions
export interface QueryRow {
  [key: string]: any;
}

export function queryAll(sql: string, params: any[] = []): QueryRow[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: QueryRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function queryOne(sql: string, params: any[] = []): QueryRow | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  saveDatabase();
}
