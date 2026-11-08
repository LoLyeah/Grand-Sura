import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['600', '700'],
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Grand Estates 3D — Luxury Landmark Monopoly',
  description:
    'A multiplayer-capable 3D Monopoly web game built with Three.js featuring real-world city landmarks, online rooms & pass-and-play bots, and an optional Male/Female AI Host with dynamic personalities, TTS commentary, Live voice chat, and Google Search trivia.',
  openGraph: {
    title: 'Grand Estates 3D — Luxury Landmark Monopoly',
    description:
      'A multiplayer-capable 3D Monopoly web game built with Three.js featuring real-world city landmarks, online rooms & pass-and-play bots, and an optional Male/Female AI Host with dynamic personalities, TTS commentary, Live voice chat, and Google Search trivia.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grand Estates 3D — Luxury Landmark Monopoly',
    description:
      'A multiplayer-capable 3D Monopoly web game built with Three.js featuring real-world city landmarks, online rooms & pass-and-play bots, and an optional Male/Female AI Host with dynamic personalities, TTS commentary, Live voice chat, and Google Search trivia.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#0F0C0A] text-[#FAF6F0] antialiased selection:bg-[#D4AF37]/30 selection:text-[#FAF6F0] overflow-hidden"
        style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
