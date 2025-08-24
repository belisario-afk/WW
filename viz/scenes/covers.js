import * as THREE from 'https://esm.sh/three@0.160.0';

export default class CoversScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 50);
    this.target = null;
    this.sprites = [];
    this.album = null;
    this.mouse = new THREE.Vector2();
  }

  init(renderer, width, height, { albumTexture, mouse }) {
    this.target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
    this.album = albumTexture || this._fallback();
    this.mouse = mouse || this.mouse;

    this._spawnSprites();
    this.camera.position.set(0, 0, 8);
    this.resize(width, height);
  }

  _fallback() {
    // 1x1 RGBA solid pixel (Spotify green) to avoid format issues
    const data = new Uint8Array([29, 185, 84, 255]);
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _spawnSprites() {
    // Clear previous sprites/materials
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
    this.sprites = [];

    const mat = new THREE.SpriteMaterial({
      map: this.album,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    for (let i = 0; i < 20; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.position.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 10
      );
      const sc = 0.8 + Math.random() * 1.6;
      s.scale.set(sc, sc, 1);
      s.userData.v = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      );
      this.scene.add(s);
      this.sprites.push(s);
    }
  }

  setAlbumTexture(tex) {
    this.album = tex;
    this._spawnSprites();
  }

  setPalette() {}
  setAnalysis() {}
  setTempo() {}

  onBeat() {
    // Beat pop: slight scale up and opacity boost
    for (const s of this.sprites) {
      s.scale.multiplyScalar(1.08);
      s.material.opacity = 1.0;
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt, t, { mouse } = {}) {
    const m = mouse || this.mouse;

    for (const s of this.sprites) {
      s.position.addScaledVector(s.userData.v, 60 * dt);
      if (s.position.x > 8 || s.position.x < -8) s.userData.v.x *= -1;
      if (s.position.y > 5 || s.position.y < -5) s.userData.v.y *= -1;
      if (s.position.z > 10 || s.position.z < -10) s.userData.v.z *= -1;

      s.material.opacity = THREE.MathUtils.lerp(s.material.opacity, 0.85, 0.05);
      s.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
    }

    // Subtle parallax using cursor
    this.scene.position.x = (m?.x || 0) * 0.3;
    this.scene.position.y = (m?.y || 0) * 0.2;
  }

  renderToTarget(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}