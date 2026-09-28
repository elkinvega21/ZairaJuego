/* =====================================================
   PRODUCTION GAME - THREE.JS SUSPENSE EDITION V2
   ===================================================== */

const container = document.getElementById('world-container');

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#010204'); // Muy oscuro (apagón)
scene.fog = new THREE.Fog('#010204', 300, 800);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lights - Apagón inicial
let isBlackout = true;
const hemiLight = new THREE.HemisphereLight(0x444466, 0x111122, 0.05); // Casi sin luz
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0); // Apagada
dirLight.position.set(150, 300, 150);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 500;
dirLight.shadow.camera.bottom = -500;
dirLight.shadow.camera.left = -500;
dirLight.shadow.camera.right = 500;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

// Linterna (Spotlight muy enfocado)
const spotLight = new THREE.SpotLight(0xffffff, 1.5);
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.3;
spotLight.distance = 400;
spotLight.castShadow = true;
scene.add(spotLight);

// Grid & Floor
const floorGeo = new THREE.PlaneGeometry(3000, 3000);
const floorMat = new THREE.MeshStandardMaterial({ color: '#050a14', roughness: 0.9, metalness: 0.1 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(3000, 60, '#22d3ee', '#22d3ee');
gridHelper.material.opacity = 0.05;
gridHelper.material.transparent = true;
gridHelper.position.y = 0.5;
scene.add(gridHelper);

// --- Configuración Global ---
const MATERIALS = {
  acero: { id: 'acero', nombre: 'Acero', color: '#64748b', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="10" width="20" height="4" rx="1"/></svg>' },
  madera: { id: 'madera', nombre: 'Madera', color: '#d97706', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"/><path d="M4 10h16M4 14h16"/></svg>' },
  ladrillo: { id: 'ladrillo', nombre: 'Ladrillo', color: '#b91c1c', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4h20v16H2z"/><path d="M2 12h20M8 4v8M16 4v8M12 12v8"/></svg>' }
};

// Item Geometry Factory
function createItemMesh(matData) {
  let geo;
  if (matData.id === 'acero') geo = new THREE.BoxGeometry(40, 5, 5); // Viga larga
  else if (matData.id === 'madera') geo = new THREE.BoxGeometry(20, 2, 30); // Tablón plano
  else if (matData.id === 'ladrillo') geo = new THREE.BoxGeometry(15, 12, 10); // Bloque grueso
  else geo = new THREE.BoxGeometry(15, 10, 10);
  
  const mat = new THREE.MeshStandardMaterial({ color: matData.color, roughness: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// --- Preguntas del Mini-juego (Fusibles) ---
const QUESTIONS = [
  { q: "¿La producción continua es ideal para productos altamente personalizados?", a: false },
  { q: "¿La producción por proyectos se usa para crear bienes únicos de gran escala?", a: true },
  { q: "¿La producción por lotes significa que se crea un solo producto a la vez sin parar?", a: false },
  { q: "¿El sistema 'Just In Time' busca reducir los inventarios al mínimo posible?", a: true },
  { q: "¿En la producción bajo pedido, se fabrica el producto antes de que el cliente lo pida?", a: false }
];
let currentQuestion = null;

// --- Game Variables ---
let playerName = "";
let unlockedLevels = 1;
let currentLevel = 0;
let isPlaying = false;
let isPaused = false;
let score = 0;
let timeRemaining = 0;
let secondTimer = 0;
let lives = 5;

let stations = [];
let droppedItems = [];
let obstacles = [];
let labels = [];
let enemies = [];

const clock = new THREE.Clock();

// --- Input ---
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
let interactPressed = false;
window.addEventListener('keydown', e => {
  if ((e.code === 'KeyE' || e.code === 'Space') && !interactPressed) {
    interactPressed = true;
    handleInteraction();
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'KeyE' || e.code === 'Space') interactPressed = false;
});

// --- Player Setup ---
const playerGroup = new THREE.Group();
scene.add(playerGroup);

const bodyGeo = new THREE.CylinderGeometry(8, 8, 20, 16);
const bodyMat = new THREE.MeshStandardMaterial({ color: '#2563eb' });
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.position.y = 10; bodyMesh.castShadow = true; playerGroup.add(bodyMesh);

const headGeo = new THREE.SphereGeometry(7, 16, 16);
const headMat = new THREE.MeshStandardMaterial({ color: '#fcd34d' });
const headMesh = new THREE.Mesh(headGeo, headMat);
headMesh.position.y = 25; headMesh.castShadow = true; playerGroup.add(headMesh);

const hatGeo = new THREE.CylinderGeometry(8, 8, 4, 16);
const hatMat = new THREE.MeshStandardMaterial({ color: '#eab308' });
const hatMesh = new THREE.Mesh(hatGeo, hatMat);
hatMesh.position.y = 30; hatMesh.castShadow = true; playerGroup.add(hatMesh);

const player = { speed: 200, carrying: null, carriedMesh: null, walkTime: 0 };
let playerLabelEl = null;

// --- Helpers ---
function createHTMLBillboard(html, yOffset, targetMesh) {
  const el = document.createElement('div');
  el.className = 'billboard-label';
  el.innerHTML = html;
  document.getElementById('ui-layer').appendChild(el);
  labels.push({ el, mesh: targetMesh, yOffset });
  return el;
}

function spawnFloatingText(text, color, pos) {
  const el = document.createElement('div');
  el.className = 'floating-text';
  el.innerText = text; el.style.color = color;
  document.getElementById('ui-layer').appendChild(el);
  
  let life = 1.0;
  const v = pos.clone();
  
  function anim() {
    life -= 0.02;
    if(life <= 0 || !isPlaying) return;
    v.y += 0.5;
    const p = v.clone(); p.project(camera);
    const x = (p.x * .5 + .5) * window.innerWidth;
    const y = (p.y * -.5 + .5) * window.innerHeight;
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.opacity = life;
    requestAnimationFrame(anim);
  }
  requestAnimationFrame(anim);
  setTimeout(()=>el.remove(), 1000);
}

function createBox(w, h, d, color, x, y, z) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color: color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// --- Menu ---
window.saveNameAndStart = function() {
  const input = document.getElementById('player-name-input').value.trim();
  if (input) {
    playerName = input;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('menu-screen').classList.add('active');
    updateMenuButtons();
    const bgm = document.getElementById('bg-music');
    bgm.volume = 0.5;
    bgm.play().catch(()=>{});
  }
}

function updateMenuButtons() {
  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById('btn-lvl-' + i);
    if (i <= unlockedLevels) {
      btn.disabled = false; btn.classList.remove('secondary'); btn.classList.add('primary');
      if (btn.innerText.includes('🔒')) {
        btn.innerText = btn.innerText.replace('🔒 ', '');
      }
    } else { btn.disabled = true; }
  }
}

// --- Init Levels ---
function clearScene() {
  stations.forEach(s => { scene.remove(s.mesh); if(s.pile) scene.remove(s.pile); });
  droppedItems.forEach(i => scene.remove(i.mesh));
  obstacles.forEach(o => scene.remove(o.mesh));
  labels.forEach(l => l.el.remove());
  if (player.carriedMesh) { playerGroup.remove(player.carriedMesh); player.carriedMesh = null; }
  
  scene.children.forEach(c => {
    if(c.userData && (c.userData.isObraMesh || c.userData.isObstacle)) scene.remove(c);
  });
  
  document.getElementById('mm-content').innerHTML = ''; // Limpiar minimapa
  stations = []; droppedItems = []; obstacles = []; labels = []; enemies = []; player.carrying = null;
}

window.startGame = function(level) {
  if (level > unlockedLevels) return;
  currentLevel = level; isPlaying = true; isPaused = false; score = 0;
  
  clearScene();
  playerGroup.position.set(0, 0, 0);
  camera.position.set(0, 300, 300); // Start high, lerp down
  playerLabelEl = createHTMLBillboard(`<span>${playerName}</span>`, 45, playerGroup);
  
  // Apagar la luz al iniciar
  isBlackout = true;
  hemiLight.intensity = 0.05;
  dirLight.intensity = 0;
  spotLight.intensity = 1.5;
  scene.background = new THREE.Color('#010204');
  scene.fog = new THREE.Fog('#010204', 300, 800);

  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
  document.getElementById('hud-screen').classList.remove('hidden');
  document.getElementById('hud-screen').classList.add('active');
  document.getElementById('hud-level').innerText = level;
  updateScore();

  // Juego desesperado: Empiezas con muy poco tiempo (aumenta un poco en niveles altos para compensar)
  timeRemaining = 25 + (level * 5); 
  lives = 5;
  updateLivesUI();
  
  createWarehouse(-250, -200, MATERIALS.acero);
  createWarehouse(0, -200, MATERIALS.madera);
  createWarehouse(250, -200, MATERIALS.ladrillo);
  createTrashCan(-150, 50);
  createBreakerBox(150, 50);
  generateObstacles();
  
  // Generar inspectores (enemigos) repartidos por todo el mapa
  const numEnemies = 3 + currentLevel;
  for(let i=0; i<numEnemies; i++) {
    createEnemy(-400 + (Math.random()*800), -300 + (Math.random()*600));
  }

  if (level === 1) initLevel1();
  else if (level === 2) initLevel2();
  else if (level === 3) initLevel3();
  else if (level === 4) initLevel4();
}

function initLevel1() {
  // PROYECTO: Estructura masiva única
  const siteMesh = createBox(200, 5, 200, '#1e293b', 0, 2.5, 200);
  const borderMesh = createBox(208, 4, 208, '#fcd34d', 0, 2, 200);
  borderMesh.userData.isObraMesh = true;
  const site = { type: 'project', mesh: siteMesh, x: 0, z: 200, radius: 160, stage: 1, currentBuilt: 0, totalForStage: 3, maxStages: 3, name: "🚧 OBRA (PROYECTO)" };
  stations.push(site);
  site.labelEl = createHTMLBillboard(site.name, 30, siteMesh);
  setupProjectStage(site);
}

function initLevel2() {
  // LOTES: Entregas masivas del mismo tipo repetidamente
  const siteMesh = createBox(200, 5, 200, '#475569', 0, 2.5, 200);
  const borderMesh = createBox(208, 4, 208, '#3b82f6', 0, 2, 200); // Borde azul
  borderMesh.userData.isObraMesh = true;
  const site = { type: 'project', mesh: siteMesh, x: 0, z: 200, radius: 160, stage: 1, currentBuilt: 0, totalForStage: 4, maxStages: 4, name: "📦 ZONA LOTE A/B" };
  stations.push(site);
  site.labelEl = createHTMLBillboard(site.name, 30, siteMesh);
  setupProjectStage(site);
}

function initLevel3() {
  // CONTINUA: Línea de producción sin fin, siempre pide algo distinto rápidamente
  const siteMesh = createBox(100, 20, 250, '#334155', 0, 10, 200);
  const borderMesh = createBox(108, 19, 258, '#22c55e', 0, 9, 200); // Borde verde
  borderMesh.userData.isObraMesh = true;
  const site = { type: 'project', mesh: siteMesh, x: 0, z: 200, radius: 140, stage: 1, currentBuilt: 0, totalForStage: 1, maxStages: 10, name: "⚙️ CINTA CONTINUA" };
  stations.push(site);
  site.labelEl = createHTMLBillboard(site.name, 40, siteMesh);
  setupProjectStage(site);
}

function initLevel4() {
  // BAJO PEDIDO: Pedidos específicos pequeños que cambian constantemente
  const siteMesh = createBox(150, 5, 150, '#1e293b', 0, 2.5, 200);
  const borderMesh = createBox(158, 4, 158, '#a855f7', 0, 2, 200); // Borde morado
  borderMesh.userData.isObraMesh = true;
  const site = { type: 'project', mesh: siteMesh, x: 0, z: 200, radius: 140, stage: 1, currentBuilt: 0, totalForStage: 2, maxStages: 5, name: "🛒 ZONA DE ENVÍOS" };
  stations.push(site);
  site.labelEl = createHTMLBillboard(site.name, 30, siteMesh);
  setupProjectStage(site);
}

function createTrashCan(x, z) {
  const geo = new THREE.CylinderGeometry(15, 12, 30, 16);
  const mat = new THREE.MeshStandardMaterial({ color: '#475569' });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 15, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  
  // Tapa negra
  const topGeo = new THREE.CylinderGeometry(16, 16, 2, 16);
  const topMat = new THREE.MeshStandardMaterial({ color: '#0f172a' });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.set(x, 31, z);
  scene.add(topMesh);
  mesh.userData.isObraMesh = true; topMesh.userData.isObraMesh = true;
  
  const labelEl = createHTMLBillboard("🗑️ Reciclaje", 40, mesh);
  stations.push({ type: 'trash', mesh, labelEl, x, z, radius: 60 });
}

function createBreakerBox(x, z) {
  const mesh = createBox(20, 40, 10, '#b91c1c', x, 20, z); // Caja roja
  const lightGeo = new THREE.SphereGeometry(3, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: '#f43f5e' }); // Luz roja (roto)
  const lightMesh = new THREE.Mesh(lightGeo, lightMat);
  lightMesh.position.set(x, 42, z);
  scene.add(lightMesh);
  mesh.userData.isObraMesh = true; lightMesh.userData.isObraMesh = true;
  
  const labelEl = createHTMLBillboard("⚡ Fusibles", 55, mesh);
  stations.push({ type: 'breaker', mesh, lightMesh, labelEl, x, z, radius: 60 });
}

function generateObstacles() {
  for (let i = 0; i < 15; i++) {
    const x = (Math.random() - 0.5) * 600;
    const z = (Math.random() - 0.5) * 400;
    if (Math.abs(z - (-200)) < 150) continue; 
    if (Math.hypot(x, z - 200) < 180) continue; // alejarse de la obra
    if (Math.hypot(x, z) < 100) continue;
    if (Math.hypot(x - (-150), z - 50) < 80) continue; // alejarse de basurero
    if (Math.hypot(x - 150, z - 50) < 80) continue; // alejarse de fusibles
    
    let mesh;
    if (Math.random() > 0.5) {
      const geo = new THREE.CylinderGeometry(10, 10, 25, 16);
      const mat = new THREE.MeshStandardMaterial({ color: '#f59e0b' });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 12.5, z);
    } else {
      mesh = createBox(30, 30, 30, '#1e293b', x, 15, z);
    }
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.isObstacle = true;
    scene.add(mesh);
    obstacles.push({ mesh, x, z, radius: 20 });
  }
}

function createWarehouse(x, z, matData) {
  const mesh = createBox(100, 80, 100, '#1e293b', x, 40, z); // Main
  const roof = createBox(106, 8, 106, '#0f172a', x, 84, z); // Roof
  roof.userData.isObraMesh = true;
  const door = createBox(30, 40, 5, '#000000', x, 20, z+50); // Door
  door.userData.isObraMesh = true;
  
  const lightGeo = new THREE.SphereGeometry(6, 16, 16);
  const lightMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
  const lightMesh = new THREE.Mesh(lightGeo, lightMat);
  lightMesh.position.set(x+30, 92, z+30);
  scene.add(lightMesh);
  lightMesh.userData.isObraMesh = true;
  
  const labelEl = createHTMLBillboard(`${matData.icon} Almacén de ${matData.nombre}`, 100, mesh);
  
  const pile = new THREE.Group();
  for(let i=0; i<3; i++) {
    const itemMesh = createItemMesh(matData);
    itemMesh.position.set(x + (Math.random()*10 - 5), 5 + i*8, z + 70 + (Math.random()*10 - 5));
    itemMesh.rotation.y = Math.random();
    pile.add(itemMesh);
  }
  scene.add(pile);
  
  stations.push({ type: 'supply', mesh, labelEl, pile, itemData: matData, x, z, radius: 90 });
}

function createEnemy(x, z) {
  const group = new THREE.Group();
  
  const bodyGeo = new THREE.CylinderGeometry(8, 8, 20, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#f43f5e' }); // Rojo inspector
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 10; bodyMesh.castShadow = true; group.add(bodyMesh);

  const headGeo = new THREE.SphereGeometry(7, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: '#fcd34d' });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.y = 25; headMesh.castShadow = true; group.add(headMesh);
  
  group.position.set(x, 0, z);
  scene.add(group);
  
  const labelEl = createHTMLBillboard("🕵️ Inspector", 40, group);
  labelEl.style.color = '#f43f5e';
  
  const mmEl = document.createElement('div');
  mmEl.className = 'mm-dot mm-enemy';
  document.getElementById('mm-content').appendChild(mmEl);
  
  enemies.push({ 
    mesh: group, labelEl, active: true, cooldown: 0, 
    speed: 60 + (currentLevel * 10), 
    targetPos: new THREE.Vector3(x, 0, z),
    mmEl
  });
}

function setupProjectStage(site) {
  const msgEl = document.getElementById('hud-msg');
  
  if (site.stage > site.maxStages) {
    addScore(200 * currentLevel); 
    msgEl.innerHTML = '¡PROYECTO TERMINADO!'; 
    document.getElementById('mission-progress').style.width = '100%'; 
    endLevel(true); 
    return;
  }

  // Define logic per level
  if (currentLevel === 1) {
    // PROYECTO: Construcción secuencial de casa/obra
    if (site.stage === 1) { site.needsItem = MATERIALS.acero; site.totalForStage = 3; }
    else if (site.stage === 2) { site.needsItem = MATERIALS.madera; site.totalForStage = 3; }
    else if (site.stage === 3) { site.needsItem = MATERIALS.ladrillo; site.totalForStage = 4; }
  } 
  else if (currentLevel === 2) {
    // LOTES: Tiras masivas de un solo componente
    if (site.stage === 1 || site.stage === 2) { site.needsItem = MATERIALS.acero; site.totalForStage = 4; }
    else if (site.stage === 3 || site.stage === 4) { site.needsItem = MATERIALS.madera; site.totalForStage = 4; }
  }
  else if (currentLevel === 3) {
    // CONTINUA: 1 material rápido, cambia aleatoriamente cada stage
    const mats = [MATERIALS.acero, MATERIALS.madera, MATERIALS.ladrillo];
    site.needsItem = mats[Math.floor(Math.random() * mats.length)];
    site.totalForStage = 1;
  }
  else if (currentLevel === 4) {
    // BAJO PEDIDO: Mezcla específica de pedidos pequeños
    if (site.stage === 1) { site.needsItem = MATERIALS.acero; site.totalForStage = 2; }
    else if (site.stage === 2) { site.needsItem = MATERIALS.ladrillo; site.totalForStage = 1; }
    else if (site.stage === 3) { site.needsItem = MATERIALS.madera; site.totalForStage = 3; }
    else if (site.stage === 4) { site.needsItem = MATERIALS.acero; site.totalForStage = 1; }
    else if (site.stage === 5) { site.needsItem = MATERIALS.ladrillo; site.totalForStage = 2; }
  }

  site.needsQty = site.totalForStage;
  site.currentBuilt = 0;
  
  updateMissionUI(site);
  
  stations.forEach(s => {
    if(s.type === 'supply' && s.labelEl) {
      if(s.itemData.id === site.needsItem.id) { s.labelEl.classList.add('target'); s.labelEl.innerHTML = `${s.itemData.icon} Almacén de ${s.itemData.nombre} <div class="label-arrow"></div>`; }
      else { s.labelEl.classList.remove('target'); s.labelEl.innerHTML = `${s.itemData.icon} Almacén de ${s.itemData.nombre}`; }
    }
  });
}

function updateMissionUI(site) {
  document.getElementById('hud-msg-icon').innerHTML = `<span style="color:${site.needsItem.color}">${site.needsItem.icon}</span>`;
  document.getElementById('mission-fase').innerText = `FASE ${site.stage} DE ${site.maxStages}`;
  document.getElementById('hud-msg').innerText = `Lleva ${site.needsQty} de ${site.needsItem.nombre} a la zona.`;
  const pct = (site.currentBuilt / site.totalForStage) * 100;
  document.getElementById('mission-progress').style.width = pct + '%';
}

// --- Game Loop ---
function update(dt) {
  if (!isPlaying || isPaused) return;

  // Movement
  let dx = 0; let dz = 0;
  if (keys['w'] || keys['arrowup']) dz -= 1;
  if (keys['s'] || keys['arrowdown']) dz += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len = Math.sqrt(dx*dx + dz*dz); dx /= len; dz /= len;
    const angle = Math.atan2(dx, dz);
    playerGroup.rotation.y = angle;
    player.walkTime += dt * 15;
    playerGroup.position.y = Math.abs(Math.sin(player.walkTime)) * 4;
  } else {
    playerGroup.position.y = 0;
  }

  let nx = playerGroup.position.x + dx * player.speed * dt;
  let nz = playerGroup.position.z + dz * player.speed * dt;

  nx = Math.max(-1000, Math.min(1000, nx));
  nz = Math.max(-1000, Math.min(1000, nz));

  let collided = false;
  stations.forEach(s => { if (Math.hypot(nx - s.x, nz - s.z) < s.radius - 20) collided = true; });
  obstacles.forEach(o => { if (Math.hypot(nx - o.x, nz - o.z) < o.radius + 10) collided = true; });

  if (!collided) { playerGroup.position.x = nx; playerGroup.position.z = nz; }
  
  // Enemies Logic
  enemies.forEach(e => {
    if (!e.active) return;
    if (e.cooldown > 0) { e.cooldown -= dt; return; }
    
    const distToPlayer = Math.hypot(playerGroup.position.x - e.mesh.position.x, playerGroup.position.z - e.mesh.position.z);
    if (distToPlayer < 250) {
      // Chase player
      const ex = playerGroup.position.x - e.mesh.position.x;
      const ez = playerGroup.position.z - e.mesh.position.z;
      const len = Math.hypot(ex, ez);
      e.mesh.position.x += (ex / len) * e.speed * dt;
      e.mesh.position.z += (ez / len) * e.speed * dt;
      e.mesh.rotation.y = Math.atan2(ex, ez);
      e.mesh.position.y = Math.abs(Math.sin(secondTimer * 10)) * 3;
      
      // Hit player
      if (distToPlayer < 20) {
        if (player.carrying) {
          dropItem();
          spawnFloatingText('¡MATERIAL PERDIDO!', 'var(--status-error)', playerGroup.position);
          document.body.classList.add('flash-error');
          setTimeout(() => document.body.classList.remove('flash-error'), 200);
        } else {
          lives--;
          updateLivesUI();
          spawnFloatingText('-1 VIDA', 'var(--status-error)', playerGroup.position);
          document.body.classList.add('flash-error');
          setTimeout(() => document.body.classList.remove('flash-error'), 200);
          if (lives <= 0) {
            endLevel(false);
          }
        }
        e.cooldown = 4.0; // Wait 4 seconds after hitting
      }
    } else {
      // Wander around map
      const dx = e.targetPos.x - e.mesh.position.x;
      const dz = e.targetPos.z - e.mesh.position.z;
      const distToWander = Math.hypot(dx, dz);
      
      if (distToWander < 10) {
        // Pick new wander target
        e.targetPos.x = -400 + Math.random() * 800;
        e.targetPos.z = -300 + Math.random() * 600;
      } else {
        const wanderSpeed = e.speed * 0.5;
        e.mesh.position.x += (dx / distToWander) * wanderSpeed * dt;
        e.mesh.position.z += (dz / distToWander) * wanderSpeed * dt;
        e.mesh.rotation.y = Math.atan2(dx, dz);
        e.mesh.position.y = Math.abs(Math.sin(secondTimer * 5)) * 2;
      }
    }
  });

  // Camera Follow
  const targetCamX = playerGroup.position.x;
  const targetCamZ = playerGroup.position.z + 180;
  camera.position.x += (targetCamX - camera.position.x) * 4 * dt;
  camera.position.z += (targetCamZ - camera.position.z) * 4 * dt;
  camera.position.y += (180 - camera.position.y) * 2 * dt;
  camera.lookAt(camera.position.x, 0, camera.position.z - 180);
  
  // Suspense Spotlight follows player
  spotLight.position.set(playerGroup.position.x, 200, playerGroup.position.z + 50);
  spotLight.target = playerGroup;

  updateMinimap();

  // Update Labels
  labels.forEach(l => {
    const p = new THREE.Vector3();
    if(l.mesh.isGroup) p.copy(l.mesh.position); else p.copy(l.mesh.position);
    p.y += l.yOffset;
    p.project(camera);
    if (p.z > 1) { l.el.style.opacity = 0; return; } else { l.el.style.opacity = 1; }
    
    const x = (p.x * .5 + .5) * window.innerWidth;
    const y = (p.y * -.5 + .5) * window.innerHeight;
    l.el.style.left = `${x}px`; l.el.style.top = `${y}px`;
  });

  // Timers
  secondTimer += dt;
  if (secondTimer >= 1) {
    secondTimer -= 1;
    if (timeRemaining > 0) {
      timeRemaining--;
      updateTimerUI();
    }
  }

  // Hints
  const hintEl = document.getElementById('interaction-hint');
  let hintStr = "";
  
  // Enemy hints take priority
  let nearEnemy = false;
  enemies.forEach(e => {
    if (e.active && Math.hypot(playerGroup.position.x - e.mesh.position.x, playerGroup.position.z - e.mesh.position.z) < 40) {
      hintStr = "Pulsa E para debatir con el Inspector";
      nearEnemy = true;
    }
  });
  
  if (!nearEnemy) {
    stations.forEach(s => {
      const dist = Math.hypot(playerGroup.position.x - s.x, playerGroup.position.z - s.z);
      if (dist < s.radius + 10) {
        if(s.type === 'supply') hintStr = `Pulsa E para tomar ${s.itemData.nombre}`;
        if(s.type === 'project' && player.carrying) hintStr = `Pulsa E para entregar`;
        if(s.type === 'trash' && player.carrying) hintStr = `Pulsa E para desechar (-3s)`;
        if(s.type === 'breaker' && isBlackout) hintStr = `Pulsa E para hackear sistema de luz`;
      }
    });
  }
  
  if (hintStr) { hintEl.innerText = hintStr; hintEl.classList.remove('hidden'); }
  else { hintEl.classList.add('hidden'); }
}

function updateMinimap() {
  const pEl = document.getElementById('mm-player');
  // Mapear de -500 a 500 en x,z hacia 0% a 100% (mundo total es aprox 1000x1000)
  const mapCoord = (val) => ((val + 500) / 1000) * 100;
  
  pEl.style.left = `${mapCoord(playerGroup.position.x)}%`;
  pEl.style.top = `${mapCoord(playerGroup.position.z)}%`;
  
  enemies.forEach(e => {
    if (e.active) {
      e.mmEl.style.display = 'block';
      e.mmEl.style.left = `${mapCoord(e.mesh.position.x)}%`;
      e.mmEl.style.top = `${mapCoord(e.mesh.position.z)}%`;
    } else {
      e.mmEl.style.display = 'none';
    }
  });
}

function updateTimerUI() {
  const ht = document.getElementById('hud-time');
  if (timeRemaining <= 0) { endLevel(false); return; }
  const min = Math.floor(timeRemaining/60).toString().padStart(2, '0');
  const sec = (timeRemaining%60).toString().padStart(2, '0');
  ht.innerText = `${min}:${sec}`;
  if(timeRemaining < 10) ht.classList.add('time-danger'); else ht.classList.remove('time-danger');
}

function updateLivesUI() {
  document.getElementById('hud-lives').innerText = lives;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  update(dt);
  renderer.render(scene, camera);
}
animate();

// --- Interaction ---
function handleInteraction() {
  if (!isPlaying || isPaused) return;
  
  // Prioridad 1: Enemigos
  let enemyToFight = null;
  enemies.forEach(e => {
    if (e.active && Math.hypot(playerGroup.position.x - e.mesh.position.x, playerGroup.position.z - e.mesh.position.z) < 40) {
      enemyToFight = e;
    }
  });
  
  if (enemyToFight) {
    isPaused = true;
    currentQuestion = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    document.getElementById('inspector-question').innerText = currentQuestion.q;
    document.getElementById('inspector-modal').classList.remove('hidden');
    
    window.activeEnemy = enemyToFight; // Referencia global temporal
    return;
  }
  
  let closest = null; let minDist = 150;
  
  stations.forEach(s => {
    const dist = Math.hypot(playerGroup.position.x - s.x, playerGroup.position.z - s.z);
    if (dist < minDist && dist < s.radius + 20) { minDist = dist; closest = { type: 'station', obj: s }; }
  });
  
  droppedItems.forEach(i => {
    const dist = Math.hypot(playerGroup.position.x - i.mesh.position.x, playerGroup.position.z - i.mesh.position.z);
    if (dist < 60) { minDist = dist; closest = { type: 'dropped', obj: i }; }
  });
  
  if (!closest) { if (player.carrying) dropItem(); return; }
  if (closest.type === 'dropped') {
    if (player.carrying) dropItem();
    pickupItem(closest.obj); return;
  }
  
  const st = closest.obj;
  const cData = player.carrying;

  if (st.type === 'supply' && !player.carrying) {
    equipItem(st.itemData);
    spawnFloatingText('+ RECOGIDO', 'var(--status-success)', playerGroup.position);
  }
  else if (st.type === 'project') {
    if (cData && cData.id === st.needsItem.id) {
      destroyCarried(); 
      st.needsQty--; st.currentBuilt++; addScore(10);
      
      // MECÁNICA DESESPERADA: Ganas tiempo al entregar
      const timeBonus = Math.max(5, 15 - currentLevel); // +14s, +13s, etc.
      timeRemaining += timeBonus;
      updateTimerUI();
      document.getElementById('hud-time').style.color = 'var(--status-success)';
      setTimeout(() => document.getElementById('hud-time').style.color = '', 500);

      spawnFloatingText(`+10 PTS | +${timeBonus}s`, 'var(--status-success)', playerGroup.position);
      
      const p = createItemMesh(cData);
      p.userData.isObraMesh = true;
      let px, pz, py;
      if (cData.id === 'acero') {
        px = (st.currentBuilt === 1) ? -80 : (st.currentBuilt === 2) ? 80 : 0;
        pz = st.z; py = 20 + (st.currentBuilt===3 ? 30 : 0);
        if(st.currentBuilt === 3) p.rotation.y = Math.PI/2; else { p.rotation.z = Math.PI/2; p.position.y += 20; }
      } else if (cData.id === 'madera') {
        px = (st.currentBuilt - 2) * 25; pz = st.z + 40; py = 10;
      } else {
        px = -50 + (st.currentBuilt * 20); pz = st.z - 40; py = 10;
      }
      p.position.set(px, py, pz);
      scene.add(p);

      updateMissionUI(st);
      if (st.needsQty <= 0) { st.stage++; setupProjectStage(st); }
    } else if(cData) {
      addScore(-10);
      spawnFloatingText('-10 PRODUCTO EQUIVOCADO', 'var(--status-error)', playerGroup.position);
      document.body.classList.add('flash-error');
      setTimeout(() => document.body.classList.remove('flash-error'), 200);
    }
  }
  else if (st.type === 'trash') {
    if (player.carrying) {
      destroyCarried();
      timeRemaining = Math.max(0, timeRemaining - 3);
      updateTimerUI();
      spawnFloatingText('-3 SEGUNDOS', 'var(--status-error)', playerGroup.position);
      document.body.classList.add('flash-error');
      setTimeout(() => document.body.classList.remove('flash-error'), 200);
    }
  }
  else if (st.type === 'breaker') {
    if (isBlackout) {
      isPaused = true;
      currentQuestion = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
      document.getElementById('breaker-question').innerText = currentQuestion.q;
      document.getElementById('breaker-modal').classList.remove('hidden');
    }
  }
}

// Logic for Inspector Modal
window.answerInspector = function(answer) {
  document.getElementById('inspector-modal').classList.add('hidden');
  isPaused = false;
  if (answer === currentQuestion.a) {
    // Correct! Evaded
    window.activeEnemy.active = false;
    window.activeEnemy.mmEl.style.display = 'none'; // Quitar del minimapa
    window.activeEnemy.mesh.material = new THREE.MeshStandardMaterial({ color: '#475569' }); // Vuelve gris
    window.activeEnemy.labelEl.style.opacity = 0;
    spawnFloatingText('INSPECTOR EVADIDO', 'var(--status-success)', playerGroup.position);
    addScore(50);
  } else {
    // Incorrect! Hit
    timeRemaining = Math.max(0, timeRemaining - 5);
    updateTimerUI();
    window.activeEnemy.cooldown = 2.0; // Te da 2 segundos para correr
    spawnFloatingText('RESPUESTA INCORRECTA (-5s)', 'var(--status-error)', playerGroup.position);
    document.body.classList.add('flash-error');
    setTimeout(() => document.body.classList.remove('flash-error'), 200);
  }
}

// Logic for Breaker Modal
window.answerBreaker = function(answer) {
  document.getElementById('breaker-modal').classList.add('hidden');
  isPaused = false;
  if (answer === currentQuestion.a) {
    // Correct!
    isBlackout = false;
    hemiLight.intensity = 0.4;
    dirLight.intensity = 0.6;
    spotLight.intensity = 0.3; // Linterna suave
    scene.background = new THREE.Color('#03050a');
    scene.fog = new THREE.Fog('#03050a', 300, 900);
    
    // Cambiar la luz de la caja
    const breaker = stations.find(s => s.type === 'breaker');
    if(breaker) breaker.lightMesh.material.color.setHex(0x34d399); // Verde

    spawnFloatingText('SISTEMA RESTABLECIDO', 'var(--status-success)', playerGroup.position);
  } else {
    // Incorrect
    timeRemaining = Math.max(0, timeRemaining - 5);
    updateTimerUI();
    spawnFloatingText('RESPUESTA INCORRECTA (-5s)', 'var(--status-error)', playerGroup.position);
    document.body.classList.add('flash-error');
    setTimeout(() => document.body.classList.remove('flash-error'), 200);
  }
}

function equipItem(data) {
  player.carrying = data;
  const mesh = createItemMesh(data);
  mesh.position.set(0, 15, 12); 
  playerGroup.add(mesh);
  player.carriedMesh = mesh;
}
function destroyCarried() {
  if (player.carriedMesh) playerGroup.remove(player.carriedMesh);
  player.carriedMesh = null; player.carrying = null;
}
function dropItem() {
  const item = player.carrying;
  const mesh = createItemMesh(item);
  const offset = new THREE.Vector3(0, 0, 30);
  offset.applyQuaternion(playerGroup.quaternion);
  mesh.position.copy(playerGroup.position).add(offset);
  mesh.position.y = 10;
  scene.add(mesh);
  droppedItems.push({ mesh: mesh, itemData: item });
  destroyCarried();
}
function pickupItem(dropped) {
  equipItem(dropped.itemData);
  scene.remove(dropped.mesh);
  droppedItems = droppedItems.filter(i => i !== dropped);
}

function addScore(points) {
  score += points;
  const el = document.getElementById('hud-score');
  el.innerText = score;
  el.style.color = points > 0 ? 'var(--status-success)' : 'var(--status-error)';
  setTimeout(()=> el.style.color = '#fff', 300);
}
function updateScore() { document.getElementById('hud-score').innerText = score; }

function endLevel(success) {
  isPlaying = false;
  if (success && currentLevel === unlockedLevels) {
    unlockedLevels++;
  }
  
  document.getElementById('hud-screen').classList.remove('active');
  document.getElementById('hud-screen').classList.add('hidden');
  
  const title = document.getElementById('end-title');
  const sub = document.getElementById('end-subtitle');
  const iconSuccess = document.getElementById('end-icon-success');
  const iconFail = document.getElementById('end-icon-fail');
  
  if (success) {
    title.innerText = "¡NIVEL COMPLETADO!";
    title.style.color = "var(--status-success)";
    sub.innerText = "¡Excelente trabajo! Has optimizado la línea de producción de forma espectacular.";
    iconSuccess.style.display = "block";
    iconFail.style.display = "none";
  } else {
    title.innerText = "SISTEMA COLAPSADO";
    title.style.color = "var(--status-error)";
    sub.innerText = "El tiempo se agotó y la producción se detuvo.";
    iconSuccess.style.display = "none";
    iconFail.style.display = "block";
  }
  
  document.getElementById('end-screen').classList.remove('hidden');
  document.getElementById('end-screen').classList.add('active');
  document.getElementById('end-stats').innerText = score;
}

window.returnToMenu = function() {
  isPlaying = false;
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
  document.getElementById('menu-screen').classList.remove('hidden');
  document.getElementById('menu-screen').classList.add('active');
  updateMenuButtons(); // Actualiza los candados
}
