import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, queryOne, queryAll } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    await getDatabase();
    const identifier = params.token;

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
      return NextResponse.json(
        {
          valid: false,
          status: 'INVALID',
          title: 'INVALID VISITOR PASS',
          message: 'Unknown QR or Pass number. No record found in factory registry.',
        },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    if (pass.status === 'CANCELLED') {
      return NextResponse.json({
        valid: false,
        status: 'CANCELLED',
        title: 'INVALID VISITOR PASS',
        message: `Pass cancelled: ${pass.cancel_reason || 'Administrative action'}. DO NOT ALLOW ENTRY.`,
        pass,
      });
    }

    if (pass.status === 'EXPIRED' || pass.visit_date < today) {
      return NextResponse.json({
        valid: false,
        status: 'EXPIRED',
        title: 'INVALID VISITOR PASS',
        message: `PASS EXPIRED. Valid date was ${pass.visit_date}. DO NOT ALLOW ENTRY.`,
        pass,
      });
    }

    if (pass.status === 'INSIDE') {
      return NextResponse.json({
        valid: true,
        status: 'INSIDE',
        canEnter: false,
        canExit: true,
        title: 'VISITOR CURRENTLY INSIDE',
        message: 'Visitor is registered inside. Ready for exit processing.',
        pass,
      });
    }

    if (pass.status === 'EXITED') {
      return NextResponse.json({
        valid: false,
        status: 'EXITED',
        canEnter: false,
        canExit: false,
        title: 'VISITOR ALREADY EXITED',
        message: 'Visitor has already exited the factory.',
        pass,
      });
    }

    return NextResponse.json({
      valid: true,
      status: 'VALID',
      canEnter: true,
      canExit: false,
      title: 'VALID VISITOR PASS',
      message: 'Visitor pass verified. Ready for gate entry.',
      pass,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
