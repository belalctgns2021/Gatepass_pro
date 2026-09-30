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

    if (pass.status !== 'INSIDE') {
      return NextResponse.json({ error: `Cannot record EXIT: Current status is ${pass.status}` }, { status: 400 });
    }

    const lastEntryLog = queryOne(
      `SELECT timestamp FROM entry_exit_logs WHERE visitor_pass_id = ? AND action = 'ENTRY' ORDER BY timestamp DESC LIMIT 1`,
      [pass.id]
    );

    const now = new Date();
    const nowIso = now.toISOString();

    let durationMinutes = 0;
    if (lastEntryLog?.timestamp) {
      const entryDate = new Date(lastEntryLog.timestamp);
      durationMinutes = Math.max(1, Math.round((now.getTime() - entryDate.getTime()) / (1000 * 60)));
    }

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const logId = 'log_' + crypto.randomUUID().slice(0, 8);

    execute(
      `INSERT INTO entry_exit_logs (id, visitor_pass_id, action, gate_id, security_user_id, timestamp, remarks, duration_minutes) VALUES (?, ?, 'EXIT', ?, ?, ?, ?, ?)`,
      [logId, pass.id, gateId || 'gate_main', guardId || 'u_sec_001', nowIso, remarks || 'Gate Exit', durationMinutes]
    );

    execute(`UPDATE visitor_passes SET status = 'EXITED', updated_at = ? WHERE id = ?`, [nowIso, pass.id]);

    return NextResponse.json({
      success: true,
      message: 'EXIT SUCCESSFUL',
      exit: {
        visitorName: pass.visitor_name,
        passNumber: pass.pass_number,
        gate: 'Main Gate',
        entryTime: lastEntryLog?.timestamp ? new Date(lastEntryLog.timestamp).toLocaleTimeString() : '--',
        exitTime: now.toLocaleTimeString(),
        duration: durationText,
        recordedBy: guardName || 'Security Guard',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
