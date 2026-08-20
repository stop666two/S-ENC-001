export interface ModalResult {
  password: string;
  compressLevel?: number;
  mode?: "on" | "off" | "auto";
  recoveryPhrase?: string;
  keyFile?: File;
  splitSize?: number;
}

export class PasswordModal {
  static show(options: { title: string; mode: "encrypt" | "decrypt"; multi?: boolean }): Promise<ModalResult | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";

      const multiRow = options.mode === "encrypt" && options.multi
        ? `<label>压缩级别: <select id="pm-level" class="term-input"><option value="1">1 (最快)</option><option value="3" selected>3 (默认)</option><option value="5">5</option><option value="9">9 (最小)</option></select></label>
          <label>压缩模式: <select id="pm-mode" class="term-input"><option value="auto" selected>自动</option><option value="on">开启</option><option value="off">关闭</option></select></label>`
        : `<input type="hidden" id="pm-level" value="3" /><input type="hidden" id="pm-mode" value="auto" />`;

      overlay.innerHTML = `
        <div class="modal">
          <h3>${options.title}</h3>
          <div class="modal-body">
            <label>密码: <input type="password" id="pm-password" class="term-input" autocomplete="off" /></label>
            <label>确认密码: <input type="password" id="pm-password2" class="term-input" autocomplete="off" /></label>
            <label>恢复短语 (可选): <input type="text" id="pm-phrase" class="term-input" placeholder="BIP39 短语作为第二因素" /></label>
            <label>密钥文件 (可选): <input type="file" id="pm-keyfile" class="term-input" /></label>
            ${multiRow}
            <div class="modal-actions">
              <button id="pm-ok" class="term-btn">[确认]</button>
              <button id="pm-cancel" class="term-btn">[取消]</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const pw = overlay.querySelector("#pm-password") as HTMLInputElement;
      const pw2 = overlay.querySelector("#pm-password2") as HTMLInputElement;
      const phrase = overlay.querySelector("#pm-phrase") as HTMLInputElement;
      const keyFile = overlay.querySelector("#pm-keyfile") as HTMLInputElement;

      const cleanup = () => { overlay.remove(); };
      (overlay.querySelector("#pm-cancel") as HTMLElement).onclick = () => { cleanup(); resolve(null); };
      (overlay.querySelector("#pm-ok") as HTMLElement).onclick = async () => {
        if (!pw.value) { pw.focus(); return; }
        if (pw.value !== pw2.value) { pw2.focus(); pw2.style.borderColor = "#f00"; return; }
        const levelEl = overlay.querySelector("#pm-level") as HTMLSelectElement;
        const modeEl = overlay.querySelector("#pm-mode") as HTMLSelectElement;
        const result: ModalResult = {
          password: pw.value,
          compressLevel: levelEl ? Number(levelEl.value) : 3,
          mode: (modeEl?.value as "on" | "off" | "auto") ?? "auto",
        };
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