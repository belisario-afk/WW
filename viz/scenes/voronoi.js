import * as THREE from 'https://esm.sh/three@0.160.0';

const frag = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uColorA, uColorB;

const int MAX_RIPPLES = 32;
uniform int uCnt;
uniform vec3 uRip[MAX_RIPPLES];

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vor(vec2 x){ vec2 n=floor(x), f=fract(x); float md=8.0; for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=vec2(hash12(n+g), hash12(n+g+7.7)); vec2 r=g+o-f; float d=dot(r,r); md=min(md,d);} return md; }

void main(){
  vec2 uv=(vUv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float v = vor(uv*3.0 + uTime*0.1);
  float crack = smoothstep(0.0,0.02,v);

  float ripple=0.0;
  for(int i=0;i<MAX_RIPPLES;i++){
    if(i>=uCnt) break;
    vec2 rp = uRip[i].xy; float ts = uRip[i].z;
    float d = length(uv - rp);
    ripple += 0.15 * (1.0 - smoothstep(0.0, 0.4, abs(d - (uTime - ts)*0.6)));
  }

  vec3 col = mix(uColorA, uColorB, crack) + ripple;
  gl_FragColor = vec4(col,1.0);
}
`;
const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);} `;

export default class VoronoiScene{
  constructor(){ this.scene=new THREE.Scene(); this.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.mesh=null; this.r=[]; this.palette=null; }
  init(renderer,w,h,{palette,mouse}){
    this.palette=palette; this.mouse=mouse;
    const m = new THREE.ShaderMaterial({
      uniforms:{ uTime:{value:0}, uRes:{value:new THREE.Vector2(w,h)},
        uColorA:{value:new THREE.Color(palette?.palette?.[0]||'#1db954')},
        uColorB:{value:new THREE.Color(palette?.palette?.[1]||'#ffffff')},
        uCnt:{value:0}, uRip:{ value: new Array(32).fill(0).map(()=>new THREE.Vector3()) }
      }, vertexShader:vert, fragmentShader:frag
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), m); this.scene.add(this.mesh);
  }
  setPalette(p){ this.palette=p; if(this.mesh){ this.mesh.material.uniforms.uColorA.value = new THREE.Color(p.palette?.[0]||'#1db954'); this.mesh.material.uniforms.uColorB.value = new THREE.Color(p.palette?.[1]||'#ffffff'); } }
  setAlbumTexture(){} setAnalysis(){} setTempo(){} setTheme(){}
  addRipple(){ const x=(Math.random()*2-1)*0.6, y=(Math.random()*2-1)*0.6; this.r.push({x,y,t:performance.now()*0.001}); if(this.r.length>32) this.r.shift(); }
  resize(w,h){ if(this.mesh) this.mesh.material.uniforms.uRes.value.set(w,h); }
  update(dt,t){ if(!this.mesh) return; this.mesh.material.uniforms.uTime.value=t; const arr=this.mesh.material.uniforms.uRip.value; let c=0; for(let i=0;i<this.r.length;i++){ const rr=this.r[i]; if(t-rr.t<6.0){ arr[c].set(rr.x, rr.y, rr.t); c++; } } this.mesh.material.uniforms.uCnt.value=c; }
  renderToTarget(r,t){ r.setRenderTarget(t); r.render(this.scene,this.cam); }
}