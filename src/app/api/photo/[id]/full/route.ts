import { NextRequest, NextResponse } from 'next/server';
import { getPhotoStream } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing photo ID' }, { status: 400 });
    }

    const { stream, mimeType, size, name } = await getPhotoStream(id);

    // Convert node stream to web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    const headers = new Headers();
    headers.set('Content-Type', mimeType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (size) {
      headers.set('Content-Length', size.toString());
    }

    // Optional download header if ?download=true
    const url = new URL(req.url);
    if (url.searchParams.get('download') === 'true') {
      headers.set('Content-Disposition', `attachment; filename="${name || 'photo.jpg'}"`);
    }

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('Error fetching full photo:', err);
    return NextResponse.json({ error: 'Photo not found or inaccessible' }, { status: 404 });
  }
}
