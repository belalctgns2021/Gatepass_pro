import { Router, Response } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { queryAll, queryOne, execute, hashPassword } from './db.ts';
import { AuthenticatedRequest, authenticate, requireRoles, createToken } from './auth.ts';
import { isPassExpired, checkAndTransitionExpiredPasses } from './expiryEngine.ts';

const router = Router();

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

router.post('/auth/login', (req, res) => {
  const { email, password, gateId } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const hashedPassword = hashPassword(password);
  const user = queryOne(
    'SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER(?) AND password_hash = ?',
    [email.trim(), hashedPassword]
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Account is deactivated. Contact factory administrator.' });
  }

  // Get active gates to assign a default gate if not provided
  let selectedGateId = gateId;
  if (!selectedGateId) {
    const defaultGate = queryOne("SELECT id FROM gates WHERE status = 'ACTIVE' ORDER BY gate_code ASC LIMIT 1");
    selectedGateId = defaultGate ? defaultGate.id : 'gate_main';
  }

  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    assignedGateId: selectedGateId,
  };

  const token = createToken(authUser);

  // Log login in audit trail
  const now = new Date().toISOString();
  execute(
    'INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      user.id,
      user.name,
      'USER_LOGIN',
      'USER',
      user.id,
      '',
      `Logged in as ${user.role}`,
      req.ip || '127.0.0.1',
      now,
    ]
  );

  res.json({
    token,
    user: authUser,
  });
});

router.post('/auth/firebase-login', (req, res) => {
  const { email, name, photoURL, uid, gateId } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required from Firebase Auth' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = queryOne('SELECT id, name, email, role, status FROM users WHERE LOWER(email) = ?', [cleanEmail]);

  const now = new Date().toISOString();
  if (!user) {
    // Determine default role: admin if admin@, else RECEPTION
    const assignedRole = cleanEmail.includes('admin') ? 'ADMIN' : cleanEmail.includes('security') ? 'SECURITY' : 'RECEPTION';
    const userId = 'u_fb_' + (uid ? uid.slice(0, 10) : crypto.randomUUID().slice(0, 8));

    execute(
      'INSERT INTO users (id, name, email, mobile, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        name || 'Google User',
        cleanEmail,
        '',
        hashPassword('firebase_google_auth_oauth'),
        assignedRole,
        'ACTIVE',
        now,
        now,
      ]
    );

    user = {
      id: userId,
      name: name || 'Google User',
      email: cleanEmail,
      role: assignedRole,
      status: 'ACTIVE',
    };
  }

  let selectedGateId = gateId;
  if (!selectedGateId) {
    const defaultGate = queryOne("SELECT id FROM gates WHERE status = 'ACTIVE' ORDER BY gate_code ASC LIMIT 1");
    selectedGateId = defaultGate ? defaultGate.id : 'gate_main';
  }

  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    assignedGateId: selectedGateId,
  };

  const token = createToken(authUser);

  execute(
    'INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      user.id,
      user.name,
      'USER_LOGIN_FIREBASE',
      'USER',
      user.id,
      '',
      `Logged in via Google Sign-In as ${user.role}`,
      req.ip || '127.0.0.1',
      now,
    ]
  );

  res.json({
    token,
    user: authUser,
  });
});

router.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  res.json({ user });
});

router.post('/auth/switch-gate', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { gateId } = req.body;
  if (!gateId) return res.status(400).json({ error: 'gateId is required' });

  const gate = queryOne('SELECT id, gate_name, gate_code FROM gates WHERE id = ?', [gateId]);
  if (!gate) return res.status(404).json({ error: 'Gate not found' });

  const updatedUser = {
    ...req.user!,
    assignedGateId: gateId,
  };

  const newToken = createToken(updatedUser);
  res.json({ token: newToken, user: updatedUser, gate });
});

router.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString();
  execute(
    'INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      req.user!.id,
      req.user!.name,
      'USER_LOGOUT',
      'USER',
      req.user!.id,
      '',
      'Logged out',
      req.ip || '127.0.0.1',
      now,
    ]
  );
  res.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// 2. GATES MANAGEMENT
// ==========================================

router.get('/gates', (req, res) => {
  const gates = queryAll('SELECT * FROM gates ORDER BY gate_code ASC');
  res.json(gates);
});

router.post('/gates', authenticate, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { gate_name, gate_code } = req.body;
  if (!gate_name || !gate_code) {
    return res.status(400).json({ error: 'gate_name and gate_code are required' });
  }

  const existing = queryOne('SELECT id FROM gates WHERE gate_code = ?', [gate_code.trim().toUpperCase()]);
  if (existing) {
    return res.status(409).json({ error: 'Gate code already exists' });
  }

  const id = 'gate_' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  execute('INSERT INTO gates (id, gate_name, gate_code, status, created_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    gate_name.trim(),
    gate_code.trim().toUpperCase(),
    'ACTIVE',
    now,
  ]);

  res.status(201).json({ id, gate_name, gate_code, status: 'ACTIVE' });
});

// ==========================================
// 3. DASHBOARD STATS
// ==========================================

router.get('/dashboard/stats', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);

  // Today's total passes
  const todayPasses = queryAll('SELECT id, status FROM visitor_passes WHERE visit_date = ?', [today]);
  const totalToday = todayPasses.length;
  const currentlyInside = queryAll("SELECT COUNT(*) as count FROM visitor_passes WHERE status = 'INSIDE'")[0]?.count || 0;
  const exitedToday = queryAll(
    `SELECT COUNT(DISTINCT vp.id) as count 
     FROM visitor_passes vp
     JOIN entry_exit_logs l ON l.visitor_pass_id = vp.id
     WHERE l.action = 'EXIT' AND l.timestamp LIKE ?`,
    [`${today}%`]
  )[0]?.count || 0;
  const expectedToday = queryAll(
    "SELECT COUNT(*) as count FROM visitor_passes WHERE visit_date = ? AND status = 'ACTIVE'",
    [today]
  )[0]?.count || 0;
  const pendingApproval = queryAll(
    "SELECT COUNT(*) as count FROM visitor_passes WHERE status IN ('PENDING_APPROVAL', 'APPROVAL_PENDING')"
  )[0]?.count || 0;

  // Recent passes (last 10)
  const recentPasses = queryAll(
    `SELECT vp.*, v.name as visitor_name, v.company as visitor_company, v.mobile as visitor_mobile,
            (SELECT timestamp FROM entry_exit_logs WHERE visitor_pass_id = vp.id ORDER BY timestamp DESC LIMIT 1) as last_action_time
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     ORDER BY vp.created_at DESC
     LIMIT 10`
  );

  // Gate breakdown
  const gateActivity = queryAll(
    `SELECT g.id, g.gate_name, g.gate_code,
            SUM(CASE WHEN l.action = 'ENTRY' THEN 1 ELSE 0 END) as entries,
            SUM(CASE WHEN l.action = 'EXIT' THEN 1 ELSE 0 END) as exits
     FROM gates g
     LEFT JOIN entry_exit_logs l ON l.gate_id = g.id AND l.timestamp LIKE ?
     GROUP BY g.id, g.gate_name, g.gate_code
     ORDER BY g.gate_code ASC`,
    [`${today}%`]
  );

  res.json({
    stats: {
      todayVisitors: totalToday,
      currentlyInside,
      expectedToday,
      exitedToday,
      pendingApproval,
    },
    recentPasses,
    gateActivity,
  });
});

// ==========================================
// 4. VISITOR PASS CREATION & RETRIEVAL
// ==========================================

router.post('/passes', authenticate, requireRoles(['ADMIN', 'MANAGER', 'RECEPTION']), (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    mobile,
    email,
    company,
    designation,
    photo,
    id_type,
    id_number,
    address,
    host_name,
    host_department,
    purpose,
    visit_date,
    expected_arrival,
    expected_departure,
    number_of_visitors,
    vehicle_type,
    vehicle_number,
    remarks,
    requiresApproval = true,
    autoApprove = false,
  } = req.body;

  if (!name || !mobile || !host_name || !purpose || !visit_date) {
    return res.status(400).json({
      error: 'Missing required fields: Visitor Name, Mobile Number, Host Name, Purpose of Visit, and Visit Date are mandatory.',
    });
  }

  const now = new Date().toISOString();
  const visitorId = 'vis_' + crypto.randomUUID().slice(0, 8);
  const userRole = req.user!.role;

  // Insert or reuse visitor
  execute(
    `INSERT INTO visitors (id, name, mobile, email, company, designation, photo, id_type, id_number, address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      visitorId,
      name.trim(),
      mobile.trim(),
      email ? email.trim() : '',
      company ? company.trim() : '',
      designation ? designation.trim() : '',
      photo || '',
      id_type || 'NATIONAL_ID',
      id_number ? id_number.trim() : '',
      address ? address.trim() : '',
      now,
      now,
    ]
  );

  // Generate sequence pass number: VP-YYYY-XXXXXX
  const year = new Date().getFullYear();
  const countRow = queryOne('SELECT COUNT(*) as count FROM visitor_passes');
  const sequenceNum = ((countRow?.count || 0) + 125).toString().padStart(6, '0');
  const passNumber = `VP-${year}-${sequenceNum}`;

  // Generate cryptographically secure random token (256-bit hex)
  const qrToken = 'token_' + crypto.randomBytes(16).toString('hex');
  const passId = 'pass_' + crypto.randomUUID().slice(0, 8);
  const expiresAt = `${visit_date} 23:59:59`;

  // Determine approval state:
  // Either Manager or Admin can approve.
  // If creator is ADMIN or MANAGER and autoApprove is true, it is immediately ACTIVE.
  // Otherwise, default status is PENDING_APPROVAL.
  let initialStatus = 'PENDING_APPROVAL';
  let approvedBy: string | null = null;
  let approvedByName: string | null = null;
  let approvedAt: string | null = null;
  let approvalRemarks: string | null = null;

  if ((userRole === 'ADMIN' || userRole === 'MANAGER') && autoApprove) {
    initialStatus = 'ACTIVE';
    approvedBy = req.user!.id;
    approvedByName = `${req.user!.name} (${userRole})`;
    approvedAt = now;
    approvalRemarks = `Directly approved upon creation by ${userRole}`;
  }

  execute(
    `INSERT INTO visitor_passes (
      id, pass_number, visitor_id, host_name, host_department, purpose, visit_date,
      expected_arrival, expected_departure, number_of_visitors, vehicle_type, vehicle_number,
      remarks, qr_token, status, requires_approval, approved_by, approved_by_name, approved_at, approval_remarks,
      created_by, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      passId,
      passNumber,
      visitorId,
      host_name.trim(),
      host_department ? host_department.trim() : 'General',
      purpose.trim(),
      visit_date,
      expected_arrival || '09:00',
      expected_departure || '17:00',
      parseInt(number_of_visitors, 10) || 1,
      vehicle_type || 'NONE',
      vehicle_number ? vehicle_number.trim().toUpperCase() : '',
      remarks ? remarks.trim() : '',
      qrToken,
      initialStatus,
      requiresApproval ? 1 : 0,
      approvedBy,
      approvedByName,
      approvedAt,
      approvalRemarks,
      req.user!.id,
      now,
      now,
      expiresAt,
    ]
  );

  // Audit log
  execute(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
     VALUES (?, ?, ?, 'CREATE_PASS', 'VISITOR_PASS', ?, '', ?, ?, ?)`,
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      req.user!.id,
      req.user!.name,
      passId,
      `Created pass ${passNumber} for ${name} (${company || 'Individual'}) - Status: ${initialStatus}`,
      req.ip || '127.0.0.1',
      now,
    ]
  );

  const createdPass = queryOne(
    `SELECT vp.*, v.name as visitor_name, v.mobile as visitor_mobile, v.email as visitor_email,
            v.company as visitor_company, v.designation as visitor_designation, v.photo as visitor_photo,
            v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address,
            u.name as creator_name
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     LEFT JOIN users u ON u.id = vp.created_by
     WHERE vp.id = ?`,
    [passId]
  );

  res.status(201).json(createdPass);
});

router.get('/passes', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const {
    q,
    status,
    dateFilter,
    startDate,
    endDate,
    department,
    limit = '100',
  } = req.query;

  let sql = `
    SELECT vp.*, v.name as visitor_name, v.mobile as visitor_mobile, v.email as visitor_email,
           v.company as visitor_company, v.designation as visitor_designation, v.photo as visitor_photo,
           v.id_type as visitor_id_type, v.id_number as visitor_id_number,
           u.name as creator_name,
           (SELECT l.timestamp FROM entry_exit_logs l WHERE l.visitor_pass_id = vp.id AND l.action = 'ENTRY' ORDER BY l.timestamp DESC LIMIT 1) as entry_time,
           (SELECT l.timestamp FROM entry_exit_logs l WHERE l.visitor_pass_id = vp.id AND l.action = 'EXIT' ORDER BY l.timestamp DESC LIMIT 1) as exit_time,
           (SELECT g.gate_name FROM entry_exit_logs l JOIN gates g ON g.id = l.gate_id WHERE l.visitor_pass_id = vp.id ORDER BY l.timestamp DESC LIMIT 1) as last_gate_name
    FROM visitor_passes vp
    JOIN visitors v ON v.id = vp.visitor_id
    LEFT JOIN users u ON u.id = vp.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  // Security role can view today's passes or search passes
  const today = new Date().toISOString().slice(0, 10);

  if (q) {
    const searchPattern = `%${String(q).trim()}%`;
    sql += ` AND (
      v.name LIKE ? OR 
      v.mobile LIKE ? OR 
      v.company LIKE ? OR 
      vp.pass_number LIKE ? OR 
      vp.host_name LIKE ? OR 
      vp.vehicle_number LIKE ? OR
      vp.qr_token LIKE ?
    )`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (status && status !== 'ALL') {
    if (status === 'PENDING_APPROVAL' || status === 'APPROVAL_PENDING') {
      sql += ` AND (vp.status = 'PENDING_APPROVAL' OR vp.status = 'APPROVAL_PENDING')`;
    } else {
      sql += ` AND vp.status = ?`;
      params.push(status);
    }
  }

  if (department) {
    sql += ` AND vp.host_department = ?`;
    params.push(department);
  }

  if (dateFilter === 'today') {
    sql += ` AND vp.visit_date = ?`;
    params.push(today);
  } else if (dateFilter === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    sql += ` AND vp.visit_date = ?`;
    params.push(yesterday);
  } else if (dateFilter === 'this_week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const weekAgo = d.toISOString().slice(0, 10);
    sql += ` AND vp.visit_date >= ?`;
    params.push(weekAgo);
  } else if (dateFilter === 'this_month') {
    const monthStart = today.slice(0, 7) + '-01';
    sql += ` AND vp.visit_date >= ?`;
    params.push(monthStart);
  } else if (startDate && endDate) {
    sql += ` AND vp.visit_date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  sql += ` ORDER BY vp.created_at DESC LIMIT ?`;
  params.push(parseInt(String(limit), 10) || 100);

  const passes = queryAll(sql, params);
  res.json(passes);
});

router.get('/passes/:id', (req, res) => {
  const pass = queryOne(
    `SELECT vp.*, v.name as visitor_name, v.mobile as visitor_mobile, v.email as visitor_email,
            v.company as visitor_company, v.designation as visitor_designation, v.photo as visitor_photo,
            v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address,
            u.name as creator_name
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     LEFT JOIN users u ON u.id = vp.created_by
     WHERE vp.id = ? OR vp.qr_token = ? OR vp.pass_number = ?`,
    [req.params.id, req.params.id, req.params.id]
  );

  if (!pass) {
    return res.status(404).json({ error: 'Visitor pass not found' });
  }

  // Get timeline of entry/exit
  const logs = queryAll(
    `SELECT l.*, g.gate_name, g.gate_code, u.name as security_guard_name
     FROM entry_exit_logs l
     JOIN gates g ON g.id = l.gate_id
     JOIN users u ON u.id = l.security_user_id
     WHERE l.visitor_pass_id = ?
     ORDER BY l.timestamp ASC`,
    [pass.id]
  );

  res.json({ pass, logs });
});

router.post('/passes/:id/cancel', authenticate, requireRoles(['ADMIN', 'RECEPTION']), (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const pass = queryOne('SELECT * FROM visitor_passes WHERE id = ?', [req.params.id]);

  if (!pass) {
    return res.status(404).json({ error: 'Pass not found' });
  }

  if (pass.status === 'CANCELLED') {
    return res.status(400).json({ error: 'Pass is already cancelled' });
  }

  if (pass.status === 'INSIDE') {
    return res.status(400).json({ error: 'Cannot cancel a pass for a visitor who is currently INSIDE the factory. Record exit first.' });
  }

  const now = new Date().toISOString();
  const cancelReason = reason ? reason.trim() : 'Cancelled by staff';

  execute(
    `UPDATE visitor_passes SET status = 'CANCELLED', cancel_reason = ?, updated_at = ? WHERE id = ?`,
    [cancelReason, now, pass.id]
  );

  execute(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
     VALUES (?, ?, ?, 'CANCEL_PASS', 'VISITOR_PASS', ?, ?, ?, ?, ?)`,
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      req.user!.id,
      req.user!.name,
      pass.id,
      pass.status,
      `CANCELLED: ${cancelReason}`,
      req.ip || '127.0.0.1',
      now,
    ]
  );

  res.json({ success: true, message: 'Pass cancelled successfully' });
});

// Approve pass: Manager or Admin both can provide approval
router.post('/passes/:id/approve', authenticate, requireRoles(['ADMIN', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { remarks } = req.body;
  const pass = queryOne('SELECT * FROM visitor_passes WHERE id = ?', [req.params.id]);

  if (!pass) {
    return res.status(404).json({ error: 'Pass not found' });
  }

  if (pass.status !== 'PENDING_APPROVAL' && pass.status !== 'APPROVAL_PENDING') {
    return res.status(400).json({ error: `Cannot approve pass with status "${pass.status}". Only passes pending approval can be approved.` });
  }

  const now = new Date().toISOString();
  const approverRole = req.user!.role; // 'ADMIN' or 'MANAGER'
  const approverName = req.user!.name;
  const approvalNote = remarks ? remarks.trim() : `Approved by ${approverName} (${approverRole})`;

  execute(
    `UPDATE visitor_passes 
     SET status = 'ACTIVE', approved_by = ?, approved_by_name = ?, approved_at = ?, approval_remarks = ?, updated_at = ?
     WHERE id = ?`,
    [req.user!.id, `${approverName} (${approverRole})`, now, approvalNote, now, pass.id]
  );

  execute(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
     VALUES (?, ?, ?, 'APPROVE_PASS', 'VISITOR_PASS', ?, 'PENDING_APPROVAL', ?, ?, ?)`,
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      req.user!.id,
      req.user!.name,
      pass.id,
      `APPROVED by ${approverName} (${approverRole}): ${approvalNote}`,
      req.ip || '127.0.0.1',
      now,
    ]
  );

  const updatedPass = queryOne(
    `SELECT vp.*, v.name as visitor_name, v.mobile as visitor_mobile, v.email as visitor_email,
            v.company as visitor_company, v.designation as visitor_designation, v.photo as visitor_photo,
            v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address,
            u.name as creator_name
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     LEFT JOIN users u ON u.id = vp.created_by
     WHERE vp.id = ?`,
    [pass.id]
  );

  res.json({ success: true, message: `Pass ${pass.pass_number} approved successfully by ${approverRole}`, pass: updatedPass });
});

// Reject pass: Manager or Admin both can reject
router.post('/passes/:id/reject', authenticate, requireRoles(['ADMIN', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const pass = queryOne('SELECT * FROM visitor_passes WHERE id = ?', [req.params.id]);

  if (!pass) {
    return res.status(404).json({ error: 'Pass not found' });
  }

  if (pass.status !== 'PENDING_APPROVAL' && pass.status !== 'APPROVAL_PENDING') {
    return res.status(400).json({ error: `Cannot reject pass with status "${pass.status}". Only passes pending approval can be rejected.` });
  }

  const now = new Date().toISOString();
  const approverRole = req.user!.role; // 'ADMIN' or 'MANAGER'
  const approverName = req.user!.name;
  const rejectionReason = reason ? reason.trim() : `Disapproved by ${approverName} (${approverRole})`;

  execute(
    `UPDATE visitor_passes 
     SET status = 'REJECTED', cancel_reason = ?, approved_by = ?, approved_by_name = ?, approved_at = ?, updated_at = ?
     WHERE id = ?`,
    [rejectionReason, req.user!.id, `${approverName} (${approverRole})`, now, now, pass.id]
  );

  execute(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
     VALUES (?, ?, ?, 'REJECT_PASS', 'VISITOR_PASS', ?, 'PENDING_APPROVAL', ?, ?, ?)`,
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      req.user!.id,
      req.user!.name,
      pass.id,
      `REJECTED by ${approverName} (${approverRole}): ${rejectionReason}`,
      req.ip || '127.0.0.1',
      now,
    ]
  );

  const updatedPass = queryOne(
    `SELECT vp.*, v.name as visitor_name, v.mobile as visitor_mobile, v.email as visitor_email,
            v.company as visitor_company, v.designation as visitor_designation, v.photo as visitor_photo,
            v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address,
            u.name as creator_name
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     LEFT JOIN users u ON u.id = vp.created_by
     WHERE vp.id = ?`,
    [pass.id]
  );

  res.json({ success: true, message: `Pass ${pass.pass_number} rejected by ${approverRole}`, pass: updatedPass });
});

// Batch Approve passes: Manager or Admin can approve multiple selected passes at once
router.post('/passes/batch-approve', authenticate, requireRoles(['ADMIN', 'MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const { passIds, remarks } = req.body;
  if (!passIds || !Array.isArray(passIds) || passIds.length === 0) {
    return res.status(400).json({ error: 'Array of passIds is required' });
  }

  const now = new Date().toISOString();
  const approverRole = req.user!.role;
  const approverName = req.user!.name;
  const note = remarks ? remarks.trim() : `Batch approved by ${approverName} (${approverRole})`;

  let approvedCount = 0;
  for (const id of passIds) {
    const pass = queryOne('SELECT * FROM visitor_passes WHERE id = ?', [id]);
    if (pass && (pass.status === 'PENDING_APPROVAL' || pass.status === 'APPROVAL_PENDING')) {
      execute(
        `UPDATE visitor_passes 
         SET status = 'ACTIVE', approved_by = ?, approved_by_name = ?, approved_at = ?, approval_remarks = ?, updated_at = ?
         WHERE id = ?`,
        [req.user!.id, `${approverName} (${approverRole})`, now, note, now, id]
      );
      execute(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
         VALUES (?, ?, ?, 'BATCH_APPROVE_PASS', 'VISITOR_PASS', ?, 'PENDING_APPROVAL', ?, ?, ?)`,
        [
          'aud_' + crypto.randomUUID().slice(0, 8),
          req.user!.id,
          req.user!.name,
          id,
          `BATCH APPROVED: ${note}`,
          req.ip || '127.0.0.1',
          now,
        ]
      );
      approvedCount++;
    }
  }

  res.json({ success: true, approvedCount, message: `Successfully approved ${approvedCount} visitor pass(es).` });
});

// Auto-Expiry trigger / status check endpoint
router.post('/passes/expire-check', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const result = checkAndTransitionExpiredPasses();
  res.json({
    success: true,
    message: `Evaluated pass validity. Transitioned ${result.expiredCount} expired pass(es) to EXPIRED.`,
    ...result,
  });
});

// ==========================================
// 5. QR CODE VERIFICATION ENGINE (Core Logic)
// ==========================================

router.get('/verify/:tokenOrPass', (req, res) => {
  const identifier = req.params.tokenOrPass.trim();

  // Find pass by QR token or by formatted pass number
  const pass = queryOne(
    `SELECT vp.*, v.name as visitor_name, v.mobile as visitor_mobile, v.email as visitor_email,
            v.company as visitor_company, v.designation as visitor_designation, v.photo as visitor_photo,
            v.id_type as visitor_id_type, v.id_number as visitor_id_number, v.address as visitor_address
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     WHERE vp.qr_token = ? OR UPPER(vp.pass_number) = UPPER(?)`,
    [identifier, identifier]
  );

  if (!pass) {
    return res.status(404).json({
      valid: false,
      reason: 'UNKNOWN_QR',
      status: 'INVALID',
      title: 'INVALID VISITOR PASS',
      message: 'Unknown QR or Pass number. No record found in factory registry. DO NOT ALLOW ENTRY.',
    });
  }

  // Fetch recent logs
  const logs = queryAll(
    `SELECT l.*, g.gate_name, g.gate_code, u.name as security_guard_name
     FROM entry_exit_logs l
     JOIN gates g ON g.id = l.gate_id
     JOIN users u ON u.id = l.security_user_id
     WHERE l.visitor_pass_id = ?
     ORDER BY l.timestamp DESC`,
    [pass.id]
  );

  const lastLog = logs[0] || null;
  const lastEntry = logs.find((l) => l.action === 'ENTRY') || null;
  const lastExit = logs.find((l) => l.action === 'EXIT') || null;

  // Rule 0A: PENDING APPROVAL (Requires Manager or Admin Approval)
  if (pass.status === 'PENDING_APPROVAL') {
    return res.json({
      valid: false,
      status: 'PENDING_APPROVAL',
      reason: 'PENDING_APPROVAL',
      canEnter: false,
      canExit: false,
      title: 'APPROVAL REQUIRED - ENTRY DENIED',
      message: 'This pass is awaiting approval from a Department Manager or Factory Admin. Entry is not permitted until approved.',
      pass,
      logs,
    });
  }

  // Rule 0B: REJECTED
  if (pass.status === 'REJECTED') {
    return res.json({
      valid: false,
      status: 'REJECTED',
      reason: 'PASS_REJECTED',
      canEnter: false,
      canExit: false,
      title: 'PASS REJECTED - ACCESS DENIED',
      message: `Pass was REJECTED by management: ${pass.cancel_reason || 'Disapproved by manager/admin'}. DO NOT ALLOW ENTRY.`,
      pass,
      logs,
    });
  }

  // Rule 1: CANCELLED
  if (pass.status === 'CANCELLED') {
    return res.json({
      valid: false,
      status: 'CANCELLED',
      reason: 'PASS_CANCELLED',
      title: 'INVALID VISITOR PASS',
      message: `Pass has been CANCELLED. Reason: ${pass.cancel_reason || 'Administrative cancellation'}. DO NOT ALLOW ENTRY.`,
      pass,
      logs,
    });
  }

  // Rule 2: EXPIRED (Past date OR current time exceeded expected departure)
  const today = new Date().toISOString().slice(0, 10);
  const expired = pass.status === 'EXPIRED' || isPassExpired(pass);
  if (expired) {
    if (pass.status !== 'EXPIRED') {
      const nowIso = new Date().toISOString();
      execute(
        `UPDATE visitor_passes SET status = 'EXPIRED', updated_at = ? WHERE id = ?`,
        [nowIso, pass.id]
      );
      execute(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
         VALUES (?, 'SYSTEM', 'AUTO_EXPIRY_ENGINE', 'EXPIRE_PASS', 'VISITOR_PASS', ?, ?, 'EXPIRED', ?, ?)`,
        [
          'aud_' + crypto.randomUUID().slice(0, 8),
          pass.id,
          `${pass.status} (Valid: ${pass.visit_date} Departure: ${pass.expected_departure || 'N/A'})`,
          req.ip || '127.0.0.1',
          nowIso,
        ]
      );
      pass.status = 'EXPIRED';
    }

    return res.json({
      valid: false,
      status: 'EXPIRED',
      reason: 'PASS_EXPIRED',
      canEnter: false,
      canExit: false,
      title: 'PASS EXPIRED - ENTRY DENIED',
      message: `PASS EXPIRED. Valid date was ${pass.visit_date} (Expected departure: ${pass.expected_departure || '23:59'}). Entry prohibited.`,
      pass,
      logs,
    });
  }

  // Rule 3: FUTURE DATE WARNING
  if (pass.visit_date > today) {
    return res.json({
      valid: false,
      status: 'FUTURE_DATE',
      reason: 'FUTURE_DATE',
      title: 'PASS NOT YET VALID',
      message: `This pass is scheduled for ${pass.visit_date}. Today is ${today}. Security authorization required for early admission.`,
      pass,
      logs,
    });
  }

  // Rule 4: CURRENTLY INSIDE -> Can record EXIT
  if (pass.status === 'INSIDE') {
    return res.json({
      valid: true,
      status: 'INSIDE',
      canEnter: false,
      canExit: true,
      title: 'VISITOR CURRENTLY INSIDE',
      message: 'Visitor is registered inside the factory. Ready for exit processing.',
      pass,
      lastEntry,
      logs,
    });
  }

  // Rule 5: ALREADY EXITED -> Cannot enter again
  if (pass.status === 'EXITED') {
    return res.json({
      valid: false,
      status: 'EXITED',
      canEnter: false,
      canExit: false,
      reason: 'ALREADY_EXITED',
      title: 'VISITOR ALREADY EXITED',
      message: `Visitor has already completed this visit and exited factory grounds. Total duration: ${lastExit?.duration_minutes ? Math.floor(lastExit.duration_minutes / 60) + 'h ' + (lastExit.duration_minutes % 60) + 'm' : 'Recorded'}. Create a new pass for re-entry.`,
      pass,
      lastEntry,
      lastExit,
      logs,
    });
  }

  // Rule 6: ACTIVE & NOT ENTERED YET -> Can record ENTRY
  return res.json({
    valid: true,
    status: 'VALID',
    canEnter: true,
    canExit: false,
    title: 'VALID VISITOR PASS',
    message: 'Visitor pass is verified and active. Ready for gate entry.',
    pass,
    logs,
  });
});

// ==========================================
// 6. RECORD ENTRY (Security Guard Action)
// ==========================================

router.post('/entry', authenticate, requireRoles(['ADMIN', 'SECURITY']), (req: AuthenticatedRequest, res: Response) => {
  const { qrToken, passNumber, gateId, remarks, deviceInformation } = req.body;

  if (!qrToken && !passNumber) {
    return res.status(400).json({ error: 'qrToken or passNumber is required' });
  }

  // Find pass
  const pass = queryOne(
    `SELECT vp.*, v.name as visitor_name, v.company as visitor_company 
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     WHERE vp.qr_token = ? OR UPPER(vp.pass_number) = UPPER(?)`,
    [qrToken || '', (passNumber || '').toUpperCase()]
  );

  if (!pass) {
    return res.status(404).json({ error: 'Pass not found. Verify the QR token or pass number.' });
  }

  // Backend verification checks:
  if (pass.status === 'PENDING_APPROVAL') {
    return res.status(403).json({
      error: 'Access Denied: Pass is PENDING APPROVAL. A Department Manager or Factory Admin must approve this pass before entry.',
      status: 'PENDING_APPROVAL',
    });
  }

  if (pass.status === 'REJECTED') {
    return res.status(403).json({
      error: `Access Denied: Pass was REJECTED by management (${pass.cancel_reason || 'Disapproved'}). Entry strictly forbidden.`,
      status: 'REJECTED',
    });
  }

  if (pass.status === 'INSIDE') {
    return res.status(409).json({
      error: 'Duplicate entry prevented: Visitor is ALREADY INSIDE the factory. Cannot record another entry.',
    });
  }

  if (pass.status === 'EXITED') {
    return res.status(400).json({
      error: 'Invalid action: This pass has already been used and exited. Cannot re-enter on an exited pass.',
    });
  }

  if (pass.status === 'CANCELLED') {
    return res.status(403).json({
      error: `Access Denied: Pass was CANCELLED (${pass.cancel_reason || 'No reason provided'}). Entry forbidden.`,
    });
  }

  if (pass.status === 'EXPIRED' || isPassExpired(pass)) {
    if (pass.status !== 'EXPIRED') {
      const nowIso = new Date().toISOString();
      execute(
        `UPDATE visitor_passes SET status = 'EXPIRED', updated_at = ? WHERE id = ?`,
        [nowIso, pass.id]
      );
    }
    return res.status(403).json({
      error: `Access Denied: Pass EXPIRED. Valid date was ${pass.visit_date} (Expected departure: ${pass.expected_departure || '23:59'}). Entry forbidden.`,
    });
  }

  const resolvedGateId = gateId || req.user!.assignedGateId || 'gate_main';
  const gate = queryOne('SELECT * FROM gates WHERE id = ?', [resolvedGateId]) || { gate_name: 'Main Gate', gate_code: 'GATE-01' };

  const now = new Date().toISOString();
  const logId = 'log_' + crypto.randomUUID().slice(0, 8);

  // 1. Record entry log
  execute(
    `INSERT INTO entry_exit_logs (id, visitor_pass_id, action, gate_id, security_user_id, timestamp, device_information, remarks)
     VALUES (?, ?, 'ENTRY', ?, ?, ?, ?, ?)`,
    [
      logId,
      pass.id,
      resolvedGateId,
      req.user!.id,
      now,
      deviceInformation || 'Security Mobile Scanner',
      remarks ? remarks.trim() : 'Standard Gate Entry',
    ]
  );

  // 2. Change pass status to INSIDE
  execute(`UPDATE visitor_passes SET status = 'INSIDE', updated_at = ? WHERE id = ?`, [now, pass.id]);

  // 3. Audit trail
  execute(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
     VALUES (?, ?, ?, 'RECORD_ENTRY', 'VISITOR_PASS', ?, 'ACTIVE', ?, ?, ?)`,
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      req.user!.id,
      req.user!.name,
      pass.id,
      `INSIDE via ${gate.gate_name}`,
      req.ip || '127.0.0.1',
      now,
    ]
  );

  const formattedTime = new Date(now).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  res.json({
    success: true,
    message: 'ENTRY SUCCESSFUL',
    entry: {
      visitorName: pass.visitor_name,
      passNumber: pass.pass_number,
      gate: gate.gate_name,
      entryTime: formattedTime,
      timestamp: now,
      recordedBy: req.user!.name,
    },
  });
});

// ==========================================
// 7. RECORD EXIT (Security Guard Action)
// ==========================================

router.post('/exit', authenticate, requireRoles(['ADMIN', 'SECURITY']), (req: AuthenticatedRequest, res: Response) => {
  const { qrToken, passNumber, gateId, remarks, deviceInformation } = req.body;

  if (!qrToken && !passNumber) {
    return res.status(400).json({ error: 'qrToken or passNumber is required' });
  }

  // Find pass
  const pass = queryOne(
    `SELECT vp.*, v.name as visitor_name, v.company as visitor_company 
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     WHERE vp.qr_token = ? OR UPPER(vp.pass_number) = UPPER(?)`,
    [qrToken || '', (passNumber || '').toUpperCase()]
  );

  if (!pass) {
    return res.status(404).json({ error: 'Pass not found' });
  }

  // Verification checks:
  if (pass.status !== 'INSIDE') {
    if (pass.status === 'EXITED') {
      return res.status(400).json({ error: 'Visitor has already been recorded as EXITED.' });
    }
    return res.status(400).json({
      error: `Cannot record EXIT: Visitor is not marked as INSIDE (current status: ${pass.status}). EXIT before ENTRY is not allowed.`,
    });
  }

  // Find last entry time
  const lastEntryLog = queryOne(
    `SELECT timestamp FROM entry_exit_logs WHERE visitor_pass_id = ? AND action = 'ENTRY' ORDER BY timestamp DESC LIMIT 1`,
    [pass.id]
  );

  const now = new Date();
  const nowIso = now.toISOString();

  let durationMinutes = 0;
  if (lastEntryLog?.timestamp) {
    const entryDate = new Date(lastEntryLog.timestamp);
    const diffMs = now.getTime() - entryDate.getTime();
    durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const resolvedGateId = gateId || req.user!.assignedGateId || 'gate_main';
  const gate = queryOne('SELECT * FROM gates WHERE id = ?', [resolvedGateId]) || { gate_name: 'Main Gate', gate_code: 'GATE-01' };

  const logId = 'log_' + crypto.randomUUID().slice(0, 8);

  // 1. Record exit log
  execute(
    `INSERT INTO entry_exit_logs (id, visitor_pass_id, action, gate_id, security_user_id, timestamp, device_information, remarks, duration_minutes)
     VALUES (?, ?, 'EXIT', ?, ?, ?, ?, ?, ?)`,
    [
      logId,
      pass.id,
      resolvedGateId,
      req.user!.id,
      nowIso,
      deviceInformation || 'Security Mobile Scanner',
      remarks ? remarks.trim() : 'Standard Gate Exit',
      durationMinutes,
    ]
  );

  // 2. Update status to EXITED
  execute(`UPDATE visitor_passes SET status = 'EXITED', updated_at = ? WHERE id = ?`, [nowIso, pass.id]);

  // 3. Audit trail
  execute(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
     VALUES (?, ?, ?, 'RECORD_EXIT', 'VISITOR_PASS', ?, 'INSIDE', ?, ?, ?)`,
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      req.user!.id,
      req.user!.name,
      pass.id,
      `EXITED via ${gate.gate_name} (Duration: ${durationText})`,
      req.ip || '127.0.0.1',
      nowIso,
    ]
  );

  const entryTimeFormatted = lastEntryLog?.timestamp
    ? new Date(lastEntryLog.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '--:--';
  const exitTimeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  res.json({
    success: true,
    message: 'EXIT SUCCESSFUL',
    exit: {
      visitorName: pass.visitor_name,
      passNumber: pass.pass_number,
      gate: gate.gate_name,
      entryTime: entryTimeFormatted,
      exitTime: exitTimeFormatted,
      duration: durationText,
      durationMinutes,
      recordedBy: req.user!.name,
    },
  });
});

// ==========================================
// 8. CURRENTLY INSIDE & EMERGENCY MUSTER LIST
// ==========================================

router.get('/currently-inside', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const visitorsInside = queryAll(
    `SELECT vp.id as pass_id, vp.pass_number, vp.host_name, vp.host_department, vp.purpose,
            vp.vehicle_type, vp.vehicle_number, vp.number_of_visitors, vp.qr_token,
            v.id as visitor_id, v.name as visitor_name, v.mobile as visitor_mobile,
            v.company as visitor_company, v.designation, v.photo,
            (SELECT l.timestamp FROM entry_exit_logs l WHERE l.visitor_pass_id = vp.id AND l.action = 'ENTRY' ORDER BY l.timestamp DESC LIMIT 1) as entry_time,
            (SELECT g.gate_name FROM entry_exit_logs l JOIN gates g ON g.id = l.gate_id WHERE l.visitor_pass_id = vp.id AND l.action = 'ENTRY' ORDER BY l.timestamp DESC LIMIT 1) as entry_gate,
            (SELECT u.name FROM entry_exit_logs l JOIN users u ON u.id = l.security_user_id WHERE l.visitor_pass_id = vp.id AND l.action = 'ENTRY' ORDER BY l.timestamp DESC LIMIT 1) as checked_in_by
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     WHERE vp.status = 'INSIDE'
     ORDER BY entry_time DESC`
  );

  res.json({
    count: visitorsInside.length,
    visitors: visitorsInside,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 9. REPORTS & ANALYTICS
// ==========================================

router.get('/reports', authenticate, requireRoles(['ADMIN', 'RECEPTION']), (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate } = req.query;

  let dateFilterSql = '';
  const params: any[] = [];

  if (startDate && endDate) {
    dateFilterSql = 'AND vp.visit_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  // Summary by company
  const byCompany = queryAll(
    `SELECT v.company, COUNT(vp.id) as total_visits
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     WHERE v.company != '' ${dateFilterSql}
     GROUP BY v.company
     ORDER BY total_visits DESC
     LIMIT 10`,
    params
  );

  // Summary by department
  const byDepartment = queryAll(
    `SELECT vp.host_department, COUNT(vp.id) as total_visits
     FROM visitor_passes vp
     WHERE 1=1 ${dateFilterSql}
     GROUP BY vp.host_department
     ORDER BY total_visits DESC`,
    params
  );

  // Summary by host
  const byHost = queryAll(
    `SELECT vp.host_name, vp.host_department, COUNT(vp.id) as total_visits
     FROM visitor_passes vp
     WHERE 1=1 ${dateFilterSql}
     GROUP BY vp.host_name, vp.host_department
     ORDER BY total_visits DESC
     LIMIT 10`,
    params
  );

  // Complete log entries for CSV export
  const detailedLogs = queryAll(
    `SELECT vp.pass_number, v.name as visitor_name, v.company, v.mobile, vp.host_name, vp.host_department,
            vp.purpose, vp.visit_date, vp.status,
            (SELECT l.timestamp FROM entry_exit_logs l WHERE l.visitor_pass_id = vp.id AND l.action = 'ENTRY' ORDER BY l.timestamp DESC LIMIT 1) as entry_time,
            (SELECT g.gate_name FROM entry_exit_logs l JOIN gates g ON g.id = l.gate_id WHERE l.visitor_pass_id = vp.id AND l.action = 'ENTRY' ORDER BY l.timestamp DESC LIMIT 1) as entry_gate,
            (SELECT l.timestamp FROM entry_exit_logs l WHERE l.visitor_pass_id = vp.id AND l.action = 'EXIT' ORDER BY l.timestamp DESC LIMIT 1) as exit_time,
            (SELECT g.gate_name FROM entry_exit_logs l JOIN gates g ON g.id = l.gate_id WHERE l.visitor_pass_id = vp.id AND l.action = 'EXIT' ORDER BY l.timestamp DESC LIMIT 1) as exit_gate,
            (SELECT l.duration_minutes FROM entry_exit_logs l WHERE l.visitor_pass_id = vp.id AND l.action = 'EXIT' ORDER BY l.timestamp DESC LIMIT 1) as duration_minutes
     FROM visitor_passes vp
     JOIN visitors v ON v.id = vp.visitor_id
     WHERE 1=1 ${dateFilterSql}
     ORDER BY vp.created_at DESC`,
    params
  );

  res.json({
    byCompany,
    byDepartment,
    byHost,
    detailedLogs,
  });
});

// ==========================================
// 10. AUDIT LOGS
// ==========================================

router.get('/audit-logs', authenticate, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const logs = queryAll(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 150`);
  res.json(logs);
});

router.post('/audit-logs/custom', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { action, entity_type, new_value } = req.body;
  const now = new Date().toISOString();
  const user = req.user!;
  execute(
    'INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      'aud_' + crypto.randomUUID().slice(0, 8),
      user.id,
      user.name,
      action || 'REPORT_EXPORT',
      entity_type || 'REPORT',
      '',
      '',
      new_value || 'Report exported',
      req.ip || '127.0.0.1',
      now,
    ]
  );
  res.json({ success: true });
});

// ==========================================
// 11. GEMINI AI SECURITY CO-PILOT CHATBOT
// ==========================================

router.post('/chat', async (req, res) => {
  try {
    const { messages, model = 'gemini-3.5-flash', contextInfo } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const ai = new GoogleGenAI();
    // Valid models per gemini-api skill:
    // 'gemini-3.5-flash' for general tasks, 'gemini-3.1-flash-lite' for fast tasks
    const selectedModel = model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';

    const systemInstruction = `You are FactoryGuard AI, the official security assistant and gate operations co-pilot for Feng Qun Manufacturing Complex.
Your mission is to assist security guards, gate officers, reception desk staff, safety wardens, and plant managers with:
1. Factory visitor safety protocols, OSHA compliance, hazardous material screening, PPE checks (Sector 1-4 safety shoes, helmets, hi-vis vests).
2. Verification steps for contractor passes, vehicle gate clearance, handling expired or cancelled passes, logistics delivery trucks.
3. Live emergency evacuation instructions, assembly muster point coordination (Muster Points A, B, C), and headcount procedures.
4. Professional pass discrepancy resolution and incident logging.

Active Gate Stations:
- Main Gate (Gate 1 - Visitor Clearance)
- North Gate - Logistics (Gate 2 - Heavy Freight)
- South Gate - Staff & Contractors (Gate 3)
- Loading Bay Gate (Gate 4)

${contextInfo ? `Current Live Operational Context: ${JSON.stringify(contextInfo)}` : ''}

Maintain an authoritative, alert, clear, and security-first tone. Use concise bullet points for quick scanning on security terminals.`;

    const contents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || 'I could not generate a response. Please refer to standard operating safety guidelines.';
    res.json({ reply, model: selectedModel });
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    res.status(500).json({ error: err.message || 'Gemini AI service unavailable' });
  }
});

export default router;
