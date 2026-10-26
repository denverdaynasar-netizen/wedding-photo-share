import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { getAllEvents, createEvent } from '@/lib/events';
import { createDriveFolder, getFolderStats } from '@/lib/google-drive';
import { sanitizeSlug } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const isAuthed = await verifyAdminAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const events = await getAllEvents();

    // Attach stats to each event
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const stats = await getFolderStats(event.driveFolderId);
        return {
          ...event,
          stats,
        };
      })
    );

    return NextResponse.json({ events: eventsWithStats });
  } catch (err: any) {
    console.error('Error listing events:', err);
    return NextResponse.json({ error: err.message || 'Failed to list events' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await verifyAdminAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, slug, welcomeMessage, eventCode, maxPhotos, uploadEnabled, accentColor } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    const cleanSlug = sanitizeSlug(slug || name);
    if (!cleanSlug) {
      return NextResponse.json({ error: 'Invalid event slug' }, { status: 400 });
    }

    // Auto-create folder in Google Drive
    const folderName = `Wedding - ${name.trim()}`;
    const driveFolderId = await createDriveFolder(folderName);

    const created = await createEvent({
      name: name.trim(),
      slug: cleanSlug,
      welcomeMessage: welcomeMessage || "Thank you for sharing your memories with us!",
      eventCode: eventCode?.trim() || '',
      maxPhotos: maxPhotos ? parseInt(maxPhotos, 10) : undefined,
      uploadEnabled: uploadEnabled !== false,
      driveFolderId,
      accentColor: accentColor || '#C59B6D',
    });

    return NextResponse.json({ success: true, event: created });
  } catch (err: any) {
    console.error('Error creating event:', err);
    return NextResponse.json({ error: err.message || 'Failed to create event' }, { status: 500 });
  }
}
