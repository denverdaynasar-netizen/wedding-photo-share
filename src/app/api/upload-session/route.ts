import { NextRequest, NextResponse } from 'next/server';
import { getEventBySlug } from '@/lib/events';
import { checkRateLimit, sanitizeFileName, validateImageFile } from '@/lib/rate-limit';
import { createResumableUploadSession, getFolderStats, getEventDriveFolderId } from '@/lib/google-drive';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    
    // Check rate limit (100 per hour per IP)
    const rateLimit = checkRateLimit(ip, 100, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Upload rate limit reached (100 photos/hour). Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { slug, accessCode, fileName, fileSize, mimeType, uploaderName } = body;

    if (!slug || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters: slug and fileName.' }, { status: 400 });
    }

    // Validate event
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    if (!event.uploadEnabled) {
      return NextResponse.json({ error: 'Photo uploads are currently turned off for this event.' }, { status: 403 });
    }

    // Validate event code if configured
    if (event.eventCode && event.eventCode.trim() !== '') {
      if (!accessCode || accessCode.trim().toLowerCase() !== event.eventCode.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Incorrect access code.' }, { status: 401 });
      }
    }

    // Resolve real Google Drive folder
    const resolvedFolderId = await getEventDriveFolderId(
      event.driveFolderId,
      event.name,
      event.slug
    );

    // Check max photos limit if configured
    if (event.maxPhotos && event.maxPhotos > 0) {
      const stats = await getFolderStats(resolvedFolderId);
      if (stats.photoCount >= event.maxPhotos) {
        return NextResponse.json({ error: `Event photo limit (${event.maxPhotos}) has been reached.` }, { status: 403 });
      }
    }

    // Validate image format & size
    const validation = validateImageFile(fileName, mimeType, fileSize || 0);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generate standardized file name
    const sanitizedName = sanitizeFileName(fileName, uploaderName || 'guest');

    // Create session
    const session = await createResumableUploadSession(
      resolvedFolderId,
      sanitizedName,
      mimeType || 'image/jpeg',
      uploaderName || 'Guest',
      event.slug,
      fileSize || 1024
    );

    return NextResponse.json({
      uploadUrl: session.uploadUrl,
      mode: session.mode,
      fileName: sanitizedName,
    });
  } catch (err: any) {
    console.error('Error creating upload session:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initiate upload session.' },
      { status: 500 }
    );
  }
}
