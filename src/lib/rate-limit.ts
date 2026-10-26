interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60 * 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitMap.set(identifier, newEntry);
    return { allowed: true, remaining: limit - 1, resetTime: newEntry.resetTime };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime };
}

export function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sanitizeFileName(originalName: string, uploaderName: string = 'guest'): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  
  const cleanUploader = (uploaderName || 'guest')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20) || 'guest';
    
  const random4 = Math.random().toString(36).substring(2, 6);

  // Preserve jpg/png/webp extension, default to .jpg
  let ext = '.jpg';
  const match = originalName.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    const originalExt = match[1].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(originalExt)) {
      ext = `.${originalExt === 'jpeg' ? 'jpg' : originalExt}`;
    }
  }

  return `${timestamp}_${cleanUploader}_${random4}${ext}`;
}

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

export function validateImageFile(fileName: string, mimeType: string, fileSize: number): { valid: boolean; error?: string } {
  // Max 20MB
  const MAX_SIZE = 20 * 1024 * 1024;
  if (fileSize > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds maximum 20MB limit.' };
  }

  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  if (!extMatch) {
    return { valid: false, error: 'File must have a valid image extension.' };
  }

  const ext = extMatch[1].toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Invalid file format (${ext}). Only JPG, PNG, WEBP, and HEIC images are allowed. No video or other documents.` };
  }

  // Normalize mime type check (allow empty mime if extension is verified valid image, but if present must be image)
  if (mimeType) {
    const lowerMime = mimeType.toLowerCase();
    if (!lowerMime.startsWith('image/') || (!ALLOWED_MIME_TYPES.has(lowerMime) && !lowerMime.includes('image/'))) {
      return { valid: false, error: `Invalid MIME type (${mimeType}). Only images are allowed.` };
    }
  }

  return { valid: true };
}
