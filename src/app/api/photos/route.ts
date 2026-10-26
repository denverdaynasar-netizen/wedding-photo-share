import { NextRequest, NextResponse } from 'next/server';
import { getEventBySlug } from '@/lib/events';
import { listFolderPhotos } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }

    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { photos, nextPageToken } = await listFolderPhotos(
      event.driveFolderId,
      event.slug,
      limit,
      cursor
    );

    return NextResponse.json({
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        welcomeMessage: event.welcomeMessage,
        hasCode: Boolean(event.eventCode && event.eventCode.trim() !== ''),
        uploadEnabled: event.uploadEnabled,
        accentColor: event.accentColor || '#C59B6D',
        maxPhotos: event.maxPhotos,
      },
      photos,
      nextCursor: nextPageToken || null,
    });
  } catch (err: any) {
    console.error('Error fetching event photos:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch photos' }, { status: 500 });
  }
}
