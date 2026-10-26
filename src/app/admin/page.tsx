'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  Lock,
  Plus,
  Settings,
  Download,
  Trash2,
  ExternalLink,
  QrCode,
  Image as ImageIcon,
  FolderOpen,
  RefreshCw,
  LogOut,
  CheckCircle2,
  FileText,
  Palette,
  Eye,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { WeddingEvent, PhotoMetadata } from '@/types';
import { downloadQrPng, generateTableCardPdf } from '@/lib/pdf-card';

interface EventWithStats extends WeddingEvent {
  stats?: {
    photoCount: number;
    totalBytes: number;
  };
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Data states
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Selected event photos & state
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Modals & form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formWelcome, setFormWelcome] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formMaxPhotos, setFormMaxPhotos] = useState<string>('');
  const [formUploadEnabled, setFormUploadEnabled] = useState(true);
  const [formAccentColor, setFormAccentColor] = useState('#C59B6D');

  const [origin, setOrigin] = useState('http://localhost:3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Check auth status
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check');
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        loadEvents();
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load events
  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (res.ok && data.events) {
        setEvents(data.events);
        if (data.events.length > 0 && !activeSlug) {
          setActiveSlug(data.events[0].slug);
        }
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Selected event object
  const activeEvent = events.find((e) => e.slug === activeSlug) || events[0] || null;

  // Load photos and QR for active event
  const loadEventPhotos = useCallback(async (slug: string) => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/photos?slug=${encodeURIComponent(slug)}&limit=100`);
      const data = await res.json();
      if (res.ok) {
        setPhotos(data.photos || []);
      }
    } catch (err) {
      console.error('Failed to load event photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  }, []);

  useEffect(() => {
    if (activeEvent) {
      loadEventPhotos(activeEvent.slug);

      const guestUrl = `${origin}/e/${activeEvent.slug}`;
      QRCode.toDataURL(guestUrl, { width: 300, margin: 2 })
        .then((url) => setQrDataUrl(url))
        .catch((e) => console.error(e));
    }
  }, [activeEvent, origin, loadEventPhotos]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid password');
      }

      setIsAuthenticated(true);
      loadEvents();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
  };

  // Open Create Form
  const openCreateModal = () => {
    setFormName('');
    setFormSlug('');
    setFormWelcome('Thank you for celebrating with us! Please snap and share all your favorite moments from our special day.');
    setFormCode('');
    setFormMaxPhotos('');
    setFormUploadEnabled(true);
    setFormAccentColor('#C59B6D');
    setShowCreateModal(true);
  };

  // Open Edit Form
  const openEditModal = () => {
    if (!activeEvent) return;
    setFormName(activeEvent.name);
    setFormSlug(activeEvent.slug);
    setFormWelcome(activeEvent.welcomeMessage);
    setFormCode(activeEvent.eventCode || '');
    setFormMaxPhotos(activeEvent.maxPhotos ? String(activeEvent.maxPhotos) : '');
    setFormUploadEnabled(activeEvent.uploadEnabled);
    setFormAccentColor(activeEvent.accentColor || '#C59B6D');
    setShowEditModal(true);
  };

  // Submit Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEvent(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          slug: formSlug,
          welcomeMessage: formWelcome,
          eventCode: formCode,
          maxPhotos: formMaxPhotos ? parseInt(formMaxPhotos, 10) : undefined,
          uploadEnabled: formUploadEnabled,
          accentColor: formAccentColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event');

      setShowCreateModal(false);
      await loadEvents();
      setActiveSlug(data.event.slug);
    } catch (err: any) {
      alert(err.message || 'Error creating event');
    } finally {
      setSubmittingEvent(false);
    }
  };

  // Submit Edit Event
  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;
    setSubmittingEvent(true);
    try {
      const res = await fetch(`/api/events/${activeEvent.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          welcomeMessage: formWelcome,
          eventCode: formCode,
          maxPhotos: formMaxPhotos ? parseInt(formMaxPhotos, 10) : undefined,
          uploadEnabled: formUploadEnabled,
          accentColor: formAccentColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update event');

      setShowEditModal(false);
      await loadEvents();
    } catch (err: any) {
      alert(err.message || 'Error updating event');
    } finally {
      setSubmittingEvent(false);
    }
  };

  // Toggle Upload on/off
  const toggleUpload = async (eventToToggle: EventWithStats) => {
    try {
      const res = await fetch(`/api/events/${eventToToggle.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadEnabled: !eventToToggle.uploadEnabled }),
      });
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.slug === eventToToggle.slug ? { ...e, uploadEnabled: !e.uploadEnabled } : e))
        );
      }
    } catch (err) {
      console.error('Failed to toggle upload status:', err);
    }
  };

  // Delete Photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!activeEvent) return;
    if (!confirm('Are you sure you want to move this photo to Google Drive trash?')) return;

    setDeletingPhotoId(photoId);
    try {
      const res = await fetch(`/api/photo/${photoId}?slug=${encodeURIComponent(activeEvent.slug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete photo');
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      loadEvents(); // update storage stats
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  // Authentication Gate Screen
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FDFBF7]">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl shadow-stone-200/50 border border-stone-200 text-center">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-stone-100 mb-4">
            <Lock className="w-6 h-6 text-stone-700" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-stone-900 mb-1">Admin Portal</h1>
          <p className="text-xs text-stone-500 mb-6">Enter your administrator password to manage wedding events.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Admin Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full text-center px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 text-sm"
                autoFocus
              />
              {loginError && <p className="text-red-500 text-xs mt-2">{loginError}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs shadow-md transition disabled:opacity-50"
            >
              {isLoggingIn ? 'Verifying...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-stone-100">
            <Link
              href="/admin/setup"
              className="text-xs text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Google Drive Setup Wizard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <p className="font-serif text-stone-500 text-sm">Authenticating...</p>
      </div>
    );
  }

  const guestUrl = activeEvent ? `${origin}/e/${activeEvent.slug}` : '';

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-800 pb-16">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-stone-200 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="font-serif font-bold text-lg text-stone-900 tracking-tight">
            Wedding Photo Share
          </span>
          <span className="text-[11px] font-semibold bg-stone-100 px-2.5 py-0.5 rounded-full text-stone-600">
            Admin
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin/setup"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium transition"
          >
            <Settings className="w-3.5 h-3.5 text-stone-500" />
            <span>Google Drive Settings</span>
          </Link>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-stone-700 font-medium transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Events Selector & Management Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {events.map((evt) => (
              <button
                key={evt.slug}
                onClick={() => setActiveSlug(evt.slug)}
                className={`px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                  evt.slug === activeSlug
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700'
                }`}
              >
                <span>{evt.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {evt.stats?.photoCount ?? 0}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs shrink-0 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Wedding Event</span>
          </button>
        </div>

        {activeEvent && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Event Info, Stats, Actions & Photos Moderation */}
            <div className="lg:col-span-2 space-y-6">
              {/* Event Card Header */}
              <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-stone-900">
                      {activeEvent.name}
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Slug: <code className="font-mono bg-stone-100 px-1.5 py-0.5 rounded">/e/{activeEvent.slug}</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={openEditModal}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5 text-stone-500" />
                      <span>Edit Settings</span>
                    </button>

                    <a
                      href={`/e/${activeEvent.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-800 transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Page</span>
                      <ExternalLink className="w-3 h-3 text-stone-400" />
                    </a>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100">
                    <span className="text-[11px] text-stone-500 block uppercase font-medium">Photos</span>
                    <span className="text-xl font-bold font-serif text-stone-900">
                      {photos.length}
                    </span>
                    {activeEvent.maxPhotos && (
                      <span className="text-[10px] text-stone-400 block">/ {activeEvent.maxPhotos} max</span>
                    )}
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100">
                    <span className="text-[11px] text-stone-500 block uppercase font-medium">Storage Used</span>
                    <span className="text-xl font-bold font-serif text-stone-900">
                      {formatBytes(activeEvent.stats?.totalBytes || photos.reduce((acc, p) => acc + p.size, 0))}
                    </span>
                    <span className="text-[10px] text-stone-400 block">in your Drive</span>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-100">
                    <span className="text-[11px] text-stone-500 block uppercase font-medium">Upload Status</span>
                    <button
                      onClick={() => toggleUpload(activeEvent)}
                      className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                        activeEvent.uploadEnabled
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${activeEvent.uploadEnabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                      <span>{activeEvent.uploadEnabled ? 'Active' : 'Paused'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct Google Drive Folder Link & ZIP Export Bar */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={`/api/export?slug=${encodeURIComponent(activeEvent.slug)}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download All as ZIP (Streamed)</span>
                  </a>

                  {activeEvent.driveFolderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${activeEvent.driveFolderId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium transition"
                    >
                      <FolderOpen className="w-4 h-4 text-amber-600" />
                      <span>Open Google Drive Folder</span>
                      <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                    </a>
                  )}
                </div>
              </div>

              {/* Photo Moderation Gallery */}
              <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-stone-600" />
                    <h3 className="font-serif font-bold text-lg text-stone-900">
                      Photo Moderation & Grid
                    </h3>
                  </div>

                  <button
                    onClick={() => loadEventPhotos(activeEvent.slug)}
                    disabled={loadingPhotos}
                    className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPhotos ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {photos.length === 0 && !loadingPhotos ? (
                  <div className="py-12 text-center text-stone-400 text-xs">
                    No photos have been uploaded to this event yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group relative aspect-square bg-stone-100 rounded-xl overflow-hidden border border-stone-200/80 shadow-2xs"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                        />

                        {/* Hover Overlay with Delete & Details */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-2">
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleDeletePhoto(photo.id)}
                              disabled={deletingPhotoId === photo.id}
                              className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-700 transition"
                              title="Move to Drive Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-[10px] text-white/90">
                            <p className="truncate font-medium">{photo.uploaderName || 'Guest'}</p>
                            <p className="text-white/60 truncate">{photo.name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: QR Code & Print Card */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-5 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold">
                  <QrCode className="w-3.5 h-3.5 text-stone-800" />
                  <span>Table Card & QR Code</span>
                </div>

                {qrDataUrl ? (
                  <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-stone-200 inline-block shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt="Guest QR Code"
                      className="w-48 h-48 mx-auto object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 mx-auto bg-stone-100 rounded-2xl animate-pulse" />
                )}

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-stone-800 truncate">
                    {guestUrl}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Guests scan this with their phone to instantly access the upload page.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => downloadQrPng(guestUrl, activeEvent.slug)}
                    className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-medium text-xs transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR Code (PNG)</span>
                  </button>

                  <button
                    onClick={() => generateTableCardPdf(activeEvent, guestUrl)}
                    className="w-full py-3 px-4 rounded-xl text-white font-medium text-xs shadow-md transition flex items-center justify-center gap-2 transform active:scale-98"
                    style={{ backgroundColor: activeEvent.accentColor || '#C59B6D' }}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Download Print-Ready PDF Table Card (A6)</span>
                  </button>
                </div>
              </div>

              {/* Event Access Code Callout */}
              <div className="bg-[#F8F6F2] rounded-3xl p-5 border border-stone-200/80 space-y-2 text-xs">
                <span className="font-semibold text-stone-800 block">Access Code Protection</span>
                <p className="text-stone-600">
                  {activeEvent.eventCode ? (
                    <span>
                      Active Code: <strong className="font-mono bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-900">{activeEvent.eventCode}</strong>
                    </span>
                  ) : (
                    <span className="text-stone-500 italic">No access code set (Open to everyone with QR code)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-serif font-bold text-stone-900">
              Create New Wedding Event
            </h2>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Couple / Event Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Noel & Danica's Wedding"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!formSlug) {
                      setFormSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '')
                      );
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  URL Slug (QR code destination) *
                </label>
                <div className="flex items-center">
                  <span className="bg-stone-100 border border-r-0 border-stone-200 px-3 py-2.5 rounded-l-xl text-stone-500">
                    /e/
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="noel-and-danica"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-r-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono text-stone-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Welcome Message for Guests
                </label>
                <textarea
                  rows={2}
                  value={formWelcome}
                  onChange={(e) => setFormWelcome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    Event Access Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LOVE2026"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 uppercase font-mono text-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    Max Photos Limit (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={formMaxPhotos}
                    onChange={(e) => setFormMaxPhotos(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formAccentColor}
                    onChange={(e) => setFormAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200"
                  />
                  <input
                    type="text"
                    value={formAccentColor}
                    onChange={(e) => setFormAccentColor(e.target.value)}
                    className="w-28 px-3 py-2 rounded-xl border border-stone-200 font-mono text-stone-800 uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium disabled:opacity-50"
                >
                  {submittingEvent ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-serif font-bold text-stone-900">
              Edit Event Settings
            </h2>

            <form onSubmit={handleEditEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Welcome Message
                </label>
                <textarea
                  rows={2}
                  value={formWelcome}
                  onChange={(e) => setFormWelcome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    Event Access Code
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty for open access"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 uppercase font-mono text-stone-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    Max Photos Limit
                  </label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={formMaxPhotos}
                    onChange={(e) => setFormMaxPhotos(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="editUploadToggle"
                  checked={formUploadEnabled}
                  onChange={(e) => setFormUploadEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-stone-900 focus:ring-0"
                />
                <label htmlFor="editUploadToggle" className="font-medium text-stone-700 cursor-pointer">
                  Enable guest photo uploads
                </label>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formAccentColor}
                    onChange={(e) => setFormAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200"
                  />
                  <input
                    type="text"
                    value={formAccentColor}
                    onChange={(e) => setFormAccentColor(e.target.value)}
                    className="w-28 px-3 py-2 rounded-xl border border-stone-200 font-mono text-stone-800 uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium disabled:opacity-50"
                >
                  {submittingEvent ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
