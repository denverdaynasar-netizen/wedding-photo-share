export interface WeddingEvent {
  id: string;
  slug: string;
  name: string;
  welcomeMessage: string;
  eventCode?: string;
  maxPhotos?: number;
  uploadEnabled: boolean;
  driveFolderId: string;
  accentColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoMetadata {
  id: string;
  name: string;
  createdTime: string;
  size: number;
  thumbnailUrl: string;
  fullUrl: string;
  uploaderName?: string;
  slug: string;
}

export interface UploadSessionRequest {
  slug: string;
  accessCode?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploaderName?: string;
}

export interface UploadSessionResponse {
  uploadUrl: string;
  mode: 'resumable' | 'direct';
  fileId?: string;
  fileName: string;
}

export interface EventStats {
  photoCount: number;
  totalBytes: number;
}
