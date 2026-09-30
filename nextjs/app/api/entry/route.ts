import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabase, queryOne, execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await getDatabase();
    const { qrToken, passNumber, gateId, remarks, guardName, guardId } = await req.json();

    const pass = queryOne(
      `SELECT vp.*, v.name as visitor_name FROM visitor_passes vp JOIN visitors v ON v.id = vp.visitor_id WHERE vp.qr_token = ? OR UPPER(vp.pass_number) = UPPER(?)`,
      [qrToken || '', (passNumber || '').toUpperCase()]
    );

    if (!pass) {
      return NextResponse.json({ error: 'Pass not found' }, { status: 404 });
    }

    if (pass.status === 'INSIDE') {
      return NextResponse.json({ error: 'Visitor is already marked INSIDE' }, { status: 409 });
    }

    if (pass.status === 'EXITED') {
      return NextResponse.json({ error: 'Pass has already exited' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const logId = 'log_' + crypto.randomUUID().slice(0, 8);

    execute(
      `INSERT INTO entry_exit_logs (id, visitor_pass_id, action, gate_id, security_user_id, timestamp, remarks) VALUES (?, ?, 'ENTRY', ?, ?, ?, ?)`,
      [logId, pass.id, gateId || 'gate_main', guardId || 'u_sec_001', now, remarks || 'Gate Entry']
    );

    execute(`UPDATE visitor_passes SET status = 'INSIDE', updated_at = ? WHERE id = ?`, [now, pass.id]);

    return NextResponse.json({
      success: true,
      message: 'ENTRY SUCCESSFUL',
      entry: {
        visitorName: pass.visitor_name,
        passNumber: pass.pass_number,
        gate: 'Main Gate',
        entryTime: new Date(now).toLocaleTimeString(),
        recordedBy: guardName || 'Security Guard',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
