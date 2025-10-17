// Minimal Three.js scene with a corrugated look and adjustable dimensions/pitch
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const canvas = document.getElementById("shedCanvas");
const fallback = document.getElementById("webglFallback");
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Basic WebGL support check
if (!window.WebGLRenderingContext) {
  fallback.hidden = false;
}

// Scene, camera, renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f15);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
resize();
window.addEventListener("resize", resize);

const camera = new THREE.PerspectiveCamera(45, 16/9, 0.1, 5000);
camera.position.set(120, 90, 160);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x0b0f15, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(100, 200, 120);
dir.castShadow = false;
scene.add(dir);

// Ground
const grid = new THREE.GridHelper(1000, 40, 0x2a354a, 0x1d2636);
scene.add(grid);

// Unit scale: 1 unit = 1 foot
// Materials: “corrugated” look via procedural stripe texture
const corrugationTex = makeCorrugatedTexture({ stripe: 6, gap: 6, metal: true });
corrugationTex.wrapS = corrugationTex.wrapT = THREE.RepeatWrapping;

const metalMat = new THREE.MeshStandardMaterial({
  color: 0xc9cfd8,
  metalness: 0.85,
  roughness: 0.35,
  map: corrugationTex
});

const frameMat = new THREE.MeshStandardMaterial({
  color: 0x8a94a6,
  metalness: 0.6,
  roughness: 0.6
});

// Shed group
const shed = new THREE.Group();
scene.add(shed);

let walls, roofLeft, roofRight;

// Controls
const lengthEl = document.getElementById("length");
const widthEl  = document.getElementById("width");
const heightEl = document.getElementById("height");
const pitchEl  = document.getElementById("pitch");

const lengthVal = document.getElementById("lengthVal");
const widthVal  = document.getElementById("widthVal");
const heightVal = document.getElementById("heightVal");
const pitchVal  = document.getElementById("pitchVal");

function readInputs() {
  const L = clamp(parseFloat(lengthEl.value), 10, 150);    // feet
  const W = clamp(parseFloat(widthEl.value),  10, 100);
  const H = clamp(parseFloat(heightEl.value),  8,  80);
  const P = clamp(parseFloat(pitchEl.value),   0,  12);    // rise per 12
  lengthVal.textContent = L;
  widthVal.textContent  = W;
  heightVal.textContent = H;
  pitchVal.textContent  = P;
  return { L, W, H, P };
}

function buildShed() {
  // Clear old
  while (shed.children.length) shed.remove(shed.children[0]);

  const { L, W, H, P } = readInputs();

  // Adjust corrugation tiling to physical size
  corrugationTex.repeat.set(L / 4, H / 2);

  // Walls (simple box shell)
  const wallsGeo = new THREE.BoxGeometry(L, H, W);
  walls = new THREE.Mesh(wallsGeo, metalMat);
  walls.position.y = H / 2;
  shed.add(walls);

  // Simple steel frame beams at corners (visual cue)
  const beamGeo = new THREE.BoxGeometry(1, H, 1);
  const offsets = [
    [-L/2+0.5, H/2, -W/2+0.5],
    [ L/2-0.5, H/2, -W/2+0.5],
    [-L/2+0.5, H/2,  W/2-0.5],
    [ L/2-0.5, H/2,  W/2-0.5]
  ];
  offsets.forEach(p => {
    const b = new THREE.Mesh(beamGeo, frameMat);
    b.position.set(p[0], p[1], p[2]);
    shed.add(b);
  });

  // Gable roof made of two thin boxes rotated by pitch
  // Pitch: rise per 12 ⇒ angle = atan((P/12))
  const angle = Math.atan(P / 12);
  const halfSpan = W / 2;
  const roofThickness = 0.6;
  const overhang = 2;

  // Roof panel dimensions: length = L + overhang*2, width = halfSpan / cos(angle)
  const roofLen = L + overhang * 2;
  const roofPanelWidth = Math.sqrt(halfSpan * halfSpan + Math.pow(halfSpan * Math.tan(angle), 2));

  const roofGeo = new THREE.BoxGeometry(roofLen, roofThickness, roofPanelWidth);
  const roofMat = metalMat.clone();
  roofMat.map = makeCorrugatedTexture({ stripe: 5, gap: 5, metal: true });
  roofMat.map.wrapS = roofMat.map.wrapT = THREE.RepeatWrapping;
  roofMat.map.repeat.set(roofLen / 4, roofPanelWidth / 2);

  // Left panel
  roofLeft = new THREE.Mesh(roofGeo, roofMat);
  roofLeft.rotation.x = 0;
  roofLeft.rotation.z =  angle;
  // position: sit atop walls at ridge height
  const ridgeRise = Math.tan(angle) * halfSpan;
  const roofY = H + ridgeRise / 2;
  roofLeft.position.set(0, roofY, -halfSpan / 2);
  shed.add(roofLeft);

  // Right panel
  roofRight = new THREE.Mesh(roofGeo, roofMat);
  roofRight.rotation.z = -angle;
  roofRight.position.set(0, roofY,  halfSpan / 2);
  shed.add(roofRight);

  // Reposition shed so it sits near origin
  shed.position.set(0, 0, 0);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.parentElement.clientWidth;
  const h = rect.height || canvas.parentElement.clientHeight || w * 9/16;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Procedural “corrugated metal” texture
function makeCorrugatedTexture({ stripe = 6, gap = 6, metal = true } = {}) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");

  // Base
  const base = ctx.createLinearGradient(0,0,256,256);
  base.addColorStop(0, metal ? "#cbd3dc" : "#cfd6de");
  base.addColorStop(1, metal ? "#aeb8c6" : "#b6c0cd");
  ctx.fillStyle = base;
  ctx.fillRect(0,0,256,256);

  // Vertical corrugations
  const period = stripe + gap;
  for (let x = 0; x < 256; x += period) {
    // bright ridge
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x, 0, stripe * 0.6, 256);
    // shadowed side
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x + stripe * 0.6, 0, stripe * 0.4, 256);
  }

  // Fine noise for metal grain
  const imgData = ctx.getImageData(0,0,256,256);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i]   = clamp(d[i]   + n, 0, 255);
    d[i+1] = clamp(d[i+1] + n, 0, 255);
    d[i+2] = clamp(d[i+2] + n, 0, 255);
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Hook up UI
["input", "change"].forEach(evt => {
  lengthEl.addEventListener(evt, buildShed);
  widthEl.addEventListener(evt, buildShed);
  heightEl.addEventListener(evt, buildShed);
  pitchEl.addEventListener(evt, buildShed);
});

// Init
buildShed();
animate();
