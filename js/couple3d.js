// Prozedurales Low-Poly-Brautpaar (Marc & Fiona) als A-Frame-1.5.0-Komponente `couple`.
// Ursprung = Fuesse (Mitte zwischen den Figuren), Blick +Z, Hoehe 1.0, Abstand der Figuren 0.45.
// Animationen: idle | walk | cheer (per Attribut `couple="anim: walk"` oder el.components.couple.play('cheer')).

const SKIN = 0xf2c4a0;
const ANIMS = ['idle', 'walk', 'cheer'];
const SPACING = 0.45;          // Abstand der Figuren (Mitte zu Mitte)
const SHOULDER = { x: 0.125, y: 0.46 };
const ARM_LEN = 0.25;          // Schulter -> Handmitte

const lerp = (a, b, k) => a + (b - a) * k;

// Pose je Animation. side: -1 = Braeutigam (links), +1 = Braut (rechts).
// outerZ/innerZ: Armwinkel gegen "haengt runter" (rad), outer = nach aussen, inner = zur Mitte.
function pose(anim, t, side) {
  if (anim === 'walk') {
    const f = t * 7, s = Math.sin(f);
    return { y: Math.abs(s) * 0.025, leg: s * 0.7, outerX: -s * 0.6, outerZ: 0.18, innerX: s * 0.08, innerZ: 0.31,
             headZ: Math.sin(f) * 0.04 * side, bodyZ: s * 0.03, skirt: s * 0.05, toss: 0 };
  }
  if (anim === 'cheer') {
    const f = t * 9, s = Math.sin(f);
    return { y: Math.abs(s) * 0.1, leg: s * 0.35, outerX: 0, outerZ: 2.6 + Math.sin(f * 2) * 0.12,
             innerX: -2.3 + Math.sin(f * 2) * 0.12, innerZ: 0.31, headZ: Math.sin(f * 0.5) * 0.1 * side,
             bodyZ: 0, skirt: Math.abs(s) * 0.08, toss: 1 };
  }
  const b = Math.sin(t * 2 + (side > 0 ? 0.8 : 0)); // idle: atmen / wippen
  return { y: (b * 0.5 + 0.5) * 0.012, leg: 0, outerX: 0, outerZ: 0.14 + b * 0.03, innerX: 0, innerZ: 0.31,
           headZ: Math.sin(t * 1.3) * 0.05 * side, bodyZ: Math.sin(t * 1.0) * 0.015 * side, skirt: b * 0.015, toss: 0 };
}

export function registerCouple(AFRAME) {
  if (!AFRAME || AFRAME.components.couple) return;
  const THREE = AFRAME.THREE;

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...o });
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
  const sphere = (r, m, x, y, z, w = 8, h = 6) => mesh(new THREE.SphereGeometry(r, w, h), m, x, y, z);
  const cyl = (rt, rb, h, m, seg = 8) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

  // Arm mit Pivot an der Schulter; Mesh haengt nach unten, Hand am Ende.
  function makeArm(sleeve, x, withSkinForearm) {
    const pivot = new THREE.Group();
    pivot.position.set(x, SHOULDER.y, 0);
    pivot.add(mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.2, 6), sleeve, 0, -0.09, 0));
    if (withSkinForearm) pivot.add(mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.1, 6), mat(SKIN), 0, -0.17, 0));
    pivot.add(sphere(0.042, mat(SKIN), 0, -ARM_LEN, 0));
    return pivot;
  }

  // Beine mit Pivot an der Hueftehoehe.
  function makeLeg(x, legMat, shoeMat, len) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.22, 0);
    pivot.add(mesh(new THREE.CylinderGeometry(0.048, 0.044, len, 6), legMat, 0, -len / 2, 0));
    const shoe = sphere(0.058, shoeMat, 0, -0.205, 0.025);
    shoe.scale.set(0.95, 0.6, 1.5);
    pivot.add(shoe);
    return pivot;
  }

  function makeHead(hairColor) {
    const head = new THREE.Group();
    head.position.set(0, 0.74, 0);
    const skin = mat(SKIN), dark = mat(0x1d1a1a, { roughness: 0.4 });
    head.add(sphere(0.21, skin, 0, 0, 0, 12, 9));
    head.add(sphere(0.036, skin, 0.205, -0.01, 0), sphere(0.036, skin, -0.205, -0.01, 0));
    for (const x of [-0.075, 0.075]) {
      head.add(sphere(0.03, dark, x, 0.015, 0.188, 8, 6));
      head.add(sphere(0.011, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), x + 0.01, 0.027, 0.214, 6, 4));
      const cheek = sphere(0.034, mat(0xff9aa0, { roughness: 1 }), x * 1.7, -0.045, 0.172, 8, 5);
      cheek.scale.set(1, 0.7, 0.35); cheek.rotation.y = Math.sign(x) * 0.62;
      head.add(cheek);
    }
    const smile = mesh(new THREE.TorusGeometry(0.048, 0.009, 4, 8, Math.PI), mat(0x9a3b3b), 0, -0.06, 0.19);
    smile.rotation.z = Math.PI;
    head.add(smile);
    head.userData.hairMat = mat(hairColor);
    return head;
  }

  function buildGroom() {
    const fig = new THREE.Group(), jacket = mat(0x262a38), pants = mat(0x1d2029), shoe = mat(0x111111);
    const torso = cyl(0.105, 0.118, 0.28, jacket); torso.position.y = 0.36; torso.rotation.y = Math.PI / 8;
    fig.add(torso);
    fig.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 6), mat(SKIN), 0, 0.51, 0));
    // weisses Hemd-Dreieck (V) + Fliege
    const tri = new THREE.Shape(); tri.moveTo(-0.075, 0.485); tri.lineTo(0.075, 0.485); tri.lineTo(0, 0.3); tri.closePath();
    const shirt = mesh(new THREE.ShapeGeometry(tri), mat(0xfafafa, { side: THREE.DoubleSide }), 0, 0, 0.1);
    fig.add(shirt);
    const bowMat = mat(0xa3202d);
    for (const s of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.03, 0.05, 4), bowMat, s * 0.03, 0.452, 0.118); w.rotation.z = s * Math.PI / 2; w.scale.z = 0.5; fig.add(w); }
    fig.add(sphere(0.014, bowMat, 0, 0.452, 0.12, 6, 4));
    for (const y of [0.4, 0.34]) fig.add(sphere(0.01, mat(0x333844), 0, y, 0.112, 5, 4)); // Knoepfe
    const head = makeHead(0x4a2d1b), hm = head.userData.hairMat;
    const cap = mesh(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0, 0.0, -0.01);
    cap.rotation.x = -0.4; head.add(cap);
    const fringe = sphere(0.09, hm, 0.05, 0.2, 0.1, 6, 4); fringe.scale.set(1.3, 0.55, 0.9); head.add(fringe);
    head.add(sphere(0.05, hm, -0.06, 0.2, 0.0, 6, 4));
    fig.add(head);
    const legs = [makeLeg(-0.055, pants, shoe, 0.2), makeLeg(0.055, pants, shoe, 0.2)];
    legs.forEach(l => fig.add(l));
    return { fig, head, legs, torso, skirt: null };
  }

  function buildBride() {
    const fig = new THREE.Group(), white = mat(0xfdfdf8), sash = mat(0xf3a7c0);
    const skirt = new THREE.Group(); skirt.position.y = 0.3;
    skirt.add(mesh(new THREE.CylinderGeometry(0.09, 0.215, 0.23, 10), white, 0, -0.115, 0));
    fig.add(skirt);
    const torso = cyl(0.088, 0.1, 0.2, white); torso.position.y = 0.4; torso.rotation.y = Math.PI / 8;
    fig.add(torso);
    fig.add(mesh(new THREE.CylinderGeometry(0.103, 0.103, 0.025, 8), sash, 0, 0.31, 0));
    fig.add(sphere(0.022, sash, 0, 0.31, 0.105, 5, 4));
    fig.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 6), mat(SKIN), 0, 0.51, 0));
    const head = makeHead(0x8a5530), hm = head.userData.hairMat;
    const cap = mesh(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52), hm, 0, 0, -0.015);
    cap.rotation.x = -0.4; head.add(cap);
    head.add(sphere(0.085, hm, 0, 0.245, -0.03, 8, 6));                 // Dutt
    head.add(sphere(0.035, mat(0xf6e27a), 0.14, 0.19, 0.11, 5, 4));      // Blumen im Haar
    head.add(sphere(0.03, mat(0xf3a7c0), 0.2, 0.12, 0.1, 5, 4));
    fig.add(head);
    // Schleier: halbtransparent, haengt hinter dem Kopf
    const veil = mesh(new THREE.CylinderGeometry(0.235, 0.27, 0.5, 12, 1, true, Math.PI * 0.5, Math.PI),
      mat(0xffffff, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }), 0, 0.68, -0.02);
    veil.rotation.x = 0.12;
    fig.add(veil);
    const legs = [makeLeg(-0.055, mat(SKIN), mat(0xf3a7c0), 0.2), makeLeg(0.055, mat(SKIN), mat(0xf3a7c0), 0.2)];
    legs.forEach(l => fig.add(l));
    return { fig, head, legs, torso, skirt };
  }

  function makeBouquet() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 5), mat(0x4f9a52), 0, -0.04, 0));
    const cols = [0xf3a7c0, 0xff7b95, 0xf6e27a, 0xffffff, 0xf3a7c0];
    cols.forEach((c, i) => {
      const a = (i / 4) * Math.PI * 2;
      g.add(sphere(0.035, mat(c), i === 4 ? 0 : Math.cos(a) * 0.04, 0.025 + (i === 4 ? 0.025 : 0), i === 4 ? 0 : Math.sin(a) * 0.04, 6, 4));
    });
    return g;
  }

  AFRAME.registerComponent('couple', {
    schema: {
      anim: { default: 'idle', oneOf: ANIMS },
      speed: { default: 1 },        // Animationstempo-Faktor
    },

    init() {
      const root = this.root = new THREE.Group();
      const groom = this.groom = buildGroom(), bride = this.bride = buildBride();
      groom.fig.position.x = -SPACING / 2; bride.fig.position.x = SPACING / 2;
      groom.side = -1; bride.side = 1;
      for (const p of [groom, bride]) {
        const outer = makeArm(p === groom ? mat(0x262a38) : mat(0xfdfdf8), p.side * SHOULDER.x, p === bride);
        const inner = makeArm(p === groom ? mat(0x262a38) : mat(0xfdfdf8), -p.side * SHOULDER.x, p === bride);
        p.outer = outer; p.inner = inner;
        p.fig.add(outer, inner);
        root.add(p.fig);
      }
      this.bouquet = makeBouquet();
      root.add(this.bouquet);
      this.el.setObject3D('mesh', root);

      this.t = 0;
      this.weights = { idle: 1, walk: 0, cheer: 0 };
      this.target = ANIMS.includes(this.data.anim) ? this.data.anim : 'idle';
      this._v = new THREE.Vector3();

      // A-Frame ruft play() ohne Argument als Lifecycle-Methode; mit String = Animation wechseln.
      const lifecyclePlay = Object.getPrototypeOf(this).play;
      this.play = (anim) => {
        if (typeof anim === 'string') return this.setAnim(anim);
        return lifecyclePlay.call(this);
      };
      this.applyPose(0);
    },

    update() {
      if (ANIMS.includes(this.data.anim)) this.target = this.data.anim;
    },

    setAnim(name) {
      if (!ANIMS.includes(name)) return console.warn('couple: unbekannte Animation', name);
      this.target = name;
      if (this.el.getAttribute('couple').anim !== name) this.el.setAttribute('couple', 'anim', name);
    },

    remove() { this.el.removeObject3D('mesh'); },

    tick(time, dtMs) {
      const dt = Math.min(dtMs || 16, 50) / 1000;
      this.t += dt * this.data.speed;
      const k = 1 - Math.exp(-dt * 6); // weiche Uebergaenge (~0.3 s)
      for (const a of ANIMS) this.weights[a] = lerp(this.weights[a], a === this.target ? 1 : 0, k);
      this.applyPose(this.t);
    },

    applyPose(t) {
      for (const p of [this.groom, this.bride]) {
        const m = { y: 0, leg: 0, outerX: 0, outerZ: 0, innerX: 0, innerZ: 0, headZ: 0, bodyZ: 0, skirt: 0, toss: 0 };
        for (const a of ANIMS) {
          const w = this.weights[a]; if (w < 0.001) continue;
          const q = pose(a, t, p.side);
          for (const key in m) m[key] += q[key] * w;
        }
        const s = p.side;
        p.fig.position.y = m.y;
        p.fig.rotation.z = m.bodyZ;
        p.legs[0].rotation.x = m.leg; p.legs[1].rotation.x = -m.leg;
        p.outer.rotation.set(m.outerX, 0, s * m.outerZ);
        // innen: Hand nach vorne-oben (innerX), Winkel zur Mitte (innerZ); Gegenarm schwingt gegen das Bein
        p.inner.rotation.set(m.innerX, 0, -s * m.innerZ);
        p.head.rotation.z = m.headZ;
        if (p.skirt) p.skirt.rotation.z = m.skirt * Math.sin(t * 7);
        p.toss = m.toss;
      }
      // Strauss: in der Hand der Braut (aussen), beim Jubeln hoch geworfen
      const b = this.bride, v = this._v.set(0, -ARM_LEN, 0.03);
      this.root.updateMatrixWorld(true);
      b.outer.localToWorld(v); this.root.worldToLocal(v);
      const ph = (t * 0.9) % 1, u = ph / 0.6;
      const toss = ph < 0.6 ? 4 * u * (1 - u) * 0.3 : 0;
      this.bouquet.position.set(v.x, v.y + toss * b.toss + 0.03, v.z);
      this.bouquet.rotation.z = toss * b.toss * 6;
    },
  });
}

if (typeof window !== 'undefined' && window.AFRAME) registerCouple(window.AFRAME);
