/**
 * Client-side image processing:
 * 1. Validates image type (JPG, PNG, WEBP, HEIC/HEIF) and 20MB limit.
 * 2. Converts HEIC/HEIF to JPEG via heic2any.
 * 3. Compresses & resizes with browser-image-compression to max 2400px, quality ~0.85, target <2MB.
 */

export interface ProcessedImage {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
}

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

export function validateClientFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `File "${file.name}" exceeds the 20MB limit.` };
  }

  const name = file.name.toLowerCase();
  const extMatch = name.match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';

  if (!ALLOWED_EXTS.includes(ext)) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported image format. Only JPG, PNG, WEBP, and HEIC are accepted (no video or documents).`,
    };
  }

  if (file.type && !file.type.startsWith('image/')) {
    return { valid: false, error: `File "${file.name}" has an invalid type (${file.type}). Only images are permitted.` };
  }

  return { valid: true };
}

export async function processImageForUpload(
  file: File,
  onProgress?: (step: string) => void
): Promise<ProcessedImage> {
  const originalSize = file.size;
  let workingBlob: Blob = file;
  let fileName = file.name;

  const isHeic =
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif') ||
    file.type.toLowerCase().includes('heic') ||
    file.type.toLowerCase().includes('heif');

  // Step 1: Convert HEIC if needed
  if (isHeic) {
    onProgress?.('Converting HEIC...');
    try {
      const heic2any = (await import('heic2any')).default;
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
      });

      const singleBlob = Array.isArray(converted) ? converted[0] : converted;
      workingBlob = singleBlob;
      fileName = fileName.replace(/\.(heic|heif)$/i, '.jpg');
    } catch (err) {
      console.error('HEIC conversion error:', err);
      throw new Error(`Failed to convert HEIC image: ${file.name}`);
    }
  }

  // Step 2: Compress & Resize
  onProgress?.('Optimizing image...');
  let compressedBlob: Blob = workingBlob;

  try {
    const imageCompression = (await import('browser-image-compression')).default;
    const workingFile = new File([workingBlob], fileName, { type: 'image/jpeg' });

    const options = {
      maxSizeMB: 2,
      maxWidthOrHeight: 2400,
      useWebWorker: true,
      initialQuality: 0.85,
      fileType: 'image/jpeg',
      alwaysKeepResolution: false,
    };

    const compressedFile = await imageCompression(workingFile, options);
    compressedBlob = compressedFile;
  } catch (compErr) {
    console.warn('browser-image-compression fallback to canvas resize:', compErr);
    // Canvas fallback
    compressedBlob = await canvasResizeFallback(workingBlob, 2400, 0.85);
  }

  const finalFile = new File([compressedBlob], fileName.replace(/\.[^/.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
  });

  const previewUrl = URL.createObjectURL(finalFile);

  return {
    file: finalFile,
    previewUrl,
    originalSize,
    compressedSize: finalFile.size,
  };
}

async function canvasResizeFallback(blob: Blob, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(blob);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else resolve(blob);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for canvas resize.'));
    };
    img.src = url;
  });
}

/**
 * Direct chunked or single upload to Google Drive resumable session URL with progress tracking.
 */
export function uploadToResumableSession(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Drive upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during direct Drive upload.'));
    };

    xhr.send(file);
  });
}
