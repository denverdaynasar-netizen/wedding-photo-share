'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Sparkles,
  Heart,
  User,
  Image as ImageIcon,
  Check,
  Plus,
} from 'lucide-react';
import { PhotoMetadata } from '@/types';
import { validateClientFile, processImageForUpload, uploadToResumableSession } from '@/lib/image-processing';

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'queued' | 'optimizing' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
  stepMessage?: string;
}

interface EventData {
  id: string;
  slug: string;
  name: string;
  welcomeMessage: string;
  hasCode: boolean;
  uploadEnabled: boolean;
  accentColor: string;
  maxPhotos?: number;
}

function GuestEventContent() {
  const params = useParams();
  const slug = (params?.slug as string) || '';

  // Event & Auth state
  const [event, setEvent] = useState<EventData | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const [enteredCode, setEnteredCode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Guest name
  const [guestName, setGuestName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Upload queue & state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // Gallery state
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // File input refs
  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load guest name and cached access code on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('wedding_guest_name');
      if (savedName) setGuestName(savedName);

      if (slug) {
        const savedCode = localStorage.getItem(`wedding_code_${slug}`);
        if (savedCode) {
          setEnteredCode(savedCode);
          setIsUnlocked(true);
        }
      }
    }
  }, [slug]);

  // Fetch event details and first batch of photos
  const fetchPhotos = useCallback(
    async (cursor?: string) => {
      if (!slug) return;
      setLoadingPhotos(true);
      try {
        const url = `/api/photos?slug=${encodeURIComponent(slug)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load photos');
        }

        setEvent(data.event);
        if (!data.event.hasCode) {
          setIsUnlocked(true);
        }

        if (cursor) {
          setPhotos((prev) => [...prev, ...data.photos]);
        } else {
          setPhotos(data.photos);
        }
        setNextCursor(data.nextCursor);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setEventError(err.message || 'Event not found or failed to load.');
      } finally {
        setLoadingPhotos(false);
        setLoadingEvent(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Save guest name
  const handleNameChange = (name: string) => {
    setGuestName(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wedding_guest_name', name);
    }
  };

  // Verify access code
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredCode.trim()) {
      setCodeError('Please enter the access code.');
      return;
    }
    setCodeError(null);
    setIsUnlocked(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`wedding_code_${slug}`, enteredCode.trim());
    }
  };

  // Add files to queue
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newItems: QueueItem[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file) => {
      const validation = validateClientFile(file);
      if (!validation.valid) {
        errors.push(validation.error || 'Invalid file');
        return;
      }

      newItems.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'queued',
        stepMessage: 'Ready to upload',
      });
    });

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
      setShowThankYou(false);
    }

    e.target.value = '';
  };

  // Concurrency-limited upload runner (3 concurrent uploads)
  useEffect(() => {
    if (isUploading) return;

    const queuedItems = queue.filter((item) => item.status === 'queued');
    if (queuedItems.length === 0) return;

    const processQueue = async () => {
      setIsUploading(true);

      const CONCURRENCY = 3;
      const executing = new Set<Promise<void>>();

      for (const item of queuedItems) {
        const task = (async () => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: 'optimizing', stepMessage: 'Optimizing...' } : q))
          );

          try {
            const processed = await processImageForUpload(item.file, (step) => {
              setQueue((prev) =>
                prev.map((q) => (q.id === item.id ? { ...q, stepMessage: step } : q))
              );
            });

            setQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', stepMessage: 'Connecting...' } : q))
            );

            const sessionRes = await fetch('/api/upload-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slug,
                accessCode: enteredCode.trim(),
                fileName: processed.file.name,
                fileSize: processed.file.size,
                mimeType: processed.file.type,
                uploaderName: guestName.trim() || 'Guest',
              }),
            });

            const sessionData = await sessionRes.json();
            if (!sessionRes.ok) {
              throw new Error(sessionData.error || 'Failed to start upload session');
            }

            if (sessionData.mode === 'resumable') {
              try {
                await uploadToResumableSession(sessionData.uploadUrl, processed.file, (percent) => {
                  setQueue((prev) =>
                    prev.map((q) => (q.id === item.id ? { ...q, progress: percent, stepMessage: `Uploading ${percent}%` } : q))
                  );
                });
              } catch (resumableErr) {
                console.warn('Resumable PUT fallback to server route:', resumableErr);
                const formData = new FormData();
                formData.append('file', processed.file);
                formData.append('slug', slug);
                formData.append('accessCode', enteredCode.trim());
                formData.append('uploaderName', guestName.trim() || 'Guest');

                const fbRes = await fetch('/api/upload', {
                  method: 'POST',
                  body: formData,
                });
                if (!fbRes.ok) {
                  const fbData = await fbRes.json();
                  throw new Error(fbData.error || 'Server upload failed');
                }
              }
            } else {
              const formData = new FormData();
              formData.append('file', processed.file);
              formData.append('slug', slug);
              formData.append('accessCode', enteredCode.trim());
              formData.append('uploaderName', guestName.trim() || 'Guest');

              const directRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });
              if (!directRes.ok) {
                const directData = await directRes.json();
                throw new Error(directData.error || 'Upload failed');
              }
            }

            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, status: 'done', progress: 100, stepMessage: 'Preserved in Drive' }
                  : q
              )
            );
          } catch (err: any) {
            console.error('Upload item failed:', err);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, status: 'error', errorMsg: err.message || 'Upload error', stepMessage: 'Failed' }
                  : q
              )
            );
          }
        })();

        executing.add(task);
        task.finally(() => executing.delete(task));

        if (executing.size >= CONCURRENCY) {
          await Promise.race(executing);
        }
      }

      await Promise.all(executing);
      setIsUploading(false);

      await fetchPhotos();
      setShowThankYou(true);
    };

    processQueue();
  }, [queue, isUploading, slug, enteredCode, guestName, fetchPhotos]);

  const handleRetry = (id: string) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: 'queued', progress: 0, errorMsg: undefined } : q))
    );
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handlePrevPhoto = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : photos.length - 1));
  }, [lightboxIndex, photos.length]);

  const handleNextPhoto = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) => (prev! < photos.length - 1 ? prev! + 1 : 0));
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'ArrowLeft') handlePrevPhoto();
      if (e.key === 'ArrowRight') handleNextPhoto();
      if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, handlePrevPhoto, handleNextPhoto]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const diff = touchStartX.current - touchEndX.current;
      if (diff > 50) handleNextPhoto();
      else if (diff < -50) handlePrevPhoto();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const accentColor = event?.accentColor || '#B8935F';

  // Loading Screen
  if (loadingEvent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAF7F2]">
        <div className="w-12 h-12 rounded-full border border-stone-300 border-t-amber-700 animate-spin" />
        <p className="mt-5 font-serif italic text-stone-600 text-xl tracking-wide">
          Unfolding celebration...
        </p>
      </div>
    );
  }

  // Error Screen
  if (eventError || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#FAF7F2]">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4 text-stone-400">
          <Heart className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h1 className="text-3xl font-serif text-stone-900 font-normal mb-2">Celebration Not Found</h1>
        <p className="text-stone-500 max-w-sm text-sm font-light">
          {eventError || 'This wedding gallery is not currently active.'}
        </p>
      </div>
    );
  }

  // Access Code Gate
  if (event.hasCode && !isUnlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAF7F2]">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl text-center border border-amber-900/10">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-5 bg-[#F2E8DC] text-[#8E6E3D]">
            <Lock className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#9C7A4A] font-semibold block mb-1">
            Private Gallery
          </span>
          <h2 className="text-3xl font-serif font-light text-stone-900 mb-3">{event.name}</h2>
          <p className="text-xs text-stone-500 leading-relaxed font-light mb-8 max-w-xs mx-auto">
            Please enter the access code written on your table card or ceremony invitation.
          </p>

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="ACCESS CODE"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                className="w-full text-center text-lg uppercase tracking-[0.2em] font-semibold px-4 py-3.5 rounded-2xl bg-white/90 border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#B8935F] text-stone-800 transition"
                autoFocus
              />
              {codeError && <p className="text-rose-600 text-xs mt-2 font-medium">{codeError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl text-white font-medium text-xs tracking-wider uppercase transition shadow-md hover:opacity-95 active:scale-98"
              style={{ backgroundColor: accentColor }}
            >
              Enter Celebration
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-stone-800 pb-32">
      {/* Hidden file inputs */}
      <input
        ref={filePickerRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Editorial Header */}
      <header className="pt-12 sm:pt-16 pb-8 px-6 text-center max-w-2xl mx-auto w-full">
        {/* Subtle Luxury Monogram / Eyebrow */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#C5A880]" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#9C7A4A] font-semibold">
            Wedding Gallery
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#C5A880]" />
        </div>

        {/* Couple Names */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-light text-stone-900 tracking-tight leading-tight">
          {event.name}
        </h1>

        {/* Intimate Welcome Note */}
        <p className="mt-3 text-stone-600 font-serif italic text-base sm:text-lg max-w-md mx-auto font-normal leading-relaxed">
          &ldquo;{event.welcomeMessage}&rdquo;
        </p>

        {/* Guest Name pill */}
        <div className="mt-5 flex items-center justify-center">
          {isEditingName || !guestName ? (
            <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-full px-4 py-1.5 border border-stone-200/80 shadow-xs">
              <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <input
                type="text"
                placeholder="Your name for uploads..."
                value={guestName}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                className="text-xs bg-transparent focus:outline-none text-stone-800 placeholder:text-stone-400 w-36"
              />
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="text-[11px] font-semibold text-[#8E6E3D] hover:text-stone-900"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-stone-200/70 text-xs text-stone-600 shadow-2xs hover:bg-white transition"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Labeling photos as <strong className="font-semibold text-stone-800">{guestName}</strong></span>
              <span className="text-[10px] text-stone-400 underline ml-0.5">Edit</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Gallery Area */}
      <main className="max-w-4xl w-full mx-auto px-3 sm:px-6 space-y-6">
        {/* Thank You Celebration Toast */}
        {showThankYou && (
          <div className="glass-panel border-emerald-300/60 rounded-3xl p-5 flex items-center justify-between shadow-lg shadow-emerald-900/5 animate-in fade-in slide-in-from-top duration-400">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 flex items-center justify-center text-emerald-700 shrink-0">
                <Sparkles className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div className="text-left">
                <h4 className="text-base font-serif font-bold text-stone-900">
                  Thank you for sharing your memories!
                </h4>
                <p className="text-xs text-stone-600 font-light">
                  Your photos were preserved in the couple&apos;s private Google Drive and added to the gallery below.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowThankYou(false)}
              className="text-stone-400 hover:text-stone-700 p-1.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Queue Card (when active) */}
        {queue.length > 0 && (
          <div className="glass-panel rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-700 font-serif">
                  Preserving Moments ({queue.filter((q) => q.status === 'done').length}/{queue.length})
                </span>
              </div>
              {!isUploading && queue.some((q) => q.status === 'done') && (
                <button
                  onClick={() => setQueue((prev) => prev.filter((q) => q.status !== 'done'))}
                  className="text-[11px] text-stone-500 hover:text-stone-800 underline font-light"
                >
                  Clear Completed
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/70 border border-stone-200/60 text-xs shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-stone-200 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="truncate font-medium text-stone-800 pr-2">
                        {item.file.name}
                      </span>
                      <span className="text-[10px] text-stone-500 shrink-0 font-light">
                        {item.status === 'done' ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Uploaded
                          </span>
                        ) : item.status === 'error' ? (
                          <span className="text-rose-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Retry needed
                          </span>
                        ) : (
                          item.stepMessage || 'Processing...'
                        )}
                      </span>
                    </div>

                    <div className="w-full bg-stone-200/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full transition-all duration-300 rounded-full"
                        style={{
                          width: `${item.progress}%`,
                          backgroundColor:
                            item.status === 'error'
                              ? '#e11d48'
                              : item.status === 'done'
                              ? '#059669'
                              : accentColor,
                        }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    {item.status === 'error' && (
                      <button
                        onClick={() => handleRetry(item.id)}
                        className="p-1 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-200/50"
                        title="Retry"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveQueueItem(item.id)}
                      className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery Header Bar */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex items-baseline gap-2">
            <h3 className="font-serif text-2xl font-light text-stone-900 tracking-tight">
              Shared Memories
            </h3>
            <span className="font-serif italic text-xs text-stone-500">
              ({photos.length} {photos.length === 1 ? 'photo' : 'photos'})
            </span>
          </div>

          <button
            onClick={() => fetchPhotos()}
            disabled={loadingPhotos}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition font-light px-2.5 py-1 rounded-full hover:bg-stone-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPhotos ? 'animate-spin text-amber-700' : ''}`} />
            <span>Update</span>
          </button>
        </div>

        {/* Gallery Grid (3 columns mobile, 4 columns desktop) */}
        {photos.length === 0 && !loadingPhotos ? (
          <div className="py-20 text-center glass-panel rounded-3xl border border-stone-200/60 p-8 shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-[#F4EDE2] mx-auto flex items-center justify-center text-[#9C7A4A] mb-3">
              <Camera className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h4 className="font-serif text-xl text-stone-800 font-normal">
              No photos captured yet
            </h4>
            <p className="text-xs text-stone-500 font-light max-w-xs mx-auto mt-1 leading-relaxed">
              Tap the shutter below to take the first photo and share the love.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                onClick={() => setLightboxIndex(idx)}
                className="photo-card group relative aspect-square bg-[#F0EBE1] rounded-2xl overflow-hidden cursor-pointer border border-stone-200/60 shadow-2xs"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Soft Vignette on Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2 sm:p-2.5">
                  <span className="text-[11px] text-white/95 truncate font-serif italic tracking-wide">
                    {photo.uploaderName || 'Guest'}
                  </span>
                </div>
              </div>
            ))}

            {/* Skeleton Shimmer */}
            {loadingPhotos &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="aspect-square bg-stone-200/70 rounded-2xl animate-pulse animate-shimmer"
                />
              ))}
          </div>
        )}

        {/* Load More Button */}
        {nextCursor && (
          <div className="pt-4 pb-8 text-center">
            <button
              onClick={() => fetchPhotos(nextCursor)}
              disabled={loadingPhotos}
              className="py-3 px-8 rounded-full bg-white/90 border border-stone-300 text-xs font-serif tracking-wider uppercase text-stone-800 hover:bg-stone-50 transition shadow-2xs"
            >
              {loadingPhotos ? 'Gathering more memories...' : 'Load More Photos'}
            </button>
          </div>
        )}
      </main>

      {/* Floating Bottom Shutter Bar (Luxury Mobile Dock) */}
      {event.uploadEnabled && lightboxIndex === null && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md">
          <div className="glass-dock rounded-full p-2 flex items-center justify-between gap-2 shadow-2xl">
            {/* Take Photo Camera Button */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-800 text-xs font-medium transition active:scale-95"
            >
              <Camera className="w-4 h-4 text-stone-700" />
              <span>Camera</span>
            </button>

            {/* Primary Golden Shutter Button */}
            <button
              onClick={() => filePickerRef.current?.click()}
              className="flex-[1.4] flex items-center justify-center gap-2 py-3.5 px-5 rounded-full text-white text-xs font-semibold uppercase tracking-wider transition shadow-lg hover:brightness-105 active:scale-95 transform"
              style={{
                background: `linear-gradient(135deg, ${accentColor} 0%, #D4BA88 50%, #9C7A4A 100%)`,
              }}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Photos</span>
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col justify-between select-none touch-none animate-in fade-in duration-200"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between p-5 text-white z-10">
            <div className="flex items-baseline gap-2">
              <span className="font-serif italic text-base text-stone-200">
                {photos[lightboxIndex].uploaderName || 'Guest'}
              </span>
              <span className="text-[11px] text-stone-400 font-light">
                • {lightboxIndex + 1} of {photos.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/photo/${photos[lightboxIndex].id}/full?download=true`}
                download
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                title="Download full resolution"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => setLightboxIndex(null)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Full Image Display */}
          <div className="flex-1 flex items-center justify-center p-3 relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIndex].fullUrl}
              alt={photos[lightboxIndex].name}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-300"
            />

            {/* Desktop Navigation Arrows */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevPhoto();
              }}
              className="hidden sm:flex absolute left-6 p-3.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextPhoto();
              }}
              className="hidden sm:flex absolute right-6 p-3.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Swipe Hint */}
          <div className="p-4 text-center text-stone-400 text-[11px] font-light tracking-wide">
            Swipe left or right to browse
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestEventPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAF7F2]">
          <div className="w-10 h-10 rounded-full border border-stone-300 border-t-amber-700 animate-spin" />
          <p className="mt-4 text-stone-500 font-serif italic text-base">Opening celebration...</p>
        </div>
      }
    >
      <GuestEventContent />
    </Suspense>
  );
}
