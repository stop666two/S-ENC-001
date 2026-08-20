import { i18n } from "./i18n";

export function setModalAria(overlay: HTMLElement, titleId: string): void {
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const h3 = overlay.querySelector("h3");
  if (h3) {
    h3.id = titleId;
    overlay.setAttribute("aria-labelledby", titleId);
  }
}

export function trapFocus(overlay: HTMLElement): void {
  const getFocusable = (): HTMLElement[] =>
    Array.from(
      overlay.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null);

  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const els = getFocusable();
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

export function announceModal(overlay: HTMLElement, titleId: string, titleKey: string): void {
  setModalAria(overlay, titleId);
  const h3 = overlay.querySelector("h3");
  if (h3) h3.textContent = i18n.t(titleKey);
  trapFocus(overlay);
}
