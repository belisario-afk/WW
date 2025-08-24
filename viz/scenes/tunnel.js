import * as THREE from 'https://esm.sh/three@0.160.0';

export default class TunnelScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    this.target = null;

    this.tube = null;
    this.starfield = null;

    this.t = 0;
    this.sectionMod = 0;
  }

  init(renderer, width, height) {
    this.target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });

    this.camera.position.set(0, 0, 2);

    const geom = new THREE.CylinderGeometry(2, 2, 40, 32, 64, true);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, wireframe: false });
    this.tube = new THREE.Mesh(geom, mat);
    this.scene.add(this.tube);

    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');
    const tex = texLoader.load('https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=60');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tube.material.map = tex;

    const starGeom = new THREE.BufferGeometry();
    const N = 1000;
    const pos = new Float32Array(N*3);
    for (let i=0;i<N;i++){ pos[i*3+0]=(Math.random()-0.5)*20; pos[i*3+1]=(Math.random()-0.5)*20; pos[i*3+2]=-Math.random()*40; }
    starGeom.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.8 });
    this.starfield = new THREE.Points(starGeom, starMat);
    this.scene.add(this.starfield);

    this.resize(width, height);
  }

  setAlbumTexture() {}
  setPalette(pal) {
    if (this.tube) this.tube.material.color = new THREE.Color(pal.accent || '#1db954');
  }
  setAnalysis() {}
  setTempo() {}
  onBar(){ this.sectionMod = (this.sectionMod + 1) % 4; }
  onSection(){ this.sectionMod = (this.sectionMod + 2) % 4; }

  resize(w,h) { this.camera.aspect = w/h; this.camera.updateProjectionMatrix(); }

  update(dt, t) {
    this.t += dt;
    const spd = 3.0;
    this.camera.position.z = 2 + (t * spd) % 40;
    if (this.tube.material.map) this.tube.material.map.offset.y = (t * 0.1) % 1;
    this.starfield.position.z = (-(t * spd) % 40);
    this.camera.rotation.z = Math.sin(t*0.2 + this.sectionMod)*0.2;
    this.camera.position.x = Math.sin(t*0.5)*0.2;
    this.camera.position.y = Math.cos(t*0.3)*0.15;
  }

  renderToTarget(renderer, target) { renderer.setRenderTarget(target); renderer.render(this.scene, this.camera); }
}