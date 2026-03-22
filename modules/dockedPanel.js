const ROOT_ID = "itd42-docked-panel";
const OWNED_ATTR = "data-itd42-owned";
const DEFAULT_MARGIN = 24;

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  try {
    return new Date(timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch (_error) {
    return "";
  }
}

function describeTemplate(state) {
  if (!state.templateDataUrl) {
    return "Шаблон не загружен.";
  }

  const parts = [];

  if (state.templateName) {
    parts.push(state.templateName);
  }

  if (state.templateWidth > 0 && state.templateHeight > 0) {
    parts.push(`${state.templateWidth}x${state.templateHeight}`);
  }

  const updatedAt = formatTimestamp(state.templateUpdatedAt);

  if (updatedAt) {
    parts.push(`загружен ${updatedAt}`);
  }

  return parts.join(" • ");
}

function createStyles() {
  const style = document.createElement("style");
  style.setAttribute(OWNED_ATTR, "1");
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      top: 24px;
      right: 24px;
      width: min(320px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      z-index: 120;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(16, 22, 30, 0.94);
      backdrop-filter: blur(18px);
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.36);
      color: #eef4ff;
      font: 13px/1.4 "Segoe UI", "Trebuchet MS", system-ui, sans-serif;
    }

    #${ROOT_ID}[hidden] {
      display: none !important;
    }

    #${ROOT_ID} * {
      box-sizing: border-box;
    }

    #${ROOT_ID} .itd42-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
      cursor: move;
      user-select: none;
      touch-action: none;
    }

    #${ROOT_ID} .itd42-panel-title {
      font-size: 15px;
      font-weight: 700;
    }

    #${ROOT_ID} .itd42-panel-close {
      border: 0;
      border-radius: 10px;
      width: 34px;
      height: 34px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.08);
      color: #eef4ff;
      font-size: 18px;
    }

    #${ROOT_ID} .itd42-panel-stack {
      display: grid;
      gap: 12px;
    }

    #${ROOT_ID} .itd42-panel-card {
      padding: 12px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
    }

    #${ROOT_ID} .itd42-panel-card h3 {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #c9d7ea;
    }

    #${ROOT_ID} .itd42-panel-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    #${ROOT_ID} label {
      display: grid;
      gap: 6px;
      color: #9aa9bf;
      font-size: 12px;
    }

    #${ROOT_ID} input[type="number"],
    #${ROOT_ID} input[type="range"],
    #${ROOT_ID} input[type="file"] {
      width: 100%;
    }

    #${ROOT_ID} input[type="number"] {
      padding: 10px 11px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(10, 14, 20, 0.72);
      color: #eef4ff;
      font: inherit;
    }

    #${ROOT_ID} input[type="file"] {
      padding: 9px;
      border-radius: 12px;
      border: 1px dashed rgba(255, 255, 255, 0.2);
      background: rgba(10, 14, 20, 0.52);
      color: #9aa9bf;
    }

    #${ROOT_ID} input[type="range"] {
      accent-color: #59d7a7;
    }

    #${ROOT_ID} .itd42-panel-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);
    }

    #${ROOT_ID} .itd42-panel-toggle input {
      width: 18px;
      height: 18px;
      accent-color: #59d7a7;
    }

    #${ROOT_ID} .itd42-panel-meta,
    #${ROOT_ID} .itd42-panel-message {
      padding: 10px 11px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(10, 14, 20, 0.5);
      color: #9aa9bf;
    }

    #${ROOT_ID} .itd42-panel-meta.error {
      color: #ffd7d7;
      border-color: rgba(255, 122, 122, 0.22);
      background: rgba(255, 122, 122, 0.08);
    }

    #${ROOT_ID} .itd42-panel-button {
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 11px 12px;
      cursor: pointer;
      font: 700 13px/1 "Segoe UI", "Trebuchet MS", system-ui, sans-serif;
    }

    #${ROOT_ID} .itd42-panel-button.secondary {
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(135deg, #283140, #1b2430);
      color: #eef4ff;
    }

    #${ROOT_ID} .itd42-panel-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    #${ROOT_ID} .itd42-panel-badge {
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid rgba(89, 215, 167, 0.2);
      background: rgba(89, 215, 167, 0.12);
      color: #cffff0;
      font-size: 11px;
      white-space: nowrap;
    }
  `;

  return style;
}

function clampPosition(left, top, width, height) {
  const maxLeft = Math.max(DEFAULT_MARGIN, window.innerWidth - width - DEFAULT_MARGIN);
  const maxTop = Math.max(DEFAULT_MARGIN, window.innerHeight - height - DEFAULT_MARGIN);

  return {
    left: Math.min(maxLeft, Math.max(DEFAULT_MARGIN, left)),
    top: Math.min(maxTop, Math.max(DEFAULT_MARGIN, top))
  };
}

export function createDockedPanel(handlers) {
  const style = createStyles();
  const root = document.createElement("aside");
  root.id = ROOT_ID;
  root.setAttribute(OWNED_ATTR, "1");
  root.hidden = true;
  root.innerHTML = `
    <div class="itd42-panel-header">
      <div class="itd42-panel-title">ITD42 Overlay</div>
      <button class="itd42-panel-close" type="button" title="Скрыть панель">×</button>
    </div>
    <div class="itd42-panel-stack">
      <section class="itd42-panel-card">
        <h3>Шаблон</h3>
        <div class="itd42-panel-stack">
          <label>
            <span>PNG файл</span>
            <input class="js-template-file" type="file" accept="image/png" />
          </label>
          <div class="itd42-panel-meta js-template-meta">Шаблон не загружен.</div>
        </div>
      </section>
      <section class="itd42-panel-card">
        <h3>Положение</h3>
        <div class="itd42-panel-grid">
          <label>
            <span>X</span>
            <input class="js-x" type="number" step="1" />
          </label>
          <label>
            <span>Y</span>
            <input class="js-y" type="number" step="1" />
          </label>
        </div>
      </section>
      <section class="itd42-panel-card">
        <h3>Отображение</h3>
        <div class="itd42-panel-stack">
          <label>
            <div class="itd42-panel-row">
              <span>Прозрачность</span>
              <span class="itd42-panel-badge js-opacity-value">65%</span>
            </div>
            <input class="js-opacity" type="range" min="0.05" max="1" step="0.01" />
          </label>
          <label class="itd42-panel-toggle">
            <span>Показывать шаблон</span>
            <input class="js-enabled" type="checkbox" />
          </label>
          <label class="itd42-panel-toggle">
            <span>Автовыбор цвета</span>
            <input class="js-auto-color-pick" type="checkbox" />
          </label>
        </div>
      </section>
      <section class="itd42-panel-card">
        <h3>Действия</h3>
        <div class="itd42-panel-stack">
          <div class="itd42-panel-message">
            Клик по пикселю шаблона выбирает нужный цвет в палитре сайта.
          </div>
          <button class="itd42-panel-button secondary js-reset" type="button">Сбросить</button>
        </div>
      </section>
    </div>
  `;

  const elements = {
    header: root.querySelector(".itd42-panel-header"),
    file: root.querySelector(".js-template-file"),
    templateMeta: root.querySelector(".js-template-meta"),
    x: root.querySelector(".js-x"),
    y: root.querySelector(".js-y"),
    opacity: root.querySelector(".js-opacity"),
    opacityValue: root.querySelector(".js-opacity-value"),
    enabled: root.querySelector(".js-enabled"),
    autoColorPick: root.querySelector(".js-auto-color-pick"),
    reset: root.querySelector(".js-reset"),
    closeButton: root.querySelector(".itd42-panel-close")
  };

  let opacityTimer = 0;
  let currentState = null;
  let dragState = null;
  let templateMessage = null;

  function isFocused(element) {
    return document.activeElement === element;
  }

  function attach() {
    if (!style.isConnected) {
      (document.head || document.documentElement).appendChild(style);
    }

    if (!root.isConnected) {
      (document.body || document.documentElement).appendChild(root);
    }
  }

  function applyPosition(state) {
    root.style.right = "auto";

    if (state.panelPositionX === null || state.panelPositionY === null) {
      root.style.left = "";
      root.style.top = `${DEFAULT_MARGIN}px`;
      root.style.right = `${DEFAULT_MARGIN}px`;
      return;
    }

    const clamped = clampPosition(
      state.panelPositionX,
      state.panelPositionY,
      root.offsetWidth,
      root.offsetHeight
    );

    root.style.left = `${clamped.left}px`;
    root.style.top = `${clamped.top}px`;
  }

  function renderTemplateMeta(state) {
    const text = templateMessage?.text || describeTemplate(state);
    elements.templateMeta.textContent = text;
    elements.templateMeta.className = templateMessage?.isError
      ? "itd42-panel-meta error"
      : "itd42-panel-meta";
  }

  function persistCurrentPosition() {
    const rect = root.getBoundingClientRect();
    const clamped = clampPosition(rect.left, rect.top, rect.width, rect.height);

    handlers.onPatch({
      panelPositionX: Math.round(clamped.left),
      panelPositionY: Math.round(clamped.top)
    }).catch((error) => {
      console.error("[itd42] save panel position failed", error);
    });
  }

  function handlePointerMove(event) {
    if (!dragState) {
      return;
    }

    const rect = root.getBoundingClientRect();
    const nextLeft = event.clientX - dragState.offsetX;
    const nextTop = event.clientY - dragState.offsetY;
    const clamped = clampPosition(nextLeft, nextTop, rect.width, rect.height);

    root.style.left = `${clamped.left}px`;
    root.style.top = `${clamped.top}px`;
    root.style.right = "auto";
  }

  function stopDragging() {
    if (!dragState) {
      return;
    }

    dragState = null;
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
    persistCurrentPosition();
  }

  function startDragging(event) {
    if (event.target === elements.closeButton) {
      return;
    }

    const rect = root.getBoundingClientRect();
    dragState = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
  }

  elements.header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    startDragging(event);
  });

  elements.closeButton.addEventListener("click", () => {
    handlers.onClose().catch((error) => {
      console.error("[itd42] close panel failed", error);
    });
  });

  elements.file.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    let uploadedRecord = null;

    if (!file) {
      return;
    }

    try {
      templateMessage = {
        text: "Обрабатываю PNG...",
        isError: false
      };
      renderTemplateMeta(currentState || {});
      uploadedRecord = await handlers.onTemplateSelected(file);
      templateMessage = null;
    } catch (error) {
      templateMessage = {
        text: error.message || "Не удалось загрузить PNG.",
        isError: true
      };
    } finally {
      renderTemplateMeta(
        uploadedRecord
          ? {
              ...(currentState || {}),
              ...uploadedRecord
            }
          : (currentState || {})
      );
      event.target.value = "";
    }
  });

  elements.x.addEventListener("change", () => {
    handlers.onPatch({
      x: Number(elements.x.value)
    }).catch((error) => {
      console.error("[itd42] save x failed", error);
    });
  });

  elements.y.addEventListener("change", () => {
    handlers.onPatch({
      y: Number(elements.y.value)
    }).catch((error) => {
      console.error("[itd42] save y failed", error);
    });
  });

  elements.opacity.addEventListener("input", () => {
    elements.opacityValue.textContent = `${Math.round(Number(elements.opacity.value) * 100)}%`;
    window.clearTimeout(opacityTimer);
    opacityTimer = window.setTimeout(() => {
      handlers.onPatch({
        opacity: Number(elements.opacity.value)
      }).catch((error) => {
        console.error("[itd42] save opacity failed", error);
      });
    }, 80);
  });

  elements.enabled.addEventListener("change", () => {
    handlers.onPatch({
      enabled: elements.enabled.checked
    }).catch((error) => {
      console.error("[itd42] save enabled failed", error);
    });
  });

  elements.autoColorPick.addEventListener("change", () => {
    handlers.onPatch({
      autoColorPickEnabled: elements.autoColorPick.checked
    }).catch((error) => {
      console.error("[itd42] save auto color pick failed", error);
    });
  });

  elements.reset.addEventListener("click", async () => {
    try {
      templateMessage = null;
      await handlers.onReset();
    } catch (error) {
      console.error("[itd42] reset failed", error);
    }
  });

  window.addEventListener("resize", () => {
    if (currentState?.panelPinned) {
      applyPosition(currentState);
    }
  });

  return {
    render(state) {
      currentState = state;
      attach();
      root.hidden = !state.panelPinned;

      if (!root.hidden) {
        applyPosition(state);
      }

      if (!isFocused(elements.x)) {
        elements.x.value = String(state.x);
      }

      if (!isFocused(elements.y)) {
        elements.y.value = String(state.y);
      }

      if (!isFocused(elements.opacity)) {
        elements.opacity.value = String(state.opacity);
      }

      elements.opacityValue.textContent = `${Math.round(state.opacity * 100)}%`;
      elements.enabled.checked = state.enabled;
      elements.autoColorPick.checked = state.autoColorPickEnabled;
      renderTemplateMeta(state);
    }
  };
}
