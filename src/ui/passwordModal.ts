import { i18n } from "./i18n";

export interface ModalResult {
  password: string;
  compressLevel?: number;
  mode?: "on" | "off" | "auto";
  recoveryPhrase?: string;
  keyFile?: File;
  splitSize?: number;
  textContent?: string;
}

export class PasswordModal {
  static show(options: { titleKey: string; mode: "encrypt" | "decrypt"; multi?: boolean; lockContent?: "files" | "text" }): Promise<ModalResult | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";

      const levelOptions = [1, 3, 5, 9]
        .map((n) => `<option value="${n}"${n === 3 ? " selected" : ""}>${i18n.t("modal.level.opt." + n)}</option>`)
        .join("");
      const modeOptions = ["auto", "on", "off"]
        .map((m) => `<option value="${m}"${m === "auto" ? " selected" : ""}>${i18n.t("modal.mode." + m)}</option>`)
        .join("");

      const compressRow =
        options.mode === "encrypt"
          ? `<label class="modal-field"><span>${i18n.t("modal.level")}</span><select id="pm-level" class="term-input">${levelOptions}</select></label>
          <label class="modal-field"><span>${i18n.t("modal.mode")}</span><select id="pm-mode" class="term-input">${modeOptions}</select></label>`
          : `<input type="hidden" id="pm-level" value="3" /><input type="hidden" id="pm-mode" value="auto" />`;

      const splitRow =
        options.mode === "encrypt"
          ? `<label class="modal-field"><span>${i18n.t("modal.split")}</span><input type="number" id="pm-split" class="term-input" min="0" max="4095" value="0" /></label>`
          : `<input type="hidden" id="pm-split" value="0" />`;

      const contentRow =
        options.mode === "encrypt"
          ? options.lockContent === "text"
            ? `<input type="hidden" id="pm-ctype" value="text" />
              <textarea id="pm-text" class="term-input" rows="4" placeholder="${i18n.t("modal.text.placeholder")}"></textarea>`
            : options.lockContent === "files"
              ? ""
              : `<label class="modal-field"><span>${i18n.t("modal.content")}</span>
                <div class="modal-content-type">
                  <label><input type="radio" name="pm-ctype" value="files" checked /> ${i18n.t("modal.content.files")}</label>
                  <label><input type="radio" name="pm-ctype" value="text" /> ${i18n.t("modal.content.text")}</label>
                </div>
              </label>
              <textarea id="pm-text" class="term-input" rows="4" style="display:none" placeholder="${i18n.t("modal.text.placeholder")}"></textarea>`
          : "";

      overlay.innerHTML = `
        <div class="modal">
          <h3>${i18n.t(options.titleKey)}</h3>
          <div class="modal-body">
            <label class="modal-field"><span>${i18n.t("modal.password")}</span><input type="password" id="pm-password" class="term-input" autocomplete="off" /></label>
            <label class="modal-field"><span>${i18n.t("modal.password2")}</span><input type="password" id="pm-password2" class="term-input" autocomplete="off" /></label>
            ${contentRow}
            ${compressRow}
            ${splitRow}
            <label class="modal-field"><span>${i18n.t("modal.phrase")}</span><input type="text" id="pm-phrase" class="term-input" placeholder="${i18n.t("modal.phrase.placeholder")}" /></label>
            <label class="modal-field"><span>${i18n.t("modal.keyfile")}</span><input type="file" id="pm-keyfile" class="term-input" /></label>
            <div class="modal-actions">
              <button id="pm-ok" class="term-btn">${i18n.t("modal.ok")}</button>
              <button id="pm-cancel" class="term-btn">${i18n.t("modal.cancel")}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const pw = overlay.querySelector("#pm-password") as HTMLInputElement;
      const pw2 = overlay.querySelector("#pm-password2") as HTMLInputElement;
      const phrase = overlay.querySelector("#pm-phrase") as HTMLInputElement;
      const keyFile = overlay.querySelector("#pm-keyfile") as HTMLInputElement;
      const textArea = overlay.querySelector("#pm-text") as HTMLTextAreaElement | null;

      overlay.querySelectorAll<HTMLInputElement>('input[name="pm-ctype"]').forEach((r) => {
        r.onchange = () => {
          const isText = r.value === "text" && r.checked;
          if (textArea) {
            textArea.style.display = isText ? "block" : "none";
            if (isText) textArea.focus();
          }
        };
      });

      const cleanup = () => { overlay.remove(); };
      (overlay.querySelector("#pm-cancel") as HTMLElement).onclick = () => { cleanup(); resolve(null); };
      (overlay.querySelector("#pm-ok") as HTMLElement).onclick = async () => {
        if (!pw.value) { pw.focus(); return; }
        if (pw.value !== pw2.value) { pw2.focus(); pw2.style.borderColor = "#f00"; return; }
        const ctype = overlay.querySelector('input[name="pm-ctype"]:checked') as HTMLInputElement | null;
        const lockedText = options.lockContent === "text";
        if ((lockedText || ctype?.value === "text") && (!textArea || !textArea.value.trim())) {
          textArea?.focus();
          return;
        }
        const levelEl = overlay.querySelector("#pm-level") as HTMLSelectElement;
        const modeEl = overlay.querySelector("#pm-mode") as HTMLSelectElement;
        const splitEl = overlay.querySelector("#pm-split") as HTMLInputElement;
        const result: ModalResult = {
          password: pw.value,
          compressLevel: levelEl ? Number(levelEl.value) : 3,
          mode: (modeEl?.value as "on" | "off" | "auto") ?? "auto",
          splitSize: splitEl ? Number(splitEl.value) : 0,
        };
        if ((lockedText || ctype?.value === "text") && textArea) result.textContent = textArea.value;
        if (phrase.value.trim()) result.recoveryPhrase = phrase.value.trim();
        if (keyFile.files?.[0]) result.keyFile = keyFile.files[0];
        cleanup();
        resolve(result);
      };
      overlay.addEventListener("click", (e) => { if (e.target === overlay) { cleanup(); resolve(null); } });
      pw.focus();
    });
  }
}
