import * as THREE from 'https://esm.sh/three@0.160.0';

const frag = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uColorA;
uniform vec3 uColorB;

const int MAX_RIPPLES = 32;
uniform int uRippleCount;
uniform vec3 uRipples[MAX_RIPPLES]; // x,y,time

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float voronoi(in vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float md = 8.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash12(n+g), hash12(n+g+7.7));
    vec2 r = g + o - f;
    float d = dot(r,r);
    md = min(md, d);
  }
  return md;
}

void main(){
  vec2 uv = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
  float v = voronoi(uv * 3.0 + uTime*0.1);
  float crackle = smoothstep(0.0, 0.02, v);

  float ripple = 0.0;
  for (int i=0; i<MAX_RIPPLES; i++){
    if (i >= uRippleCount) break;
    vec2 rp = uRipples[i].xy;
    float t = uRipples[i].z;
    float d = length(uv - rp);
    ripple += 0.15 * (1.0 - smoothstep(0.0, 0.4, abs(d - (uTime - t)*0.6)));
  }

  vec3 col = mix(uColorA, uColorB, crackle) + ripple;
  gl_FragColor = vec4(col, 1.0);
}
`;

const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position = vec4(position.xy,0.0,1.0); }`;

export default class VoronoiScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.mesh = null;
    this.target = null;
    this.ripples = [];
    this.palette = { palette: ['#1db954','#fff'] };
  }

  init(renderer, width, height, { palette, mouse }) {
    this.target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
    this.palette = palette || this.palette;
    this.mouse = mouse;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(width, height) },
        uColorA: { value: new THREE.Color(this.palette.palette[0] || '#1db954') },
        uColorB: { value: new THREE.Color(this.palette.palette[1] || '#ffffff') },
        uRippleCount: { value: 0 },
        uRipples: { value: new Array(32).fill(0).map(_=>new THREE.Vector3()) }
      },
      vertexShader: vert, fragmentShader: frag
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat);
    this.scene.add(this.mesh);
  }

  setPalette(pal) {
    this.palette = pal;
    if (this.mesh) {
      this.mesh.material.uniforms.uColorA.value = new THREE.Color(this.palette.palette[0] || '#1db954');
      this.mesh.material.uniforms.uColorB.value = new THREE.Color(this.palette.palette[1] || '#ffffff');
    }
  }
  setAlbumTexture() {}
  setAnalysis() {}
  setTempo() {}

  addRipple() {
    const x = (Math.random()*2-1)*0.6;
    const y = (Math.random()*2-1)*0.6;
    this.ripples.push({ x, y, t: performance.now()*0.001 });
    if (this.ripples.length > 32) this.ripples.shift();
  }

  resize(w,h){ if (this.mesh) this.mesh.material.uniforms.uRes.value.set(w,h); }

  update(dt, t) {
    if (!this.mesh) return;
    this.mesh.material.uniforms.uTime.value = t;
    const arr = this.mesh.material.uniforms.uRipples.value;
    const now = t;
    let count = 0;
    for (let i=0;i<this.ripples.length;i++){
      const r = this.ripples[i];
      if (now - r.t < 6.0) { arr[count].set(r.x, r.y, r.t); count++; }
    }
    this.mesh.material.uniforms.uRippleCount.value = count;
  }

  renderToTarget(renderer, target) { renderer.setRenderTarget(target); renderer.render(this.scene, this.camera); }
}