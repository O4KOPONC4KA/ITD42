(function pageHookBootstrap() {
  if (window.__itd42PageHookInstalled) {
    return;
  }

  window.__itd42PageHookInstalled = true;

  const VIEWPORT_EVENT_NAME = "itd42:viewport";
  const CANVAS_ID_ATTR = "data-itd42-canvas-id";
  const OWNED_ATTR = "data-itd42-owned";
  const lastSignatureByCanvas = new WeakMap();
  let nextCanvasId = 0;

  function ensureCanvasId(canvas) {
    let id = canvas.getAttribute(CANVAS_ID_ATTR);

    if (!id) {
      nextCanvasId += 1;
      id = `itd42-${Date.now().toString(36)}-${nextCanvasId.toString(36)}`;
      canvas.setAttribute(CANVAS_ID_ATTR, id);
    }

    return id;
  }

  function shouldIgnoreCanvas(canvas) {
    if (!canvas || canvas.getAttribute(OWNED_ATTR) === "1") {
      return true;
    }

    if (!canvas.isConnected) {
      return true;
    }

    const rect = canvas.getBoundingClientRect();
    return rect.width <= 0 || rect.height <= 0;
  }

  function emitViewport(ctx, reason) {
    const canvas = ctx.canvas;

    if (shouldIgnoreCanvas(canvas)) {
      return;
    }

    const id = ensureCanvasId(canvas);
    const rect = canvas.getBoundingClientRect();
    const matrix = typeof ctx.getTransform === "function"
      ? ctx.getTransform()
      : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

    const signature = [
      reason,
      canvas.width,
      canvas.height,
      Math.round(rect.left),
      Math.round(rect.top),
      Math.round(rect.width),
      Math.round(rect.height),
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f
    ].join("|");

    if (lastSignatureByCanvas.get(canvas) === signature) {
      return;
    }

    lastSignatureByCanvas.set(canvas, signature);

    window.dispatchEvent(
      new CustomEvent(VIEWPORT_EVENT_NAME, {
        detail: {
          type: VIEWPORT_EVENT_NAME,
          reason,
          canvasId: id,
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
        }
      })
    );
  }

  const contextPrototype =
    window.CanvasRenderingContext2D &&
    window.CanvasRenderingContext2D.prototype;

  if (!contextPrototype) {
    return;
  }

  const methodsToWrap = [
    "drawImage",
    "putImageData",
    "fillRect",
    "strokeRect"
  ];

  for (const methodName of methodsToWrap) {
    const original = contextPrototype[methodName];

    if (typeof original !== "function" || original.__itd42Wrapped) {
      continue;
    }

    const wrapped = function wrappedCanvasMethod(...args) {
      const result = original.apply(this, args);

      try {
        emitViewport(this, methodName);
      } catch (_error) {
        // Keep the page stable even if hook telemetry fails.
      }

      return result;
    };

    wrapped.__itd42Wrapped = true;
    contextPrototype[methodName] = wrapped;
  }
})();
