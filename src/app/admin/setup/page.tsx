'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Key,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

function SetupContent() {
  const searchParams = useSearchParams();
  const refreshTokenParam = searchParams.get('refreshToken');
  const errorParam = searchParams.get('error');
  const warningParam = searchParams.get('warning');

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(errorParam || null);
  const [driveStatus, setDriveStatus] = useState<{ authenticated: boolean; driveConfigured: boolean } | null>(null);

  const [origin, setOrigin] = useState('http://localhost:3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }

    fetch('/api/admin/check')
      .then((r) => r.json())
      .then((data) => setDriveStatus(data))
      .catch((e) => console.error(e));
  }, []);

  const redirectUri = `${origin}/api/auth/google/callback`;

  const handleStartOAuth = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setConnectError('Please enter both Google Client ID and Client Secret.');
      return;
    }

    setConnectError(null);
    setIsConnecting(true);

    try {
      const res = await fetch(
        `/api/auth/google/url?clientId=${encodeURIComponent(clientId.trim())}&clientSecret=${encodeURIComponent(
          clientSecret.trim()
        )}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate auth URL');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setConnectError(err.message || 'Failed to start Google OAuth');
      setIsConnecting(false);
    }
  };

  const handleCopy = (text: string, isEnv: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isEnv) {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const envSnippet = `# Google Drive API Credentials
GOOGLE_CLIENT_ID="${clientId || 'YOUR_CLIENT_ID'}"
GOOGLE_CLIENT_SECRET="${clientSecret || 'YOUR_CLIENT_SECRET'}"
GOOGLE_REFRESH_TOKEN="${refreshTokenParam || 'YOUR_REFRESH_TOKEN'}"

# App Config
APP_URL="${origin}"
ADMIN_PASSWORD="your-secure-admin-password"
`;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-800 py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold mb-3">
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span>One-Time Google Drive Setup</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">
            Connect Your Google Account
          </h1>
          <p className="mt-2 text-stone-600 text-sm max-w-lg mx-auto">
            Link your personal Google Drive (with 5TB storage). Guests upload directly to your private Drive folders without signing in.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-xs text-stone-500">Current status:</span>
            {driveStatus?.driveConfigured ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Drive API Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" /> Running in Local Mock Mode
              </span>
            )}
          </div>
        </div>

        {/* Success Banner if token obtained */}
        {refreshTokenParam && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 space-y-4 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-emerald-950 text-lg">
                  Refresh Token Generated!
                </h3>
                <p className="text-xs text-emerald-700">
                  Save this refresh token into your environment variables (.env.local or Vercel Settings).
                </p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-emerald-950 truncate flex-1">
                {refreshTokenParam}
              </code>
              <button
                onClick={() => handleCopy(refreshTokenParam, false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-emerald-900 block">
                Copy all variables for .env.local:
              </span>
              <div className="relative bg-stone-900 text-stone-100 p-3 rounded-xl text-xs font-mono overflow-x-auto">
                <pre>{envSnippet}</pre>
                <button
                  onClick={() => handleCopy(envSnippet, true)}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-[11px] flex items-center gap-1"
                >
                  {copiedEnv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEnv ? 'Copied Snippet' : 'Copy .env'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
              >
                <span>Continue to Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Warning or Error notifications */}
        {warningParam && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>{warningParam}</p>
          </div>
        )}

        {connectError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p>{connectError}</p>
          </div>
        )}

        {/* Step-by-Step Instructions */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Setup Instructions (Google Cloud Console)
          </h2>

          <div className="space-y-6 text-xs text-stone-600 leading-relaxed">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-stone-100 text-stone-800 font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-stone-900 text-sm">Create Google Cloud Project & Enable Drive API</h3>
                <p>
                  Go to the{' '}
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-800 font-semibold underline inline-flex items-center gap-0.5"
                  >
                    Google Cloud Console <ExternalLink className="w-3 h-3" />
                  </a>
                  , create a new project (e.g., &quot;Wedding Photo Share&quot;), then navigate to <strong>APIs & Services &gt; Library</strong>. Search for <strong>Google Drive API</strong> and click <strong>Enable</strong>.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-stone-100 text-stone-800 font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-stone-900 text-sm">Configure OAuth Consent Screen & Publish to Production</h3>
                <p>
                  Go to <strong>APIs & Services &gt; OAuth consent screen</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-stone-600">
                  <li>User Type: <strong>External</strong></li>
                  <li>App name: <strong>Wedding Photo Share</strong></li>
                  <li>User support email: your personal Gmail/Google email</li>
                  <li>Developer contact email: your email</li>
                </ul>
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-amber-900 font-medium mt-2">
                  <span className="font-bold">CRITICAL: </span>
                  Under <em>Publishing status</em>, click <strong>&quot;Publish App&quot;</strong> to set it to <strong>&quot;In production&quot;</strong>. If left in &quot;Testing&quot; mode, Google will invalidate your refresh token after 7 days!
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-stone-100 text-stone-800 font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-stone-900 text-sm">Create OAuth 2.0 Credentials</h3>
                <p>
                  Go to <strong>APIs & Services &gt; Credentials &gt; Create Credentials &gt; OAuth client ID</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-stone-600">
                  <li>Application type: <strong>Web application</strong></li>
                  <li>Name: <strong>Wedding Photo Web App</strong></li>
                  <li>
                    Authorized redirect URIs:
                    <div className="mt-1 flex items-center gap-2">
                      <code className="bg-stone-100 px-2 py-1 rounded text-[11px] font-mono text-stone-800">
                        {redirectUri}
                      </code>
                      <button
                        onClick={() => handleCopy(redirectUri)}
                        className="text-stone-500 hover:text-stone-800"
                        title="Copy Redirect URI"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0">
                4
              </div>
              <div className="space-y-3 w-full">
                <h3 className="font-semibold text-stone-900 text-sm">Authorize & Generate Refresh Token</h3>
                <p>Paste the Client ID and Client Secret created in Step 3 below:</p>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      placeholder="e.g. GOCSPX-xxxxxxxxxxxxx"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-600 font-mono"
                    />
                  </div>

                  <button
                    onClick={handleStartOAuth}
                    disabled={isConnecting}
                    className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>{isConnecting ? 'Connecting to Google...' : 'Connect Google Drive & Get Refresh Token'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center pt-2">
          <Link
            href="/admin"
            className="text-xs text-stone-500 hover:text-stone-800 underline inline-flex items-center gap-1"
          >
            Return to Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
          <p className="text-sm font-serif text-stone-500">Loading setup...</p>
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
