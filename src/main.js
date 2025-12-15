import * as THREE from 'three';
// Importe les contrôles de la caméra (nécessite three-stdlib)
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; 
// Importe le GUI pour les paramètres du jeu (nécessite dat.gui)
import * as dat from 'dat.gui'; 
// CORRECTION : Importe les styles CSS pour que le canvas remplisse l'écran
import './style.css'; 

// --- DÉCLARATION GLOBALE DES COMPOSANTS ---
// Déclarer ces variables en dehors des fonctions pour les rendre accessibles partout (CORRECTION CLÉ)
const container = document.getElementById('app') || document.body;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
let controls; // Variable globale pour les OrbitControls

// --- CONFIGURATION ET INITIALISATION DE LA SCÈNE ---
function initScene() {
    // Nettoyer l'élément et configurer le rendu
    container.innerHTML = ''; 
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x36454F); // Couleur de fond gris ardoise
    container.appendChild(renderer.domElement);

    // Initialisation des contrôles de la caméra (Exigence du livrable A.2)
    camera.position.set(10, 15, 10);
    camera.lookAt(0, 0, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Mouvement plus fluide

    // Lumières et Aide visuelle
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    
    // Ajout d'une grille pour visualiser le sol
    const gridHelper = new THREE.GridHelper(50, 50, 0x555555, 0x333333);
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize, false);
}

// Gestion du redimensionnement (pour la réactivité)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- LOGIQUE DU JEU (Prototype de Tuile) ---

// Fonction de création de tuile 3D (objet à manipuler)
function createTestTile(x, y, z, color = 0x4169E1) {
    const geometry = new THREE.BoxGeometry(2, 0.3, 2); 
    const material = new THREE.MeshStandardMaterial({ color: color, metalness: 0.2, roughness: 0.5 });
    const tile = new THREE.Mesh(geometry, material);
    tile.position.set(x, y, z);
    scene.add(tile);
    return tile;
}

// Crée une petite pile test (structure multicouche)
function createInitialPile() {
    const colors = [0xFF5733, 0x33FF57, 0x3357FF, 0xFFC300, 0x8A2BE2];
    let y_offset = 0.15; // Moitié de la hauteur d'une tuile
    
    // Couche inférieure (3x3)
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            createTestTile(i * 2.1 - 2.1, y_offset, j * 2.1 - 2.1, colors[i % 5]);
        }
    }
    y_offset += 0.3; // Augmente la hauteur pour la couche suivante
    
    // Couche intermédiaire (2x2)
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            createTestTile(i * 2.1 - 1.05, y_offset, j * 2.1 - 1.05, colors[3]);
        }
    }
    y_offset += 0.3;
    
    // Couche supérieure (1x1)
    createTestTile(0, y_offset, 0, colors[4]);
}

// --- BOUCLE D'ANIMATION ---
function animate() {
    requestAnimationFrame(animate);

    // Utilise la variable globale 'controls' (CORRECTION)
    if (controls) controls.update(); 
    
    renderer.render(scene, camera);
}

// --- GUI (dat.gui - Exigence : paramétrer le jeu) ---
function setupGUI() {
    const gui = new dat.GUI();
    // Configuration pour les niveaux de difficulté
    const settings = {
        difficulty: 'Moyen',
        timeLimit: true,
        startGame: () => {
            console.log("Démarrage du jeu avec difficulté :", settings.difficulty);
            // La logique pour générer la pile selon la difficulté ira ici
        }
    };

    gui.add(settings, 'difficulty', ['Facile', 'Moyen', 'Difficile']).name('Niveau de Difficulté');
    gui.add(settings, 'timeLimit').name('Temps Limité');
    gui.add(settings, 'startGame').name('Lancer la Partie');
}

// --- LANCEMENT DE L'APPLICATION ---
initScene();
createInitialPile();
setupGUI();
animate();
;