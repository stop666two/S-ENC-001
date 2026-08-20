import { i18n } from "./i18n";
import { escapeHtml } from "./resultModal";

export class PhraseModal {
  static show(phrase: string): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <h3>${i18n.t("modal.phrase.title")}</h3>
          <div class="modal-body">
            <div class="phrase-box">${escapeHtml(phrase)}</div>
            <div class="field-hint">${i18n.t("hint.phrase.modal")}</div>
            <div class="modal-actions">
              <button id="ph-copy" class="term-btn">${i18n.t("modal.phrase.copy")}</button>
              <button id="ph-close" class="term-btn">${i18n.t("modal.phrase.close")}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const onKey = (e: KeyboardEvent): void => {
        if (e.key === "Escape") {
          cleanup();
          resolve();
        }
      };
      const cleanup = (): void => {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
      };
      const copyBtn = overlay.querySelector("#ph-copy") as HTMLElement;
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(phrase);
          copyBtn.textContent = i18n.t("modal.phrase.copied");
          setTimeout(() => { copyBtn.textContent = i18n.t("modal.phrase.copy"); }, 800);
        } catch {
          // clipboard unavailable
        }
      };
      (overlay.querySelector("#ph-close") as HTMLElement).onclick = () => { cleanup(); resolve(); };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { cleanup(); resolve(); }
      });
      document.addEventListener("keydown", onKey);
      copyBtn.focus();
    });
  }
}
