import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

function mkRibbon(color) {
  const N = 120;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, linewidth: 1 });
  const line = new THREE.Line(geom, mat);
  line.userData = { pts: Array.from({length:N}, (_,i)=>new THREE.Vector3(0,0,0)), t: Math.random()*100 };
  return line;
}

export class RibbonsScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 20);
    this.target = null;
    this.ribbons = [];
    this.palette = { palette: ['#1db954','#fff','#ff0080'] };
  }

  init(renderer, width, height, { palette, mouse }) {
    this.target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
    this.palette = palette || this.palette;
    this.mouse = mouse;

    for (let i=0;i<4;i++){
      const color = this.palette.palette[i%this.palette.palette.length] || '#ffffff';
      this.ribbons.push(mkRibbon(new THREE.Color(color)));
    }
    this.ribbons.forEach(r => this.scene.add(r));
    this.camera.position.set(0,0,5);
    this.resize(width, height);
  }

  setPalette(pal){
    this.palette = pal;
    for (let i=0;i<this.ribbons.length;i++){
      const col = new THREE.Color(this.palette.palette[i%this.palette.palette.length] || '#ffffff');
      this.ribbons[i].material.color = col;
    }
  }
  setAlbumTexture() {}
  setAnalysis() {}
  setTempo() {}
  onBeat(){
    // small opacity pop
    this.ribbons.forEach(r => r.material.opacity = 1.0);
  }

  resize(w,h){ this.camera.aspect = w/h; this.camera.updateProjectionMatrix(); }

  update(dt, t, { mouse }) {
    const m = mouse || this.mouse;
    for (const r of this.ribbons) {
      const data = r.userData;
      data.t += dt;
      const head = new THREE.Vector3(
        Math.sin(data.t*0.7 + r.id)*1.8 + m.x*0.8,
        Math.cos(data.t*0.9 + r.id)*1.2 + m.y*0.6,
        Math.sin(data.t*0.5 + r.id)*0.6
      );
      data.pts.pop();
      data.pts.unshift(head);
      const pos = r.geometry.attributes.position.array;
      for (let i=0;i<data.pts.length;i++){
        const p = data.pts[i];
        pos[i*3+0]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z;
      }
      r.geometry.attributes.position.needsUpdate = true;
      r.material.opacity = THREE.MathUtils.lerp(r.material.opacity, 0.7, 0.05);
    }
  }

  renderToTarget(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}