const PAGE_EVENT_NAME = "itd42:viewport";
const HOOK_SCRIPT_PATH = "modules/pageHook.js";
const CANVAS_ID_ATTR = "data-itd42-canvas-id";
const OWNED_ATTR = "data-itd42-owned";
const INJECTED_SCRIPT_ID = "itd42-page-hook";
const HOOK_STALE_MS = 600;

let nextCanvasId = 0;

function roundMetric(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 1000) / 1000;
}

function isVisibleCanvas(canvas) {
  if (!canvas || canvas.getAttribute(OWNED_ATTR) === "1") {
    return false;
  }

  const rect = canvas.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const style = window.getComputedStyle(canvas);
  return style.visibility !== "hidden" && style.display !== "none";
}

function getCanvasScore(canvas) {
  if (!isVisibleCanvas(canvas)) {
    return -1;
  }

  const rect = canvas.getBoundingClientRect();
  return rect.width * rect.height;
}

function pickBestCanvas() {
  const canvases = Array.from(document.querySelectorAll("canvas"));
  let bestCanvas = null;
  let bestScore = -1;

  for (const canvas of canvases) {
    const score = getCanvasScore(canvas);

    if (score > bestScore) {
      bestScore = score;
      bestCanvas = canvas;
    }
  }

  return bestCanvas;
}

function ensureCanvasId(canvas) {
  if (!canvas) {
    return "";
  }

  let id = canvas.getAttribute(CANVAS_ID_ATTR);

  if (!id) {
    nextCanvasId += 1;
    id = `itd42-local-${Date.now().toString(36)}-${nextCanvasId.toString(36)}`;
    canvas.setAttribute(CANVAS_ID_ATTR, id);
  }

  return id;
}

function buildViewportFromCanvas(canvas, reason = "poll") {
  if (!canvas || !isVisibleCanvas(canvas)) {
    return null;
  }

  const context = canvas.getContext("2d");

  if (!context || typeof context.getTransform !== "function") {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const matrix = context.getTransform();

  return {
    type: PAGE_EVENT_NAME,
    reason,
    canvasId: ensureCanvasId(canvas),
    width: canvas.width,
    height: canvas.height,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    },
    matrix: {
      a: matrix.a,
      b: matrix.b,
      c: matrix.c,
      d: matrix.d,
      e: matrix.e,
      f: matrix.f
    },
    timestamp: performance.now()
  };
}

function getViewportSignature(detail) {
  if (!detail) {
    return "";
  }

  return [
    detail.canvasId,
    detail.width,
    detail.height,
    roundMetric(detail.rect.left),
    roundMetric(detail.rect.top),
    roundMetric(detail.rect.width),
    roundMetric(detail.rect.height),
    roundMetric(detail.matrix.a),
    roundMetric(detail.matrix.b),
    roundMetric(detail.matrix.c),
    roundMetric(detail.matrix.d),
    roundMetric(detail.matrix.e),
    roundMetric(detail.matrix.f)
  ].join("|");
}

export function createSiteAdapter(extensionApi) {
  const viewportListeners = new Set();
  const canvasListeners = new Set();
  const viewportByCanvasId = new Map();

  let boardCanvas = null;
  let mutationObserver = null;
  let boundViewportHandler = null;
  let resizeHandler = null;
  let animationFrameId = 0;
  let lastViewportSignature = "";
  let lastHookAt = 0;

  function getBoardCanvasId(canvas) {
    return ensureCanvasId(canvas);
  }

  function notifyCanvas() {
    for (const listener of canvasListeners) {
      listener(boardCanvas);
    }

    const canvasId = getBoardCanvasId(boardCanvas);

    if (canvasId && viewportByCanvasId.has(canvasId)) {
      const viewport = viewportByCanvasId.get(canvasId);

      for (const listener of viewportListeners) {
        listener(viewport);
      }
    }
  }

  function publishViewport(detail) {
    if (!detail) {
      return;
    }

    const signature = getViewportSignature(detail);

    if (signature === lastViewportSignature) {
      return;
    }

    lastViewportSignature = signature;
    viewportByCanvasId.set(detail.canvasId, detail);

    if (getBoardCanvasId(boardCanvas) !== detail.canvasId) {
      return;
    }

    for (const listener of viewportListeners) {
      listener(detail);
    }
  }

  function selectBoardCanvas() {
    const nextCanvas = pickBestCanvas();

    if (nextCanvas === boardCanvas) {
      return;
    }

    boardCanvas = nextCanvas;
    lastViewportSignature = "";

    if (boardCanvas) {
      publishViewport(buildViewportFromCanvas(boardCanvas, "canvas-change"));
    }

    notifyCanvas();
  }

  function injectPageHook() {
    if (document.getElementById(INJECTED_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = INJECTED_SCRIPT_ID;
    script.src = extensionApi.runtime.getURL(HOOK_SCRIPT_PATH);
    script.async = false;
    (document.documentElement || document.head || document.body).appendChild(script);
  }

  function handleViewportEvent(event) {
    const detail = event.detail;

    if (!detail || detail.type !== PAGE_EVENT_NAME || !detail.canvasId) {
      return;
    }

    lastHookAt = performance.now();
    publishViewport(detail);
  }

  function pollViewport(now = performance.now()) {
    selectBoardCanvas();

    if (boardCanvas && now - lastHookAt > HOOK_STALE_MS) {
      publishViewport(buildViewportFromCanvas(boardCanvas, "poll"));
    }

    animationFrameId = window.requestAnimationFrame(pollViewport);
  }

  return {
    start() {
      injectPageHook();
      selectBoardCanvas();

      boundViewportHandler = (event) => {
        handleViewportEvent(event);
      };

      resizeHandler = () => {
        selectBoardCanvas();

        if (boardCanvas) {
          publishViewport(buildViewportFromCanvas(boardCanvas, "resize"));
        }
      };

      window.addEventListener(PAGE_EVENT_NAME, boundViewportHandler);
      window.addEventListener("resize", resizeHandler);

      mutationObserver = new MutationObserver(() => {
        selectBoardCanvas();
      });

      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      animationFrameId = window.requestAnimationFrame(pollViewport);
    },

    onCanvas(listener) {
      canvasListeners.add(listener);

      if (boardCanvas) {
        listener(boardCanvas);
      }

      return () => {
        canvasListeners.delete(listener);
      };
    },

    onViewport(listener) {
      viewportListeners.add(listener);

      const canvasId = getBoardCanvasId(boardCanvas);

      if (canvasId && viewportByCanvasId.has(canvasId)) {
        listener(viewportByCanvasId.get(canvasId));
      }

      return () => {
        viewportListeners.delete(listener);
      };
    },

    getCanvas() {
      return boardCanvas;
    },

    destroy() {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }

      if (boundViewportHandler) {
        window.removeEventListener(PAGE_EVENT_NAME, boundViewportHandler);
        boundViewportHandler = null;
      }

      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
        resizeHandler = null;
      }

      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }

      viewportListeners.clear();
      canvasListeners.clear();
    }
  };
}
