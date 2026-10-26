import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { getEventBySlug } from '@/lib/events';
import { trashPhoto, verifyFileBelongsToFolder } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthed = await verifyAdminAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!id) {
      return NextResponse.json({ error: 'Missing photo ID' }, { status: 400 });
    }

    let folderId: string | undefined = undefined;
    if (slug) {
      const event = await getEventBySlug(slug);
      if (event) {
        folderId = event.driveFolderId;
        const belongs = await verifyFileBelongsToFolder(id, folderId);
        if (!belongs) {
          return NextResponse.json({ error: 'Photo does not belong to this event folder.' }, { status: 403 });
        }
      }
    }

    const trashed = await trashPhoto(id, folderId);
    if (!trashed) {
      return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Photo moved to trash.' });
  } catch (err: any) {
    console.error('Error deleting photo:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete photo' }, { status: 500 });
  }
}
