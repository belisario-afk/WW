import * as THREE from 'https://esm.sh/three@0.160.0';

export default class TunnelScene{
  constructor(){ this.scene=new THREE.Scene(); this.cam=new THREE.PerspectiveCamera(70,1,0.1,100); this.tube=null; this.star=null; this.t=0; this.sectionMod=0; }
  init(renderer,w,h){
    this.cam.position.set(0,0,2);
    const geom = new THREE.CylinderGeometry(2,2,40,32,64,true);
    geom.rotateX(Math.PI/2);
    const mat = new THREE.MeshBasicMaterial({ color:0xffffff, side:THREE.BackSide });
    this.tube = new THREE.Mesh(geom, mat); this.scene.add(this.tube);

    const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
    const tex = loader.load('https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=60');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
    this.tube.material.map = tex;

    const starGeom = new THREE.BufferGeometry(); const N=1000; const pos = new Float32Array(N*3);
    for(let i=0;i<N;i++){ pos[i*3+0]=(Math.random()-0.5)*20; pos[i*3+1]=(Math.random()-0.5)*20; pos[i*3+2]=-Math.random()*40; }
    starGeom.setAttribute('position', new THREE.BufferAttribute(pos,3));
    this.star = new THREE.Points(starGeom, new THREE.PointsMaterial({color:0xffffff,size:0.02,opacity:0.8,transparent:true}));
    this.scene.add(this.star);

    this.resize(w,h);
  }
  setAlbumTexture(){} setPalette(p){ if(this.tube) this.tube.material.color = new THREE.Color(p.accent||'#1db954'); } setAnalysis(){} setTempo(){} setTheme(){}
  onBar(){ this.sectionMod = (this.sectionMod+1)%4; } onSection(){ this.sectionMod = (this.sectionMod+2)%4; }
  resize(w,h){ this.cam.aspect=w/h; this.cam.updateProjectionMatrix(); }
  update(dt,t){ this.t+=dt; const spd=3.0; this.cam.position.z=2+(t*spd)%40; if(this.tube.material.map) this.tube.material.map.offset.y=(t*0.1)%1;
    this.star.position.z = (-(t*spd)%40); this.cam.rotation.z = Math.sin(t*0.2 + this.sectionMod)*0.2; this.cam.position.x=Math.sin(t*0.5)*0.2; this.cam.position.y=Math.cos(t*0.3)*0.15; }
  renderToTarget(renderer,target){ renderer.setRenderTarget(target); renderer.render(this.scene,this.cam); }
}