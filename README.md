# WW — Spotify Player + Visualizer

A static GitHub Pages site that lets you:
- Log in with Spotify using Authorization Code with PKCE (no client secret).
- Use the Web Playback SDK (Spotify Premium required) to play tracks in your browser.
- Search tracks and control playback.
- See a music visualizer whose colors are extracted from the album cover and animation follows the track’s audio analysis.

## Quick start

1. In your Spotify Developer Dashboard:
   - Add Redirect URI: `https://belisario-afk.github.io/WW/`
   - Make sure to rotate/delete any leaked client secret. This app uses PKCE and does not need a client secret.
   - If you see any “Website URL” or “Allowlist” for the Web Playback SDK, add:
     - `https://belisario-afk.github.io`
     - `https://belisario-afk.github.io/WW`

2. Update `index.html` if you change anything:
   - `CLIENT_ID` (already set to yours).
   - `REDIRECT_URI` (must exactly match what you added in the Dashboard).

3. Enable GitHub Pages:
   - Go to your repo Settings → Pages → Build and deployment.
   - Source: `Deploy from a branch`
   - Branch: `main` and folder `/ (root)`
   - Save. Your site will be at `https://belisario-afk.github.io/WW/`

4. Commit and push the files:
   - index.html
   - style.css
   - app.js
   - README.md

5. Open your site and click “Log in with Spotify”.
   - After login, the page will redirect back.
   - Click play on a search result to start playback on the WW Visualizer “device”.

## Notes and limitations

- Spotify Web Playback SDK requires a Spotify Premium account to play audio.
- The SDK does not expose raw audio to the Web Audio API. The visualizer uses:
  - Album art colors (via Color Thief) for palette.
  - Spotify’s audio analysis endpoint to approximate intensity over time and animate bars/rings.
- If album art fails CORS color extraction, the palette falls back to default accent colors.
- If you change the repository name or use a custom domain, update the `REDIRECT_URI`.
- Do not include or commit any client secrets in this repo.

## Local testing

You can test locally with a simple server (authorization still redirects to GitHub Pages unless you add localhost as a redirect URI):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

If you want localhost login to work, add `http://localhost:8080/` to your Redirect URIs and update `REDIRECT_URI` accordingly.

## Security

This app uses Authorization Code with PKCE so no client secret is embedded. If you previously exposed your secret, rotate it in the Spotify Dashboard immediately.
"# WW" 
