import fs from 'fs';
import path from 'path';
import { WeddingEvent } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

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

function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(DEFAULT_EVENTS, null, 2), 'utf-8');
  }
}

export async function getAllEvents(): Promise<WeddingEvent[]> {
  try {
    // If EVENTS_JSON env variable is provided (e.g. on read-only serverless), parse from env
    if (process.env.EVENTS_JSON) {
      try {
        const parsed = JSON.parse(process.env.EVENTS_JSON);
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {
        console.error('Failed to parse EVENTS_JSON env var:', err);
      }
    }

    ensureDataFile();
    const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
    return JSON.parse(data) as WeddingEvent[];
  } catch (err) {
    console.error('Error reading events:', err);
    return DEFAULT_EVENTS;
  }
}

export async function getEventBySlug(slug: string): Promise<WeddingEvent | null> {
  const events = await getAllEvents();
  const normalizedSlug = slug.toLowerCase().trim();
  return events.find((e) => e.slug.toLowerCase() === normalizedSlug) || null;
}

export async function saveEvents(events: WeddingEvent[]): Promise<void> {
  ensureDataFile();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
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
