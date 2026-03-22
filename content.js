(async () => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;

  if (!extensionApi?.runtime?.getURL) {
    return;
  }

  const importModule = (path) => import(extensionApi.runtime.getURL(path));

  const [
    { createStorage },
    { fileToTemplateRecord, loadTemplateFromDataUrl },
    { createDockedPanel },
    { createOverlayRenderer },
    { createSiteAdapter },
    { BOARD_SIZE, getPaletteRgb, findClosestPaletteIndex }
  ] = await Promise.all([
    importModule("modules/storage.js"),
    importModule("modules/templateLoader.js"),
    importModule("modules/dockedPanel.js"),
    importModule("modules/overlayRenderer.js"),
    importModule("modules/siteAdapter.js"),
    importModule("modules/colorUtils.js")
  ]);

  const storage = createStorage(extensionApi);
  const siteAdapter = createSiteAdapter(extensionApi);
  const overlayRenderer = createOverlayRenderer();
  const dockedPanel = createDockedPanel({
    onPatch: async (patch) => storage.patchSettings(patch),
    onTemplateSelected: async (file) => {
      const record = await fileToTemplateRecord(file);
      await storage.patchSettings({
        ...record,
        enabled: true,
        panelPinned: true
      });
      return record;
    },
    onReset: async () => storage.reset(),
    onClose: async () => storage.patchSettings({ panelPinned: false })
  });

  let settings = await storage.getSettings();
  let template = null;
  let boardCanvas = null;
  let viewport = null;
  let templateLoadId = 0;
  const PLACE_BUTTON_RE = /ПОСТАВИТЬ|ОЖИДАНИЕ/i;
  const SITE_PANEL_CLASSES = Object.freeze({
    rightPanel: "Ucl8QbBG",
    colorButton: "UnF3CfUN",
    activeColor: "OWtRuGkW",
    placeButtonText: "L8J15IA3"
  });

  function parseCssRgb(color) {
    if (!color || color === "transparent") {
      return null;
    }

    const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

    if (hexMatch) {
      const hex = hexMatch[1];
      const fullHex =
        hex.length === 3
          ? hex
              .split("")
              .map((part) => `${part}${part}`)
              .join("")
          : hex;
      const value = Number.parseInt(fullHex, 16);

      return [
        (value >> 16) & 255,
        (value >> 8) & 255,
        value & 255
      ];
    }

    const match = color.match(/rgba?\(([^)]+)\)/i);

    if (!match) {
      return null;
    }

    const [r, g, b, alpha = "1"] = match[1]
      .split(",")
      .map((part) => Number.parseFloat(part.trim()));

    if (
      !Number.isFinite(r) ||
      !Number.isFinite(g) ||
      !Number.isFinite(b) ||
      !Number.isFinite(alpha) ||
      alpha <= 0
    ) {
      return null;
    }

    return [Math.round(r), Math.round(g), Math.round(b)];
  }

  function isSameRgb(left, right) {
    return (
      left &&
      right &&
      left[0] === right[0] &&
      left[1] === right[1] &&
      left[2] === right[2]
    );
  }

  function getPaletteIndexFromRgb(rgb) {
    if (!rgb) {
      return -1;
    }

    for (let index = 0; index < 32; index += 1) {
      if (isSameRgb(rgb, getPaletteRgb(index))) {
        return index;
      }
    }

    return findClosestPaletteIndex(rgb[0], rgb[1], rgb[2]);
  }

  function isVisibleElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.pointerEvents !== "none" &&
      Number.parseFloat(style.opacity || "1") > 0
    );
  }

  function getElementPaletteIndex(element) {
    if (!(element instanceof HTMLElement)) {
      return -1;
    }

    const inlineRgb =
      parseCssRgb(element.style.backgroundColor) ||
      parseCssRgb(element.getAttribute("style") || "");

    if (inlineRgb) {
      const inlineIndex = getPaletteIndexFromRgb(inlineRgb);

      if (inlineIndex >= 0) {
        return inlineIndex;
      }
    }

    const computedRgb = parseCssRgb(window.getComputedStyle(element).backgroundColor);
    return getPaletteIndexFromRgb(computedRgb);
  }

  function getElementPaletteDistance(element, paletteIndex) {
    if (!(element instanceof HTMLElement) || paletteIndex < 0) {
      return Number.POSITIVE_INFINITY;
    }

    const rgb =
      parseCssRgb(element.style.backgroundColor) ||
      parseCssRgb(element.getAttribute("style") || "") ||
      parseCssRgb(window.getComputedStyle(element).backgroundColor);

    if (!rgb) {
      return Number.POSITIVE_INFINITY;
    }

    const target = getPaletteRgb(paletteIndex);
    const dr = rgb[0] - target[0];
    const dg = rgb[1] - target[1];
    const db = rgb[2] - target[2];
    return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
  }

  function isPaletteButtonCandidate(element) {
    if (!isVisibleElement(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    if (
      rect.width < 24 ||
      rect.width > 52 ||
      rect.height < 24 ||
      rect.height > 52
    ) {
      return false;
    }

    if (Math.abs(rect.width - rect.height) > 8) {
      return false;
    }

    return getElementPaletteIndex(element) >= 0;
  }

  function scorePaletteButton(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    let score = 0;

    if (style.cursor === "pointer") {
      score += 20;
    }

    if (Math.abs(rect.width - 36) <= 8 && Math.abs(rect.height - 36) <= 8) {
      score += 20;
    }

    if (rect.left > window.innerWidth * 0.6) {
      score += 18;
    }

    if (rect.bottom > window.innerHeight * 0.45) {
      score += 12;
    }

    if (style.borderRadius && style.borderRadius !== "0px") {
      score += 8;
    }

    return score;
  }

  function collectPaletteGroup(root) {
    if (!(root instanceof HTMLElement) || !isVisibleElement(root)) {
      return null;
    }

    const byIndex = new Map();
    let buttonCount = 0;

    for (const candidate of root.querySelectorAll("div, button")) {
      if (!(candidate instanceof HTMLElement) || !isPaletteButtonCandidate(candidate)) {
        continue;
      }

      const paletteIndex = getElementPaletteIndex(candidate);

      if (paletteIndex < 0) {
        continue;
      }

      buttonCount += 1;
      const score = scorePaletteButton(candidate);
      const existing = byIndex.get(paletteIndex);

      if (!existing || score > existing.score) {
        byIndex.set(paletteIndex, {
          element: candidate,
          score
        });
      }
    }

    if (byIndex.size < 8) {
      return null;
    }

    const rect = root.getBoundingClientRect();
    const style = window.getComputedStyle(root);
    let score = byIndex.size * 20 + buttonCount * 4;

    if (style.display.includes("grid") || style.display.includes("flex")) {
      score += 20;
    }

    if (rect.left > window.innerWidth * 0.45) {
      score += 24;
    }

    if (rect.bottom > window.innerHeight * 0.35) {
      score += 16;
    }

    return {
      root,
      byIndex,
      score
    };
  }

  function findPlacementPanelRoot() {
    const directPanel = document.querySelector(`.${SITE_PANEL_CLASSES.rightPanel}`);

    if (directPanel instanceof HTMLElement && isVisibleElement(directPanel)) {
      const directGroup = collectPaletteGroup(directPanel);

      if (directGroup) {
        return directGroup;
      }
    }

    const buttons = Array.from(document.querySelectorAll("button")).filter((button) => {
      if (!(button instanceof HTMLButtonElement) || !isVisibleElement(button)) {
        return false;
      }

      return PLACE_BUTTON_RE.test(button.textContent || "");
    });

    let bestGroup = null;

    for (const button of buttons) {
      let current = button.parentElement;
      let depth = 0;

      while (current && depth < 6) {
        const group = collectPaletteGroup(current);

        if (group && (!bestGroup || group.score > bestGroup.score)) {
          bestGroup = group;
        }

        current = current.parentElement;
        depth += 1;
      }
    }

    return bestGroup;
  }

  function findVisiblePlaceButton() {
    for (const element of document.querySelectorAll("button, span, div")) {
      if (!(element instanceof HTMLElement) || !isVisibleElement(element)) {
        continue;
      }

      if (PLACE_BUTTON_RE.test(element.textContent || "")) {
        return element;
      }
    }

    return null;
  }

  function collectSquareColorNodes(root) {
    if (!(root instanceof HTMLElement) || !isVisibleElement(root)) {
      return [];
    }

    const nodes = [];

    for (const candidate of root.querySelectorAll("div, button")) {
      if (!(candidate instanceof HTMLElement) || !isVisibleElement(candidate)) {
        continue;
      }

      const rect = candidate.getBoundingClientRect();

      if (
        rect.width < 20 ||
        rect.width > 52 ||
        rect.height < 20 ||
        rect.height > 52 ||
        Math.abs(rect.width - rect.height) > 8
      ) {
        continue;
      }

      const paletteIndex = getElementPaletteIndex(candidate);

      if (paletteIndex < 0) {
        continue;
      }

      nodes.push({
        element: candidate,
        paletteIndex,
        score: scorePaletteButton(candidate)
      });
    }

    return nodes;
  }

  function collectPaletteLayoutNodes(root) {
    if (!(root instanceof HTMLElement) || !isVisibleElement(root)) {
      return [];
    }

    const nodes = [];

    for (const candidate of root.querySelectorAll("div, button")) {
      if (!(candidate instanceof HTMLElement) || !isVisibleElement(candidate)) {
        continue;
      }

      const rect = candidate.getBoundingClientRect();

      if (
        rect.width < 20 ||
        rect.width > 52 ||
        rect.height < 20 ||
        rect.height > 52 ||
        Math.abs(rect.width - rect.height) > 8
      ) {
        continue;
      }

      nodes.push({
        element: candidate,
        rect,
        score: scorePaletteButton(candidate)
      });
    }

    nodes.sort((left, right) => {
      const topDiff = left.rect.top - right.rect.top;

      if (Math.abs(topDiff) > 8) {
        return topDiff;
      }

      return left.rect.left - right.rect.left;
    });

    return nodes;
  }

  function findPalettePanelFromButton() {
    const placeButton = findVisiblePlaceButton();

    if (!(placeButton instanceof HTMLElement)) {
      return null;
    }

    let current = placeButton;
    let depth = 0;
    let bestPanel = null;

    while (current && depth < 8) {
      const nodes = collectPaletteLayoutNodes(current);

      if (nodes.length >= 25) {
        const colorNodes = collectSquareColorNodes(current);
        const uniqueIndices = new Set(colorNodes.map((node) => node.paletteIndex));
        const score = nodes.length * 4 + uniqueIndices.size * 20;

        if (
          !bestPanel ||
          score > bestPanel.score
        ) {
          bestPanel = {
            root: current,
            nodes,
            score
          };
        }
      }

      current = current.parentElement;
      depth += 1;
    }

    return bestPanel;
  }

  function findSitePaletteSwatch(paletteIndex) {
    const directPanel = document.querySelector(`.${SITE_PANEL_CLASSES.rightPanel}`);

    if (directPanel instanceof HTMLElement && isVisibleElement(directPanel)) {
      const directButtons = Array.from(
        directPanel.querySelectorAll(`.${SITE_PANEL_CLASSES.colorButton}`)
      ).filter((button) => button instanceof HTMLElement && isVisibleElement(button));

      if (directButtons.length >= 32 && directButtons[paletteIndex]) {
        return directButtons[paletteIndex];
      }
    }

    const panelFromButton = findPalettePanelFromButton();

    if (panelFromButton) {
      const layoutNodes = panelFromButton.nodes.filter((node) => node.score >= 12);

      if (layoutNodes[paletteIndex]) {
        return layoutNodes[paletteIndex].element;
      }

      if (panelFromButton.nodes[paletteIndex]) {
        return panelFromButton.nodes[paletteIndex].element;
      }
    }

    const panel = document.querySelector(`.${SITE_PANEL_CLASSES.rightPanel}`);

    if (!(panel instanceof HTMLElement) || !isVisibleElement(panel)) {
      return null;
    }

    const buttons = panel.querySelectorAll(`.${SITE_PANEL_CLASSES.colorButton}`);
    let nearestButton = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const button of buttons) {
      if (!(button instanceof HTMLElement) || !isVisibleElement(button)) {
        continue;
      }

      const buttonPaletteIndex = getElementPaletteIndex(button);

      if (buttonPaletteIndex === paletteIndex) {
        return button;
      }

      const distance = getElementPaletteDistance(button, paletteIndex);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestButton = button;
      }
    }

    return nearestDistance < 400 ? nearestButton : null;
  }

  function findPaletteGroupFallback() {
    const groups = new Map();

    for (const candidate of document.querySelectorAll("div, button")) {
      if (!(candidate instanceof HTMLElement) || !isPaletteButtonCandidate(candidate)) {
        continue;
      }

      let current = candidate.parentElement;
      let depth = 0;

      while (current && depth < 5) {
        let group = groups.get(current);

        if (!group) {
          group = collectPaletteGroup(current);

          if (group) {
            groups.set(current, group);
          }
        }

        current = current.parentElement;
        depth += 1;
      }
    }

    let bestGroup = null;

    for (const group of groups.values()) {
      if (!bestGroup || group.score > bestGroup.score) {
        bestGroup = group;
      }
    }

    return bestGroup;
  }

  function findPaletteSwatch(paletteIndex) {
    const siteSwatch = findSitePaletteSwatch(paletteIndex);

    if (siteSwatch) {
      return siteSwatch;
    }

    const paletteGroup = findPlacementPanelRoot() || findPaletteGroupFallback();

    if (paletteGroup?.byIndex.has(paletteIndex)) {
      return paletteGroup.byIndex.get(paletteIndex).element;
    }

    if (paletteGroup?.byIndex?.size) {
      let nearestEntry = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const entry of paletteGroup.byIndex.values()) {
        const distance = getElementPaletteDistance(entry.element, paletteIndex);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEntry = entry;
        }
      }

      if (nearestEntry && nearestDistance < 400) {
        return nearestEntry.element;
      }
    }

    return null;
  }

  function dispatchPaletteSelection(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const baseEvent = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX,
      clientY
    };

    target.focus?.({ preventScroll: true });
    let handled = false;

    const preactListeners = target.l;
    const clickHandler =
      preactListeners &&
      typeof preactListeners === "object" &&
      typeof preactListeners.click === "function"
        ? preactListeners.click
        : null;

    if (typeof clickHandler === "function") {
      try {
        clickHandler(
          new MouseEvent("click", {
            ...baseEvent,
            buttons: 0
          })
        );
        handled = true;
      } catch (error) {
        console.warn("[itd42] direct preact click failed", error);
      }
    }

    if (typeof window.PointerEvent === "function") {
      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...baseEvent,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true
        })
      );
      handled = true;
    }

    target.dispatchEvent(new MouseEvent("mousedown", baseEvent));
    handled = true;

    if (typeof window.PointerEvent === "function") {
      target.dispatchEvent(
        new PointerEvent("pointerup", {
          ...baseEvent,
          buttons: 0,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true
        })
      );
    }

    target.dispatchEvent(
      new MouseEvent("mouseup", {
        ...baseEvent,
        buttons: 0
      })
    );
    handled = true;

    if (typeof target.click === "function") {
      try {
        target.click();
        handled = true;
      } catch (_error) {
        // Ignore and keep the other fallbacks.
      }
    }

    target.dispatchEvent(
      new MouseEvent("click", {
        ...baseEvent,
        buttons: 0
      })
    );

    return handled;
  }

  async function waitForPaletteSwatch(paletteIndex, timeoutMs = 1400) {
    const startedAt = performance.now();

    while (performance.now() - startedAt < timeoutMs) {
      const swatch = findPaletteSwatch(paletteIndex);

      if (swatch) {
        return swatch;
      }

      await new Promise((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }

    return null;
  }

  async function selectPaletteColor(paletteIndex) {
    const swatch = await waitForPaletteSwatch(paletteIndex);

    if (!swatch) {
      return false;
    }

    return dispatchPaletteSelection(swatch);
  }

  function invertCanvasPoint(matrix, x, y) {
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;

    if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.000001) {
      return null;
    }

    const dx = x - matrix.e;
    const dy = y - matrix.f;

    return {
      x: (matrix.d * dx - matrix.c * dy) / determinant,
      y: (matrix.a * dy - matrix.b * dx) / determinant
    };
  }

  function getTemplatePixelFromEvent(event) {
    if (!settings || !template || !boardCanvas || !viewport?.matrix) {
      return null;
    }

    const rect = boardCanvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const canvasX =
      (event.clientX - rect.left) * (boardCanvas.width / rect.width);
    const canvasY =
      (event.clientY - rect.top) * (boardCanvas.height / rect.height);
    const boardPoint = invertCanvasPoint(viewport.matrix, canvasX, canvasY);

    if (!boardPoint) {
      return null;
    }

    const boardX = Math.floor(boardPoint.x);
    const boardY = Math.floor(boardPoint.y);

    if (
      boardX < 0 ||
      boardY < 0 ||
      boardX >= BOARD_SIZE ||
      boardY >= BOARD_SIZE
    ) {
      return null;
    }

    const localX = boardX - settings.x;
    const localY = boardY - settings.y;

    if (
      localX < 0 ||
      localY < 0 ||
      localX >= template.width ||
      localY >= template.height
    ) {
      return null;
    }

    const index = localY * template.width + localX;

    if (!template.alphaMask[index]) {
      return null;
    }

    const paletteIndex = template.paletteIndices[index];

    if (!Number.isInteger(paletteIndex) || paletteIndex < 0) {
      return null;
    }

    return {
      boardX,
      boardY,
      paletteIndex
    };
  }

  async function handleBoardCanvasClick(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (!settings?.autoColorPickEnabled) {
      return;
    }

    const pixel = getTemplatePixelFromEvent(event);

    if (!pixel) {
      return;
    }

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 40);
      });

      const didSelect = await selectPaletteColor(pixel.paletteIndex);

      if (!didSelect) {
        console.warn("[itd42] palette swatch not found", pixel);
      }
    } catch (error) {
      console.error("[itd42] palette selection failed", error);
    }
  }

  function setBoardCanvas(nextCanvas) {
    if (boardCanvas === nextCanvas) {
      return;
    }

    if (boardCanvas) {
      boardCanvas.removeEventListener("click", handleBoardCanvasClick);
    }

    boardCanvas = nextCanvas;

    if (boardCanvas) {
      boardCanvas.addEventListener("click", handleBoardCanvasClick);
    }

    overlayRenderer.setHostCanvas(nextCanvas);
  }

  async function loadTemplateFromState(state) {
    if (!state.templateDataUrl) {
      return null;
    }

    try {
      return await loadTemplateFromDataUrl(state.templateDataUrl, {
        name: state.templateName
      });
    } catch (error) {
      console.error("[itd42] template load failed", error);
      return null;
    }
  }

  async function syncTemplate(state) {
    const currentLoadId = ++templateLoadId;
    const nextTemplate = await loadTemplateFromState(state);

    if (currentLoadId !== templateLoadId) {
      return nextTemplate;
    }

    template = nextTemplate;
    overlayRenderer.setTemplate(nextTemplate);
    return nextTemplate;
  }

  async function applyState(nextState, changedKeys) {
    settings = nextState;
    overlayRenderer.setSettings(settings);
    dockedPanel.render(settings);

    if (
      changedKeys.includes("templateDataUrl") ||
      changedKeys.includes("templateUpdatedAt")
    ) {
      await syncTemplate(settings);
    }
  }

  overlayRenderer.start();

  siteAdapter.onCanvas((canvas) => {
    setBoardCanvas(canvas);
  });

  siteAdapter.onViewport((nextViewport) => {
    viewport = nextViewport;
    overlayRenderer.setViewport(nextViewport);
  });

  siteAdapter.start();

  overlayRenderer.setSettings(settings);
  await syncTemplate(settings);
  dockedPanel.render(settings);

  storage.subscribe((nextState, changedKeys) => {
    applyState(nextState, changedKeys).catch((error) => {
      console.error("[itd42]", error);
    });
  });
})().catch((error) => {
  console.error("[itd42] bootstrap failed", error);
});
