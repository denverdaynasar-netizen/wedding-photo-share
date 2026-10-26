import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { PhotoMetadata, EventStats } from '@/types';

const MOCK_STORAGE_DIR = path.join(process.cwd(), '.local-drive-storage');

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_REFRESH_TOKEN !== 'mock'
  );
}

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'mock') {
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
  }

  return oauth2Client;
}

export function getDriveClient() {
  const oauth2Client = getOAuth2Client();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Ensure mock storage directory exists
function ensureMockFolder(folderId: string): string {
  const folderPath = path.join(MOCK_STORAGE_DIR, folderId);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}

function getMockMetaFile(folderId: string): string {
  return path.join(ensureMockFolder(folderId), '_meta.json');
}

function getMockFiles(folderId: string): Array<PhotoMetadata & { trashed?: boolean; mimeType?: string }> {
  const metaFile = getMockMetaFile(folderId);
  if (!fs.existsSync(metaFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMockFiles(folderId: string, files: any[]): void {
  const metaFile = getMockMetaFile(folderId);
  fs.writeFileSync(metaFile, JSON.stringify(files, null, 2), 'utf-8');
}

/**
 * Creates a folder in Google Drive (or mock directory).
 */
export async function createDriveFolder(folderName: string): Promise<string> {
  if (!isDriveConfigured()) {
    const mockId = `mock-folder-${Date.now()}`;
    ensureMockFolder(mockId);
    return mockId;
  }

  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Wedding Photo Share Event Folder',
    },
    fields: 'id',
  });

  if (!res.data.id) {
    throw new Error('Failed to create Google Drive folder: No folder ID returned.');
  }

  return res.data.id;
}

/**
 * Initiates a Google Drive Resumable Upload Session URL.
 * Returns the resumable upload URL which the client can directly PUT file data to.
 */
export async function createResumableUploadSession(
  folderId: string,
  fileName: string,
  mimeType: string,
  uploaderName: string,
  slug: string,
  fileSize: number
): Promise<{ uploadUrl: string; mode: 'resumable' | 'direct' }> {
  if (!isDriveConfigured()) {
    // Return direct server route in mock mode
    return {
      uploadUrl: `/api/upload?folderId=${encodeURIComponent(folderId)}&fileName=${encodeURIComponent(fileName)}&uploaderName=${encodeURIComponent(uploaderName)}&slug=${encodeURIComponent(slug)}`,
      mode: 'direct',
    };
  }

  const oauth2Client = getOAuth2Client();
  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken = tokenResponse.token;

  if (!accessToken) {
    throw new Error('Failed to obtain Google Drive access token from refresh token.');
  }

  // Request resumable upload session from Google Drive API
  const metadata = {
    name: fileName,
    parents: [folderId],
    description: `Uploaded by ${uploaderName} via Wedding Photo Share`,
    properties: {
      uploaderName: uploaderName || 'Guest',
      slug: slug,
    },
  };

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': fileSize.toString(),
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Drive resumable session error:', response.status, errText);
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Google Drive did not return a resumable session Location header.');
  }

  return { uploadUrl, mode: 'resumable' };
}

/**
 * Server-side upload stream fallback.
 */
export async function uploadFileStream(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  uploaderName: string,
  slug: string
): Promise<PhotoMetadata> {
  if (!isDriveConfigured()) {
    ensureMockFolder(folderId);
    const id = `mock-photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const filePath = path.join(ensureMockFolder(folderId), `${id}_${fileName}`);
    fs.writeFileSync(filePath, buffer);

    const newPhoto: PhotoMetadata & { trashed?: boolean; mimeType?: string } = {
      id,
      name: fileName,
      createdTime: new Date().toISOString(),
      size: buffer.length,
      thumbnailUrl: `/api/photo/${id}/thumb`,
      fullUrl: `/api/photo/${id}/full`,
      uploaderName: uploaderName || 'Guest',
      slug,
      trashed: false,
      mimeType,
    };

    const files = getMockFiles(folderId);
    files.unshift(newPhoto);
    saveMockFiles(folderId, files);

    return newPhoto;
  }

  const drive = getDriveClient();
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      description: `Uploaded by ${uploaderName} via Wedding Photo Share`,
      properties: {
        uploaderName: uploaderName || 'Guest',
        slug: slug,
      },
    },
    media: {
      mimeType: mimeType,
      body: stream,
    },
    fields: 'id, name, createdTime, size, mimeType',
  });

  const file = res.data;
  return {
    id: file.id || '',
    name: file.name || fileName,
    createdTime: file.createdTime || new Date().toISOString(),
    size: Number(file.size || buffer.length),
    thumbnailUrl: `/api/photo/${file.id}/thumb`,
    fullUrl: `/api/photo/${file.id}/full`,
    uploaderName: uploaderName || 'Guest',
    slug,
  };
}

/**
 * Lists photos in an event folder.
 */
export async function listFolderPhotos(
  folderId: string,
  slug: string,
  pageSize: number = 24,
  pageToken?: string
): Promise<{ photos: PhotoMetadata[]; nextPageToken?: string }> {
  if (!isDriveConfigured()) {
    const all = getMockFiles(folderId).filter((f) => !f.trashed);
    const start = pageToken ? parseInt(pageToken, 10) : 0;
    const paged = all.slice(start, start + pageSize);
    const nextToken = start + pageSize < all.length ? String(start + pageSize) : undefined;
    return { photos: paged, nextPageToken: nextToken };
  }

  const drive = getDriveClient();
  const query = `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`;

  const res = await drive.files.list({
    q: query,
    pageSize: pageSize,
    pageToken: pageToken || undefined,
    orderBy: 'createdTime desc',
    fields: 'nextPageToken, files(id, name, createdTime, size, mimeType, thumbnailLink, properties, description)',
  });

  const files = res.data.files || [];
  const photos: PhotoMetadata[] = files.map((file) => {
    let uploader = file.properties?.uploaderName;
    if (!uploader && file.description) {
      const match = file.description.match(/Uploaded by (.*?) via/);
      if (match) uploader = match[1];
    }
    if (!uploader && file.name) {
      const parts = file.name.split('_');
      if (parts.length >= 3) {
        uploader = parts[1];
      }
    }

    return {
      id: file.id || '',
      name: file.name || 'Photo',
      createdTime: file.createdTime || new Date().toISOString(),
      size: Number(file.size || 0),
      thumbnailUrl: `/api/photo/${file.id}/thumb`,
      fullUrl: `/api/photo/${file.id}/full`,
      uploaderName: uploader || 'Guest',
      slug,
    };
  });

  return {
    photos,
    nextPageToken: res.data.nextPageToken || undefined,
  };
}

/**
 * Verifies that a fileId belongs to the specified event folder.
 */
export async function verifyFileBelongsToFolder(fileId: string, folderId: string): Promise<boolean> {
  if (!isDriveConfigured()) {
    const files = getMockFiles(folderId);
    return files.some((f) => f.id === fileId);
  }

  try {
    const drive = getDriveClient();
    const res = await drive.files.get({
      fileId: fileId,
      fields: 'parents, trashed',
    });

    if (res.data.trashed) return false;
    const parents = res.data.parents || [];
    return parents.includes(folderId);
  } catch (err) {
    console.error('Error verifying file folder ownership:', err);
    return false;
  }
}

/**
 * Get photo stream from Google Drive or mock store.
 */
export async function getPhotoStream(
  fileId: string,
  folderId?: string
): Promise<{ stream: Readable; mimeType: string; size?: number; name: string }> {
  if (!isDriveConfigured()) {
    if (!folderId) {
      // search in all mock folders
      if (fs.existsSync(MOCK_STORAGE_DIR)) {
        const folders = fs.readdirSync(MOCK_STORAGE_DIR);
        for (const f of folders) {
          const files = getMockFiles(f);
          const found = files.find((p) => p.id === fileId);
          if (found) {
            folderId = f;
            break;
          }
        }
      }
    }

    if (!folderId) {
      throw new Error('Photo not found');
    }

    const folderPath = path.join(MOCK_STORAGE_DIR, folderId);
    const entries = fs.readdirSync(folderPath);
    const targetFile = entries.find((e) => e.startsWith(`${fileId}_`));

    if (!targetFile) {
      throw new Error('Photo file not found on disk');
    }

    const filePath = path.join(folderPath, targetFile);
    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    return {
      stream,
      mimeType: 'image/jpeg',
      size: stat.size,
      name: targetFile.replace(`${fileId}_`, ''),
    };
  }

  const drive = getDriveClient();

  // Get metadata first
  const metaRes = await drive.files.get({
    fileId: fileId,
    fields: 'id, name, mimeType, size',
  });

  const mediaRes = await drive.files.get(
    { fileId: fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return {
    stream: mediaRes.data as unknown as Readable,
    mimeType: metaRes.data.mimeType || 'image/jpeg',
    size: metaRes.data.size ? Number(metaRes.data.size) : undefined,
    name: metaRes.data.name || 'photo.jpg',
  };
}

/**
 * Soft deletes (moves to trash) a photo.
 */
export async function trashPhoto(fileId: string, folderId?: string): Promise<boolean> {
  if (!isDriveConfigured()) {
    if (folderId) {
      const files = getMockFiles(folderId);
      const target = files.find((f) => f.id === fileId);
      if (target) {
        target.trashed = true;
        saveMockFiles(folderId, files);
        return true;
      }
    }
    return false;
  }

  const drive = getDriveClient();
  await drive.files.update({
    fileId: fileId,
    requestBody: {
      trashed: true,
    },
  });

  return true;
}

/**
 * Gets stats (count and total size) for an event folder.
 */
export async function getFolderStats(folderId: string): Promise<EventStats> {
  if (!isDriveConfigured()) {
    const files = getMockFiles(folderId).filter((f) => !f.trashed);
    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    return { photoCount: files.length, totalBytes };
  }

  try {
    const drive = getDriveClient();
    const query = `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`;

    let photoCount = 0;
    let totalBytes = 0;
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await drive.files.list({
        q: query,
        pageSize: 1000,
        pageToken,
        fields: 'nextPageToken, files(id, size)',
      });

      const files = res.data.files || [];
      photoCount += files.length;
      for (const f of files) {
        totalBytes += Number(f.size || 0);
      }

      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return { photoCount, totalBytes };
  } catch (err) {
    console.error('Error fetching folder stats:', err);
    return { photoCount: 0, totalBytes: 0 };
  }
}
