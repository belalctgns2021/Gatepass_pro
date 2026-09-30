import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabase, queryOne, execute, hashPassword } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await getDatabase();
    const body = await req.json();
    const { email, password, gateId } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const hashedPassword = hashPassword(password);
    const user = queryOne(
      'SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER(?) AND password_hash = ?',
      [email.trim(), hashedPassword]
    );

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedGateId: gateId || 'gate_main',
    };

    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');

    return NextResponse.json({
      token,
      user: payload,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
