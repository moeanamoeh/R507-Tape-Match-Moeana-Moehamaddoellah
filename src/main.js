import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "dat.gui";
import "./style.css";

/* -------------------------------------------------------
   TAP MATCH (Vanilla JS) - Adapté depuis ta version TSX
   - Raycasting survol + clic
   - OrbitControls caméra (rotation/zoom)
   - GUI : difficulté + temps limité + lancer/restart
   - Inventaire limité + triplés + bonus nettoyage + combo
-------------------------------------------------------- */

// DOM
const container = document.getElementById("app");

// THREE core
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(10, 12, 10);
camera.lookAt(0, 2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 2, 0);

// Lights + ground
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0x4ecdc4, 0.55);
pointLight.position.set(-10, 10, -10);
scene.add(pointLight);

const groundGeometry = new THREE.CircleGeometry(15, 32);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x16213e,
  roughness: 0.85,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

// Game state
let score = 0;
let gameStarted = false;
let gameOver = false;
let victory = false;

let difficulty = "moyen"; // facile | moyen | difficile
let timeLimit = false;
let timeRemaining = 180;

let tiles = []; // toutes les tuiles dans la scène (hors supprimées)
let inventory = []; // tuiles sélectionnées
let lastTripleTime = 0;

let timerId = null;

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredTile = null;

// HUD DOM
const hud = document.createElement("div");
hud.className = "hud";
hud.innerHTML = `
  <h1>🎮 Tap Match</h1>
  <div class="row"><span>Score</span><span class="badge" id="hudScore">0</span></div>
  <div class="row" id="hudTimeRow" style="display:none;"><span>Temps</span><span class="badge" id="hudTime">0</span></div>
  <div class="row"><span>Inventaire</span><span class="badge" id="hudInv">0/0</span></div>
  <div style="margin-top:8px;font-size:12px;opacity:0.9;">
    Souris: <b>clic</b> sur tuile libre · Caméra: <b>drag</b> + <b>molette</b>
  </div>
`;
container.style.position = "relative";
container.appendChild(hud);
// --- STOCKAGE (barre d'inventaire visible) ---
const storage = document.createElement("div");
storage.style.position = "absolute";
storage.style.left = "16px";
storage.style.bottom = "16px";
storage.style.zIndex = "1600";
storage.style.background = "rgba(20, 20, 30, 0.88)";
storage.style.color = "white";
storage.style.padding = "10px 12px";
storage.style.borderRadius = "12px";
storage.style.minWidth = "260px";
storage.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
storage.innerHTML = `
  <div style="font-weight:800;margin-bottom:8px;">📦 Stockage</div>
  <div id="storageSlots" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
`;
container.appendChild(storage);


const messageEl = document.createElement("div");
messageEl.className = "message";
container.appendChild(messageEl);

const overlay = document.createElement("div");
overlay.className = "overlay";
overlay.innerHTML = `
  <div class="panel">
    <h2 id="overlayTitle">—</h2>
    <p style="margin:0 0 6px;">Score final : <b id="overlayScore">0</b></p>
    <button id="overlayBtn">🔄 Rejouer</button>
  </div>
`;
container.appendChild(overlay);

overlay.querySelector("#overlayBtn").addEventListener("click", () => startGame());

// Helpers HUD
function showMessage(txt, ms = 2000) {
  messageEl.textContent = txt;
  messageEl.style.display = "block";
  setTimeout(() => {
    messageEl.style.display = "none";
  }, ms);
}

function setOverlay(show, title = "", finalScore = 0) {
  overlay.style.display = show ? "flex" : "none";
  if (show) {
    overlay.querySelector("#overlayTitle").textContent = title;
    overlay.querySelector("#overlayScore").textContent = String(finalScore);
  }
}

function renderStorage() {
  const cfg = getDifficultyConfig();
  const slotsEl = document.getElementById("storageSlots");
  if (!slotsEl) return;

  slotsEl.innerHTML = "";

  for (let i = 0; i < cfg.inventorySize; i++) {
    const slot = document.createElement("div");
    slot.style.width = "26px";
    slot.style.height = "26px";
    slot.style.borderRadius = "8px";
    slot.style.border = "2px solid rgba(255,255,255,0.22)";
    slot.style.boxSizing = "border-box";

    if (inventory[i]) {
      // couleur de la tuile stockée
      const c = inventory[i].userData.originalColor; // ex: 0xff6b6b
      slot.style.background = `#${c.toString(16).padStart(6, "0")}`;
      slot.title = `Tuile type ${inventory[i].userData.type}`;
    } else {
      slot.style.background = "rgba(255,255,255,0.08)";
      slot.title = "Vide";
    }

    slotsEl.appendChild(slot);
  }
}

function updateHUD() {
  const cfg = getDifficultyConfig();
  hud.querySelector("#hudScore").textContent = String(score);
  hud.querySelector("#hudInv").textContent = `${inventory.length}/${cfg.inventorySize}`;

  const timeRow = hud.querySelector("#hudTimeRow");
  if (timeLimit) {
    timeRow.style.display = "flex";
    hud.querySelector("#hudTime").textContent = `${timeRemaining}s`;
  } else {
    timeRow.style.display = "none";
  }

  // met à jour l'affichage du stockage
  renderStorage();
}


// Difficulty config (reprend ta logique TSX)
function getDifficultyConfig() {
  switch (difficulty) {
    case "facile":
      return { layers: 3, types: 8, inventorySize: 8, time: 240 };
    case "moyen":
      return { layers: 5, types: 12, inventorySize: 7, time: 180 };
    case "difficile":
      return { layers: 7, types: 16, inventorySize: 7, time: 120 };
    default:
      return { layers: 5, types: 12, inventorySize: 7, time: 180 };
  }
}

function getTileColors(numTypes) {
  const colors = [
    0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24,
    0x6c5ce7, 0xa29bfe, 0xfd79a8, 0xe17055,
    0x00b894, 0x0984e3, 0xfdcb6e, 0xd63031,
    0xe84393, 0x2d3436, 0x00cec9, 0xff7675,
  ];
  return colors.slice(0, numTypes);
}

function createTile(type, color, position, layer) {
  const geometry = new THREE.BoxGeometry(1.2, 0.3, 1.2);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.2,
  });

  const tile = new THREE.Mesh(geometry, material);
  tile.position.copy(position);
  tile.castShadow = true;
  tile.receiveShadow = true;

  tile.userData = {
    type,
    originalColor: color,
    isFree: layer === 0,
    layer,
    inInventory: false,
  };

  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  tile.add(edges);

  return tile;
}

function clearTiles() {
  tiles.forEach((t) => scene.remove(t));
  tiles = [];
  inventory = [];
}

function generatePile() {
  clearTiles();

  const cfg = getDifficultyConfig();
  const colors = getTileColors(cfg.types);
  const tilesPerLayer = 12;

  // Génère des types en triplés (comme ton TSX)
  const numTiles = cfg.layers * tilesPerLayer;
  const tileTypes = [];

  for (let i = 0; i < Math.floor(numTiles / 3); i++) {
    const type = i % cfg.types;
    tileTypes.push(type, type, type);
  }

  // Shuffle
  for (let i = tileTypes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tileTypes[i], tileTypes[j]] = [tileTypes[j], tileTypes[i]];
  }

  let idx = 0;
  for (let layer = 0; layer < cfg.layers; layer++) {
    const radius = 3 - layer * 0.3;
    const angleStep = (Math.PI * 2) / tilesPerLayer;

    for (let i = 0; i < tilesPerLayer; i++) {
      if (idx >= tileTypes.length) break;

      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = layer * 0.4;

      const type = tileTypes[idx];
      const tile = createTile(
        type,
        colors[type],
        new THREE.Vector3(x, y, z),
        layer
      );

      tiles.push(tile);
      scene.add(tile);
      idx++;
    }
  }

  updateFreeTiles();
  updateHUD();
}

function updateFreeTiles() {
  tiles.forEach((tile) => {
    if (tile.userData.inInventory) return;

    let isCovered = false;
    const p = tile.position;

    tiles.forEach((other) => {
      if (other === tile || other.userData.inInventory) return;

      const op = other.position;
      if (op.y > p.y + 0.2) {
        const dx = Math.abs(op.x - p.x);
        const dz = Math.abs(op.z - p.z);
        if (dx < 0.9 && dz < 0.9) isCovered = true;
      }
    });

    tile.userData.isFree = !isCovered;
  });
}

function animateTileTo(tile, target, duration = 300) {
  const start = tile.position.clone();
  const startTime = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    tile.position.lerpVectors(start, target, ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function reorganizeInventory() {
  inventory.forEach((tile, index) => {
    const target = new THREE.Vector3(-6 + index * 1.5, -2, 8);
    animateTileTo(tile, target, 250);
  });
}

function selectTile(tile) {
  const cfg = getDifficultyConfig();

  if (inventory.length >= cfg.inventorySize) {
    showMessage("❌ Inventaire plein !");
    return;
  }

  tile.userData.inInventory = true;
  inventory.push(tile);

  const target = new THREE.Vector3(-6 + inventory.length * 1.5, -2, 8);
  animateTileTo(tile, target, 280);

  updateFreeTiles();
  updateHUD();

  setTimeout(checkForTriples, 250);
}

function checkForTriples() {
  const counts = {};
  inventory.forEach((t) => {
    counts[t.userData.type] = (counts[t.userData.type] || 0) + 1;
  });

  for (const k in counts) {
    if (counts[k] >= 3) {
      removeTriple(parseInt(k, 10));
      return;
    }
  }

  // Défaite si inventaire plein ET aucun triplé
  const cfg = getDifficultyConfig();
  if (inventory.length >= cfg.inventorySize) endGame(false);
}

function removeTriple(type) {
  const toRemove = inventory.filter((t) => t.userData.type === type).slice(0, 3);

  // retire les 3 tuiles de l’inventaire + scène
  toRemove.forEach((t) => {
    scene.remove(t);
    inventory = inventory.filter((x) => x !== t);
    tiles = tiles.filter((x) => x !== t);
  });

  let points = 100;

  const now = Date.now();
  if (now - lastTripleTime < 3000) {
    points += 50;
    showMessage("🔥 COMBO +50 !");
  } else {
    showMessage("✨ Triplé +100 !");
  }
  lastTripleTime = now;

  // Bonus nettoyage : retire toutes les tuiles restantes du même type sur le plateau
  const remainingSame = tiles.filter(
    (t) => t.userData.type === type && !t.userData.inInventory
  );
  if (remainingSame.length > 0) {
    points += 200;
    showMessage("💫 NETTOYAGE BONUS +200 !");
    remainingSame.forEach((t) => {
      scene.remove(t);
      tiles = tiles.filter((x) => x !== t);
    });
  }

  score += points;
  reorganizeInventory();
  updateFreeTiles();
  updateHUD();

  // Victoire si plus de tuiles hors inventaire
  const remainingTiles = tiles.filter((t) => !t.userData.inInventory);
  if (remainingTiles.length === 0) endGame(true);
}

function startGame() {
  gameStarted = true;
  gameOver = false;
  victory = false;

  score = 0;
  lastTripleTime = 0;

  const cfg = getDifficultyConfig();
  timeRemaining = cfg.time;

  if (timerId) clearInterval(timerId);
  timerId = null;

  setOverlay(false);

  generatePile();

  if (timeLimit) {
    timerId = setInterval(() => {
      timeRemaining -= 1;
      if (timeRemaining <= 0) {
        timeRemaining = 0;
        endGame(false, true); // défaite par temps
      }
      updateHUD();
    }, 1000);
  }

  updateHUD();
}

function endGame(isVictory, byTime = false) {
  if (timerId) clearInterval(timerId);
  timerId = null;

  gameOver = !isVictory;
  victory = isVictory;

  // pénalité temps : score = 0 si timeLimit et temps écoulé (comme ton doc)
  if (!isVictory && byTime && timeLimit) score = 0;

  updateHUD();
  setOverlay(true, isVictory ? "🎉 VICTOIRE !" : "💀 DÉFAITE", score);
}

function getIntersects(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // IMPORTANT: recursive=true pour toucher aussi les enfants (edges)
  const hits = raycaster.intersectObjects(tiles, true);

  // On remonte jusqu'au parent qui possède userData.type
  return hits.map(h => {
    let obj = h.object;
    while (obj && (!obj.userData || obj.userData.type === undefined) && obj.parent) {
      obj = obj.parent;
    }
    return { ...h, object: obj };
  }).filter(h => h.object && h.object.userData && h.object.userData.type !== undefined);
}


renderer.domElement.addEventListener("click", (e) => {
  if (!gameStarted || gameOver || victory) return;

  const hits = getIntersects(e.clientX, e.clientY);
  if (hits.length > 0) {
    const tile = hits[0].object;
    if (tile.userData.isFree && !tile.userData.inInventory) selectTile(tile);
  }
});

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// GUI dat.gui
const gui = new dat.GUI();
const settings = {
  difficulty: "moyen",
  timeLimit: false,
  start: () => startGame(),
  restart: () => startGame(),
};

gui.add(settings, "difficulty", ["facile", "moyen", "difficile"]).name("Difficulté").onChange((v) => {
  difficulty = v;
  updateHUD();
});
gui.add(settings, "timeLimit").name("Temps Limité").onChange((v) => {
  timeLimit = v;
  updateHUD();
});
gui.add(settings, "start").name("Lancer la Partie");
gui.add(settings, "restart").name("Recommencer");

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// État initial (pas lancé)
difficulty = settings.difficulty;
timeLimit = settings.timeLimit;
updateHUD();
showMessage("Choisis tes options dans le GUI → puis Lance la partie ✅", 2500);
hud.style.pointerEvents = "none";
messageEl.style.pointerEvents = "none";
storage.style.pointerEvents = "none";

