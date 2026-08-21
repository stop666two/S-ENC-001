import { i18n } from "./i18n";
import { setModalAria, trapFocus } from "./modalFocus";
import { modalBarHtml, bindModalBar } from "./modalBar";

export interface CheckItem {
  id: "wasm" | "worker" | "crypto" | "codec" | "clipboard" | "sw";
  critical: boolean;
  supported: boolean;
}

export interface BrowserCheckResult {
  items: CheckItem[];
  criticalMissing: boolean;
  optionalMissing: boolean;
}

export function checkBrowser(): BrowserCheckResult {
  const has = (f: () => unknown): boolean => {
    try { return !!f(); } catch { return false; }
  };
  const items: CheckItem[] = [
    { id: "wasm", critical: true, supported: has(() => typeof WebAssembly !== "undefined" && typeof WebAssembly.instantiate === "function") },
    { id: "worker", critical: true, supported: has(() => typeof Worker !== "undefined") },
    { id: "crypto", critical: true, supported: has(() => globalThis.crypto?.subtle !== undefined) },
    { id: "codec", critical: true, supported: has(() => typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined") },
    { id: "clipboard", critical: false, supported: has(() => navigator.clipboard?.writeText !== undefined) },
    { id: "sw", critical: false, supported: has(() => { const sw = (navigator as { serviceWorker?: unknown }).serviceWorker; return sw !== undefined && sw !== null; }) },
  ];
  return {
    items,
    criticalMissing: items.some((i) => i.critical && !i.supported),
    optionalMissing: items.some((i) => !i.critical && !i.supported),
  };
}

interface GuideBrowser {
  key: "chrome" | "firefox" | "edge";
  url: string;
}

const GUIDES: Record<string, GuideBrowser[]> = {
  windows: [
    { key: "chrome", url: "https://www.google.com/chrome/" },
    { key: "firefox", url: "https://www.mozilla.org/firefox/" },
    { key: "edge", url: "https://www.microsoft.com/edge" },
  ],
  mac: [
    { key: "chrome", url: "https://www.google.com/chrome/" },
    { key: "firefox", url: "https://www.mozilla.org/firefox/" },
    { key: "edge", url: "https://www.microsoft.com/edge" },
  ],
  linux: [
    { key: "chrome", url: "https://www.google.com/chrome/" },
    { key: "firefox", url: "https://www.mozilla.org/firefox/" },
    { key: "edge", url: "https://www.microsoft.com/edge" },
  ],
  android: [
    { key: "chrome", url: "https://www.google.com/chrome/" },
    { key: "firefox", url: "https://www.mozilla.org/firefox/" },
    { key: "edge", url: "https://www.microsoft.com/edge" },
  ],
  ios: [
    { key: "chrome", url: "https://apps.apple.com/" },
    { key: "firefox", url: "https://apps.apple.com/" },
    { key: "edge", url: "https://apps.apple.com/" },
  ],
};

function guideBlock(platform: "windows" | "mac" | "linux" | "android" | "ios"): string {
  const rows = GUIDES[platform]
    .map((b) => {
      const name = i18n.t("check.guide." + b.key);
      const link = i18n.t(`check.guide.${b.key}.${platform}`);
      return `<div class="guide-browser"><span class="guide-name">${name}</span><a href="${b.url}" target="_blank" rel="noopener noreferrer">${link}</a></div>`;
    })
    .join("");
  return `<div class="guide-platform"><h4>${i18n.t("check.guide." + platform)}</h4>${rows}</div>`;
}

export function showBrowserReport(result: BrowserCheckResult, onRetry?: () => void): Promise<void> {
  return new Promise<void>((resolve) => {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const critical = result.items.filter((i) => i.critical);
  const optional = result.items.filter((i) => !i.critical);

  const row = (i: CheckItem): string => {
    const label = i18n.t("check.item." + i.id);
    const tag = i18n.t(i.critical ? "check.critical" : "check.optional");
    const status = i.supported ? i18n.t("check.ok") : i18n.t("check.missing");
    const cls = i.supported ? "check-ok" : "check-missing";
    const marker = i.supported ? "OK" : "!!";
    return `<div class="check-row ${cls}"><span class="check-marker">[${marker}]</span><span class="check-label">${label} <span class="check-tag">(${tag})</span></span><span class="check-status">${status}</span></div>`;
  };

  const heading = result.criticalMissing
    ? `<div class="check-heading check-heading-fail"><span class="check-icon">[X]</span><strong>${i18n.t("check.fail.title")}</strong><p>${i18n.t("check.fail.desc")}</p></div>`
    : result.optionalMissing
      ? `<div class="check-heading check-heading-warn"><span class="check-icon">[!]</span><strong>${i18n.t("check.warn.title")}</strong><p>${i18n.t("check.warn.desc")}</p></div>`
      : `<div class="check-heading check-heading-pass"><span class="check-icon">[OK]</span><strong>${i18n.t("check.pass.title")}</strong><p>${i18n.t("check.pass.desc")}</p></div>`;

  const criticalBlock = critical.map(row).join("");
  const optionalBlock = optional.map(row).join("");

  const guideBody = [
    guideBlock("windows"),
    guideBlock("mac"),
    guideBlock("linux"),
    guideBlock("android"),
    guideBlock("ios"),
  ].join("");

  const retryBtn = onRetry
    ? `<button id="bc-retry" class="term-btn">${i18n.t("check.retry")}</button>`
    : "";

  overlay.innerHTML = `
    <div class="modal check-modal">
      <h3>${i18n.t("check.title")}</h3>
      ${modalBarHtml("bc")}
      <div class="modal-body">
        ${heading}
        <div class="check-section"><h4>${i18n.t("check.critical")}</h4>${criticalBlock}</div>
        <div class="check-section"><h4>${i18n.t("check.optional")}</h4>${optionalBlock}</div>
        <div class="guide-section">
          <h4>${i18n.t("check.guide.title")}</h4>
          <p class="guide-intro">${i18n.t("check.guide.intro")}</p>
          <div class="guide-scroll">${guideBody}<p class="guide-note">${i18n.t("check.guide.note")}</p></div>
        </div>
        <div class="modal-actions">${retryBtn}<button id="bc-close" class="term-btn">${i18n.t("modal.cancel")}</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setModalAria(overlay, "bc-title");
  trapFocus(overlay);
  bindModalBar("bc");

  const cleanup = (): void => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    resolve();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      cleanup();
    }
  };
  document.addEventListener("keydown", onKey);
  const close = overlay.querySelector("#bc-close") as HTMLElement;
  close.onclick = () => cleanup();
  const retry = overlay.querySelector("#bc-retry") as HTMLElement | null;
  if (retry) retry.onclick = () => { cleanup(); onRetry?.(); };
  close.focus();
  });
}
