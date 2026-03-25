import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const ZOOM_LEVEL = 2.6;
const MOTION_EASING = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.14;
const MAX_PIXEL_RATIO = 2;

const waitForImage = (image) => {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleLoad = () => {
      cleanup();
      resolve();
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
  });
};

const waitForRenderableSize = (element) =>
  new Promise((resolve) => {
    const checkSize = () => {
      const rect = element.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        resolve(rect);
        return;
      }

      window.requestAnimationFrame(checkSize);
    };

    checkSize();
  });

const loadTexture = (url) =>
  new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();

    loader.load(url, resolve, undefined, reject);
  });

const initializeProfile = async (root) => {
  const image = root.querySelector("img");

  if (!image) {
    return;
  }

  try {
    await waitForImage(image);
  } catch {
    return;
  }

  let texture;

  try {
    texture = await loadTexture(image.currentSrc || image.src);
  } catch {
    return;
  }

  await waitForRenderableSize(root);

  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture }));

  scene.add(mesh);

  const state = {
    hovering: false,
    pointerX: 0.5,
    pointerY: 0.5,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  };

  const viewport = {
    planeWidth: 1,
    planeHeight: 1,
    worldWidth: 2,
    worldHeight: 2,
  };

  const resize = () => {
    const rect = root.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return false;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(rect.width, rect.height, false);

    viewport.worldWidth = (rect.width / rect.height) * 2;
    viewport.worldHeight = 2;

    camera.left = -viewport.worldWidth / 2;
    camera.right = viewport.worldWidth / 2;
    camera.top = viewport.worldHeight / 2;
    camera.bottom = -viewport.worldHeight / 2;
    camera.updateProjectionMatrix();

    const imageAspect = image.naturalWidth / image.naturalHeight;
    viewport.planeWidth = viewport.worldWidth;
    viewport.planeHeight = viewport.planeWidth / imageAspect;

    if (viewport.planeHeight < viewport.worldHeight) {
      viewport.planeHeight = viewport.worldHeight;
      viewport.planeWidth = viewport.planeHeight * imageAspect;
    }

    return true;
  };

  const updatePointer = (event) => {
    const rect = root.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    state.hovering = true;
    state.pointerX = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    state.pointerY = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
  };

  const renderFrame = () => {
    if (!resize()) {
      return false;
    }

    const targetZoom = state.hovering ? ZOOM_LEVEL : 1;

    state.zoom += (targetZoom - state.zoom) * MOTION_EASING;

    const maxOffsetX = Math.max(0, (viewport.planeWidth * state.zoom - viewport.worldWidth) / 2);
    const maxOffsetY = Math.max(0, (viewport.planeHeight * state.zoom - viewport.worldHeight) / 2);
    const targetOffsetX = state.hovering ? (0.5 - state.pointerX) * maxOffsetX * 2 : 0;
    const targetOffsetY = state.hovering ? (state.pointerY - 0.5) * maxOffsetY * 2 : 0;

    state.offsetX += (targetOffsetX - state.offsetX) * MOTION_EASING;
    state.offsetY += (targetOffsetY - state.offsetY) * MOTION_EASING;

    mesh.scale.set(viewport.planeWidth * state.zoom, viewport.planeHeight * state.zoom, 1);
    mesh.position.set(state.offsetX, state.offsetY, 0);

    renderer.render(scene, camera);
    return true;
  };

  const animate = () => {
    renderFrame();
    window.requestAnimationFrame(animate);
  };

  root.addEventListener("pointerenter", updatePointer);
  root.addEventListener("pointermove", updatePointer);
  root.addEventListener("pointerleave", () => {
    state.hovering = false;
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => {
      renderFrame();
    });

    resizeObserver.observe(root);
  } else {
    window.addEventListener("resize", () => {
      renderFrame();
    });
  }

  if (!renderFrame()) {
    return;
  }

  root.classList.add("is-ready");
  animate();
};

document.querySelectorAll("[data-threejs-profile]").forEach((root) => {
  initializeProfile(root);
});
