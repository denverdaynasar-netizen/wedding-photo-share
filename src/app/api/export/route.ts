import { NextRequest, NextResponse } from 'next/server';
import { ZipArchive } from 'archiver';
import { verifyAdminAuth } from '@/lib/auth';
import { getEventBySlug } from '@/lib/events';
import { listFolderPhotos, getPhotoStream } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const isAuthed = await verifyAdminAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }

    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // List all photos (paginate through all)
    let allPhotos: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const result = await listFolderPhotos(event.driveFolderId, event.slug, 100, pageToken);
      allPhotos = allPhotos.concat(result.photos);
      pageToken = result.nextPageToken;
    } while (pageToken);

    if (allPhotos.length === 0) {
      return NextResponse.json({ error: 'No photos to download in this event folder.' }, { status: 400 });
    }

    const archive = new ZipArchive({
      zlib: { level: 5 },
    });

    // Create web stream connected to archiver
    const webStream = new ReadableStream({
      async start(controller) {
        archive.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        archive.on('end', () => {
          controller.close();
        });

        archive.on('error', (err) => {
          console.error('Archiver stream error:', err);
          controller.error(err);
        });

        // Pipe each photo into the archive sequentially
        try {
          for (let i = 0; i < allPhotos.length; i++) {
            const photo = allPhotos[i];
            try {
              const { stream } = await getPhotoStream(photo.id, event.driveFolderId);
              const entryName = `${i + 1}_${photo.name}`;
              archive.append(stream, { name: entryName });
            } catch (pErr) {
              console.error(`Skipping unreadable photo ${photo.id}:`, pErr);
            }
          }
          await archive.finalize();
        } catch (streamErr) {
          console.error('Error during archive finalization:', streamErr);
          controller.error(streamErr);
        }
      },
    });

    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${event.slug}-photos.zip"`);
    headers.set('Cache-Control', 'no-store');

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('Error streaming ZIP export:', err);
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}
