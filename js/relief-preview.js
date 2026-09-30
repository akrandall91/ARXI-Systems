// Live 3D lithophane relief preview.
// Renders an uploaded (or sample) photo as a real solid relief model in WebGL —
// front face sculpted from image luminance, flat back, connecting side walls —
// draggable via OrbitControls, with a light toggle that swaps in a
// physically-motivated "backlit" glow (Beer-Lambert-style transmission).
//
// Geometry + transmission model adapted from a fuller in-house 3D lithophane
// designer (akrd-print-lab-pricing.html) that exports real STL print files;
// this version keeps only what a homepage preview needs.

const LUM_MAX_DIM = 260; // source resolution used for luminance + glow texture
const MESH_RES_LONG = 110; // mesh resolution along the longer side — geometry is coarser than the texture, same as real print resolution limits
const DENSITY = 2.8;
const AMBIENT = 0.08;
const TINT = [255, 241, 214];

const SHAPES = {
  flat: { sizeMM: 130, minThickness: 0.8, maxThickness: 3.0 },
  cylinder: { heightMM: 140, diameterMM: 90, minThickness: 0.8, maxThickness: 3.0 },
};

let threePromise = null;
function loadThree() {
  if (!threePromise) {
    threePromise = Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
    ]);
  }
  return threePromise;
}

// A soft dark-to-darker gradient reads as a subtle studio backdrop instead of
// a flat void behind the model.
function buildBackgroundTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#1b1c2b');
  g.addColorStop(0.55, '#101018');
  g.addColorStop(1, '#08080c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A radial-gradient alpha blob under the model — a cheap, always-correct
// stand-in for a real contact shadow that grounds the object in the scene.
function buildShadowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

// Resizes to LUM_MAX_DIM on the longer side and keeps the source aspect ratio
// (no forced square crop), matching the resolution the glow texture renders at.
function computeLuminanceGrid(img) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  let w = iw, h = ih;
  if (w > h && w > LUM_MAX_DIM) { h = Math.round(h * (LUM_MAX_DIM / w)); w = LUM_MAX_DIM; }
  else if (h >= w && h > LUM_MAX_DIM) { w = Math.round(w * (LUM_MAX_DIM / h)); h = LUM_MAX_DIM; }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  return { width: w, height: h, lum };
}

function sampleLumFlat(lumInfo, i, j, resX, resY) {
  const sx = Math.min(lumInfo.width - 1, Math.round((i / (resX - 1)) * (lumInfo.width - 1)));
  const sy = Math.min(lumInfo.height - 1, Math.round((j / (resY - 1)) * (lumInfo.height - 1)));
  return lumInfo.lum[sy * lumInfo.width + sx];
}

function sampleLumCyl(lumInfo, i, j, resX, resY) {
  const sx = Math.min(lumInfo.width - 1, Math.round((i / resX) * lumInfo.width));
  const sy = Math.min(lumInfo.height - 1, Math.round((j / (resY - 1)) * (lumInfo.height - 1)));
  return lumInfo.lum[sy * lumInfo.width + sx];
}

function thicknessFromLum(l, opts) {
  let t = opts.invert ? l : 1 - l;
  t = Math.min(1, Math.max(0, Math.pow(t, opts.contrast)));
  return opts.minThickness + t * (opts.maxThickness - opts.minThickness);
}

// Approximates how the piece looks backlit: darker source = thicker = blocks more
// light. A perceptual model, not a physical light simulation, but a lot more
// convincing than a flat brightness map.
function buildTransmissionTexture(THREE, lumInfo, opts) {
  const w = lumInfo.width, h = lumInfo.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(w, h);
  for (let p = 0; p < lumInfo.lum.length; p++) {
    let t = opts.invert ? lumInfo.lum[p] : 1 - lumInfo.lum[p];
    t = Math.min(1, Math.max(0, Math.pow(t, opts.contrast)));
    const transmission = AMBIENT + (1 - AMBIENT) * Math.exp(-DENSITY * t);
    const o = p * 4;
    out.data[o] = Math.round(TINT[0] * transmission);
    out.data[o + 1] = Math.round(TINT[1] * transmission);
    out.data[o + 2] = Math.round(TINT[2] * transmission);
    out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Solid panel: relief front, flat back, connecting side walls — a real closed
// volume, so it still reads as an object (not a sheet) from every angle.
function buildFlatGeometry(THREE, lumInfo, opts) {
  const aspect = lumInfo.width / lumInfo.height;
  let resX, resY;
  if (aspect >= 1) { resX = MESH_RES_LONG; resY = Math.max(8, Math.round(MESH_RES_LONG / aspect)); }
  else { resY = MESH_RES_LONG; resX = Math.max(8, Math.round(MESH_RES_LONG * aspect)); }
  const widthMM = aspect >= 1 ? opts.sizeMM : opts.sizeMM * aspect;
  const heightMM = aspect >= 1 ? opts.sizeMM / aspect : opts.sizeMM;

  const positions = [];
  const uvs = [];
  const frontIndex = (i, j) => j * resX + i;
  for (let j = 0; j < resY; j++) {
    for (let i = 0; i < resX; i++) {
      const x = (i / (resX - 1) - 0.5) * widthMM;
      const y = (0.5 - j / (resY - 1)) * heightMM;
      const l = sampleLumFlat(lumInfo, i, j, resX, resY);
      positions.push(x, y, thicknessFromLum(l, opts));
      uvs.push(i / (resX - 1), 1 - j / (resY - 1));
    }
  }
  const indices = [];
  for (let j = 0; j < resY - 1; j++) {
    for (let i = 0; i < resX - 1; i++) {
      const a = frontIndex(i, j), b = frontIndex(i + 1, j), c = frontIndex(i, j + 1), d = frontIndex(i + 1, j + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  const backBase = positions.length / 3;
  const hw = widthMM / 2, hh = heightMM / 2;
  positions.push(-hw, hh, 0, hw, hh, 0, -hw, -hh, 0, hw, -hh, 0);
  uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
  indices.push(backBase, backBase + 1, backBase + 2, backBase + 1, backBase + 3, backBase + 2);

  function pushWallStrip(getFrontIdx, count, flip) {
    const wallBase = positions.length / 3;
    for (let k = 0; k < count; k++) {
      const fi = getFrontIdx(k);
      positions.push(positions[fi * 3], positions[fi * 3 + 1], 0);
      uvs.push(0, 0);
    }
    for (let k = 0; k < count - 1; k++) {
      const fTop1 = getFrontIdx(k), fTop2 = getFrontIdx(k + 1);
      const bBot1 = wallBase + k, bBot2 = wallBase + k + 1;
      if (flip) indices.push(fTop1, fTop2, bBot1, fTop2, bBot2, bBot1);
      else indices.push(fTop1, bBot1, fTop2, fTop2, bBot1, bBot2);
    }
  }
  pushWallStrip((k) => frontIndex(k, 0), resX, true);
  pushWallStrip((k) => frontIndex(k, resY - 1), resX, false);
  pushWallStrip((k) => frontIndex(0, k), resY, false);
  pushWallStrip((k) => frontIndex(resX - 1, k), resY, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Cylinder lamp: relief wrapped 360° around the outer wall, plain inner wall,
// annular caps closing the top and bottom rims into one solid shell.
function buildCylinderGeometry(THREE, lumInfo, opts) {
  const heightMM = opts.heightMM;
  const outerRadiusMax = opts.diameterMM / 2;
  const innerRadius = Math.max(2, outerRadiusMax - opts.maxThickness);
  const circumferenceMM = Math.PI * opts.diameterMM;
  const resX = MESH_RES_LONG;
  const resY = Math.max(8, Math.min(220, Math.round(MESH_RES_LONG * (heightMM / circumferenceMM))));

  const positions = [];
  const uvs = [];
  const outerIndex = (i, j) => j * resX + i;
  for (let j = 0; j < resY; j++) {
    for (let i = 0; i < resX; i++) {
      const theta = (i / resX) * Math.PI * 2;
      const l = sampleLumCyl(lumInfo, i, j, resX, resY);
      const radius = innerRadius + thicknessFromLum(l, opts);
      const y = (0.5 - j / (resY - 1)) * heightMM;
      positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
      uvs.push(i / resX, 1 - j / (resY - 1));
    }
  }
  const indices = [];
  for (let j = 0; j < resY - 1; j++) {
    for (let i = 0; i < resX; i++) {
      const iNext = (i + 1) % resX;
      const a = outerIndex(i, j), b = outerIndex(iNext, j), c = outerIndex(i, j + 1), d = outerIndex(iNext, j + 1);
      indices.push(a, b, c, b, d, c);
    }
  }

  const innerBase = positions.length / 3;
  const innerTop = (i) => innerBase + i;
  const innerBottom = (i) => innerBase + resX + i;
  for (let i = 0; i < resX; i++) {
    const theta = (i / resX) * Math.PI * 2;
    positions.push(innerRadius * Math.cos(theta), heightMM / 2, innerRadius * Math.sin(theta));
    uvs.push(0, 0);
  }
  for (let i = 0; i < resX; i++) {
    const theta = (i / resX) * Math.PI * 2;
    positions.push(innerRadius * Math.cos(theta), -heightMM / 2, innerRadius * Math.sin(theta));
    uvs.push(0, 0);
  }
  for (let i = 0; i < resX; i++) {
    const iNext = (i + 1) % resX;
    indices.push(innerTop(i), innerBottom(i), innerBottom(iNext));
    indices.push(innerTop(i), innerBottom(iNext), innerTop(iNext));
  }
  for (let i = 0; i < resX; i++) {
    const iNext = (i + 1) % resX;
    indices.push(outerIndex(i, 0), innerTop(i), innerTop(iNext));
    indices.push(outerIndex(i, 0), innerTop(iNext), outerIndex(iNext, 0));
    const jb = resY - 1;
    indices.push(outerIndex(i, jb), innerBottom(iNext), innerBottom(i));
    indices.push(outerIndex(i, jb), outerIndex(iNext, jb), innerBottom(iNext));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const instances = new WeakMap();

// For classic (non-module) scripts, like order.html's configurator, that need
// to feed in a File the user already picked through their own upload input.
export function feedReliefImage(container, file) {
  const inst = instances.get(container);
  return inst ? inst.loadFile(file) : Promise.resolve();
}

export async function mountReliefPreview(container) {
  if (!container || container.dataset.reliefMounted) return;
  container.dataset.reliefMounted = '1';

  const canvasHost = container.querySelector('.previewCanvas');
  const fileInput = container.querySelector('.previewFile');
  const toggleBtn = container.querySelector('.previewToggle');
  const statusEl = container.querySelector('.previewStatus');
  const shapeBtns = container.querySelectorAll('.previewShape [data-shape]');
  const contrastInput = container.querySelector('.previewContrast');
  const invertInput = container.querySelector('.previewInvert');
  const emptyEl = container.querySelector('.previewEmpty');
  const defaultSrc = container.dataset.default;
  const uploadTargetId = container.dataset.uploadTarget;
  if (!canvasHost) return;

  if (emptyEl && (uploadTargetId || fileInput)) {
    emptyEl.style.pointerEvents = 'auto';
    emptyEl.style.cursor = 'pointer';
    emptyEl.addEventListener('click', () => {
      const target = uploadTargetId ? document.getElementById(uploadTargetId) : fileInput;
      if (target) target.click();
    });
  }

  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
  if (!gl) {
    canvasHost.innerHTML = '<div class="previewFallback">3D preview needs a browser with WebGL support. Everything else on the site still works.</div>';
    if (emptyEl) emptyEl.classList.add('hidden');
    if (toggleBtn) toggleBtn.disabled = true;
    if (fileInput) fileInput.disabled = true;
    return;
  }

  let THREE, scene, camera, renderer, composer, bloomPass, controls, mesh, shadowMesh;
  let visible = true, lit = false, started = false;
  let currentLum = null;
  const state = { shape: 'flat', contrast: 1, invert: false };

  function resize() {
    const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
    if (!w || !h || !renderer) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  }

  function ensureShadow() {
    if (shadowMesh) return shadowMesh;
    const material = new THREE.MeshBasicMaterial({ map: buildShadowTexture(THREE), transparent: true, depthWrite: false });
    shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    shadowMesh.rotation.x = -Math.PI / 2;
    scene.add(shadowMesh);
    return shadowMesh;
  }

  function frameCameraToMesh() {
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
    const r = mesh.geometry.boundingSphere.radius || 60;
    camera.position.set(r * 1.4, r * 0.85, r * 1.9);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    const shadow = ensureShadow();
    shadow.scale.setScalar(r * 2.4);
    shadow.position.set(0, mesh.geometry.boundingBox.min.y - r * 0.06, 0);
  }

  function applyLight(on) {
    lit = on;
    if (mesh) {
      mesh.material.emissiveIntensity = on ? 1.5 : 0.06;
      mesh.material.color.set(on ? '#050505' : '#e9e2d3');
      mesh.material.roughness = on ? 0.5 : 0.88;
      mesh.material.needsUpdate = true;
    }
    if (bloomPass) bloomPass.strength = on ? 1.1 : 0.12;
    if (toggleBtn) {
      toggleBtn.classList.toggle('on', on);
      const label = toggleBtn.querySelector('span');
      if (label) label.textContent = on ? 'Light: On' : 'Light: Off';
    }
  }

  async function rebuild() {
    if (!currentLum || !THREE) return;
    const opts = { ...SHAPES[state.shape], contrast: state.contrast, invert: state.invert };
    const geo = state.shape === 'cylinder'
      ? buildCylinderGeometry(THREE, currentLum, opts)
      : buildFlatGeometry(THREE, currentLum, opts);
    const texture = buildTransmissionTexture(THREE, currentLum, opts);
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.emissiveMap && mesh.material.emissiveMap.dispose();
      mesh.material.dispose();
    }
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.88, metalness: 0.04,
      emissive: '#ffb066', emissiveMap: texture,
      side: THREE.DoubleSide,
    });
    mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);
    frameCameraToMesh();
    applyLight(lit);
    if (emptyEl) emptyEl.classList.add('hidden');
  }

  let rebuildTimer = null;
  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 90);
  }

  async function showImage(src, isSample) {
    if (statusEl) statusEl.textContent = isSample ? 'Loading sample preview…' : 'Reading your photo…';
    try {
      await loadThree();
      const img = await loadImageEl(src);
      currentLum = computeLuminanceGrid(img);
      await rebuild();
      if (statusEl) statusEl.textContent = isSample
        ? 'This is a sample photo — upload your own to preview it as a lithophane.'
        : 'Your photo, rendered as a lithophane relief. Drag to rotate.';
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Could not load that image. Try a different photo.';
    }
  }

  async function start() {
    if (started) return;
    started = true;
    if (statusEl) statusEl.textContent = 'Loading 3D engine…';
    let OrbitControls, EffectComposer, RenderPass, UnrealBloomPass;
    try {
      const mods = await loadThree();
      THREE = mods[0];
      OrbitControls = mods[1].OrbitControls;
      EffectComposer = mods[2].EffectComposer;
      RenderPass = mods[3].RenderPass;
      UnrealBloomPass = mods[4].UnrealBloomPass;
    } catch (err) {
      if (statusEl) statusEl.textContent = '3D preview could not load. Everything else on the site still works.';
      return;
    }

    scene = new THREE.Scene();
    scene.background = buildBackgroundTexture(THREE);
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
    camera.position.set(150, 110, 220);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    canvasHost.appendChild(renderer.domElement);

    const w = canvasHost.clientWidth || 480, h = canvasHost.clientHeight || 360;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.12, 0.55, 0.2);
    composer.addPass(bloomPass);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.1;
    controls.minDistance = 60;
    controls.maxDistance = 700;
    controls.enablePan = false;

    scene.add(new THREE.AmbientLight(0x8890ff, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(120, 180, 220);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb4ff, 0.3);
    fill.position.set(-160, 60, 80);
    scene.add(fill);
    const back = new THREE.PointLight(0xfff2d9, 0.45);
    back.position.set(0, 0, -260);
    scene.add(back);

    resize();
    window.addEventListener('resize', resize);

    if (defaultSrc) {
      await showImage(defaultSrc, true);
    } else if (statusEl) {
      statusEl.textContent = 'Upload a photo above to see it in 3D.';
    }

    renderer.setAnimationLoop(() => {
      if (!visible) return;
      controls.update();
      composer.render();
    });

    document.addEventListener('visibilitychange', () => {
      visible = document.visibilityState === 'visible';
    });
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) start();
      visible = entry.isIntersecting && document.visibilityState === 'visible';
    }
  }, { threshold: 0.1 });
  io.observe(container);

  function loadFile(file) {
    if (!file) return Promise.resolve();
    const url = URL.createObjectURL(file);
    return start().then(() => showImage(url, false));
  }
  instances.set(container, { loadFile });

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      loadFile(e.target.files && e.target.files[0]);
    });
  }
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => applyLight(!lit));
  }
  if (shapeBtns && shapeBtns.length) {
    shapeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.shape === state.shape) return;
        state.shape = btn.dataset.shape;
        shapeBtns.forEach((b) => b.classList.toggle('on', b === btn));
        scheduleRebuild();
      });
    });
  }
  if (contrastInput) {
    contrastInput.addEventListener('input', (e) => {
      state.contrast = +e.target.value || 1;
      scheduleRebuild();
    });
  }
  if (invertInput) {
    invertInput.addEventListener('change', (e) => {
      state.invert = e.target.checked;
      scheduleRebuild();
    });
  }
}

export function mountAllReliefPreviews() {
  document.querySelectorAll('[data-relief-preview]').forEach((el) => mountReliefPreview(el));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAllReliefPreviews);
  } else {
    mountAllReliefPreviews();
  }
}

if (typeof window !== 'undefined') {
  // Bridge for classic (non-module) scripts — order.html's configurator calls
  // window.MPRelief.feedImage(containerEl, file) from its own file input handler.
  window.MPRelief = { feedImage: feedReliefImage };
}
