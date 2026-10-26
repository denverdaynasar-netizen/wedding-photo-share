import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    const origin = process.env.APP_URL || new URL(req.url).origin;
    const redirectUri = `${origin}/api/auth/google/callback`;

    if (error) {
      return NextResponse.redirect(`${origin}/admin/setup?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/admin/setup?error=Missing_authorization_code`);
    }

    let clientId = process.env.GOOGLE_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (stateParam) {
      try {
        const parsedState = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
        if (parsedState.clientId) clientId = parsedState.clientId;
        if (parsedState.clientSecret) clientSecret = parsedState.clientSecret;
      } catch (e) {
        console.error('Error parsing OAuth state:', e);
      }
    }

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${origin}/admin/setup?error=Missing_Client_Credentials`);
    }

    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return NextResponse.redirect(
        `${origin}/admin/setup?warning=${encodeURIComponent(
          'Google did not return a refresh token. This happens if you already granted permissions previously. Please revoke app access in your Google Account security settings or re-run with prompt=consent.'
        )}`
      );
    }

    return NextResponse.redirect(
      `${origin}/admin/setup?refreshToken=${encodeURIComponent(refreshToken)}&status=success`
    );
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    const origin = process.env.APP_URL || new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/admin/setup?error=${encodeURIComponent(err.message || 'Token_Exchange_Failed')}`);
  }
}
