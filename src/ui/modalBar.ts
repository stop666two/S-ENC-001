import { i18n } from "./i18n";
import { applyStoredTheme, cycleTheme } from "./theme";

export function modalBarHtml(prefix: string): string {
  const mode = applyStoredTheme();
  return `<div class="modal-bar">
  <button type="button" id="${prefix}-lang" class="term-btn modal-bar-btn">${i18n.t("btn.lang")}</button>
  <button type="button" id="${prefix}-theme" class="term-btn modal-bar-btn" title="${i18n.t("hint.btn.theme." + mode)}">${i18n.t("btn.theme")}</button>
</div>`;
}

export function bindModalBar(prefix: string): void {
  const langBtn = document.getElementById(prefix + "-lang");
  langBtn?.addEventListener("click", () => {
    i18n.toggle();
    location.reload();
  });
  const themeBtn = document.getElementById(prefix + "-theme");
  themeBtn?.addEventListener("click", () => {
    const mode = cycleTheme();
    themeBtn.setAttribute("title", i18n.t("hint.btn.theme." + mode));
  });
}
