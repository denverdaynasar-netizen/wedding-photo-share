import { cookies } from 'next/headers';
import crypto from 'crypto';

const ADMIN_COOKIE_NAME = 'wedding_admin_session';

function getExpectedToken(): string {
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  return crypto.createHash('sha256').update(`wedding_${password}`).digest('hex');
}

export async function verifyAdminAuth(req?: Request): Promise<boolean> {
  // Check Authorization header first (for API calls or scripts)
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const rawPass = process.env.ADMIN_PASSWORD || 'admin123';
      if (token === rawPass || token === getExpectedToken()) {
        return true;
      }
    }
  }

  // Check cookie
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
    if (!sessionCookie?.value) return false;
    return sessionCookie.value === getExpectedToken();
  } catch {
    return false;
  }
}

export function generateAdminToken(): string {
  return getExpectedToken();
}

export { ADMIN_COOKIE_NAME };
