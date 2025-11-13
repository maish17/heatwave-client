# Heatwave Client

Heatwave is a pedestrian navigation app designed for hot climates. Instead of only optimizing for distance or time, it offers walking routes that reduce heat exposure by preferring shaded, low-effort, and cooler-feeling paths.

This repository contains the frontend client and local configuration for the GraphHopper routing backend.

---

## Features

- MapLibre-based interactive map with vector tiles (PMTiles)
- Multiple pedestrian routing profiles:
  - `foot-fastest` – shortest/fastest route
  - `foot-cool` – heat-aware “coolest” route
  - `foot-balanced` – compromise between time and comfort
- Offline-capable tile data for Texas (via `texas.pmtiles`)
- Route comparison and selection UI
- Settings screen for tuning app behavior and route preferences
- Layout tuned for mobile-first use, with bottom navigation and header

---

## Tech Stack

- Frontend:
  - React + TypeScript
  - Vite
  - MapLibre GL JS
  - PMTiles (served from `public/tiles`)
- Routing backend:
  - GraphHopper
  - Custom models for pedestrian routing (`foot-fastest`, `foot-cool`, `foot-balanced`)
- Tooling:
  - ESLint
  - Vitest
  - Capacitor (for native builds)

---

## Project Structure

From the repository root:

```text
.
├── capacitor.config.ts
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── public
│   ├── favicon.svg
│   └── tiles
│       └── texas.pmtiles
├── README.md
├── server
│   └── graphhopper
│       ├── config.yml
│       └── custom_models
│           ├── foot-balanced.json
│           ├── foot-cool.json
│           └── foot-fastest.json
├── src
│   ├── app
│   │   ├── main.tsx
│   │   ├── providers
│   │   └── routes
│   │       ├── App.tsx
│   │       └── settings.tsx
│   ├── assets
│   │   └── fonts
│   ├── components
│   │   ├── index.ts
│   │   └── layout
│   │       ├── BottomBar
│   │       │   ├── BottomBar.tsx
│   │       │   └── index.ts
│   │       ├── Header
│   │       │   ├── Navbar.tsx
│   │       │   └── index.ts
│   │       ├── MapCanvas
│   │       │   ├── MapView.tsx
│   │       │   └── index.ts
│   │       └── SearchBox
│   │           ├── SearchBox.tsx
│   │           └── index.ts
│   ├── features
│   │   ├── places
│   │   │   ├── api
│   │   │   │   └── places.api.ts
│   │   │   ├── components
│   │   │   │   └── map/MapCanvas
│   │   │   │       └── routes.ts
│   │   │   └── hooks
│   │   └── routing
│   │       ├── api
│   │       │   ├── ghModels.ts
│   │       │   └── routing.api.ts
│   │       ├── components
│   │       │   └── RoutePanel
│   │       │       └── NavPanel.tsx
│   │       ├── hooks
│   │       └── lib
│   │           └── navigation.ts
│   ├── lib
│   │   ├── map
│   │   │   ├── colors.ts
│   │   │   ├── dom.ts
│   │   │   ├── routes.ts
│   │   │   ├── utils.ts
│   │   │   └── view.ts
│   │   ├── openInfo.ts
│   │   └── workers
│   ├── styles
│   │   ├── fonts.css
│   │   └── index.css
│   └── types
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

⸻

Getting Started

Prerequisites
• Node.js 20+ (recommended)
• npm 9+ (or compatible)
• Java 17+ (for the GraphHopper server)

1. Clone the repository

git clone maish17/heatwave-client.git
cd heatwave-client

2. Install dependencies

npm install

3. Configure GraphHopper

This repo assumes you are running a GraphHopper server configured with the files under server/graphhopper.

1. Download the GraphHopper Web JAR matching your GraphHopper version.
2. Place it somewhere on your machine (outside or inside this repo).
3. Adjust server/graphhopper/config.yml as needed:
   • Data source (OSM data for the region)
   • Graph cache directory
   • HTTP port (commonly 8989)
   • Custom model configuration pointing to the three JSON files:
   • foot-fastest.json
   • foot-cool.json
   • foot-balanced.json

Example command (adjust paths, versions, and memory to your setup):

java -Xmx4g -jar graphhopper-web-<version>.jar server server/graphhopper/config.yml

By default, the client expects GraphHopper to be accessible at:

http://localhost:8989/

If you change the port or host, update the routing API configuration in:

src/features/routing/api/routing.api.ts

or in your environment configuration if you externalize it.

4. Map tiles (PMTiles)

The app uses public/tiles/texas.pmtiles as its vector tile source.
• To use different regions, replace texas.pmtiles with your own PMTiles file and update any hard-coded paths in the map setup code under:

src/lib/map/_
src/lib/workers/_

Ensure the PMTiles URL used by the frontend matches the file location under public/.

5. Run the development server

In one terminal, ensure GraphHopper is running.

In another terminal (at the repo root):

npm run dev

By default, Vite serves the app at:

http://localhost:5173/

Open that in your browser. You should see the Heatwave map, be able to search/select locations, and request routes using the configured profiles.

⸻

Build and Production

Build

npm run build

This outputs a production build into dist/.

Preview (local production preview)

npm run preview

This serves the contents of dist/ locally so you can verify the production build.

You are responsible for hosting dist/ behind your chosen static hosting solution and ensuring that:
• The GraphHopper instance is reachable from the client.
• Any environment-specific routing URLs are correctly configured.

⸻

Testing and Linting

Run tests

Vitest is configured via vitest.config.ts. To run the test suite:

npm test

(or npm run test, depending on your scripts).

Lint

To run ESLint:

npm run lint

Fix errors as needed to keep the codebase consistent.

⸻

Mobile Builds (Capacitor)

Capacitor is configured via capacitor.config.ts so the app can be packaged as a native shell.

Basic flow (high level):
npm run build
npx cap sync
npx cap open android

Further details (signing, store deployment, native plugins) should follow official Capacitor and platform documentation.

⸻

Routing Profiles and Custom Models

The three main GraphHopper custom models live in:

server/graphhopper/custom_models/
foot-fastest.json
foot-cool.json
foot-balanced.json

Typical usage:
• foot-fastest:
• Prioritizes low total travel time / distance.
• foot-cool:
• Adds penalties for high-exposure segments (e.g., lack of shade, steep climbs, undesirable surfaces).
• foot-balanced:
• Blends both considerations, giving a route that is reasonably quick while avoiding the worst segments.

The frontend refers to these profiles via ghModels.ts and uses them when requesting routes through routing.api.ts. If you change model names or add new profiles, update ghModels.ts and any UI references accordingly.

⸻

Notes
• Environment-specific details (e.g., production URLs, API keys for places/geocoding, etc.) should be added where appropriate in src/features/\*/api and/or via Vite environment variables.
• If you extend the app with additional map sources, layers, or workers, keep related code under src/lib/map and src/lib/workers to maintain the current structure.
