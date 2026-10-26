import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { isDriveConfigured } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const isAuthed = await verifyAdminAuth(req);
  return NextResponse.json({
    authenticated: isAuthed,
    driveConfigured: isDriveConfigured(),
  });
}
