/* WW — Spotify Player + Visualizer (PKCE, no client secret) */

const cfg = window.APP_CONFIG;
const statusEl = document.getElementById('status');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const albumArtEl = document.getElementById('albumArt');
const trackNameEl = document.getElementById('trackName');
const artistNameEl = document.getElementById('artistName');
const resultsEl = document.getElementById('results');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playPauseBtn = document.getElementById('playPauseBtn');

const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');

const colorThief = new window.ColorThief();

let accessToken = null;
let refreshToken = null;
let tokenExpiresAt = 0;
let deviceId = null;
let player = null;
let currentTrackId = null;
let currentAnalysis = null;

const canvas = document.getElementById('viz');
const ctx = canvas.getContext('2d', { alpha: true });
let vizColors = {
  bg: '#0b0b10',
  accent: '#1db954',
  palette: ['#1db954', '#ffffff', '#2a2a2a']
};
let vizRAF = 0;

/* -------------------- Utilities -------------------- */
function logStatus(msg) {
  statusEl.textContent = msg;
  // console.info(msg);
}
function setButtonsEnabled(ena) {
  [prevBtn, nextBtn, playPauseBtn].forEach(b => b.disabled = !ena);
}

function saveTokens({ access_token, refresh_token, expires_in }) {
  accessToken = access_token || accessToken;
  if (refresh_token) refreshToken = refresh_token;
  tokenExpiresAt = Date.now() + (expires_in ? (expires_in - 60) : 3500) * 1000;

  localStorage.setItem('sp_access_token', accessToken);
  if (refreshToken) localStorage.setItem('sp_refresh_token', refreshToken);
  localStorage.setItem('sp_expires_at', String(tokenExpiresAt));
}

function loadTokensFromStorage() {
  accessToken = localStorage.getItem('sp_access_token');
  refreshToken = localStorage.getItem('sp_refresh_token');
  tokenExpiresAt = Number(localStorage.getItem('sp_expires_at') || 0);
}

function clearTokens() {
  accessToken = refreshToken = null;
  tokenExpiresAt = 0;
  localStorage.removeItem('sp_access_token');
  localStorage.removeItem('sp_refresh_token');
  localStorage.removeItem('sp_expires_at');
  localStorage.removeItem('sp_code_verifier');
  localStorage.removeItem('sp_state');
}

async function sha256(plain) {
  const enc = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return new Uint8Array(buf);
}
function base64UrlEncode(bytes) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

/* -------------------- Auth (PKCE) -------------------- */
async function beginLogin() {
  // Generate code_verifier and code_challenge
  const codeVerifier = randomString(64);
  const state = randomString(16);
  localStorage.setItem('sp_code_verifier', codeVerifier);
  localStorage.setItem('sp_state', state);

  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.CLIENT_ID,
    redirect_uri: cfg.REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    scope: cfg.SCOPES.join(' ')
  });

  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

async function exchangeCodeForToken(code) {
  const codeVerifier = localStorage.getItem('sp_code_verifier');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.REDIRECT_URI,
    client_id: cfg.CLIENT_ID,
    code_verifier: codeVerifier
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function refreshAccessToken() {
  if (!refreshToken) throw new Error('No refresh token available');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: cfg.CLIENT_ID
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error('Failed to refresh token');
  return res.json();
}

async function getValidAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  if (refreshToken) {
    const tok = await refreshAccessToken();
    saveTokens(tok);
    return accessToken;
  }
  return null;
}

/* -------------------- Spotify Web API helper -------------------- */
async function spFetch(path, init = {}) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${text}`);
  }
  return res.json();
}

/* -------------------- Player & Controls -------------------- */
function setupPlayer() {
  return new Promise((resolve, reject) => {
    if (!window.Spotify || !window.Spotify.Player) {
      reject(new Error('Web Playback SDK not loaded'));
      return;
    }
    player = new Spotify.Player({
      name: 'WW Visualizer',
      getOAuthToken: async cb => {
        try {
          cb(await getValidAccessToken());
        } catch (e) {
          console.error(e);
          cb(null);
        }
      },
      volume: 0.8
    });

    player.addListener('ready', ({ device_id }) => {
      deviceId = device_id;
      logStatus('Player ready');
      resolve();
    });

    player.addListener('not_ready', ({ device_id }) => {
      logStatus('Player not ready');
      if (deviceId === device_id) deviceId = null;
    });

    player.addListener('initialization_error', ({ message }) => console.error('init_error', message));
    player.addListener('authentication_error', ({ message }) => console.error('auth_error', message));
    player.addListener('account_error', ({ message }) => console.error('account_error', message));

    player.addListener('player_state_changed', state => {
      // Update play/pause icon
      if (state) {
        playPauseBtn.textContent = state.paused ? '▶️' : '⏸️';
        const tr = state.track_window?.current_track;
        if (tr?.id && tr.id !== currentTrackId) {
          onTrackChangedFromState(tr);
        }
      }
    });

    player.connect();
  });
}

async function transferPlayback() {
  if (!deviceId) return;
  await spFetch('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: false })
  });
}

async function onTrackChangedFromState(tr) {
  currentTrackId = tr.id;
  const art = tr.album?.images?.[0]?.url;
  if (art) {
    albumArtEl.src = art;
    await albumArtEl.decode().catch(() => {});
    updatePaletteFromAlbum();
  }
  trackNameEl.textContent = tr.name || '—';
  artistNameEl.textContent = (tr.artists || []).map(a => a.name).join(', ') || '—';
  fetchAnalysisForTrack(tr.id).catch(console.error);
}

async function playTrackUri(uri) {
  if (!deviceId) await setupPlayer().catch(console.error);
  await transferPlayback();
  await spFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri] })
  });
  setButtonsEnabled(true);
  logStatus('Playing on WW Visualizer');
}

async function getCurrentlyPlaying() {
  try {
    const data = await spFetch('/me/player/currently-playing?additional_types=track');
    if (!data || !data.item) return null;
    const tr = data.item;
    currentTrackId = tr.id;
    albumArtEl.src = tr.album?.images?.[0]?.url || '';
    trackNameEl.textContent = tr.name || '—';
    artistNameEl.textContent = (tr.artists || []).map(a => a.name).join(', ') || '—';
    if (albumArtEl.src) {
      await albumArtEl.decode().catch(() => {});
      updatePaletteFromAlbum();
    }
    fetchAnalysisForTrack(tr.id).catch(console.error);
    return tr;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/* -------------------- Search -------------------- */
async function searchTracks(q) {
  const params = new URLSearchParams({ q, type: 'track', limit: '12' });
  const data = await spFetch(`/search?${params.toString()}`);
  return data.tracks?.items || [];
}

function renderResults(items) {
  resultsEl.innerHTML = '';
  for (const t of items) {
    const li = document.createElement('li');
    li.className = 'result';
    const art = t.album?.images?.[2]?.url || t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
    li.innerHTML = `
      <img src="${art || ''}" alt="">
      <div>
        <div class="title">${t.name}</div>
        <div class="subtitle">${(t.artists || []).map(a => a.name).join(', ')}</div>
      </div>
      <div class="actions">
        <button class="primary">Play</button>
        <a href="${t.external_urls?.spotify}" target="_blank" rel="noopener">Open</a>
      </div>
    `;
    li.querySelector('button.primary').addEventListener('click', async () => {
      await playTrackUri(t.uri);
    });
    resultsEl.appendChild(li);
  }
}

/* -------------------- Audio Analysis-driven Visualization -------------------- */
async function fetchAnalysisForTrack(trackId) {
  try {
    currentAnalysis = await spFetch(`/audio-analysis/${trackId}`);
  } catch (e) {
    console.error('analysis error', e);
    currentAnalysis = null;
  }
}

function updatePaletteFromAlbum() {
  try {
    // Extract dominant and palette colors
    const pal = colorThief.getPalette(albumArtEl, 6);
    const dom = colorThief.getColor(albumArtEl);
    const toHex = (rgb) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    const palette = pal.map(toHex);
    vizColors = {
      bg: toHex(dom),
      accent: palette[0] || '#1db954',
      palette: palette
    };
    document.documentElement.style.setProperty('--accent', vizColors.accent);
    drawViz(true);
  } catch (e) {
    // Might fail if image not loaded with CORS allowance
    // Fallback: keep current colors
  }
}

function getApproxIntensityAt(ms) {
  // Use segments loudness to approximate energy (0..1)
  if (!currentAnalysis?.segments?.length) return 0.3;
  const t = ms / 1000;
  const segs = currentAnalysis.segments;
  // Binary search could be used; linear is fine for simplicity
  let seg = segs.find(s => t >= s.start && t < s.start + s.duration);
  if (!seg) seg = segs[segs.length - 1];
  const loudMax = seg.loudness_max || -20;
  // Normalize: loudness typically ranges [-60, 0] dB
  return Math.min(1, Math.max(0, (loudMax + 60) / 60));
}

function drawViz(force = false) {
  cancelAnimationFrame(vizRAF);
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== Math.floor(width) || canvas.height !== Math.floor(height)) {
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
  }

  const bars = 48;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radiusBase = Math.min(centerX, centerY) * 0.35;

  let lastTs = performance.now();

  const loop = async () => {
    const state = player ? await player.getCurrentState() : null;
    const playing = !!(state && !state.paused);
    const pos = state ? state.position : 0;

    const now = performance.now();
    const dt = (now - lastTs) / 1000;
    lastTs = now;

    // Background gradient from palette
    const g = ctx.createRadialGradient(centerX, centerY, radiusBase * 0.5, centerX, centerY, Math.max(centerX, centerY));
    const pal = vizColors.palette;
    g.addColorStop(0, hexWithAlpha(pal[0] || '#1db954', 0.35));
    g.addColorStop(1, hexWithAlpha(pal[2] || '#000000', 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ring pulse based on intensity
    const intensity = getApproxIntensityAt(pos);
    const pulse = 0.4 + intensity * 0.8;
    const ringR = radiusBase * (1 + 0.08 * Math.sin(now / 200 + pulse * 2));

    ctx.beginPath();
    ctx.arc(centerX, centerY, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = hexWithAlpha(pal[1] || '#ffffff', 0.45);
    ctx.lineWidth = 6;
    ctx.stroke();

    // Bars around the circle
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2 + now / 2000;
      const barLen = radiusBase * (0.2 + intensity * 0.8) * (0.6 + 0.4 * Math.sin(now / 600 + i));
      const x1 = centerX + Math.cos(angle) * (radiusBase - 6);
      const y1 = centerY + Math.sin(angle) * (radiusBase - 6);
      const x2 = centerX + Math.cos(angle) * (radiusBase + barLen);
      const y2 = centerY + Math.sin(angle) * (radiusBase + barLen);
      ctx.strokeStyle = hexWithAlpha(pal[(i % pal.length)] || vizColors.accent, 0.9);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (!force) vizRAF = requestAnimationFrame(loop);
  };

  vizRAF = requestAnimationFrame(loop);
}

function hexWithAlpha(hex, a) {
  // hex: #rrggbb
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0,2), 16);
  const g = parseInt(c.slice(2,4), 16);
  const b = parseInt(c.slice(4,6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* -------------------- Events & Boot -------------------- */
loginBtn.addEventListener('click', () => beginLogin().catch(e => alert(e.message)));
logoutBtn.addEventListener('click', () => {
  clearTokens();
  location.reload();
});

prevBtn.addEventListener('click', async () => {
  await spFetch('/me/player/previous', { method: 'POST' }).catch(console.error);
});
nextBtn.addEventListener('click', async () => {
  await spFetch('/me/player/next', { method: 'POST' }).catch(console.error);
});
playPauseBtn.addEventListener('click', async () => {
  const state = player ? await player.getCurrentState() : null;
  if (state?.paused) {
    await spFetch('/me/player/play', { method: 'PUT' }).catch(console.error);
  } else {
    await spFetch('/me/player/pause', { method: 'PUT' }).catch(console.error);
  }
});

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;

  // If the user pasted a Spotify URL, try to resolve it to a track
  const urlMatch = q.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
  const uriMatch = q.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  const id = (urlMatch && urlMatch[1]) || (uriMatch && uriMatch[1]) || null;
  if (id) {
    await playTrackUri(`spotify:track:${id}`);
    return;
  }

  try {
    const items = await searchTracks(q);
    renderResults(items);
  } catch (err) {
    alert('Search failed: ' + err.message);
  }
});

async function handleRedirect() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = localStorage.getItem('sp_state');

  if (code) {
    if (!state || state !== storedState) {
      alert('OAuth state mismatch. Please try logging in again.');
      return;
    }
    try {
      const tok = await exchangeCodeForToken(code);
      saveTokens(tok);
      // cleanup URL
      url.search = '';
      history.replaceState({}, document.title, url.toString());
      logStatus('Authenticated');
      loginBtn.hidden = true;
      logoutBtn.hidden = false;
      await afterAuth();
    } catch (e) {
      alert(e.message);
    }
  }
}

async function afterAuth() {
  setButtonsEnabled(false);
  await ensurePlayerReady();
  await getCurrentlyPlaying();
  drawViz();
}

async function ensurePlayerReady() {
  if (player && deviceId) return;

  // Wait until the Spotify SDK is present or its ready flag is set
  await new Promise(resolve => {
    if (window.Spotify || window.__spotifySDKReady) return resolve();
    // chain any existing callback
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      try { if (typeof prev === 'function') prev(); } catch {}
      resolve();
    };
  });

  await setupPlayer();
  await transferPlayback();
  loginBtn.hidden = true;
  logoutBtn.hidden = false;
  setButtonsEnabled(true);
}

async function boot() {
  loadTokensFromStorage();
  if (accessToken) {
    // Try refreshing if expired
    try {
      await getValidAccessToken();
      logStatus('Authenticated');
      loginBtn.hidden = true;
      logoutBtn.hidden = false;
      await afterAuth();
    } catch {
      clearTokens();
    }
  } else {
    logStatus('Not authenticated');
  }
  await handleRedirect();
}

boot();