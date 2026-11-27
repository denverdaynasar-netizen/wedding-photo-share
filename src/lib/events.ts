import fs from 'fs';
import path from 'path';
import os from 'os';
import { WeddingEvent } from '@/types';
import { loadEventsFromDrive, saveEventsToDrive } from '@/lib/google-drive';

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'events.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'memoryshare_events.json');

const DEFAULT_EVENTS: WeddingEvent[] = [
  {
    id: 'evt-default-1',
    slug: 'noel-and-danica',
    name: "Noel & Danica's Wedding",
    welcomeMessage: "Thank you for celebrating with us! Please snap and share all your favorite moments from our special day.",
    eventCode: '',
    uploadEnabled: true,
    driveFolderId: 'mock-folder-noel-and-danica',
    accentColor: '#C59B6D',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

let memoryEventsCache: WeddingEvent[] | null = null;

function readSeedEvents(): WeddingEvent[] {
  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      const data = fs.readFileSync(TMP_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const data = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return DEFAULT_EVENTS;
}

function writeLocalFallback(events: WeddingEvent[]): void {
  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(events, null, 2), 'utf-8');
  } catch {}

  try {
    // Only works if filesystem is writable (local development)
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(events, null, 2), 'utf-8');
  } catch {
    // Gracefully ignore EROFS on read-only serverless deployment
  }
}

export async function getAllEvents(): Promise<WeddingEvent[]> {
  // 1. Return in-memory cache if available
  if (memoryEventsCache && memoryEventsCache.length > 0) {
    return memoryEventsCache;
  }

  // 2. EVENTS_JSON env var fallback
  if (process.env.EVENTS_JSON) {
    try {
      const parsed = JSON.parse(process.env.EVENTS_JSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryEventsCache = parsed;
        return parsed;
      }
    } catch (err) {
      console.error('Failed to parse EVENTS_JSON env var:', err);
    }
  }

  // 3. Try loading from Google Drive (cloud persistence)
  try {
    const driveEvents = await loadEventsFromDrive();
    if (driveEvents && driveEvents.length > 0) {
      memoryEventsCache = driveEvents as WeddingEvent[];
      writeLocalFallback(memoryEventsCache);
      return memoryEventsCache;
    }
  } catch (err) {
    console.warn('Drive events load failed, using local seed:', err);
  }

  // 4. Seed from local files or defaults
  const seed = readSeedEvents();
  memoryEventsCache = seed;

  // Initialize Drive in background if empty
  try {
    await saveEventsToDrive(seed);
  } catch {}

  return seed;
}

export async function getEventBySlug(slug: string): Promise<WeddingEvent | null> {
  const events = await getAllEvents();
  const normalizedSlug = slug.toLowerCase().trim();
  return events.find((e) => e.slug.toLowerCase() === normalizedSlug) || null;
}

export async function saveEvents(events: WeddingEvent[]): Promise<void> {
  memoryEventsCache = events;
  writeLocalFallback(events);

  // Persist permanently to Google Drive
  try {
    await saveEventsToDrive(events);
  } catch (err) {
    console.error('Error saving events to Google Drive:', err);
  }
}

export async function createEvent(
  eventData: Omit<WeddingEvent, 'id' | 'createdAt' | 'updatedAt'>
): Promise<WeddingEvent> {
  const events = await getAllEvents();
  const normalizedSlug = eventData.slug.toLowerCase().trim();

  if (events.some((e) => e.slug.toLowerCase() === normalizedSlug)) {
    throw new Error(`An event with slug "${normalizedSlug}" already exists.`);
  }

  const newEvent: WeddingEvent = {
    ...eventData,
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    slug: normalizedSlug,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  events.push(newEvent);
  await saveEvents(events);
  return newEvent;
}

export async function updateEvent(
  slug: string,
  updates: Partial<WeddingEvent>
): Promise<WeddingEvent | null> {
  const events = await getAllEvents();
  const normalizedSlug = slug.toLowerCase().trim();
  const index = events.findIndex((e) => e.slug.toLowerCase() === normalizedSlug);

  if (index === -1) {
    return null;
  }

  const updated: WeddingEvent = {
    ...events[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  events[index] = updated;
  await saveEvents(events);
  return updated;
}

export async function deleteEvent(slug: string): Promise<boolean> {
  const events = await getAllEvents();
  const normalizedSlug = slug.toLowerCase().trim();
  const filtered = events.filter((e) => e.slug.toLowerCase() !== normalizedSlug);

  if (filtered.length === events.length) {
    return false;
  }

  await saveEvents(filtered);
  return true;
}
