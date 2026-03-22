const ROOT_ID = "itd42-overlay-root";
const CANVAS_ID = "itd42-overlay-canvas";
const OWNED_ATTR = "data-itd42-owned";

function roundMetric(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 1000) / 1000;
}

export function createOverlayRenderer() {
  let hostCanvas = null;
  let viewport = null;
  let settings = null;
  let template = null;
  let animationFrameId = 0;
  let isRunning = false;
  let isDirty = true;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute(OWNED_ATTR, "1");
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.width = "0";
  root.style.height = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "2";
  root.style.display = "none";

  const canvas = document.createElement("canvas");
  canvas.id = CANVAS_ID;
  canvas.setAttribute(OWNED_ATTR, "1");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.display = "block";

  root.appendChild(canvas);

  const context = canvas.getContext("2d", { alpha: true });

  const lastBounds = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    pixelWidth: 0,
    pixelHeight: 0
  };

  function attachRoot() {
    if (!root.isConnected) {
      (document.documentElement || document.body).appendChild(root);
    }
  }

  function markDirty() {
    isDirty = true;
  }

  function syncHostBounds() {
    if (!hostCanvas || !hostCanvas.isConnected) {
      return false;
    }

    const rect = hostCanvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const nextBounds = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      pixelWidth: hostCanvas.width,
      pixelHeight: hostCanvas.height
    };

    const changed =
      roundMetric(nextBounds.left) !== roundMetric(lastBounds.left) ||
      roundMetric(nextBounds.top) !== roundMetric(lastBounds.top) ||
      roundMetric(nextBounds.width) !== roundMetric(lastBounds.width) ||
      roundMetric(nextBounds.height) !== roundMetric(lastBounds.height) ||
      nextBounds.pixelWidth !== lastBounds.pixelWidth ||
      nextBounds.pixelHeight !== lastBounds.pixelHeight;

    if (changed) {
      lastBounds.left = nextBounds.left;
      lastBounds.top = nextBounds.top;
      lastBounds.width = nextBounds.width;
      lastBounds.height = nextBounds.height;
      lastBounds.pixelWidth = nextBounds.pixelWidth;
      lastBounds.pixelHeight = nextBounds.pixelHeight;

      root.style.left = `${rect.left}px`;
      root.style.top = `${rect.top}px`;
      root.style.width = `${rect.width}px`;
      root.style.height = `${rect.height}px`;

      if (canvas.width !== hostCanvas.width) {
        canvas.width = hostCanvas.width;
      }

      if (canvas.height !== hostCanvas.height) {
        canvas.height = hostCanvas.height;
      }
    }

    return changed;
  }

  function clear() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawCurrentFrame() {
    const boundsChanged = syncHostBounds();

    if (!settings?.enabled || !template || !viewport || !hostCanvas) {
      root.style.display = "none";

      if (isDirty || boundsChanged) {
        clear();
        isDirty = false;
      }

      return;
    }

    if (!isDirty && !boundsChanged) {
      return;
    }

    root.style.display = "block";
    canvas.style.opacity = String(settings.opacity);
    clear();

    context.imageSmoothingEnabled = false;
    context.setTransform(
      viewport.matrix.a,
      viewport.matrix.b,
      viewport.matrix.c,
      viewport.matrix.d,
      viewport.matrix.e,
      viewport.matrix.f
    );
    context.drawImage(template.sourceCanvas, settings.x, settings.y);
    isDirty = false;
  }

  function loop() {
    drawCurrentFrame();
    animationFrameId = window.requestAnimationFrame(loop);
  }

  return {
    start() {
      attachRoot();

      if (isRunning) {
        return;
      }

      isRunning = true;
      animationFrameId = window.requestAnimationFrame(loop);
    },

    stop() {
      if (!isRunning) {
        return;
      }

      isRunning = false;
      window.cancelAnimationFrame(animationFrameId);
    },

    setHostCanvas(nextCanvas) {
      hostCanvas = nextCanvas;
      markDirty();
    },

    setViewport(nextViewport) {
      viewport = nextViewport;
      markDirty();
    },

    setSettings(nextSettings) {
      settings = nextSettings;
      markDirty();
    },

    setTemplate(nextTemplate) {
      template = nextTemplate;
      markDirty();
    },

    destroy() {
      this.stop();
      root.remove();
    }
  };
}
