import * as THREE from 'https://esm.sh/three@0.160.0';

const frag = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uCol1, uCol2;
uniform float uStrength;

float hash(vec2 p){ return fract(sin(dot(p, vec2(27.1, 61.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1,0));
  float c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
vec2 flow(vec2 p){
  float n = noise(p*0.9 + uTime*0.06)*6.2831;
  return vec2(cos(n), sin(n));
}

void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
  vec3 col = vec3(0.0);
  vec2 pos = p;
  float a = 0.0;
  for(int i=0;i<60;i++){
    vec2 v = flow(pos*2.0 + a);
    pos += v * 0.01;
    float t = float(i)/60.0;
    vec3 c = mix(uCol1, uCol2, t);
    float w = smoothstep(1.0, 0.0, length(pos - p)*1.2);
    col += c * w * 0.02 * uStrength;
    a += 0.17;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);} `;

export default class FlowfieldScene{
  constructor(){ this.scene=new THREE.Scene(); this.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1); this.mesh=null; this.palette=null; this.strength=1.0; }
  init(renderer,w,h,{palette}){
    this.palette = palette;
    const m = new THREE.ShaderMaterial({
      uniforms:{ uTime:{value:0}, uRes:{value:new THREE.Vector2(w,h)},
        uCol1:{value:new THREE.Color(palette?.palette?.[0]||'#51ffd2').toArray().slice(0,3)},
        uCol2:{value:new THREE.Color(palette?.palette?.[2]||'#1b2640').toArray().slice(0,3)},
        uStrength:{value:this.strength}
      },
      vertexShader:vert, fragmentShader:frag
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), m);
    this.scene.add(this.mesh);
  }
  setPalette(p){ this.palette=p; if(this.mesh){ this.mesh.material.uniforms.uCol1.value = new THREE.Color(p.palette?.[0]||'#51ffd2').toArray().slice(0,3); this.mesh.material.uniforms.uCol2.value = new THREE.Color(p.palette?.[2]||'#1b2640').toArray().slice(0,3); } }
  setAlbumTexture(){} setAnalysis(){} setTempo(){} setTheme(){}
  resize(w,h){ if(this.mesh) this.mesh.material.uniforms.uRes.value.set(w,h); }
  update(dt,t){ if(!this.mesh) return; this.mesh.material.uniforms.uTime.value=t; this.mesh.material.uniforms.uStrength.value = THREE.MathUtils.lerp(this.mesh.material.uniforms.uStrength.value, 1.0, 0.05); }
  renderToTarget(r,t){ r.setRenderTarget(t); r.render(this.scene,this.cam); }
}