import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const frag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform int uSegments;
uniform float uRadius;

vec2 kaleido(vec2 uv, int N){
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float tau = 6.28318530718;
  float sector = tau / float(N);
  a = mod(a, sector);
  a = abs(a - sector*0.5);
  return vec2(cos(a), sin(a)) * r;
}

void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  uv *= uRadius;
  vec2 k = kaleido(uv, uSegments);
  k = k * 0.5 + 0.5;
  vec3 col = texture2D(uTex, k).rgb;
  gl_FragColor = vec4(col, 1.0);
}
`;

const vert = `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position = vec4(position.xy,0.0,1.0); }
`;

export class KaleidoScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.mesh = null;
    this.target = null;
    this.segments = 6;
    this.radius = 1.2;
    this.album = null;
  }

  init(renderer, width, height, { albumTexture }) {
    this.target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
    this.album = albumTexture || this._fallbackTexture(renderer);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this.album },
        uTime: { value: 0 },
        uSegments: { value: this.segments },
        uRadius: { value: this.radius },
      },
      vertexShader: vert, fragmentShader: frag
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat);
    this.scene.add(this.mesh);
  }

  _fallbackTexture(renderer) {
    const data = new Uint8Array([29,185,84]); // spotify green pixel
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBFormat);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  setAlbumTexture(tex) { this.album = tex; if (this.mesh) this.mesh.material.uniforms.uTex.value = tex; }
  setPalette() {}
  setAnalysis() {}
  setTempo() {}
  onBeat() { this.radius = 1.1 + Math.random()*0.2; }
  setSegments(n) { this.segments = Math.max(3, Math.min(24, n|0)); if (this.mesh) this.mesh.material.uniforms.uSegments.value = this.segments; }

  resize() {}

  update(dt, t) {
    if (!this.mesh) return;
    this.mesh.material.uniforms.uTime.value = t;
    this.mesh.material.uniforms.uRadius.value = THREE.MathUtils.lerp(this.mesh.material.uniforms.uRadius.value, 1.15, 0.05);
  }

  renderToTarget(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}