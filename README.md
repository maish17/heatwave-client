# Heatwave Client

A mobile-first React + Capacitor app that shows heat-aware walking routes across Texas.  
It uses **MapLibre GL** for rendering, **PMTiles** (served from Cloudflare R2) for vector tiles, and a self‑hosted **GraphHopper** instance for routing.

> TL;DR to run: set env vars, `npm i`, `npm run dev` (web) or open the Android project with Android Studio (mobile).

---

## Features

- 📍 Live geolocation & “follow me” camera
- 🗺️ Offline‑friendly vector tiles via PMTiles
- 🧭 Three pedestrian route profiles:
  - `foot_fastest` (quickest)
  - `foot_balanced` (default)
  - `foot_coolest` (prefers cooler streets per custom model)
- 🔎 Reverse geocoding on map tap (simple label popup)
- 🧱 Clean, minimal UI with a bottom route picker
- ⚙️ Works as PWA and as a native Android app via Capacitor

---

## Architecture

```
heatwave-client/
├─ android/                 # Capacitor Android project (Android Studio)
├─ public/                  # Static assets
├─ src/
│  ├─ components/MapView/   # Map + route rendering
│  ├─ components/...        # UI components
│  ├─ lib/
│  │  ├─ routing.ts         # GraphHopper client & profile mapping
│  │  └─ ghModels.ts        # Custom Model types
│  └─ main.tsx              # App entry
├─ package.json
└─ README.md (this file)
```

**Backends (prod):**

- **Routing:** `https://gh.heatwaves.app` → Caddy (HTTPS) → GraphHopper on VM (`127.0.0.1:8989`)
- **Tiles:** `https://tiles.heatwaves.app/texas.pmtiles` → Cloudflare R2 + CDN

> In dev you can point routing to localhost/Android emulator or to the prod host. Tiles are public over HTTPS.

---

## Requirements

- Node.js 18+ and npm (or pnpm/yarn)
- Android Studio (to build or run on a device/emulator)
- Java 17+ (Android Gradle plugin)
- Optional: Capacitor CLI `npx cap --version`

---

## Configuration

Create a `.env` in the project root (values shown are sane defaults):

```env
# Routing base (prod)
VITE_GH_BASE_URL=https://gh.heatwaves.app

# Optional: GraphHopper.com cloud (not used when self-hosted)
# VITE_GH_API_KEY=your_cloud_key

# Tiles (PMTiles over HTTPS)
VITE_PM_TILES_URL=https://tiles.heatwaves.app/texas.pmtiles
```

Notes:

- The app’s routing client (`src/lib/routing.ts`) also accepts a **runtime override** via the `ghBaseUrl` option if you want to point at `:8989`, `localhost:8989`, or `10.0.2.2:8989` (Android emulator special host).
- Profiles available on the server must include: `foot_fastest`, `foot_balanced`, `foot_coolest`.

---

## Local Development (Web)

```bash
npm install
npm run dev
# open http://localhost:5173
```

If you’re running a local GraphHopper on the same machine (e.g., `:8989`), pass it in where `routeBetween` is called, or set `VITE_GH_BASE_URL=http://localhost:8989` in `.env`.

**Android emulator talking to your laptop:** use `10.0.2.2:8989` in `.env` or via the `ghBaseUrl` option (the code already normalizes `:8989` to the right host per platform).

---

## Android (Capacitor) — Run & Build

1. Build the web assets:
   ```bash
   npm run build
   ```
2. Sync native project and open Android Studio:
   ```bash
   npx cap sync android
   npx cap open android
   ```
3. **Run** on a device/emulator from Android Studio.

### Generate an APK (to share/install)

- Android Studio → **Build** → **Generate App Bundles or APKs** → **Generate APKs** → **debug** (or **release** if you need signing).
- Output paths:
  - Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
  - Release (signed): `android/app/build/outputs/apk/release/app-release.apk`

> “Generate Bundles” (AAB) is for Play Store; for direct installs use an APK.

---

## Routing API (GraphHopper)

The app calls `POST /route` with JSON. Example:

```bash
curl -X POST https://gh.heatwaves.app/route \
  -H 'content-type: application/json' \
  --data '{
    "profile": "foot_balanced",
    "points": [[-97.7429,30.2682], [-97.7400,30.2740]],
    "points_encoded": false,
    "locale": "en"
  }'
```

- **Profiles:** must match those configured on the server.
- When sending a **custom model**, the client automatically disables CH by setting `"ch.disable": true`.

---

## Production Notes (Server)

> Provided for reference; the backend lives outside this repo.

- **GraphHopper** runs on an Ubuntu VM as a **systemd service**.
- **Caddy** terminates TLS and reverse‑proxies to `127.0.0.1:8989`.
- Open only **80/443** publicly; keep `8989` private.
- Profiles configured:
  - `foot_fastest` (CH)
  - `foot_balanced` (LM)
  - `foot_coolest` (LM, custom model)
- Tiles are served from Cloudflare R2 with `Accept-Ranges`, long‑lived caching, and permissive CORS.

---

## Troubleshooting

### “Straight line” routes in the app

- This means the `/route` call failed. Check the browser/Android **console** and **network** tab for the error message.
- Common causes:
  - Wrong `VITE_GH_BASE_URL` (or a typo in a profile name).
  - GraphHopper service not running, or not imported yet.
  - Corporate/school network doing TLS interception or blocking.

### School/Enterprise Wi‑Fi

- Some networks install a **mitm** TLS proxy (e.g., “ContentKeeper”). Your device will show errors like _“self-signed certificate in certificate chain”_ and TLS will fail.  
  ✅ Try a **mobile hotspot** or **VPN**.

### PMTiles don’t load

- Make sure the device can resolve `tiles.heatwaves.app` and reach it over HTTPS.
- Confirm CORS/Range support:
  ```bash
  curl -I https://tiles.heatwaves.app/texas.pmtiles
  curl -I -H "Range: bytes=0-15" https://tiles.heatwaves.app/texas.pmtiles
  ```
- If a vector style fails, the app **auto‑falls back** to a demo style so the map still renders.

### Android emulator & localhost

- Use `10.0.2.2` instead of `localhost` to reach services running on your Mac.
- The code accepts `:8989` and normalizes it per platform.

---

## Scripts

Common npm scripts (actual names may vary by `package.json`):

- `dev` – start Vite dev server
- `build` – production web build
- `preview` – preview production build
- `cap sync android` – sync Capacitor Android project

---

## Contributing

1. Create a branch: `git checkout -b feature/my-change`
2. Commit changes: `git commit -m "feat: add X"`
3. Push: `git push origin feature/my-change`
4. Open a PR

Please run `npm run build` locally before opening a PR and ensure the map renders and routes work against your chosen backend.

---

## License

MIT © 2025 Heatwave

---

## Acknowledgements

- [MapLibre GL JS](https://maplibre.org/)
- [PMTiles](https://protomaps.com/pmtiles/)
- [GraphHopper](https://www.graphhopper.com/)
- OpenStreetMap contributors

---

## Contact

- Issues: open a GitHub issue on this repo
- Email: team@heatwaves.app (placeholder)
