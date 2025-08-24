import * as THREE from 'https://esm.sh/three@0.160.0';

function mkRibbon(color){
  const N=140; const g=new THREE.BufferGeometry(); const pos=new Float32Array(N*3);
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.8 });
  const line=new THREE.Line(g,m);
  line.userData={ pts:Array.from({length:N},()=>new THREE.Vector3(0,0,0)), t:Math.random()*100 };
  return line;
}

export default class RibbonsScene{
  constructor(){ this.scene=new THREE.Scene(); this.cam=new THREE.PerspectiveCamera(70,1,0.1,20); this.ribs=[]; this.palette=null; this.mouse=null; }
  init(renderer,w,h,{palette,mouse}){
    this.palette=palette; this.mouse=mouse;
    for(let i=0;i<5;i++){ const col = palette?.palette?.[i % (palette.palette?.length||1)] || '#ffffff'; this.ribs.push(mkRibbon(new THREE.Color(col))); }
    this.ribs.forEach(r=>this.scene.add(r));
    this.cam.position.set(0,0,5);
    this.resize(w,h);
  }
  setPalette(p){ this.palette=p; for(let i=0;i<this.ribs.length;i++){ const col = new THREE.Color(p.palette?.[i % (p.palette?.length||1)] || '#fff'); this.ribs[i].material.color = col; } }
  setAlbumTexture(){} setAnalysis(){} setTempo(){} setTheme(){}
  onBeat(){ this.ribs.forEach(r=>r.material.opacity = 1.0); }
  resize(w,h){ this.cam.aspect=w/h; this.cam.updateProjectionMatrix(); }
  update(dt,t,{mouse}){ const m=mouse||this.mouse; for(const r of this.ribs){ const d=r.userData; d.t+=dt;
      const head=new THREE.Vector3( Math.sin(d.t*0.7 + r.id)*1.8 + (m?.x||0)*0.8, Math.cos(d.t*0.9 + r.id)*1.2 + (m?.y||0)*0.6, Math.sin(d.t*0.5 + r.id)*0.6 );
      d.pts.pop(); d.pts.unshift(head);
      const p=r.geometry.attributes.position.array;
      for(let i=0;i<d.pts.length;i++){ const pt=d.pts[i]; p[i*3+0]=pt.x; p[i*3+1]=pt.y; p[i*3+2]=pt.z; }
      r.geometry.attributes.position.needsUpdate = true;
      r.material.opacity = THREE.MathUtils.lerp(r.material.opacity, 0.7, 0.05);
    } }
  renderToTarget(r,t){ r.setRenderTarget(t); r.render(this.scene,this.cam); }
}