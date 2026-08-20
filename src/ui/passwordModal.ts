import { i18n } from "./i18n";
import { PasswordGenerator } from "./passwordGen";
import { setModalAria, trapFocus } from "./modalFocus";

export interface ModalResult {
  password: string;
  compressLevel?: number;
  mode?: "on" | "off" | "auto";
  recoveryPhrase?: string;
  keyFile?: File;
  splitSize?: number;
  textContent?: string;
}

const LS_LEVEL = "s-enc-level";
const LS_MODE = "s-enc-mode";
const LS_SPLIT = "s-enc-split";

function strengthInfo(pw: string): { bits: number; key: string; cls: string } | null {
  if (!pw) return null;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length * (pool > 0 ? Math.log2(pool) : 0);
  if (bits >= 60) return { bits, key: "modal.strength.strong", cls: "pw-strong" };
  if (bits >= 40) return { bits, key: "modal.strength.medium", cls: "pw-medium" };
  return { bits, key: "modal.strength.weak", cls: "pw-weak" };
}

export class PasswordModal {
  static show(options: { titleKey: string; mode: "encrypt" | "decrypt"; multi?: boolean; lockContent?: "files" | "text" }): Promise<ModalResult | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const encrypt = options.mode === "encrypt";

      const savedLevel = Number(localStorage.getItem(LS_LEVEL)) || 5;
      const savedMode = localStorage.getItem(LS_MODE) ?? "auto";
      const savedSplit = Number(localStorage.getItem(LS_SPLIT)) || 0;

      const levelOptions = [1, 3, 5, 9, 19]
        .map((n) => `<option value="${n}"${n === savedLevel ? " selected" : ""}>${i18n.t("modal.level.opt." + n)}</option>`)
        .join("");
      const modeOptions = ["auto", "on", "off"]
        .map((m) => `<option value="${m}"${m === savedMode ? " selected" : ""}>${i18n.t("modal.mode." + m)}</option>`)
        .join("");

      const compressRow =
        encrypt
          ? `<label class="modal-field"><span>${i18n.t("modal.level")}</span><select id="pm-level" class="term-input">${levelOptions}</select><div class="field-hint">${i18n.t("hint.level")}</div></label>
          <label class="modal-field"><span>${i18n.t("modal.mode")}</span><select id="pm-mode" class="term-input">${modeOptions}</select><div class="field-hint">${i18n.t("hint.mode")}</div></label>`
          : `<input type="hidden" id="pm-level" value="3" /><input type="hidden" id="pm-mode" value="auto" />`;

      const splitRow =
        encrypt
          ? `<label class="modal-field"><span>${i18n.t("modal.split")}</span><input type="number" id="pm-split" class="term-input" min="0" max="4095" value="${savedSplit}" /><div class="field-hint">${i18n.t("hint.split")}</div></label>`
          : `<input type="hidden" id="pm-split" value="0" />`;

      const contentRow =
        encrypt
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

      const genSuffix = (genId: string | undefined): string =>
        genId ? `<button type="button" id="${genId}" class="term-btn pw-toggle">${i18n.t("pg.generate")}</button>` : "";

      const pwField = (id: string, labelKey: string, eyeId: string, hintKey: string, genId?: string): string => `
        <label class="modal-field"><span>${i18n.t(labelKey)}</span><div class="pw-row"><input type="password" id="${id}" class="term-input" autocomplete="off" /><button type="button" id="${eyeId}" class="term-btn pw-toggle">${i18n.t("modal.show")}</button>${genSuffix(genId)}</div><div class="field-hint">${i18n.t(hintKey)}</div></label>`;

      overlay.innerHTML = `
        <div class="modal">
          <h3>${i18n.t(options.titleKey)}</h3>
          <div class="modal-body">
            <form id="pm-form">
              ${pwField("pm-password", "modal.password", "pm-eye", "hint.password", encrypt ? "pm-gen" : undefined)}
              ${encrypt ? pwField("pm-password2", "modal.password2", "pm-eye2", "hint.password2") + `<div id="pm-strength" class="pw-strength"></div>` : ""}
              ${contentRow}
              ${compressRow}
              ${splitRow}
              <label class="modal-field"><span>${i18n.t("modal.phrase")}</span><input type="text" id="pm-phrase" class="term-input" placeholder="${i18n.t("modal.phrase.placeholder")}" /><div class="field-hint">${i18n.t("hint.phrase")}</div></label>
              <label class="modal-field"><span>${i18n.t("modal.keyfile")}</span><input type="file" id="pm-keyfile" class="term-input" /><div class="field-hint">${i18n.t("hint.keyfile")}</div></label>
              <div class="modal-actions">
                <button id="pm-ok" type="submit" class="term-btn">${i18n.t("modal.ok")}</button>
                <button id="pm-cancel" type="button" class="term-btn">${i18n.t("modal.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      setModalAria(overlay, "pm-title");
      trapFocus(overlay);

      const pw = overlay.querySelector("#pm-password") as HTMLInputElement;
      const pw2 = overlay.querySelector("#pm-password2") as HTMLInputElement | null;
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

      const eyeFor = (input: HTMLInputElement, eyeId: string): void => {
        const eye = overlay.querySelector("#" + eyeId) as HTMLElement;
        if (!eye) return;
        eye.onclick = () => {
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          eye.textContent = i18n.t(show ? "modal.hide" : "modal.show");
        };
      };
      eyeFor(pw, "pm-eye");
      if (pw2) eyeFor(pw2, "pm-eye2");

      const genBtn = overlay.querySelector("#pm-gen") as HTMLElement | null;
      if (genBtn) {
        genBtn.onclick = () => {
          new PasswordGenerator().show((p) => {
            pw.value = p;
            if (pw2) pw2.value = p;
          });
        };
      }

      const strength = overlay.querySelector("#pm-strength") as HTMLElement | null;
      if (strength) {
        pw.oninput = () => {
          const info = strengthInfo(pw.value);
          if (!info) {
            strength.textContent = "";
            strength.className = "pw-strength";
            return;
          }
          strength.textContent = `${i18n.t(info.key)} (${Math.round(info.bits)} bits)`;
          strength.className = "pw-strength " + info.cls;
        };
      } else {
        pw.oninput = () => {
          if (pw2 && pw2.style.borderColor === "rgb(255, 0, 0)") pw2.style.borderColor = "";
        };
      }
      if (pw2) {
        pw2.oninput = () => {
          if (pw2.style.borderColor) pw2.style.borderColor = "";
        };
      }

      const onKey = (e: KeyboardEvent): void => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        }
      };
      const cleanup = (): void => {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
      };
      document.addEventListener("keydown", onKey);
      (overlay.querySelector("#pm-cancel") as HTMLElement).onclick = () => { cleanup(); resolve(null); };
      (overlay.querySelector("#pm-form") as HTMLFormElement).onsubmit = (e) => {
        e.preventDefault();
        if (!pw.value) { pw.focus(); return; }
        if (pw2 && pw.value !== pw2.value) {
          pw2.focus();
          pw2.style.borderColor = "#f00";
          return;
        }
        const ctype = overlay.querySelector('input[name="pm-ctype"]:checked') as HTMLInputElement | null;
        const lockedText = options.lockContent === "text";
        if ((lockedText || ctype?.value === "text") && (!textArea || !textArea.value.trim())) {
          textArea?.focus();
          return;
        }
        const levelEl = overlay.querySelector("#pm-level") as HTMLSelectElement;
        const modeEl = overlay.querySelector("#pm-mode") as HTMLSelectElement;
        const splitEl = overlay.querySelector("#pm-split") as HTMLInputElement;
        if (encrypt && levelEl && modeEl && splitEl) {
          localStorage.setItem(LS_LEVEL, levelEl.value);
          localStorage.setItem(LS_MODE, modeEl.value);
          localStorage.setItem(LS_SPLIT, splitEl.value);
        }
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
