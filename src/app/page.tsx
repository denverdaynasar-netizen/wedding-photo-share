import Link from 'next/link';
import { Camera, Heart, ShieldCheck, Sparkles, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { getAllEvents } from '@/lib/events';

export default async function HomePage() {
  const events = await getAllEvents();
  const featuredEvent = events[0] || null;

  return (
    <div className="min-h-screen text-stone-800 flex flex-col justify-between selection:bg-[#EADBCC]">
      {/* Editorial Header */}
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-[#E8DEC8]/60 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <Heart className="w-4 h-4 text-[#9C7A4A] stroke-[1.75]" />
          <span className="font-serif text-xl font-normal text-stone-900 tracking-tight">
            Wedding Photo Share
          </span>
        </div>

        <Link
          href="/admin"
          className="text-xs font-serif uppercase tracking-[0.15em] px-4 py-2 rounded-full border border-stone-300/80 hover:bg-white text-stone-700 transition"
        >
          Admin Portal
        </Link>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-16 sm:py-24 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-[#E8DEC8] text-xs text-[#8E6E3D] font-medium shadow-2xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="uppercase tracking-[0.2em] text-[10px]">Private Wedding Galleries</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-light text-stone-900 tracking-tight leading-[1.08]">
          Every cherished moment, <br />
          <span className="italic font-normal">captured by those who love you.</span>
        </h1>

        <p className="text-stone-600 font-serif italic text-lg sm:text-xl max-w-xl mx-auto font-normal leading-relaxed">
          Guests scan the table QR code with their phone camera to instantly share photos directly into your private 5TB Google Drive.
        </p>

        {featuredEvent && (
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/e/${featuredEvent.slug}`}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-white font-serif uppercase tracking-wider text-xs shadow-xl transition transform hover:brightness-105 active:scale-98"
              style={{
                background: 'linear-gradient(135deg, #B8935F 0%, #D4BA88 50%, #9C7A4A 100%)',
              }}
            >
              <Camera className="w-4 h-4" />
              <span>Enter &quot;{featuredEvent.name}&quot;</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-white/80 border border-stone-300 text-stone-700 font-serif uppercase tracking-wider text-xs hover:bg-white transition"
            >
              <span>Manage Events</span>
            </Link>
          </div>
        )}

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-16 text-left">
          <div className="glass-panel p-6 rounded-3xl shadow-2xs">
            <div className="w-10 h-10 rounded-2xl bg-[#F4EDE2] text-[#9C7A4A] flex items-center justify-center mb-4">
              <Camera className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="font-serif font-bold text-stone-900 text-base mb-1.5">Zero App Downloads</h3>
            <p className="text-stone-600 text-xs leading-relaxed font-light">
              Guests scan with their iPhone or Android camera, pick from their camera roll, or snap live photos directly in Safari / Chrome.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-3xl shadow-2xs">
            <div className="w-10 h-10 rounded-2xl bg-[#E8F0EA] text-[#2F6744] flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="font-serif font-bold text-stone-900 text-base mb-1.5">Direct to Your 5TB Drive</h3>
            <p className="text-stone-600 text-xs leading-relaxed font-light">
              High-resolution photos upload directly to your private Google Drive account using resumable sessions, bypassing server limits.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-3xl shadow-2xs">
            <div className="w-10 h-10 rounded-2xl bg-[#F5EBF0] text-[#7A3654] flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="font-serif font-bold text-stone-900 text-base mb-1.5">A6 Printable Table Cards</h3>
            <p className="text-stone-600 text-xs leading-relaxed font-light">
              Generate 1-click print-ready A6 cardstock PDFs with custom wedding calligraphy, table instructions, and QR codes.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 text-center border-t border-[#E8DEC8]/60 text-xs text-stone-500 font-serif italic">
        Wedding Photo Share • Crafted with elegance for your celebration
      </footer>
    </div>
  );
}
