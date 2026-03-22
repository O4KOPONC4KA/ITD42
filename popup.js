import { createStorage, getExtensionApi } from "./modules/storage.js";

const api = getExtensionApi();
const storage = createStorage(api);

const elements = {
  openPanel: document.getElementById("openPanel")
};

function isPromiseApi() {
  return typeof globalThis.browser !== "undefined" && api === globalThis.browser;
}

async function queryActiveTab() {
  if (isPromiseApi()) {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  return new Promise((resolve) => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve((tabs && tabs[0]) || null);
    });
  });
}

async function openPanel() {
  const tab = await queryActiveTab();

  if (tab?.url && tab.url.startsWith("https://pixel.xn--d1ah4a.com/")) {
    await storage.patchSettings({
      panelPinned: true
    });
    window.close();
    return;
  }

  elements.openPanel.disabled = true;
  elements.openPanel.textContent = "Откройте сайт";
}

async function init() {
  elements.openPanel.addEventListener("click", () => {
    openPanel().catch(() => {
      elements.openPanel.disabled = true;
      elements.openPanel.textContent = "Ошибка";
    });
  });
}

init().catch((error) => {
  console.error("[itd42] popup init failed", error);
  elements.openPanel.disabled = true;
  elements.openPanel.textContent = "Ошибка";
});
