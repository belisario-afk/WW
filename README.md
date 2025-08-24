# WW — Spotify Player + Pro Visualizer

A static GitHub Pages site that lets you:
- Log in with Spotify using Authorization Code with PKCE (no client secret).
- Use the Web Playback SDK (Spotify Premium required) to play tracks in your browser.
- Search tracks and control playback.
- Enjoy a pro-grade, multi-scene WebGL visualizer that reacts to Spotify Audio Analysis.

## Visual effects and scenes

- Fluid aurora/ink and flow fields (Aurora).
- Kaleidoscope/mirror using album art (Kaleido).
- 3D tunnel with starfield and camera rails (Tunnel).
- Voronoi/ripples synced to beats (Voronoi).
- Waveform-like ribbons and silk trails (Ribbons).
- Floating album covers with DOF (Covers).
- Scenes are composited together with post-processing.

## Setup

1. Spotify Developer Dashboard:
   - Add Redirect URI: `https://belisario-afk.github.io/WW/`
   - Do not use your client secret in a static site (PKCE doesn’t need it).

2. GitHub Pages:
   - Settings → Pages → Build and deployment → Deploy from a branch
   - Branch: `main`, Folder: `/ (root)`

3. Open `https://belisario-afk.github.io/WW/`, log in, and play a track.

## Notes

- Uses esm.sh for CORS-safe ESM imports of three and postprocessing.
- If album art sampling fails due to CORS, a default palette is used.
- Use the Pro panel to tune Bloom/DOF/Grain/Chromatic, choose presets, or switch scene stack.