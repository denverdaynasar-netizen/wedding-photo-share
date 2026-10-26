import { NextRequest, NextResponse } from 'next/server';
import { getEventBySlug } from '@/lib/events';
import { checkRateLimit, sanitizeFileName, validateImageFile } from '@/lib/rate-limit';
import { uploadFileStream, getEventDriveFolderId } from '@/lib/google-drive';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const rateLimit = checkRateLimit(ip, 100, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Upload rate limit reached (100 photos/hour).' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const slug = formData.get('slug') as string | null;
    const accessCode = formData.get('accessCode') as string | null;
    const uploaderName = formData.get('uploaderName') as string | null;

    if (!file || !slug) {
      return NextResponse.json({ error: 'Missing required fields: file and slug.' }, { status: 400 });
    }

    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    if (!event.uploadEnabled) {
      return NextResponse.json({ error: 'Uploads are currently closed for this event.' }, { status: 403 });
    }

    if (event.eventCode && event.eventCode.trim() !== '') {
      if (!accessCode || accessCode.trim().toLowerCase() !== event.eventCode.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Incorrect access code.' }, { status: 401 });
      }
    }

    const validation = validateImageFile(file.name, file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const resolvedFolderId = await getEventDriveFolderId(
      event.driveFolderId,
      event.name,
      event.slug
    );

    const sanitizedName = sanitizeFileName(file.name, uploaderName || 'guest');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadedPhoto = await uploadFileStream(
      resolvedFolderId,
      sanitizedName,
      file.type || 'image/jpeg',
      buffer,
      uploaderName || 'Guest',
      event.slug
    );

    return NextResponse.json({
      success: true,
      photo: uploadedPhoto,
    });
  } catch (err: any) {
    console.error('Upload route error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed.' }, { status: 500 });
  }
}
