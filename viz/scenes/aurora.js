import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const frag = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uA, uB, uC;
uniform float uPulse;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float noise(in vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
}
vec3 palette(float t, vec3 a, vec3 b, vec3 c) {
  return a + b*cos(6.28318*(c*t)+vec3(0.0,0.33,0.67));
}
void main(){
  vec2 uv = vUv * vec2(uRes.x/uRes.y, 1.0);
  float t = uTime * 0.05;
  float n = 0.0;
  vec2 p = uv * 2.0;
  for (int i=0;i<5;i++) {
    n += noise(p + t) * 0.5; p *= 1.9;
  }
  float glow = smoothstep(0.3, 1.0, n);
  vec3 col = palette(n + uPulse*0.2, uA, uB, uC);
  col *= 1.0 + glow * 1.4;
  gl_FragColor = vec4(col, 1.0);
}
`;

const vert = `
varying vec2 vUv;
void main(){
  vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export class AuroraScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.mesh = null;
    this.target = null;
    this.pulse = 0;
    this.palette = { palette: ['#1db954','#fff','#222'] };
  }

  init(renderer, width, height, { albumTexture, palette }) {
    this.target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
    this.palette = palette || this.palette;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(width, height) },
        uA: { value: new THREE.Color(this.palette.palette[0] || '#1db954').toArray().slice(0,3) },
        uB: { value: new THREE.Color(this.palette.palette[1] || '#ffffff').toArray().slice(0,3) },
        uC: { value: new THREE.Color(this.palette.palette[2] || '#232323').toArray().slice(0,3) },
        uPulse: { value: 0 }
      },
      vertexShader: vert,
      fragmentShader: frag
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat);
    this.scene.add(quad);
    this.mesh = quad;
  }

  setPalette(pal) {
    this.palette = pal;
    if (this.mesh) {
      this.mesh.material.uniforms.uA.value = new THREE.Color(this.palette.palette[0] || '#1db954').toArray().slice(0,3);
      this.mesh.material.uniforms.uB.value = new THREE.Color(this.palette.palette[1] || '#ffffff').toArray().slice(0,3);
      this.mesh.material.uniforms.uC.value = new THREE.Color(this.palette.palette[2] || '#232323').toArray().slice(0,3);
    }
  }
  setAlbumTexture() {}
  setAnalysis() {}
  setTempo() {}
  onTatum(){ this.pulse = Math.min(1, this.pulse + 0.25); }

  resize(w,h) {
    if (this.mesh) this.mesh.material.uniforms.uRes.value.set(w,h);
  }

  update(dt, t) {
    if (this.mesh) {
      this.mesh.material.uniforms.uTime.value = t;
      this.pulse = Math.max(0, this.pulse - dt*1.5);
      this.mesh.material.uniforms.uPulse.value = this.pulse;
    }
  }

  renderToTarget(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}