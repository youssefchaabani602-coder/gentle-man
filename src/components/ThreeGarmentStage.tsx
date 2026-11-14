import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Pause, Play, RotateCw } from 'lucide-react';
import type { GarmentType } from '../types';

export interface ThreeGarmentStageHandle {
  captureSnapshot: () => string | null;
}

export interface ThreeGarmentStageProps {
  mode: 'hero' | 'inspector';
  garmentType: GarmentType | string;
  colorHex: string;
  garmentLabel?: string;
  onSelectGarment?: (type: GarmentType) => void;
  onSelectColor?: (hex: string, name: string) => void;
  showHeroDock?: boolean;
  className?: string;
}

const SHOWCASE_GARMENTS: Array<{ type: GarmentType; label: string; colorHex: string; colorName: string }> = [
  { type: 'blazer', label: 'Medina Cashmere Blazer', colorHex: '#181B22', colorName: 'Obsidian' },
  { type: 'overshirt', label: 'Aghlabid Linen Overshirt', colorHex: '#C6B394', colorName: 'Sahara Sand' },
  { type: 'polo', label: 'Kairouan Merino Polo', colorHex: '#596356', colorName: 'Olive Leaf' },
  { type: 'trousers', label: 'Tailored Pleated Trousers', colorHex: '#353841', colorName: 'Slate Charcoal' },
  { type: 'bomber', label: 'Saffian Calfskin Bomber', colorHex: '#2C1E19', colorName: 'Espresso' },
];

const FABRIC_SWATCHES = [
  { name: 'Obsidian', hex: '#181B22' },
  { name: 'Sahara Sand', hex: '#C6B394' },
  { name: 'Espresso', hex: '#3D271E' },
  { name: 'Olive Leaf', hex: '#4F5C4D' },
  { name: 'Midnight Navy', hex: '#1B283D' },
];

function createFabricTextures(seedType: string): {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = seedType === 'bomber' ? '#7a7a7a' : '#c8c8c8';
  rctx.fillRect(0, 0, size, size);

  if (seedType === 'bomber') {
    // Subtle pebbled calfskin grain
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 1 + Math.random() * 1.6;
      const v = 110 + Math.floor(Math.random() * 45);
      bctx.fillStyle = `rgb(${v},${v},${v})`;
      bctx.beginPath();
      bctx.arc(x, y, r, 0, Math.PI * 2);
      bctx.fill();
    }
  } else if (seedType === 'polo') {
    // Fine ribbed knit
    for (let x = 0; x < size; x += 4) {
      bctx.fillStyle = x % 8 === 0 ? '#9c9c9c' : '#6c6c6c';
      bctx.fillRect(x, 0, 2, size);
      rctx.fillStyle = x % 8 === 0 ? '#dcdcdc' : '#b8b8b8';
      rctx.fillRect(x, 0, 2, size);
    }
  } else {
    // Diagonal herringbone / twill weave
    bctx.strokeStyle = 'rgba(220,220,220,0.35)';
    bctx.lineWidth = 1.5;
    for (let i = -size; i < size * 2; i += 6) {
      bctx.beginPath();
      bctx.moveTo(i, 0);
      bctx.lineTo(i + size, size);
      bctx.stroke();
    }
    bctx.strokeStyle = 'rgba(70,70,70,0.32)';
    for (let i = -size; i < size * 2; i += 6) {
      bctx.beginPath();
      bctx.moveTo(i + 3, 0);
      bctx.lineTo(i + 3 - size, size);
      bctx.stroke();
    }
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4, 4);

  return { bumpMap, roughnessMap };
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function buildHanger(brassMat: THREE.Material, walnutMat: THREE.Material): THREE.Group {
  const hanger = new THREE.Group();
  const barGeom = new THREE.CylinderGeometry(0.032, 0.032, 1.55, 16);
  const leftBar = new THREE.Mesh(barGeom, walnutMat);
  leftBar.position.set(-0.36, 1.25, 0);
  leftBar.rotation.z = Math.PI / 2 - 0.24;
  leftBar.scale.set(1, 0.56, 1);

  const rightBar = new THREE.Mesh(barGeom, walnutMat);
  rightBar.position.set(0.36, 1.25, 0);
  rightBar.rotation.z = -(Math.PI / 2 - 0.24);
  rightBar.scale.set(1, 0.56, 1);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.034, 0.22, 14), brassMat);
  neck.position.set(0, 1.38, 0);

  const hookCurve = new THREE.TorusGeometry(0.095, 0.016, 12, 24, Math.PI * 1.4);
  const hook = new THREE.Mesh(hookCurve, brassMat);
  hook.position.set(0, 1.56, 0);
  hook.rotation.z = -0.3;

  hanger.add(leftBar, rightBar, neck, hook);
  return hanger;
}

function buildGarmentAssembly(
  type: GarmentType | string,
  colorHex: string,
  textures: { bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture }
): THREE.Group {
  const group = new THREE.Group();
  const baseColor = new THREE.Color(colorHex || '#181B22');
  const hsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl);
  const trimColor = baseColor.clone().offsetHSL(0, -0.04, hsl.l > 0.45 ? -0.14 : 0.06);

  const isLeather = type === 'bomber';
  const fabricMat = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: isLeather ? 0.38 : 0.86,
    metalness: 0.02,
    envMapIntensity: isLeather ? 0.65 : 0.36,
    sheen: isLeather ? 0.12 : 0.45,
    sheenRoughness: 0.78,
    sheenColor: hsl.l < 0.25 ? new THREE.Color('#38322A') : new THREE.Color('#D8CBB4'),
    clearcoat: isLeather ? 0.28 : 0.0,
    clearcoatRoughness: 0.38,
    bumpMap: textures.bumpMap,
    bumpScale: isLeather ? 0.014 : 0.022,
    roughnessMap: textures.roughnessMap,
  });

  const trimMat = new THREE.MeshPhysicalMaterial({
    color: trimColor,
    roughness: 0.74,
    envMapIntensity: 0.36,
    sheen: 0.35,
    sheenColor: new THREE.Color('#4B4336'),
    bumpMap: textures.bumpMap,
    bumpScale: 0.012,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.88,
    roughness: 0.24,
  });

  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x3b2618,
    metalness: 0.05,
    roughness: 0.48,
  });

  const silkLiningMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c1920,
    roughness: 0.36,
    metalness: 0.08,
    envMapIntensity: 0.45,
    sheen: 0.7,
  });

  const pocketLinenMat = new THREE.MeshStandardMaterial({
    color: 0xede6d6,
    roughness: 0.7,
    metalness: 0.02,
  });

  const hornMat = new THREE.MeshStandardMaterial({
    color: 0x2a1f16,
    roughness: 0.3,
    metalness: 0.12,
  });

  group.add(buildHanger(brassMat, walnutMat));

  if (type === 'trousers') {
    // Waistband + belt loops + buckle + left & right pleated legs
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.44, 0.18, 24), trimMat);
    waist.scale.set(1.18, 1, 0.56);
    waist.position.set(0, 0.96, 0);

    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 10, 18), brassMat);
    buckle.position.set(0, 0.96, 0.26);

    const legGeom = new THREE.CylinderGeometry(0.21, 0.145, 1.85, 20);
    const leftLeg = new THREE.Mesh(legGeom, fabricMat);
    leftLeg.position.set(-0.24, -0.02, 0);
    leftLeg.scale.set(1.05, 1, 0.72);
    leftLeg.rotation.z = 0.035;

    const rightLeg = new THREE.Mesh(legGeom, fabricMat);
    rightLeg.position.set(0.24, -0.02, 0);
    rightLeg.scale.set(1.05, 1, 0.72);
    rightLeg.rotation.z = -0.035;

    // Pressed center pleats
    const pleatGeom = new THREE.BoxGeometry(0.025, 1.72, 0.04);
    const leftPleat = new THREE.Mesh(pleatGeom, trimMat);
    leftPleat.position.set(-0.24, -0.02, 0.13);
    const rightPleat = new THREE.Mesh(pleatGeom, trimMat);
    rightPleat.position.set(0.24, -0.02, 0.13);

    // Clamp bar
    const clampBar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.15, 14), walnutMat);
    clampBar.rotation.z = Math.PI / 2;
    clampBar.position.set(0, 1.12, 0);

    group.add(waist, buckle, leftLeg, rightLeg, leftPleat, rightPleat, clampBar);
    return group;
  }

  // Torso sculpted silhouette shared across upper-body garments
  const torsoGeom = new THREE.CylinderGeometry(0.56, 0.48, 1.56, 28, 8);
  const torso = new THREE.Mesh(torsoGeom, fabricMat);
  torso.scale.set(1.16, 1, 0.56);
  torso.position.set(0, 0.22, 0);
  group.add(torso);

  // Shoulders yoke
  const shoulderCap = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.06, 8, 16), fabricMat);
  shoulderCap.rotation.z = Math.PI / 2;
  shoulderCap.scale.set(1, 1, 0.86);
  shoulderCap.position.set(0, 0.96, 0);
  group.add(shoulderCap);

  // Sleeves (left & right articulated drape)
  const sleeveGeom = new THREE.CylinderGeometry(0.16, 0.125, 1.38, 20);
  const leftSleeve = new THREE.Mesh(sleeveGeom, fabricMat);
  leftSleeve.position.set(-0.75, 0.34, 0.02);
  leftSleeve.rotation.z = -0.17;
  leftSleeve.rotation.x = 0.04;

  const rightSleeve = new THREE.Mesh(sleeveGeom, fabricMat);
  rightSleeve.position.set(0.75, 0.34, 0.02);
  rightSleeve.rotation.z = 0.17;
  rightSleeve.rotation.x = 0.04;

  // Cuffs
  const cuffGeom = new THREE.CylinderGeometry(0.132, 0.132, 0.12, 18);
  const leftCuff = new THREE.Mesh(cuffGeom, trimMat);
  leftCuff.position.set(-0.87, -0.32, 0.04);
  leftCuff.rotation.z = -0.17;

  const rightCuff = new THREE.Mesh(cuffGeom, trimMat);
  rightCuff.position.set(0.87, -0.32, 0.04);
  rightCuff.rotation.z = 0.17;

  group.add(leftSleeve, rightSleeve, leftCuff, rightCuff);

  if (type === 'blazer') {
    // Peaked lapels, silk collar backing, horn buttons, pocket square
    const lapelShape = new THREE.Shape();
    lapelShape.moveTo(0, 0.65);
    lapelShape.lineTo(0.22, 0.58);
    lapelShape.lineTo(0.16, 0.22);
    lapelShape.lineTo(0.02, -0.18);
    lapelShape.closePath();

    const lapelGeo = new THREE.ExtrudeGeometry(lapelShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });

    const rightLapel = new THREE.Mesh(lapelGeo, trimMat);
    rightLapel.position.set(0.02, 0.35, 0.29);
    rightLapel.rotation.y = 0.12;

    const leftLapel = new THREE.Mesh(lapelGeo, trimMat);
    leftLapel.scale.x = -1;
    leftLapel.position.set(-0.02, 0.35, 0.29);
    leftLapel.rotation.y = -0.12;

    const liningV = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 4), silkLiningMat);
    liningV.rotation.z = Math.PI;
    liningV.scale.set(1, 1, 0.4);
    liningV.position.set(0, 0.86, 0.28);

    const pocketSquare = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.085, 0.025), pocketLinenMat);
    pocketSquare.position.set(0.28, 0.54, 0.31);
    pocketSquare.rotation.z = -0.1;

    const buttonGeom = new THREE.CylinderGeometry(0.032, 0.032, 0.018, 16);
    for (let i = 0; i < 2; i++) {
      const btn = new THREE.Mesh(buttonGeom, hornMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.12 - i * 0.24, 0.32);
      group.add(btn);
    }

    group.add(rightLapel, leftLapel, liningV, pocketSquare);
  } else if (type === 'overshirt') {
    // Workwear collar + two chest pockets + front placket with horn buttons
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.055, 12, 24), trimMat);
    collar.rotation.x = Math.PI / 2 - 0.18;
    collar.position.set(0, 1.06, 0.02);

    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.48, 0.04), trimMat);
    placket.position.set(0, 0.25, 0.31);

    const pocketGeom = new THREE.BoxGeometry(0.24, 0.26, 0.04);
    const leftPocket = new THREE.Mesh(pocketGeom, trimMat);
    leftPocket.position.set(-0.27, 0.52, 0.30);
    const rightPocket = new THREE.Mesh(pocketGeom, trimMat);
    rightPocket.position.set(0.27, 0.52, 0.30);

    const buttonGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.016, 14);
    for (let i = 0; i < 5; i++) {
      const btn = new THREE.Mesh(buttonGeom, hornMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.82 - i * 0.26, 0.33);
      group.add(btn);
    }

    group.add(collar, placket, leftPocket, rightPocket);
  } else if (type === 'polo') {
    // Open Johnny collar + ribbed waist hem
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.052, 12, 24), trimMat);
    collar.rotation.x = Math.PI / 2 - 0.22;
    collar.position.set(0, 1.06, 0.03);

    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.045), trimMat);
    placket.position.set(0, 0.78, 0.31);

    const waistRib = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.47, 0.14, 24), trimMat);
    waistRib.scale.set(1.16, 1, 0.56);
    waistRib.position.set(0, -0.52, 0);

    group.add(collar, placket, waistRib);
  } else {
    // Leather bomber: stand collar + metallic brass zipper + welt pockets + ribbed hem
    const standCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.16, 22, 1, true), trimMat);
    standCollar.position.set(0, 1.08, 0.01);

    const zipperTrack = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.5, 0.045), brassMat);
    zipperTrack.position.set(0, 0.24, 0.31);

    const zipPull = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.055), brassMat);
    zipPull.position.set(0, 0.88, 0.34);

    const hemRib = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.16, 24), trimMat);
    hemRib.scale.set(1.16, 1, 0.56);
    hemRib.position.set(0, -0.52, 0);

    group.add(standCollar, zipperTrack, zipPull, hemRib);
  }

  return group;
}

export const ThreeGarmentStage = React.forwardRef<ThreeGarmentStageHandle, ThreeGarmentStageProps>(
  function ThreeGarmentStage(
    {
      mode,
      garmentType,
      colorHex,
      garmentLabel,
      onSelectGarment,
      onSelectColor,
      showHeroDock = true,
      className = '',
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const mainGroupRef = useRef<THREE.Group | null>(null);
    const secondaryLeftRef = useRef<THREE.Group | null>(null);
    const secondaryRightRef = useRef<THREE.Group | null>(null);

    const pointerRef = useRef({ x: 0, y: 0, dragging: false, lastX: 0, dragYaw: 0 });
    const scrollRatioRef = useRef(0);
    const pausedRef = useRef(false);

    const [paused, setPaused] = useState(false);
    const [dockCollapsed, setDockCollapsed] = useState(
      () => typeof window !== 'undefined' && window.innerWidth < 640
    );

    useImperativeHandle(ref, () => ({
      captureSnapshot: () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!renderer || !scene || !camera) return null;
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      },
    }));

    useEffect(() => {
      pausedRef.current = paused;
    }, [paused]);

    // Initialize Three.js WebGL stage
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const width = Math.max(300, container.clientWidth);
      const height = Math.max(280, container.clientHeight);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: mode === 'inspector',
        });
      } catch {
        return;
      }

      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);

      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      const bgHex = mode === 'hero' ? 0x0e1014 : 0x15181f;
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, mode === 'hero' ? 0.08 : 0.05);
      sceneRef.current = scene;

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(mode === 'hero' ? 40 : 38, width / height, 0.1, 40);
      camera.position.set(mode === 'hero' ? 1.45 : 0, 0.25, mode === 'hero' ? 5.2 : 4.2);
      cameraRef.current = camera;

      // Three-point tailored studio lighting
      const hemi = new THREE.HemisphereLight(0xf3eee6, 0x1a1d24, 0.72);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xfff0d6, 2.35);
      keyLight.position.set(3.5, 4.5, 4.2);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xd4af37, 1.45);
      rimLight.position.set(-4.2, 2.5, -3.5);
      scene.add(rimLight);

      // Atelier brass runway rail in hero mode
      const shadowTex = createContactShadowTexture();
      const shadowDisc = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 3.2),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.65, depthWrite: false })
      );
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.set(mode === 'hero' ? 1.1 : 0, -1.25, 0);
      scene.add(shadowDisc);

      if (mode === 'hero') {
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 9, 14),
          new THREE.MeshStandardMaterial({ color: 0xc5a059, metalness: 0.88, roughness: 0.22 })
        );
        rail.rotation.z = Math.PI / 2;
        rail.position.set(1.1, 1.71, 0);
        scene.add(rail);
      }

      const mainPivot = new THREE.Group();
      mainPivot.position.set(mode === 'hero' ? 1.15 : 0, 0.05, 0);
      scene.add(mainPivot);
      mainGroupRef.current = mainPivot;

      if (mode === 'hero') {
        const leftGhost = buildGarmentAssembly('overshirt', '#B5A184', createFabricTextures('overshirt'));
        leftGhost.position.set(0.1, -0.04, -2.05);
        leftGhost.scale.setScalar(0.76);
        leftGhost.rotation.y = 0.35;
        scene.add(leftGhost);
        secondaryLeftRef.current = leftGhost;

        const rightGhost = buildGarmentAssembly('trousers', '#262B34', createFabricTextures('trousers'));
        rightGhost.position.set(3.15, -0.05, -1.25);
        rightGhost.scale.setScalar(0.82);
        rightGhost.rotation.y = -0.35;
        scene.add(rightGhost);
        secondaryRightRef.current = rightGhost;
      }

      const handlePointerMove = (e: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
        pointerRef.current.x = nx;
        pointerRef.current.y = ny;
        if (pointerRef.current.dragging) {
          const dx = e.clientX - pointerRef.current.lastX;
          pointerRef.current.dragYaw += dx * 0.012;
          pointerRef.current.lastX = e.clientX;
        }
      };

      const handlePointerDown = (e: PointerEvent) => {
        pointerRef.current.dragging = true;
        pointerRef.current.lastX = e.clientX;
      };

      const handlePointerUp = () => {
        pointerRef.current.dragging = false;
      };

      const handleScroll = () => {
        const maxScroll = Math.max(600, document.documentElement.scrollHeight - window.innerHeight);
        scrollRatioRef.current = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      };

      const pointerTarget = mode === 'inspector' ? container : window;
      pointerTarget.addEventListener('pointermove', handlePointerMove as EventListener, { passive: true });
      container.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();

      const ro = new ResizeObserver(() => {
        const w = Math.max(300, container.clientWidth);
        const h = Math.max(280, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      ro.observe(container);

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let rafId = 0;
      let lastTime = performance.now();
      let spinAngle = mode === 'inspector' ? 0.12 : -0.2;
      let lastFrameTick = 0;

      const tick = (now: number) => {
        rafId = requestAnimationFrame(tick);
        if (document.hidden) return;
        // Pace software WebGL cleanly so SwiftShader never drops frames or stalls UI
        if (isSoftwareGl && now - lastFrameTick < 32) return;
        lastFrameTick = now;

        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        const alpha = 1 - Math.exp(-6.5 * dt);

        if (!pausedRef.current && !prefersReduced) {
          spinAngle += dt * (mode === 'hero' ? 0.36 : 0.22);
        }

        const scrollTilt = mode === 'hero' ? scrollRatioRef.current * Math.PI * 1.4 : 0;
        const targetYaw =
          spinAngle +
          scrollTilt +
          pointerRef.current.dragYaw +
          pointerRef.current.x * (mode === 'hero' ? 0.45 : 0.28);
        const targetPitch = -pointerRef.current.y * 0.12;

        if (mainGroupRef.current) {
          mainGroupRef.current.rotation.y += (targetYaw - mainGroupRef.current.rotation.y) * alpha;
          mainGroupRef.current.rotation.x += (targetPitch - mainGroupRef.current.rotation.x) * alpha;
          mainGroupRef.current.position.y =
            0.05 + Math.sin(now * 0.0014) * (prefersReduced ? 0 : 0.03);
        }

        if (secondaryLeftRef.current) {
          secondaryLeftRef.current.rotation.y = 0.4 + scrollTilt * 0.8 + pointerRef.current.x * 0.2;
        }
        if (secondaryRightRef.current) {
          secondaryRightRef.current.rotation.y = -0.35 - scrollTilt * 0.8 + pointerRef.current.x * 0.2;
        }

        // Scroll-driven camera glide in hero mode
        if (mode === 'hero') {
          const camTargetX = (window.innerWidth < 768 ? 0.6 : 1.45) + pointerRef.current.x * 0.25;
          const camTargetY = 0.28 - scrollRatioRef.current * 0.35 - pointerRef.current.y * 0.16;
          const camTargetZ = (window.innerWidth < 768 ? 6.1 : 5.1) - scrollRatioRef.current * 0.55;
          camera.position.x += (camTargetX - camera.position.x) * alpha;
          camera.position.y += (camTargetY - camera.position.y) * alpha;
          camera.position.z += (camTargetZ - camera.position.z) * alpha;
          camera.lookAt(window.innerWidth < 768 ? 0.5 : 0.35, 0.15, 0);
        } else {
          camera.position.x += (pointerRef.current.x * 0.22 - camera.position.x) * alpha;
          camera.position.y += (0.25 - pointerRef.current.y * 0.18 - camera.position.y) * alpha;
          camera.lookAt(0, 0.1, 0);
        }

        keyLight.position.x = 3.5 + pointerRef.current.x * 1.4;
        renderer.render(scene, camera);
      };

      rafId = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        pointerTarget.removeEventListener('pointermove', handlePointerMove as EventListener);
        container.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('scroll', handleScroll);
        pmrem.dispose();
        envTex.dispose();
        shadowTex.dispose();
        renderer.dispose();
      };
    }, [mode]);

    // Rebuild garment mesh cleanly when garmentType or colorHex changes
    useEffect(() => {
      const pivot = mainGroupRef.current;
      if (!pivot) return;

      while (pivot.children.length > 0) {
        const child = pivot.children.pop()!;
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }

      const textures = createFabricTextures(garmentType);
      const assembly = buildGarmentAssembly(garmentType, colorHex, textures);
      pivot.add(assembly);
    }, [garmentType, colorHex]);

    return (
      <div
        className={`relative w-full h-full overflow-hidden select-none ${className}`}
        data-garment={garmentType}
        data-color={colorHex}
      >
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label={`Interactive 3D view of ${garmentLabel || garmentType}`}
        />

        {mode === 'hero' && showHeroDock && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
            <div
              className="pointer-events-auto max-w-4xl w-full border border-white/15 text-[#F6F3EC] shadow-2xl"
              style={{ backgroundColor: 'rgba(14, 16, 20, 0.92)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-[11px] sm:text-xs tracking-wider uppercase text-[#C5A059] min-w-0">
                  <span className="shrink-0">3D Runway</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/80 normal-case tracking-normal font-medium truncate max-w-[140px] sm:max-w-none">
                    {garmentLabel || SHOWCASE_GARMENTS.find((g) => g.type === garmentType)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#F6F3EC] border border-white/15 hover:border-[#C5A059] transition-colors"
                    aria-label={paused ? 'Resume 3D spin' : 'Pause 3D spin'}
                  >
                    {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{paused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pointerRef.current.dragYaw = 0;
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-white/80 border border-white/15 hover:border-[#C5A059]"
                    aria-label="Reset 3D angle"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDockCollapsed((c) => !c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-white/80 border border-white/15 hover:border-[#C5A059]"
                    aria-label={dockCollapsed ? 'Show 3D controls' : 'Hide 3D controls'}
                  >
                    {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{dockCollapsed ? 'Controls' : 'Hide'}</span>
                  </button>
                </div>
              </div>

              {!dockCollapsed && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SHOWCASE_GARMENTS.map((item) => {
                      const active = garmentType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => onSelectGarment?.(item.type)}
                          className={`px-2.5 py-1 text-xs transition-colors border ${
                            active
                              ? 'bg-[#C5A059] text-[#0E1014] border-[#C5A059] font-semibold'
                              : 'bg-transparent text-white/80 border-white/15 hover:border-white/40'
                          }`}
                        >
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-white/55">Tone</span>
                    {FABRIC_SWATCHES.map((swatch) => {
                      const selected = colorHex.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.name}
                          type="button"
                          onClick={() => onSelectColor?.(swatch.hex, swatch.name)}
                          title={swatch.name}
                          aria-label={`Fabric color ${swatch.name}`}
                          className={`w-5 h-5 border transition-transform ${
                            selected ? 'border-[#C5A059] scale-115' : 'border-white/30 hover:scale-105'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
