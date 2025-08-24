// VizEngine: Three.js multi-scene engine with post-processing and scene stack compositor
import * as THREE from 'https://esm.sh/three@0.160.0';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect
} from 'https://esm.sh/postprocessing@6.35.3?deps=three@0.160.0';

import { AuroraScene } from './scenes/aurora.js';
import { KaleidoScene } from './scenes/kaleidoscope.js';
import { TunnelScene } from './scenes/tunnel.js';
import { VoronoiScene } from './scenes/voronoi.js';
import { RibbonsScene } from './scenes/ribbons.js';
import { CoversScene } from './scenes/covers.js';

export class VizEngine {
  constructor(container) {
    this.container = container;
    this.renderer = null;

    this.width = 1; this.height = 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    // Compositor scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = null;

    // Scene stack
    this.scenes = {};
    this.stack = ['aurora', 'tunnel', 'kaleido', 'ribbons', 'covers'];
    this.layers = {}; // id -> { scene, target, opacity }

    // Post FX
    this.composer = null;
    this.post = { bloom: 0.9, dof: 0.35, grain: 0.04, chroma: 0.0035 };

    // Album art and palette
    this.albumTexture = null;
    this.palette = { dominant: '#1db954', accent: '#1db954', palette: ['#1db954', '#ffffff', '#222'] };

    // Analysis and tempo
    this.analysis = null;
    this.tempo = 120;

    // Compositor uniforms/material
    this.compositeMaterial = null;
    this.blankTexture = null;

    // UI helpers
    this.mouse = new THREE.Vector2(0, 0);
    this.timeStart = performance.now();

    // Events
    this._bindResize = this._onResize.bind(this);
    window.addEventListener('resize', this._bindResize);
    window.addEventListener('mousemove', (e) => {
      const r = this.container.getBoundingClientRect();
      this.mouse.set((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * -2 + 1);
    }, { passive: true });
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this._setupCompositor();
    this._createScenes();
    this._onResize();
  }

  _setupCompositor() {
    // 1x1 transparent fallback texture to avoid invalid sampler state
    this.blankTexture = new THREE.DataTexture(new Uint8Array([0,0,0,0]), 1, 1, THREE.RGBAFormat);
    this.blankTexture.needsUpdate = true;
    this.blankTexture.colorSpace = THREE.SRGBColorSpace;

    this.compositeMaterial = new THREE.ShaderMaterial({
      transparent: false,
      uniforms: {
        t0: { value: this.blankTexture },
        t1: { value: this.blankTexture },
        t2: { value: this.blankTexture },
        t3: { value: this.blankTexture },
        t4: { value: this.blankTexture },
        opacity0: { value: 1.0 },
        opacity1: { value: 0.9 },
        opacity2: { value: 0.9 },
        opacity3: { value: 0.9 },
        opacity4: { value: 0.9 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D t0; uniform float opacity0;
        uniform sampler2D t1; uniform float opacity1;
        uniform sampler2D t2; uniform float opacity2;
        uniform sampler2D t3; uniform float opacity3;
        uniform sampler2D t4; uniform float opacity4;

        void main(){
          vec3 c = vec3(0.0);
          c += texture2D(t0, vUv).rgb * opacity0;
          c += texture2D(t1, vUv).rgb * opacity1;
          c += texture2D(t2, vUv).rgb * opacity2;
          c += texture2D(t3, vUv).rgb * opacity3;
          c += texture2D(t4, vUv).rgb * opacity4;
          gl_FragColor = vec4(c, 1.0);
        }
      `
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMaterial);
    this.scene.add(quad);
    this.quad = quad;

    // Post FX
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this._rebuildPost();
  }

  _rebuildPost() {
    while (this.composer.passes.length > 1) this.composer.passes.pop();

    const bloom = new BloomEffect({ intensity: this.post.bloom, luminanceThreshold: 0.2, luminanceSmoothing: 0.8 });
    const vignette = new VignetteEffect({ darkness: 0.4, offset: 0.2 });
    const grain = new NoiseEffect({ premultiply: true, blendFunction: 12 /* SOFT_LIGHT */ });
    grain.blendMode.opacity.value = this.post.grain;
    const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(this.post.chroma, 0) });
    const dof = new DepthOfFieldEffect(this.camera, { focusDistance: 0.013, focalLength: 0.055, bokehScale: 2.0 });
    dof.resolution.height = 720;
    dof.resolution.scale = this.post.dof > 0 ? 1 : 0.5;
    dof.blurPass.blurMaterial.multiBlur = true;
    dof.blurPass.scale = Math.max(0.0001, this.post.dof);

    const effectPass = new EffectPass(this.camera, bloom, vignette, grain, chroma, dof);
    this.composer.addPass(effectPass);
  }

  _createScenes() {
    const makeTarget = () => new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      depthBuffer: false
    });

    this.scenes.aurora = new AuroraScene();
    this.scenes.kaleido = new KaleidoScene();
    this.scenes.tunnel = new TunnelScene();
    this.scenes.voronoi = new VoronoiScene();
    this.scenes.ribbons = new RibbonsScene();
    this.scenes.covers = new CoversScene();

    for (const key of Object.keys(this.scenes)) {
      const target = makeTarget();
      this.layers[key] = { scene: this.scenes[key], target, opacity: 0.9 };
      this.scenes[key].init(this.renderer, this.width, this.height, {
        albumTexture: this.albumTexture,
        palette: this.palette,
        tempo: this.tempo,
        mouse: this.mouse
      });
    }
  }

  setAlbumArtTexture(imgEl) {
    const tex = new THREE.Texture(imgEl);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.albumTexture = tex;
    for (const s of Object.values(this.scenes)) s.setAlbumTexture(tex);
  }

  setPalette(pal) {
    this.palette = pal;
    for (const s of Object.values(this.scenes)) s.setPalette(pal);
  }

  setAnalysis(analysis) {
    this.analysis = analysis;
    for (const s of Object.values(this.scenes)) s.setAnalysis(analysis);
  }

  setTempo(tempo) {
    this.tempo = tempo;
    for (const s of Object.values(this.scenes)) s.setTempo(tempo);
  }

  onBeat(obj) {
    this.scenes.voronoi?.addRipple(obj.start, obj.duration);
    this.scenes.kaleido?.onBeat();
    this.scenes.ribbons?.onBeat();
    this.scenes.covers?.onBeat();
  }
  onBar() { this.scenes.tunnel?.onBar(); }
  onTatum() { this.scenes.aurora?.onTatum(); }
  onSection() {
    this.scenes.kaleido?.setSegments(3 + Math.floor(Math.random() * 13));
    this.scenes.tunnel?.onSection();
  }

  applyPreset(name) {
    const presets = {
      default: { bloom: 0.9, dof: 0.35, grain: 0.04, chroma: 0.0035 },
      cinematic: { bloom: 1.3, dof: 0.55, grain: 0.06, chroma: 0.002 },
      neon: { bloom: 1.6, dof: 0.25, grain: 0.03, chroma: 0.006 },
      warm: { bloom: 1.1, dof: 0.4, grain: 0.045, chroma: 0.003 },
      cool: { bloom: 0.8, dof: 0.3, grain: 0.035, chroma: 0.004 },
    };
    const map = { warm: 'warm', warmglow: 'warm', 'warm glow': 'warm', cool: 'cool', neon: 'neon', cinematic: 'cinematic' };
    const key = presets[name] ? name : (map[name?.toLowerCase()] || 'default');
    Object.assign(this.post, presets[key]);
    this._rebuildPost();
  }

  savePreset(name) {
    const preset = { post: this.post, stack: this.stack, palette: this.palette };
    localStorage.setItem(`viz_preset_${name}`, JSON.stringify(preset));
    alert(`Saved preset "${name}"`);
  }

  setSceneStack(which) {
    switch (which) {
      case 'aurora': this.stack = ['aurora']; break;
      case 'tunnel': this.stack = ['tunnel']; break;
      case 'kaleido': this.stack = ['kaleido']; break;
      case 'voronoi': this.stack = ['voronoi']; break;
      case 'ribbons': this.stack = ['ribbons']; break;
      case 'covers': this.stack = ['covers']; break;
      default: this.stack = ['aurora', 'tunnel', 'kaleido', 'ribbons', 'covers'];
    }
  }

  describeStack() { return this.stack.join(' + '); }

  tunePost({ bloom, dof, grain, chroma }) {
    if (typeof bloom === 'number') this.post.bloom = bloom;
    if (typeof dof === 'number') this.post.dof = dof;
    if (typeof grain === 'number') this.post.grain = grain;
    if (typeof chroma === 'number') this.post.chroma = chroma;
    this._rebuildPost();
  }

  _onResize() {
    const r = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(r.width));
    this.height = Math.max(1, Math.floor(r.height));
    if (this.renderer) this.renderer.setSize(this.width, this.height, false);
    for (const { target, scene } of Object.values(this.layers)) {
      target.setSize(this.width, this.height);
      scene.resize(this.width, this.height);
    }
    if (this.composer) this.composer.setSize(this.width, this.height);
  }

  update(positionMs) {
    const t = (performance.now() - this.timeStart) * 0.001;
    const dt = 1 / 60;

    // Render each scene to its target
    for (const key of Object.keys(this.layers)) {
      const layer = this.layers[key];
      layer.scene.update(dt, t, { positionMs, palette: this.palette, mouse: this.mouse });
      this.renderer.setRenderTarget(layer.target);
      this.renderer.clear();
      layer.scene.renderToTarget(this.renderer, layer.target);
    }
    this.renderer.setRenderTarget(null);

    // Bind composite textures with fallback
    const u = this.compositeMaterial.uniforms;
    u.t0.value = (this.layers[this.stack[0]]?.target.texture) || this.blankTexture; u.opacity0.value = 1.0;
    u.t1.value = (this.layers[this.stack[1]]?.target.texture) || this.blankTexture; u.opacity1.value = 0.9;
    u.t2.value = (this.layers[this.stack[2]]?.target.texture) || this.blankTexture; u.opacity2.value = 0.9;
    u.t3.value = (this.layers[this.stack[3]]?.target.texture) || this.blankTexture; u.opacity3.value = 0.9;
    u.t4.value = (this.layers[this.stack[4]]?.target.texture) || this.blankTexture; u.opacity4.value = 0.9;

    this.composer.render(dt);
  }
}