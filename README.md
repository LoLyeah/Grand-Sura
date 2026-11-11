# Grand Estates 3D — Luxury Landmark Monopoly

A 3D and 2D Monopoly web game built with **Next.js (App Router)**, **Three.js**, and **Tailwind CSS**. Supports **2 to 16 players** across **5 board sizes** (24 to 84 spaces), an optional dynamic **Male/Female AI Host**, **Turn-Time Limits**, **Autonomous Macro-Economic Events**, and **Live Landmark Trivia**.

---

## Features

- **3D & 2D Board Modes**: Switch seamlessly between an interactive Three.js 3D board (`3D Angle`, `3D Top-Down`, `Follow Token`) and a high-contrast `2D Easy-Read` tabletop view.
- **5 Board Scales (Up to 16 Players)**:
  - **Mini Sprint** (24 spaces · 2–3P recommended, max 4P)
  - **Classic Grand** (40 spaces · 3–5P recommended, max 6P)
  - **Mega Metropolis** (52 spaces · 5–8P recommended, max 8P)
  - **Continental Empire** (68 spaces · 8–12P recommended, max 12P)
  - **Colossal World Tour** (84 spaces · 12–16P recommended, max 16P)
- **Game Modes**:
  - **Local Table (Pass-and-Play + AI Bots)**: Works 100% client-side on any static/serverless host (Vercel, Netlify).
  - **Online Multiplayer Rooms**: Uses the custom Node/WebSocket server (`server.ts`) when hosted on a persistent Node runtime.
- **Optional AI Host & Landmark Intelligence**:
  - Customizable Male/Female AI Host with preset personalities (*Witty Game Show Host*, *Ruthless Wall Street Tycoon*, *Calm Zen Financial Advisor*, *Dramatic Auctioneer*).
  - Live city & landmark intelligence powered by Google Search grounding (`/api/landmark-intel`).
- **Keyboard Shortcuts**:
  - `B` — Build a Villa/Hotel on the currently selected property (if owned and you have sufficient cash).
  - `H` — Collapse/Expand the bottom control dock.

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` file in the project root (see `.env.example`):
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel or Netlify

### 1. Deploy to Vercel (Recommended for Next.js)

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the project in the [Vercel Dashboard](https://vercel.com/new).
3. Configure the build settings (detected automatically):
   - **Framework Preset**: `Next.js`
   - **Build Command**: `next build` (or `npm run build`)
   - **Output Directory**: Default (`.next`)
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` = your API key (enables AI Host TTS and Landmark Search routes under `/api/*`).
5. Click **Deploy**.

### 2. Deploy to Netlify

1. Push this repository to your Git provider and import it into [Netlify](https://app.netlify.com/).
2. Configure the build settings:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `.next` (Netlify automatically uses `@netlify/plugin-nextjs` for Next.js App Router).
3. In **Site Configuration → Environment Variables**, add:
   - `GEMINI_API_KEY` = your API key
4. Trigger a deploy.

> **Note on Serverless Hosting (Vercel & Netlify)**:
> - **Local Table Mode (2–16 Players, Pass-and-Play + AI Bots)**, **3D & 2D Boards**, **AI Host TTS (`/api/host/tts`)**, and **Landmark Intelligence (`/api/landmark-intel`)** work out of the box on Vercel and Netlify serverless functions.
> - Notice that `next.config.ts` includes `output: 'standalone'`. Vercel and Netlify both support Next.js App Router builds directly; if Netlify prompts for standard output mode, you can remove `output: 'standalone'` from `next.config.ts`.
