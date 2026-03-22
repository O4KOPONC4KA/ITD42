const MIN_OPACITY = 0.05;
const MAX_OPACITY = 1;
const MAX_TEMPLATE_DIMENSION = 4096;
const LEGACY_KEYS = Object.freeze([
  "showOnlyMismatches",
  "hideCorrectPixels",
  "compareUpdatedAt",
  "lastCompareSummary"
]);

const DEFAULTS = Object.freeze({
  enabled: true,
  autoColorPickEnabled: true,
  x: 0,
  y: 0,
  opacity: 0.65,
  panelPinned: false,
  panelPositionX: null,
  panelPositionY: null,
  templateDataUrl: "",
  templateName: "",
  templateWidth: 0,
  templateHeight: 0,
  templateUpdatedAt: 0
});

function isPromiseApi(api) {
  return typeof globalThis.browser !== "undefined" && api === globalThis.browser;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function toInteger(value, fallback = 0) {
  const nextValue = Number.parseInt(String(value), 10);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const nextValue = Number(value);

  if (!Number.isFinite(nextValue)) {
    return null;
  }

  return Math.round(nextValue);
}

function sanitizeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function sanitizeSettings(raw = {}) {
  return {
    enabled: raw.enabled !== false,
    autoColorPickEnabled: raw.autoColorPickEnabled !== false,
    x: toInteger(raw.x, DEFAULTS.x),
    y: toInteger(raw.y, DEFAULTS.y),
    opacity: clamp(Number(raw.opacity), MIN_OPACITY, MAX_OPACITY),
    panelPinned: Boolean(raw.panelPinned),
    panelPositionX: normalizeNullableNumber(raw.panelPositionX),
    panelPositionY: normalizeNullableNumber(raw.panelPositionY),
    templateDataUrl: sanitizeText(raw.templateDataUrl),
    templateName: sanitizeText(raw.templateName),
    templateWidth: clamp(
      toInteger(raw.templateWidth, DEFAULTS.templateWidth),
      0,
      MAX_TEMPLATE_DIMENSION
    ),
    templateHeight: clamp(
      toInteger(raw.templateHeight, DEFAULTS.templateHeight),
      0,
      MAX_TEMPLATE_DIMENSION
    ),
    templateUpdatedAt: Math.max(
      0,
      toInteger(raw.templateUpdatedAt, DEFAULTS.templateUpdatedAt)
    )
  };
}

async function getLocal(api, defaults) {
  const area = api.storage.local;

  if (isPromiseApi(api)) {
    return area.get(defaults);
  }

  return new Promise((resolve, reject) => {
    area.get(defaults, (items) => {
      if (api.runtime?.lastError) {
        reject(new Error(api.runtime.lastError.message || "Не удалось прочитать настройки."));
        return;
      }

      resolve(items || {});
    });
  });
}

async function setLocal(api, value) {
  const area = api.storage.local;

  if (isPromiseApi(api)) {
    await area.set(value);
    return;
  }

  await new Promise((resolve, reject) => {
    area.set(value, () => {
      if (api.runtime?.lastError) {
        reject(new Error(api.runtime.lastError.message || "Не удалось сохранить настройки."));
        return;
      }

      resolve();
    });
  });
}

async function removeLocal(api, keys) {
  if (!keys.length) {
    return;
  }

  const area = api.storage.local;

  if (isPromiseApi(api)) {
    await area.remove(keys);
    return;
  }

  await new Promise((resolve, reject) => {
    area.remove(keys, () => {
      if (api.runtime?.lastError) {
        reject(new Error(api.runtime.lastError.message || "Не удалось очистить старые настройки."));
        return;
      }

      resolve();
    });
  });
}

export function getExtensionApi() {
  const api = globalThis.browser ?? globalThis.chrome;

  if (!api?.storage?.local) {
    throw new Error("Browser extension API is unavailable.");
  }

  return api;
}

export function createStorage(api = getExtensionApi()) {
  const listeners = new Set();
  let cachedSettings = null;
  let isListening = false;

  function handleChanged(changes, areaName) {
    if (areaName !== "local") {
      return;
    }

    const changedKeys = Object.keys(changes);

    if (!changedKeys.length) {
      return;
    }

    const patch = {};

    for (const key of changedKeys) {
      patch[key] = changes[key]?.newValue;
    }

    cachedSettings = sanitizeSettings({
      ...(cachedSettings || DEFAULTS),
      ...patch
    });

    for (const listener of listeners) {
      listener(cachedSettings, changedKeys);
    }
  }

  function ensureListening() {
    if (isListening) {
      return;
    }

    api.storage.onChanged.addListener(handleChanged);
    isListening = true;
  }

  return {
    async getSettings() {
      const stored = await getLocal(api, DEFAULTS);
      cachedSettings = sanitizeSettings(stored);
      return cachedSettings;
    },

    async patchSettings(patch) {
      const currentSettings = await this.getSettings();
      const nextSettings = sanitizeSettings({
        ...currentSettings,
        ...patch
      });

      await setLocal(api, nextSettings);
      cachedSettings = nextSettings;
      return nextSettings;
    },

    async reset() {
      const currentSettings = await this.getSettings();
      const nextSettings = sanitizeSettings({
        ...DEFAULTS,
        panelPinned: currentSettings.panelPinned,
        panelPositionX: currentSettings.panelPositionX,
        panelPositionY: currentSettings.panelPositionY
      });

      await setLocal(api, nextSettings);
      await removeLocal(api, LEGACY_KEYS);
      cachedSettings = nextSettings;
      return nextSettings;
    },

    subscribe(listener) {
      listeners.add(listener);
      ensureListening();

      return () => {
        listeners.delete(listener);
      };
    }
  };
}
