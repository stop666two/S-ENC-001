import { i18n } from "./i18n";
import { setModalAria, trapFocus } from "./modalFocus";

export class ModeChoice {
  static show(): Promise<"files" | "text" | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <h3>${i18n.t("modal.modechoice.title")}</h3>
          <div class="modal-body">
            <div class="modal-actions">
              <button id="mc-files" class="term-btn">${i18n.t("modal.modechoice.files")}</button>
              <button id="mc-text" class="term-btn">${i18n.t("modal.modechoice.text")}</button>
              <button id="mc-cancel" class="term-btn">${i18n.t("modal.cancel")}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      setModalAria(overlay, "mc-title");
      trapFocus(overlay);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        }
      };
      const cleanup = () => {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
      };
      (overlay.querySelector("#mc-files") as HTMLElement).onclick = () => {
        cleanup();
        resolve("files");
      };
      (overlay.querySelector("#mc-text") as HTMLElement).onclick = () => {
        cleanup();
        resolve("text");
      };
      (overlay.querySelector("#mc-cancel") as HTMLElement).onclick = () => {
        cleanup();
        resolve(null);
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(null);
        }
      });
      document.addEventListener("keydown", onKey);
      (overlay.querySelector("#mc-files") as HTMLElement).focus();
    });
  }
}
