# Wedding Photo Share 💍📸

A mobile-first, elegant wedding photo sharing web application. Wedding guests scan a table QR code, upload high-resolution photos directly from their mobile camera or photo library, and view a live shared gallery. All photos are stored securely in the owner's personal 5TB Google Drive via the Google Drive API.

---

## 🌟 Key Features

- **Direct-to-Drive Architecture**: Uploads go directly to your personal Google Drive account (utilizing your 5TB storage). Guests never sign in; the Google Drive folder remains private.
- **Client-Side Optimization**:
  - Automatically converts iPhone `.heic` / `.heif` images to `.jpg` using `heic2any`.
  - Resizes & compresses images using canvas/browser compression (max 2400px, quality ~0.85, target <2MB).
  - Preserves correct EXIF orientation.
  - Strictly images only (JPG, PNG, WEBP, HEIC). Videos and documents are rejected both on client and server.
- **Resumable Uploads**: Bypasses Vercel serverless request body limits by generating Google Drive resumable upload sessions.
- **Mobile-First Experience**:
  - Large touch targets, camera shutter button (`capture="environment"`), and photo picker.
  - Optional guest name labeling (persisted in `localStorage`).
  - Per-photo upload progress bars with retry support and celebratory "Thank You!" confirmation banner.
  - Masonry gallery with skeleton loaders, lazy loading, and infinite scroll.
  - Full-screen lightbox viewer with left/right touch swipe gestures, keyboard arrow keys, and download buttons.
- **Admin Dashboard (`/admin`)**:
  - Protected with `ADMIN_PASSWORD`.
  - Create and edit wedding events with custom titles, slugs, welcome messages, access codes, photo limits, and accent colors.
  - Auto-creates a dedicated Google Drive folder for each event.
  - 1-click **Download QR Code as PNG** and **Print-Ready A6 PDF Table Card** with elegant wedding typography and centered QR code.
  - Photo moderation: preview and move inappropriate photos to Drive trash.
  - Direct link to open the event's Google Drive folder.
  - Real-time event statistics: photo count and total storage used.
  - **Download all as ZIP**: Streams a ZIP archive (`[event-slug]-photos.zip`) on-the-fly using Node.js streaming.
- **One-Time OAuth Setup Wizard (`/admin/setup`)**:
  - Interactive walkthrough to generate your permanent Google Drive refresh token.
- **Zero-Dependency Local Mock Mode**:
  - Runs out of the box locally even before Google Cloud credentials are added, allowing you to test the complete user journey and UI immediately.

---

## 🏗️ Architecture & Storage Decision

### Why Simple JSON Config (`data/events.json`)?
We chose a file-based JSON store with an optional environment variable fallback (`EVENTS_JSON`):
1. **Zero External Billing & Setup**: Eliminates the need for external database services (Firestore, DynamoDB, Supabase, or paid Redis).
2. **Instant Portability**: Works out of the box locally and in self-hosted Docker/Node.js environments.
3. **Vercel Serverless Ready**: For read-only or serverless production on Vercel, events can also be loaded directly from the `EVENTS_JSON` environment variable or synced to an external store without rewriting application logic.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Clone or navigate to the project directory
cd wedding-photo-share

# 2. Install dependencies
npm install

# 3. Copy the example environment file
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- Guest demo page: [http://localhost:3000/e/noel-and-danica](http://localhost:3000/e/noel-and-danica)
- Admin portal: [http://localhost:3000/admin](http://localhost:3000/admin) (Default password: `admin`)
- Setup wizard: [http://localhost:3000/admin/setup](http://localhost:3000/admin/setup)

---

## ☁️ Google Cloud Setup & Refresh Token Guide

Follow these steps to link your personal Google Drive account:

### 1. Create a Project & Enable the Drive API
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project**. Name it `Wedding Photo Share`.
3. In the left sidebar, navigate to **APIs & Services > Library**.
4. Search for **Google Drive API**, click it, and click **Enable**.

### 2. Configure OAuth Consent Screen ("In Production")
1. Navigate to **APIs & Services > OAuth consent screen**.
2. Select **User Type: External** and click **Create**.
3. Fill in the required fields:
   - **App name**: `Wedding Photo Share`
   - **User support email**: Your Google account email.
   - **Developer contact information**: Your email address.
4. Click **Save and Continue** through Scopes (no manual scopes need to be added here; the app requests `drive` / `drive.file` at runtime).
5. ⚠️ **CRITICAL STEP — Avoid 7-Day Token Expiration**:
   - Go back to the **OAuth consent screen** dashboard.
   - Under **Publishing status**, click **"Publish App"** and confirm.
   - Setting the status to **"In production"** ensures that Google OAuth refresh tokens **do not expire after 7 days**. (In "Testing" mode, Google revokes refresh tokens weekly).

### 3. Create OAuth 2.0 Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Set **Application type**: **Web application**.
4. Set **Name**: `Wedding Photo Web App`.
5. Under **Authorized redirect URIs**, add:
   - Local: `http://localhost:3000/api/auth/google/callback`
   - Production (Vercel): `https://your-app-domain.vercel.app/api/auth/google/callback`
6. Click **Create**.
7. Copy the generated **Client ID** and **Client Secret**.

### 4. Obtain the Refresh Token via Setup Wizard
1. Run your app and open `/admin/setup` (e.g., `http://localhost:3000/admin/setup`).
2. Paste your **Client ID** and **Client Secret** into the form.
3. Click **Connect Google Drive & Get Refresh Token**.
4. Google will ask you to sign in with your 5TB account and authorize access.
5. You will be redirected back to the Setup page with your **Refresh Token** displayed on screen.
6. Copy the token into your `.env.local` or Vercel environment variables:
   ```bash
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_REFRESH_TOKEN="your-refresh-token"
   ```

---

## 🚢 Deploying to Vercel

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/) and click **Add New > Project**, then import your repository.
3. In the project settings, add the following **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `GOOGLE_CLIENT_ID` | `...` | Google Cloud OAuth Client ID |
   | `GOOGLE_CLIENT_SECRET` | `...` | Google Cloud OAuth Client Secret |
   | `GOOGLE_REFRESH_TOKEN` | `...` | Refresh Token generated from `/admin/setup` |
   | `ADMIN_PASSWORD` | `your-secure-password` | Password for accessing `/admin` |
   | `APP_URL` | `https://your-domain.vercel.app` | Production app URL |
4. In Google Cloud Console > **Credentials** > your OAuth Client ID:
   - Add `https://your-domain.vercel.app/api/auth/google/callback` to **Authorized redirect URIs**.
5. Click **Deploy**.

---

## 📋 Managing Events & Printing Table Cards

### Creating a New Event
1. Go to `/admin` and log in with your `ADMIN_PASSWORD`.
2. Click **New Wedding Event**.
3. Fill in:
   - **Event Name**: e.g., `Sophia & Liam's Wedding`
   - **Slug**: e.g., `sophia-and-liam` (this forms `/e/sophia-and-liam`)
   - **Welcome Message**: Personalized message displayed to guests
   - **Event Access Code (Optional)**: If you want to protect the gallery with a code
   - **Max Photos Limit (Optional)**: Cap total photos or leave empty for unlimited
   - **Accent Color**: Choose a wedding color palette (gold, sage, dusty rose, champagne)
4. Click **Create Event**. A dedicated Google Drive folder is created automatically.

### Printing QR Code Table Cards
1. In the Admin Dashboard, select the wedding event.
2. In the right panel, preview the generated QR code.
3. Click **Download Print-Ready PDF Table Card (A6)**:
   - Generates an A6-sized (105mm × 148mm) portrait PDF ready for cardstock printing.
   - Features the couple's name, accent decorative borders, instructions ("Scan with your phone's camera to upload & view photos"), the access code (if enabled), and the centered QR code.
4. You can also click **Download QR Code (PNG)** if you are designing custom stationery in Canva, Photoshop, or InDesign.

---

## 🧪 Automated Testing

A test suite is included in `test_suite.mjs` verifying:
- Single photo upload
- 10 concurrent photo uploads
- HEIC photo upload
- Rejection of invalid formats (video `.mp4`, document `.pdf`)
- Access code authentication gate (401 on missing/wrong code, 200 on correct code)
- Paginated gallery loading
- Photo deletion (soft-delete to Drive trash)
- Streaming ZIP download

Run tests at any time with:
```bash
node test_suite.mjs
```

---

## 🔒 Security Best Practices

- Google credentials and Drive folder IDs are kept strictly server-side.
- Rate limiting enforces a maximum of 100 uploads per IP per hour.
- All file extensions and MIME types are validated against an allowlist of image types.
- Filenames are sanitized with a timestamp, uploader name, and random hash (`YYYYMMDD-HHmmss_guestname_xxxx.jpg`).
- Admin endpoints require authorization cookies or `Bearer` tokens.
