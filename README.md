# WW — Spotify Player + Pro Visualizer

A static GitHub Pages site that lets you:
- Log in with Spotify using Authorization Code with PKCE (no client secret).
- Use the Web Playback SDK (Spotify Premium required) to play tracks in your browser.
- Search tracks and control playback.
- Enjoy a pro-grade, multi-scene WebGL visualizer that reacts to Spotify Audio Analysis.

## Visual effects and scenes

- Fluid aurora/ink and flow fields: noise-driven shader with additive glow (Aurora).
- Kaleidoscope and mirror rooms: symmetry shader using album-art texture with BPM/section-driven segment switching (Kaleido).
- 3D tunnels and camera paths: cylinder tunnel with parallax starfield and rail motion (Tunnel).
- Voronoi/ripple surfaces: beat-synced ripples layered onto cellular crackle (Voronoi).
- Waveform ribbons and silk trails: layered parametric ribbons with motion blur via post-processing (Ribbons).
- Floating covers + DOF: depth-sorted album covers with soft opacity pops on beat and subtle parallax (Covers).
- Scene stack compositor: multiple scenes are rendered off-screen and blended in a final composite pass. Use the “Scene Stack” selector to isolate a scene or render all combined.

## Pro controls and post-processing

- Timeline/keyframes: scenes respond to beats, bars, tatums, sections from Spotify Audio Analysis (mapped in `viz/engine.js` with onBeat/onBar/onTatum/onSection). You can save presets for post processing and stack.
- Post FX pipeline: bloom, vignette, grain, chromatic aberration, and depth of field (tunable in UI).
- Camera system: each 3D scene (Tunnel, Ribbons, Covers) animates camera on rails, with subtle shake; mouse parallax in scenes where applicable.
- Color engines: album art palette extraction (Color Thief) drives accent and scene palettes.

## Setup

1. Spotify Developer Dashboard:
   - Add Redirect URI: `https://belisario-afk.github.io/WW/`
   - Do not use your client secret in a static site. Rotate any leaked secret. This app uses PKCE and does not require a client secret.

2. GitHub Pages:
   - Settings → Pages → Build and deployment
   - Source: Deploy from a branch
   - Branch: `main`, Folder: `/ (root)`

3. Files:
   - `index.html` (module-based app)
   - `style.css`
   - `app.js`
   - `viz/engine.js`
   - `viz/scenes/*.js`
   - `README.md`
   - Optional: `404.html` to redirect to root.

4. Open `https://belisario-afk.github.io/WW/` and log in.

## Notes

- Web Playback SDK requires a Spotify Premium account to output audio in the browser.
- No raw audio is routed to Web Audio; animation is driven by the player’s position and Spotify Audio Analysis events (beats/bars/etc.).
- If Color Thief cannot sample album art due to CORS, a default palette is used.
- Switch scenes from the “Scene Stack” dropdown. Save custom post settings with “Save Preset.”
