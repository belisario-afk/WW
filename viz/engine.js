// Advanced VizEngine: dynamic scenes, robust compositor with built-in post (bloom, CA, grain, vignette)
import * as THREE from 'https://esm.sh/three@0.160.0';

export class VizEngine {
  constructor(container){
    this.container = container;
    this.renderer = null;

    this.width = 1; this.height = 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = 1.0;

    // Composite scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.quad = null;

    // Layers
    this.scenes = {};
    this.layers = {}; // id -> { scene, target, opacity }
    this.stack = ['aurora', 'flow', 'tunnel', 'kaleido', 'voronoi', 'ribbons', 'covers'];

    // Final pass uniforms
    this.finalMaterial = null;

    // State & Inputs
    this.albumTexture = null;
    this.palette = { dominant:'#1db954', accent:'#1db954', palette:['#1db954','#ffffff','#232323'] };
    this.analysis = null;
    this.tempo = 120;
    this.mouse = new THREE.Vector2(0,0);
    this.timeStart = performance.now();

    // Mode
    this.mode = 'director'; // 'director' | 'all' | scene id
    this.director = { lastSwitch: 0, minBars: 4, current: ['aurora','flow'], cursor:0 };

    // Events
    window.addEventListener('resize', ()=>this._onResize());
    window.addEventListener('mousemove', (e)=>{
      const r = this.container.getBoundingClientRect();
      this.mouse.set((e.clientX - r.left)/r.width*2-1, (e.clientY - r.top)/r.height*-2+1);
    }, { passive:true });
  }

  async init(){
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.container.appendChild(this.renderer.domElement);

    await this._loadScenes();
    this._setupComposite();
    this._createLayers();
    this._onResize();
  }

  async _loadScenes(){
    const urls = {
      aurora: './scenes/aurora.js?v=7',
      kaleido: './scenes/kaleidoscope.js?v=7',
      tunnel: './scenes/tunnel.js?v=7',
      voronoi: './scenes/voronoi.js?v=7',
      ribbons: './scenes/ribbons.js?v=7',
      covers: './scenes/covers.js?v=7',
      flow: './scenes/flowfield.js?v=7',
    };
    this.SceneCtors = {};
    const keys = Object.keys(urls);
    const mods = await Promise.all(keys.map(k => import(urls[k])));

    const pick = (m, names) => m?.default || names.map(n=>m?.[n]).find(Boolean);
    const nameMap = {
      aurora:['AuroraScene'], kaleido:['KaleidoScene','KaleidoscopeScene'], tunnel:['TunnelScene'],
      voronoi:['VoronoiScene'], ribbons:['RibbonsScene'], covers:['CoversScene'], flow:['FlowfieldScene','FlowScene']
    };
    keys.forEach((k,i)=>{ const ctor = pick(mods[i], nameMap[k]); if(!ctor) throw new Error(`Scene ${k} missing export`); this.SceneCtors[k] = ctor; });
  }

  _setupComposite(){
    const geo = new THREE.PlaneGeometry(2,2);
    this.finalMaterial = new THREE.ShaderMaterial({
      uniforms:{
        t0:{value:null}, t1:{value:null}, t2:{value:null}, t3:{value:null}, t4:{value:null}, t5:{value:null}, t6:{value:null},
        op0:{value:1}, op1:{value:0.9}, op2:{value:0.9}, op3:{value:0.9}, op4:{value:0.9}, op5:{value:0.9}, op6:{value:0.9},
        uRes:{value:new THREE.Vector2(1,1)},
        uTime:{value:0},
        uBloom:{value:1.2},
        uChroma:{value:0.003},
        uGrain:{value:0.05},
        uVignette:{value:0.35}
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position = vec4(position.xy,0.0,1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D t0; uniform float op0;
        uniform sampler2D t1; uniform float op1;
        uniform sampler2D t2; uniform float op2;
        uniform sampler2D t3; uniform float op3;
        uniform sampler2D t4; uniform float op4;
        uniform sampler2D t5; uniform float op5;
        uniform sampler2D t6; uniform float op6;
        uniform vec2 uRes;
        uniform float uTime, uBloom, uChroma, uGrain, uVignette;

        vec3 sampleCombined(vec2 uv){
          vec3 c = vec3(0.0);
          c += texture2D(t0, uv).rgb * op0;
          c += texture2D(t1, uv).rgb * op1;
          c += texture2D(t2, uv).rgb * op2;
          c += texture2D(t3, uv).rgb * op3;
          c += texture2D(t4, uv).rgb * op4;
          c += texture2D(t5, uv).rgb * op5;
          c += texture2D(t6, uv).rgb * op6;
          return c;
        }

        float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

        void main(){
          // Chromatic aberration: offset per-channel along radial
          vec2 center = vec2(0.5);
          vec2 dir = normalize(vUv - center + 1e-6);
          vec2 off = dir * uChroma;

          vec3 c0 = sampleCombined(vUv + off);
          vec3 c1 = sampleCombined(vUv);
          vec3 c2 = sampleCombined(vUv - off);

          vec3 color = vec3(c0.r, c1.g, c2.b);

          // Lightweight bloom (small kernel)
          vec2 px = 1.0 / uRes;
          vec3 blur = vec3(0.0);
          blur += sampleCombined(vUv + vec2(-2.0, 0.0)*px);
          blur += sampleCombined(vUv + vec2( 2.0, 0.0)*px);
          blur += sampleCombined(vUv + vec2( 0.0,-2.0)*px);
          blur += sampleCombined(vUv + vec2( 0.0, 2.0)*px);
          blur += sampleCombined(vUv + vec2( 1.5, 1.5)*px);
          blur += sampleCombined(vUv + vec2(-1.5, 1.5)*px);
          blur += sampleCombined(vUv + vec2( 1.5,-1.5)*px);
          blur += sampleCombined(vUv + vec2(-1.5,-1.5)*px);
          blur *= 0.125;
          // threshold-ish glow
          float lum = dot(color, vec3(0.2126,0.7152,0.0722));
          vec3 glow = max(color - vec3(0.6), 0.0) + blur * 0.6;
          color += glow * uBloom;

          // Vignette
          float d = distance(vUv, center);
          float vig = smoothstep(1.0, 0.5, d + uVignette*0.5);
          color *= vig;

          // Grain
          float n = rnd(vUv*vec2(uRes.x, uRes.y) + uTime*60.0) - 0.5;
          color += n * uGrain;

          // Tone
          color = clamp(color, 0.0, 1.0);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    this.quad = new THREE.Mesh(geo, this.finalMaterial);
    this.scene.add(this.quad);
  }

  _createLayers(){
    const makeTarget = ()=> new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, depthBuffer:false });

    // Instantiate scenes
    for(const id of this.stack){
      const Ctor = this.SceneCtors[id];
      const scene = new Ctor();
      const target = makeTarget();
      this.layers[id] = { scene, target, opacity: 0.9 };
      scene.init?.(this.renderer, this.width, this.height, {
        albumTexture: this.albumTexture, palette: this.palette, tempo:this.tempo, mouse:this.mouse
      });
    }
  }

  setAlbumArtTexture(imgEl){
    const tex = new THREE.Texture(imgEl);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.albumTexture = tex;
    Object.values(this.layers).forEach(l => l.scene.setAlbumTexture?.(tex));
  }

  setPalette(pal){
    this.palette = pal;
    Object.values(this.layers).forEach(l => l.scene.setPalette?.(pal));
  }

  setAnalysis(a){ this.analysis = a; Object.values(this.layers).forEach(l=>l.scene.setAnalysis?.(a)); }
  setTempo(t){ this.tempo = t; Object.values(this.layers).forEach(l=>l.scene.setTempo?.(t)); }

  // Director-driven triggers
  onBeat(obj){
    this.layers.voronoi?.scene.addRipple?.(obj.start, obj.duration);
    this.layers.kaleido?.scene.onBeat?.();
    this.layers.ribbons?.scene.onBeat?.();
    this.layers.covers?.scene.onBeat?.();
    // Subtle composite pulse
    this.finalMaterial.uniforms.uBloom.value = THREE.MathUtils.lerp(this.finalMaterial.uniforms.uBloom.value, this._bloomBase()*1.2, 0.3);
  }
  onBar(){ this.layers.tunnel?.scene.onBar?.(); }
  onTatum(){ this.layers.aurora?.scene.onTatum?.(); }
  onSection(){
    // Auto scene shuffle
    if(this.mode !== 'director') return;
    const seq = ['aurora','flow','kaleido','tunnel','ribbons','voronoi','covers'];
    this.director.cursor = (this.director.cursor + 1) % seq.length;
    this.director.current = [seq[this.director.cursor], seq[(this.director.cursor+3)%seq.length]];
  }

  directorReset(tempo){
    this.director.lastSwitch = 0;
    this.director.minBars = Math.max(3, Math.round(tempo/40));
    this.director.current = ['aurora','flow'];
    this.director.cursor = 0;
  }

  applyTheme({ bias='album', contrast=1.0, sat=1.0 }){
    // push to scenes for internal coloring, if any
    Object.values(this.layers).forEach(l => l.scene.setTheme?.({ bias, contrast, sat }));
  }

  setSceneMode(mode){
    this.mode = mode;
  }

  describeStack(){
    if(this.mode === 'director') return `Director: ${this.director.current.join(' + ')}`;
    if(this.mode === 'all') return 'All Scenes';
    return `Solo: ${this.mode}`;
  }

  tuneFinal({ bloom, chroma, grain, vignette }){
    if(typeof bloom === 'number') this.finalMaterial.uniforms.uBloom.value = bloom;
    if(typeof chroma === 'number') this.finalMaterial.uniforms.uChroma.value = chroma;
    if(typeof grain === 'number') this.finalMaterial.uniforms.uGrain.value = grain;
    if(typeof vignette === 'number') this.finalMaterial.uniforms.uVignette.value = vignette;
  }
  _bloomBase(){ return 1.0; }

  setRenderScale(s){
    this.scale = Math.max(0.5, Math.min(1.0, s||1));
    this._onResize();
  }

  _onResize(){
    const r = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(r.width * this.scale));
    this.height = Math.max(1, Math.floor(r.height * this.scale));
    if(this.renderer) this.renderer.setSize(this.width, this.height, false);
    if(this.finalMaterial) this.finalMaterial.uniforms.uRes.value.set(this.width, this.height);
    Object.values(this.layers).forEach(l=>{
      l.target.setSize(this.width, this.height);
      l.scene.resize?.(this.width, this.height);
    });
  }

  update(positionMs){
    const t = (performance.now() - this.timeStart)*0.001;
    this.finalMaterial.uniforms.uTime.value = t;

    // Update scenes
    for(const id of Object.keys(this.layers)){
      const layer = this.layers[id];
      layer.scene.update?.(1/60, t, { positionMs, palette: this.palette, mouse: this.mouse });
      this.renderer.setRenderTarget(layer.target);
      this.renderer.clear();
      layer.scene.renderToTarget?.(this.renderer, layer.target);
    }
    this.renderer.setRenderTarget(null);

    // Bind textures based on mode
    const u = this.finalMaterial.uniforms;
    const pick = (id)=> this.layers[id]?.target.texture || null;
    // reset ops
    u.op0.value = u.op1.value = u.op2.value = u.op3.value = u.op4.value = u.op5.value = u.op6.value = 0.0;
    u.t0.value = u.t1.value = u.t2.value = u.t3.value = u.t4.value = u.t5.value = u.t6.value = null;

    let list = [];
    if(this.mode === 'director') list = this.director.current;
    else if(this.mode === 'all') list = this.stack;
    else list = [this.mode];

    const tex = list.map(pick).filter(Boolean);
    const ops = list.map(()=>1.0);
    const slots = ['t0','t1','t2','t3','t4','t5','t6'];
    const oslots = ['op0','op1','op2','op3','op4','op5','op6'];
    for(let i=0;i<slots.length;i++){
      u[slots[i]].value = tex[i] || null;
      u[oslots[i]].value = ops[i] || 0.0;
    }

    this.renderer.render(this.scene, this.camera);
  }
}