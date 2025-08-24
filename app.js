// Advanced WW Visualizer: PKCE + Web Playback + Smooth Director + Reworked UI
import { VizEngine } from './viz/engine.js?v=7';

const cfg = window.APP_CONFIG;

// UI elements
const stage = document.getElementById('stage');
const vizContainer = document.getElementById('viz3d');
const albumArtEl = document.getElementById('albumArt');
const hudArt = document.getElementById('hudArt');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statusEl = document.getElementById('status');
const scenePill = document.getElementById('scenePill');

const trackNameEl = document.getElementById('trackName');
const artistNameEl = document.getElementById('artistName');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playPauseBtn = document.getElementById('playPauseBtn');

const togglePanelBtn = document.getElementById('togglePanel');
const closePanelBtn = document.getElementById('closePanel');
const panel = document.getElementById('panel');

const themeSelect = document.getElementById('themeSelect');
const sceneMode = document.getElementById('sceneMode');

const bloomStrength = document.getElementById('bloomStrength');
const chromaticOffset = document.getElementById('chromaticOffset');
const grainAmount = document.getElementById('grainAmount');
const vignetteStrength = document.getElementById('vignetteStrength');
const renderScale = document.getElementById('renderScale');

const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const resultsEl = document.getElementById('results');

// State
const colorThief = new window.ColorThief();
let accessToken = null;
let refreshToken = null;
let tokenExpiresAt = 0;
let deviceId = null;
let player = null;
let currentAnalysis = null;
let currentTrackId = null;
let lastPosMs = 0;
let beatIdx = 0, barIdx = 0, sectionIdx = 0, tatumIdx = 0;

// Viz
const viz = new VizEngine(vizContainer);

// Utils
function logStatus(msg){ statusEl.textContent = msg; }
function setButtonsEnabled(on){ [prevBtn, nextBtn, playPauseBtn].forEach(b => b.disabled = !on); }

function saveTokens({ access_token, refresh_token, expires_in }) {
  accessToken = access_token || accessToken;
  if (refresh_token) refreshToken = refresh_token;
  tokenExpiresAt = Date.now() + (expires_in ? (expires_in - 60) : 3500) * 1000;
  localStorage.setItem('sp_access_token', accessToken || '');
  if (refreshToken) localStorage.setItem('sp_refresh_token', refreshToken || '');
  localStorage.setItem('sp_expires_at', String(tokenExpiresAt));
}
function loadTokens(){ accessToken = localStorage.getItem('sp_access_token'); refreshToken = localStorage.getItem('sp_refresh_token'); tokenExpiresAt = Number(localStorage.getItem('sp_expires_at')||0);}
function clearTokens(){ accessToken = refreshToken = null; tokenExpiresAt = 0; localStorage.removeItem('sp_access_token'); localStorage.removeItem('sp_refresh_token'); localStorage.removeItem('sp_expires_at'); localStorage.removeItem('sp_code_verifier'); localStorage.removeItem('sp_state'); }

// PKCE
async function sha256(s){ const enc = new TextEncoder().encode(s); const buf = await crypto.subtle.digest('SHA-256', enc); return new Uint8Array(buf); }
function base64Url(bytes){ return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function rand(len=64){ const a = new Uint8Array(len); crypto.getRandomValues(a); return base64Url(a); }
async function beginLogin(){
  const codeVerifier = rand(64), state = rand(16);
  localStorage.setItem('sp_code_verifier', codeVerifier);
  localStorage.setItem('sp_state', state);
  const codeChallenge = base64Url(await sha256(codeVerifier));
  const params = new URLSearchParams({
    response_type:'code', client_id: cfg.CLIENT_ID, redirect_uri: cfg.REDIRECT_URI,
    code_challenge_method:'S256', code_challenge:codeChallenge, state, scope: cfg.SCOPES.join(' ')
  });
  location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
async function exchangeCodeForToken(code){
  const codeVerifier = localStorage.getItem('sp_code_verifier');
  const body = new URLSearchParams({
    grant_type:'authorization_code', code, redirect_uri: cfg.REDIRECT_URI, client_id: cfg.CLIENT_ID, code_verifier: codeVerifier
  });
  const res = await fetch('https://accounts.spotify.com/api/token',{ method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  if(!res.ok) throw new Error('Token exchange failed');
  return res.json();
}
async function refreshAccessToken(){
  if(!refreshToken) throw new Error('No refresh token');
  const body = new URLSearchParams({ grant_type:'refresh_token', refresh_token: refreshToken, client_id: cfg.CLIENT_ID });
  const res = await fetch('https://accounts.spotify.com/api/token',{ method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  if(!res.ok) throw new Error('Failed to refresh token');
  return res.json();
}
async function getValidAccessToken(){
  if(accessToken && Date.now() < tokenExpiresAt) return accessToken;
  if(refreshToken){ const tok = await refreshAccessToken(); saveTokens(tok); return accessToken; }
  return null;
}
async function handleRedirect(){
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stored = localStorage.getItem('sp_state');
  if(code){
    if(state !== stored){ alert('OAuth state mismatch.'); return; }
    try{
      const tok = await exchangeCodeForToken(code);
      saveTokens(tok);
      url.search = ''; history.replaceState({}, document.title, url.toString());
      logStatus('Authenticated');
      loginBtn.hidden = true; logoutBtn.hidden = false;
      await afterAuth();
    }catch(e){ alert(e.message); }
  }
}

// Web API
async function spFetch(path, init={}){
  const token = await getValidAccessToken();
  if(!token) throw new Error('Not authenticated');
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers||{}) }
  });
  if(res.status === 204) return null;
  if(!res.ok){ const t = await res.text(); throw new Error(`Spotify API ${res.status}: ${t}`); }
  return res.json();
}

// Player
function setupPlayer(){
  return new Promise((resolve, reject)=>{
    if(!window.Spotify || !window.Spotify.Player){ reject(new Error('Web Playback SDK not loaded')); return; }
    player = new Spotify.Player({
      name: 'WW Visualizer',
      getOAuthToken: async cb => { try{ cb(await getValidAccessToken()); }catch{ cb(null); } },
      volume: 0.8
    });
    player.addListener('ready', ({ device_id }) => { deviceId = device_id; logStatus('Player ready'); resolve(); });
    player.addListener('not_ready', ({ device_id }) => { if(deviceId === device_id) deviceId = null; });
    player.addListener('player_state_changed', st => {
      if(st){
        playPauseBtn.textContent = st.paused ? '▶️' : '⏸️';
        const tr = st.track_window?.current_track;
        if(tr?.id && tr.id !== currentTrackId) onTrackChangedFromState(tr);
      }
    });
    player.addListener('initialization_error', ({ message }) => console.error('init_error', message));
    player.addListener('authentication_error', ({ message }) => console.error('auth_error', message));
    player.addListener('account_error', ({ message }) => console.error('account_error', message));
    player.connect();
  });
}
async function ensurePlayerReady(){
  if(player && deviceId) return;
  await new Promise(res=>{
    if(window.Spotify || window.__spotifySDKReady) return res();
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = ()=>{ try{ if(typeof prev==='function') prev(); }catch{} res(); };
  });
  await setupPlayer();
  await transferPlayback();
  loginBtn.hidden = true; logoutBtn.hidden = false;
  setButtonsEnabled(true);
}
async function transferPlayback(){
  if(!deviceId) return;
  await spFetch('/me/player', { method:'PUT', body: JSON.stringify({ device_ids:[deviceId], play:false }) });
}
async function onTrackChangedFromState(tr){
  currentTrackId = tr.id;
  const art = tr.album?.images?.[0]?.url;
  if(art){
    albumArtEl.src = art;
    hudArt.src = art;
    await albumArtEl.decode().catch(()=>{});
    applyPaletteFromAlbum();
    viz.setAlbumArtTexture(albumArtEl);
  }
  trackNameEl.textContent = tr.name || '—';
  artistNameEl.textContent = (tr.artists||[]).map(a=>a.name).join(', ') || '—';
  fetchAnalysisForTrack(tr.id).catch(console.error);
}
async function getCurrentlyPlaying(){
  try{
    const data = await spFetch('/me/player/currently-playing?additional_types=track');
    if(!data || !data.item) return null;
    const tr = data.item;
    currentTrackId = tr.id;
    const art = tr.album?.images?.[0]?.url || '';
    albumArtEl.src = art; hudArt.src = art;
    trackNameEl.textContent = tr.name || '—';
    artistNameEl.textContent = (tr.artists||[]).map(a=>a.name).join(', ') || '—';
    if(art){ await albumArtEl.decode().catch(()=>{}); applyPaletteFromAlbum(); viz.setAlbumArtTexture(albumArtEl); }
    fetchAnalysisForTrack(tr.id).catch(console.error);
    return tr;
  }catch(e){ console.error(e); return null; }
}

// Search
async function searchTracks(q){
  const params = new URLSearchParams({ q, type:'track', limit:'10' });
  const data = await spFetch(`/search?${params.toString()}`);
  return data.tracks?.items || [];
}
function renderResults(items){
  resultsEl.innerHTML = '';
  for(const t of items){
    const li = document.createElement('li');
    li.className = 'result';
    const art = t.album?.images?.[2]?.url || t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
    li.innerHTML = `
      <img src="${art||''}" alt="">
      <div>
        <div class="title">${t.name}</div>
        <div class="subtitle">${(t.artists||[]).map(a=>a.name).join(', ')}</div>
      </div>
      <div><button class="primary">Play</button></div>
    `;
    li.querySelector('button').addEventListener('click', async ()=>{ await playTrackUri(t.uri); });
    resultsEl.appendChild(li);
  }
}

// Analysis mapping + Director
async function fetchAnalysisForTrack(trackId){
  try{
    currentAnalysis = await spFetch(`/audio-analysis/${trackId}`);
    viz.setAnalysis(currentAnalysis);
    beatIdx = barIdx = sectionIdx = tatumIdx = 0;
    lastPosMs = 0;
    const tempo = currentAnalysis.track?.tempo || 120;
    viz.setTempo(tempo);
    viz.directorReset(tempo); // reset director pacing
  }catch(e){ console.error('analysis error', e); currentAnalysis = null; }
}
function stepAnalysis(prevMs, nowMs){
  if(!currentAnalysis) return;
  const m = s => s*1000;
  const pass = (arr, idx, cb)=>{ while(idx < arr.length && m(arr[idx].start) <= nowMs){ if(m(arr[idx].start) > prevMs) cb(arr[idx], idx); idx++; } return idx; };
  beatIdx = pass(currentAnalysis.beats||[], beatIdx, obj=>viz.onBeat(obj));
  tatumIdx = pass(currentAnalysis.tatums||[], tatumIdx, obj=>viz.onTatum(obj));
  barIdx = pass(currentAnalysis.bars||[], barIdx, obj=>viz.onBar(obj));
  sectionIdx = pass(currentAnalysis.sections||[], sectionIdx, obj=>viz.onSection(obj));
}

// Colors
function applyPaletteFromAlbum(){
  try{
    const pal = colorThief.getPalette(albumArtEl, 6);
    const dom = colorThief.getColor(albumArtEl);
    const toHex = rgb => '#' + rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
    const palette = pal.map(toHex);
    const accent = palette[0] || '#1db954';
    document.documentElement.style.setProperty('--accent', accent);
    viz.setPalette({ dominant: toHex(dom), accent, palette });
  }catch(e){}
}

// Director controls
function setTheme(name){
  switch(name){
    case 'neon': viz.applyTheme({ bias:'cool', contrast:1.1, sat:1.2 }); break;
    case 'warm': viz.applyTheme({ bias:'warm', contrast:1.05, sat:1.1 }); break;
    case 'cool': viz.applyTheme({ bias:'cool', contrast:1.0, sat:1.0 }); break;
    case 'mono': viz.applyTheme({ bias:'mono', contrast:1.15, sat:0.2 }); break;
    default: viz.applyTheme({ bias:'album', contrast:1.0, sat:1.0 });
  }
}

// Events
loginBtn.addEventListener('click', ()=>beginLogin().catch(e=>alert(e.message)));
logoutBtn.addEventListener('click', ()=>{ clearTokens(); location.reload(); });

prevBtn.addEventListener('click', async ()=>{ await spFetch('/me/player/previous', { method:'POST' }).catch(console.error); });
nextBtn.addEventListener('click', async ()=>{ await spFetch('/me/player/next', { method:'POST' }).catch(console.error); });
playPauseBtn.addEventListener('click', async ()=>{
  const state = player ? await player.getCurrentState() : null;
  if(state?.paused) await spFetch('/me/player/play', { method:'PUT' }).catch(console.error);
  else await spFetch('/me/player/pause', { method:'PUT' }).catch(console.error);
});

togglePanelBtn.addEventListener('click', ()=>panel.classList.add('open'));
closePanelBtn.addEventListener('click', ()=>panel.classList.remove('open'));

themeSelect.addEventListener('change', ()=> setTheme(themeSelect.value));
sceneMode.addEventListener('change', ()=>{
  viz.setSceneMode(sceneMode.value);
  scenePill.textContent = `Mode: ${sceneMode.options[sceneMode.selectedIndex].text}`;
});
[bloomStrength, chromaticOffset, grainAmount, vignetteStrength].forEach(el=>{
  el.addEventListener('input', ()=>{
    viz.tuneFinal({
      bloom: parseFloat(bloomStrength.value),
      chroma: parseFloat(chromaticOffset.value),
      grain: parseFloat(grainAmount.value),
      vignette: parseFloat(vignetteStrength.value)
    });
  });
});
renderScale.addEventListener('input', ()=> viz.setRenderScale(parseFloat(renderScale.value)));

searchForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const q = searchInput.value.trim();
  if(!q) return;
  const urlMatch = q.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
  const uriMatch = q.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  const id = (urlMatch && urlMatch[1]) || (uriMatch && uriMatch[1]) || null;
  if(id){ await playTrackUri(`spotify:track:${id}`); return; }
  try{ renderResults(await searchTracks(q)); }catch(err){ alert('Search failed: '+err.message); }
});

async function playTrackUri(uri){
  if(!deviceId) await ensurePlayerReady().catch(console.error);
  await transferPlayback();
  await spFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method:'PUT', body: JSON.stringify({ uris:[uri] }) });
  setButtonsEnabled(true);
  logStatus('Playing on WW Visualizer');
}

// Loop
function loop(){
  const run = async ()=>{
    const state = player ? await player.getCurrentState() : null;
    const pos = state ? state.position : 0;
    stepAnalysis(lastPosMs, pos);
    viz.update(pos);
    lastPosMs = pos;
    requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

// Boot
async function afterAuth(){
  setButtonsEnabled(false);
  await ensurePlayerReady();
  await getCurrentlyPlaying();
}
async function boot(){
  loadTokens();
  await viz.init(); // async
  viz.setSceneMode('director');
  setTheme('auto');
  viz.tuneFinal({ bloom: parseFloat(bloomStrength.value), chroma: parseFloat(chromaticOffset.value), grain: parseFloat(grainAmount.value), vignette: parseFloat(vignetteStrength.value) });
  viz.setRenderScale(parseFloat(renderScale.value));

  if(accessToken){
    try{ await getValidAccessToken(); logStatus('Authenticated'); loginBtn.hidden = true; logoutBtn.hidden = false; await afterAuth(); }
    catch{ clearTokens(); }
  } else {
    logStatus('Not authenticated');
  }
  await handleRedirect();
  loop();
}

boot();