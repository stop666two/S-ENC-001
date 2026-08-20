import { i18n } from "./i18n";

export class PasswordGenerator {
  private overlay: HTMLElement | null = null;

  show(): void {
    this.overlay = document.createElement("div");
    this.overlay.className = "modal-overlay";
    this.overlay.innerHTML = `
      <div class="modal">
        <h3>${i18n.t("pg.title")}</h3>
        <div class="modal-body">
          <label class="modal-field"><span>${i18n.t("pg.length")}</span><div class="pg-range-row"><input type="range" id="pg-length" min="8" max="64" value="15" /><span id="pg-length-val">15</span></div></label>
          <label class="modal-field"><span>${i18n.t("pg.upper")}</span><input type="checkbox" id="pg-upper" checked /></label>
          <label class="modal-field"><span>${i18n.t("pg.lower")}</span><input type="checkbox" id="pg-lower" checked /></label>
          <label class="modal-field"><span>${i18n.t("pg.digits")}</span><input type="checkbox" id="pg-digits" checked /></label>
          <label class="modal-field"><span>${i18n.t("pg.symbols")}</span><input type="checkbox" id="pg-symbols" /></label>
          <label class="modal-field"><span>${i18n.t("pg.exclude")}</span><input type="text" id="pg-exclude" class="term-input" value="0oOlLiI1" /></label>
          <div id="pg-result" class="password-result"></div>
          <div class="modal-actions">
            <button id="pg-generate" class="term-btn">${i18n.t("pg.generate")}</button>
            <button id="pg-use" class="term-btn">${i18n.t("pg.use")}</button>
            <button id="pg-close" class="term-btn">${i18n.t("pg.close")}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    const lengthInput = this.overlay.querySelector("#pg-length") as HTMLInputElement;
    const lengthVal = this.overlay.querySelector("#pg-length-val") as HTMLElement;
    lengthInput.oninput = () => { lengthVal.textContent = lengthInput.value; };

    (this.overlay.querySelector("#pg-generate") as HTMLElement).onclick = async () => {
      const result = this.overlay!.querySelector("#pg-result") as HTMLElement;
      try {
        const wasm = await (eval('import("/wasm/s_enc_core.js")') as Promise<typeof import("../wasm-pkg/s_enc_core.js")>);
        await wasm.default();
        const length = Number((this.overlay!.querySelector("#pg-length") as HTMLInputElement).value);
        const upper = (this.overlay!.querySelector("#pg-upper") as HTMLInputElement).checked;
        const lower = (this.overlay!.querySelector("#pg-lower") as HTMLInputElement).checked;
        const digits = (this.overlay!.querySelector("#pg-digits") as HTMLInputElement).checked;
        const symbols = (this.overlay!.querySelector("#pg-symbols") as HTMLInputElement).checked;
        const exclude = (this.overlay!.querySelector("#pg-exclude") as HTMLInputElement).value;
        result.textContent = wasm.generate_password(length, upper, lower, digits, symbols, exclude);
      } catch (err) {
        result.textContent = i18n.t("pg.error", { err: String(err) });
      }
    };

    (this.overlay.querySelector("#pg-close") as HTMLElement).onclick = () => this.close();
    (this.overlay.querySelector("#pg-use") as HTMLElement).onclick = async () => {
      const result = this.overlay!.querySelector("#pg-result") as HTMLElement;
      if (result.textContent && !result.textContent.startsWith("[")) {
        try { await navigator.clipboard.writeText(result.textContent); } catch { /* noop */ }
      }
      this.close();
    };
  }

  private close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
