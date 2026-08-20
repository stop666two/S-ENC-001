import { i18n } from "./i18n";

export class ConfirmModal {
  static show(options: { titleKey: string; message: string; danger?: boolean }): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const okClass = options.danger ? "term-btn danger" : "term-btn";
      overlay.innerHTML = `
        <div class="modal">
          <h3>${i18n.t(options.titleKey)}</h3>
          <div class="modal-body">
            <p>${options.message}</p>
            <div class="modal-actions">
              <button id="cm-ok" class="${okClass}">${i18n.t("modal.ok")}</button>
              <button id="cm-cancel" class="term-btn">${i18n.t("modal.cancel")}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const cleanup = () => {
        overlay.remove();
      };
      (overlay.querySelector("#cm-ok") as HTMLElement).onclick = () => {
        cleanup();
        resolve(true);
      };
      (overlay.querySelector("#cm-cancel") as HTMLElement).onclick = () => {
        cleanup();
        resolve(false);
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
      (overlay.querySelector("#cm-ok") as HTMLElement).focus();
    });
  }

  static choose(options: { titleKey: string; choices: { id: string; label: string; danger?: boolean }[] }): Promise<string | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const buttons = options.choices
        .map((c, i) => `<button id="cm-choice-${i}" class="${c.danger ? "term-btn danger" : "term-btn"}">${c.label}</button>`)
        .join("");
      overlay.innerHTML = `
        <div class="modal">
          <h3>${i18n.t(options.titleKey)}</h3>
          <div class="modal-body">
            <div class="modal-actions">
              ${buttons}
              <button id="cm-cancel" class="term-btn">${i18n.t("modal.cancel")}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const cleanup = () => {
        overlay.remove();
      };
      options.choices.forEach((c, i) => {
        (overlay.querySelector("#cm-choice-" + i) as HTMLElement).onclick = () => {
          cleanup();
          resolve(c.id);
        };
      });
      (overlay.querySelector("#cm-cancel") as HTMLElement).onclick = () => {
        cleanup();
        resolve(null);
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(null);
        }
      });
      (overlay.querySelector("#cm-choice-0") as HTMLElement).focus();
    });
  }
}
