# WW Advanced Visualizer — Product Spec

## Vision
A world-class, browser-first music visualizer that feels art-directed and alive. It reacts musically and visually without manual tweaking, offers deep yet approachable controls, and looks stunning on any device.

## Core Pillars
- Smoothness: target 60 fps via dynamic resolution scaling, simple post in one pass, and careful shader budgets.
- Reliability: CORS-safe ESM imports, cache-busting, graceful fallbacks (analysis, playback).
- Beauty: glassy UI, cinematic post effects, curated themes with intentional contrast/sat/emphasis.
- Control: power-user panel with presets, director options, and scene stack management.

## User Stories
- As a listener, I log in with Spotify and immediately get beautiful, music-aware visuals in “Director (Auto).”
- As a creator, I pick a theme (e.g., Cyberpunk), slightly tune bloom and chroma, and save/share my preset.
- As a performer, I solo scenes and lock transitions (e.g., only exposure ramp + additive glow), maintain performance with Render Scale, and overlay track meta on a HUD.

## Feature List
- Director 2.0: auto scene changes on sections/phrases, transition catalog, energy/valence bias, intro/outro ramping.
- Post effects: bloom, chromatic aberration, vignette, grain, exposure/gamma, FXAA/TAA, motion blur-lite.
- Scenes: Aurora Pro, Flowfield Pro, Voronoi + ripples, Neon Tunnel, Ribbons, Floating Covers, Kaleido Room, Waveform Mesh, Particles/Boids, SDF Morphs, Light Grid.
- Themes: 12 curated sets + Album Auto; palette stability heuristics.
- Settings: JSON-schema backed; save/load/share presets; performance profile.
- QA: Playwright smoke tests for auth + render; visual baselines for essential scenes.

## Success Criteria (MVP++)
- 60 fps or smooth scaling on M1 Air & mid-tier Android.
- Auth works across browsers; if Premium missing, visualizer still runs with analysis & local beat-fallback.
- Director transitions feel intentional for popular genres (EDM/Pop/Hip-Hop/Rock).
- Zero console errors; module loads CORS-safe.
