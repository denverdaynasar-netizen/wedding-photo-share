import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = searchParams.get('clientSecret') || process.env.GOOGLE_CLIENT_SECRET;
    const origin = req.headers.get('origin') || process.env.APP_URL || new URL(req.url).origin;
    const redirectUri = `${origin}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_ID and GOCLIENT_SECRET must be provided in env or query parameters.' },
        { status: 400 }
      );
    }

    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ],
      state: Buffer.from(JSON.stringify({ clientId, clientSecret, origin })).toString('base64'),
    });

    return NextResponse.json({ url: authUrl });
  } catch (err: any) {
    console.error('Error generating Google OAuth URL:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate OAuth URL' }, { status: 500 });
  }
}
