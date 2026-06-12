/* ══════════════════════════════════════════════════════════════
   NECTA Monitor — Scène 3D de l'écran de connexion
   Machine espresso stylisée en Three.js : rotation douce,
   parallax souris, vapeur animée, éclairage premium.
   Module 100% autonome : crée son propre canvas, ne touche à
   aucun code métier, se met en pause quand le login est masqué.
   ══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(typeof THREE === 'undefined') return;                       // three.js absent : on abandonne silencieusement
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth < 768;

  const loginScreen = document.getElementById('loginScreen');
  if(!loginScreen) return;

  /* ── Canvas plein écran derrière la carte de connexion ── */
  const canvas = document.createElement('canvas');
  canvas.id = 'login3d';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
  loginScreen.insertBefore(canvas, loginScreen.firstChild);
  /* La carte de connexion passe au-dessus */
  const wrap = loginScreen.querySelector('.login-wrap');
  if(wrap) wrap.style.zIndex = '2';

  /* ── Renderer ── */
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:!isMobile});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth/window.innerHeight, .1, 60);
  /* Sur mobile la carte couvre le centre : on recule la caméra */
  camera.position.set(0, 1.45, isMobile ? 9.5 : 7.2);
  camera.lookAt(0, 1.05, 0);

  /* ── Éclairage : clé froide + contre-jour bleu + chaleur près de la tasse ── */
  scene.add(new THREE.AmbientLight(0x8899bb, .45));
  const key = new THREE.DirectionalLight(0xdde6ff, 1.0);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x4f9cf9, 2.2, 14);           // halo bleu NECTA
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffaa55, 1.1, 5);           // lueur chaude de la tasse
  warm.position.set(0, .9, 1.6);
  scene.add(warm);

  /* ── Matériaux ── */
  const matBody  = new THREE.MeshStandardMaterial({color:0x232a3a, metalness:.85, roughness:.32});
  const matDark  = new THREE.MeshStandardMaterial({color:0x12161f, metalness:.7,  roughness:.45});
  const matSteel = new THREE.MeshStandardMaterial({color:0x9aa6c0, metalness:.95, roughness:.22});
  const matCup   = new THREE.MeshStandardMaterial({color:0xe8e9f0, metalness:.05, roughness:.55});
  const matGlow  = new THREE.MeshBasicMaterial({color:0x4f9cf9});
  const matCoffee= new THREE.MeshStandardMaterial({color:0x3a2317, metalness:.1, roughness:.3});

  /* ── La machine (groupe pivotant) ── */
  const machine = new THREE.Group();
  scene.add(machine);
  const add = (geo, mat, x, y, z, g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    (g || machine).add(m);
    return m;
  };

  /* Socle / bac d'égouttage */
  add(new THREE.BoxGeometry(3.4, .22, 2.2), matDark, 0, .11, 0);
  add(new THREE.BoxGeometry(2.2, .06, 1.3), matSteel, 0, .26, .35);   // grille
  /* Corps principal */
  add(new THREE.BoxGeometry(3.0, 2.3, 1.5), matBody, 0, 1.5, -.45);
  /* Panneau supérieur (chauffe-tasses) */
  add(new THREE.BoxGeometry(3.15, .18, 1.65), matDark, 0, 2.72, -.45);
  /* Liseré lumineux bleu sur la façade */
  add(new THREE.BoxGeometry(2.6, .055, .02), matGlow, 0, 2.32, .32);
  /* Manomètre */
  add(new THREE.CylinderGeometry(.27, .27, .08, 24).rotateX(Math.PI/2), matSteel, -.85, 1.85, .33);
  add(new THREE.CylinderGeometry(.20, .20, .02, 24).rotateX(Math.PI/2), new THREE.MeshBasicMaterial({color:0xcfe2ff}), -.85, 1.85, .38);
  /* Groupe d'extraction */
  add(new THREE.CylinderGeometry(.42, .46, .5, 28), matSteel, 0, 1.0, .15);
  /* Porte-filtre + manche */
  add(new THREE.CylinderGeometry(.36, .32, .18, 28), matDark, 0, .72, .15);
  add(new THREE.CylinderGeometry(.07, .09, 1.0, 14).rotateX(Math.PI/2), matDark, 0, .72, .85);
  /* Tasse + café + anse */
  add(new THREE.CylinderGeometry(.30, .22, .42, 28), matCup, 0, .50, .15);
  add(new THREE.CylinderGeometry(.27, .27, .03, 28), matCoffee, 0, .70, .15);
  add(new THREE.TorusGeometry(.13, .045, 10, 20), matCup, .33, .50, .15);
  /* Boutons de façade */
  for(let i = 0; i < 3; i++)
    add(new THREE.CylinderGeometry(.09, .09, .06, 18).rotateX(Math.PI/2), matSteel, .45 + i*.42, 1.85, .33);
  /* Logo lumineux */
  add(new THREE.BoxGeometry(.5, .14, .02), matGlow, .85, 2.32, .33).visible = false;

  /* ── Halo circulaire au sol (fausse ombre douce) ── */
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128,128,10, 128,128,128);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.6),
    new THREE.MeshBasicMaterial({map:shadowTex, transparent:true, depthWrite:false})
  );
  shadow.rotation.x = -Math.PI/2;
  shadow.position.y = .01;
  machine.add(shadow);

  /* ── Vapeur : sprites qui montent de la tasse en ondulant ── */
  const steamTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32,32,2, 32,32,32);
    g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
  })();
  const steamCount = isMobile ? 14 : 26;
  const steam = [];
  for(let i = 0; i < steamCount; i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map:steamTex, transparent:true, opacity:0, depthWrite:false}));
    s.userData = {t: Math.random()*2.2};                          // phase de vie aléatoire
    machine.add(s);
    steam.push(s);
  }

  /* ── Orbes lumineux flottants en arrière-plan ── */
  const orbs = [];
  const orbColors = [0x4f9cf9, 0x3ecf8e, 0xa78bfa];
  for(let i = 0; i < (isMobile ? 5 : 9); i++){
    const o = new THREE.Sprite(new THREE.SpriteMaterial({
      map:steamTex, transparent:true, opacity:.10 + Math.random()*.12,
      color:orbColors[i % 3], depthWrite:false
    }));
    const sc = 1.2 + Math.random()*2.4;
    o.scale.set(sc, sc, 1);
    o.position.set((Math.random()-.5)*16, Math.random()*7, -4 - Math.random()*6);
    o.userData = {sp: .08 + Math.random()*.18, ph: Math.random()*6.28, y0: o.position.y};
    scene.add(o);
    orbs.push(o);
  }

  /* ── Parallax souris (interpolé pour rester soyeux) ── */
  let mx = 0, my = 0;
  if(!isMobile) window.addEventListener('mousemove', e => {
    mx = (e.clientX / window.innerWidth  - .5) * 2;
    my = (e.clientY / window.innerHeight - .5) * 2;
  }, {passive:true});

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ── Boucle d'animation : 60 FPS, en pause si le login est masqué ── */
  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    if(loginScreen.style.display === 'none') return;             // dashboard ouvert : zéro travail GPU
    const dt = Math.min(clock.getDelta(), .05);
    const t  = clock.elapsedTime;

    /* Rotation de présentation + parallax souris */
    machine.rotation.y += ((Math.sin(t*.22)*.38 + mx*.30) - machine.rotation.y) * .045;
    machine.rotation.x += ((my*.06) - machine.rotation.x) * .045;
    machine.position.y  = Math.sin(t*.7)*.05;                    // lévitation subtile

    /* Vapeur : cycle de vie montée + dissipation */
    steam.forEach((s, i) => {
      s.userData.t += dt;
      const life = 2.2, p = (s.userData.t % life) / life;
      s.position.set(
        Math.sin(p*9 + i)*.09 + Math.sin(i*7)*.05,
        .75 + p*1.5,
        .15 + Math.cos(i*3)*.04
      );
      const sc = .12 + p*.5;
      s.scale.set(sc, sc, 1);
      s.material.opacity = Math.sin(p*Math.PI)*.30;
    });

    /* Orbes : flottement lent */
    orbs.forEach(o => {
      o.position.y = o.userData.y0 + Math.sin(t*o.userData.sp + o.userData.ph)*.6;
      o.position.x += Math.sin(t*.05 + o.userData.ph)*.0012;
    });

    /* Pulsation douce du halo bleu */
    rim.intensity = 2.2 + Math.sin(t*1.3)*.5;

    renderer.render(scene, camera);
  }

  if(reduced){
    /* Préférence "réduire les animations" : une seule image fixe */
    machine.rotation.y = .3;
    renderer.render(scene, camera);
  } else {
    animate();
  }
})();
