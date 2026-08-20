import "./styles/terminal.css";
import { Terminal } from "./ui/terminal";
import { ThemeManager } from "./ui/theme";
import { i18n } from "./ui/i18n";
import { DragDrop } from "./ui/dragDrop";
import { ProgressBar } from "./ui/progress";
import { PasswordGenerator } from "./ui/passwordGen";
import { PasswordModal } from "./ui/passwordModal";
import { ModeChoice } from "./ui/modeChoice";
import { ConfirmModal } from "./ui/confirmModal";
import { ResultModal, DecryptResultItem } from "./ui/resultModal";
import { MainWorker, WorkerEvent } from "./worker/mainWorker";
import { triggerDownload } from "./core/download";
import { ClipboardManager } from "./core/clipboard";
import { SizeEstimator } from "./core/estimate";
import type * as WasmTypes from "./wasm-pkg/s_enc_core.js";

// Single-pass base64 -> bytes (avoids Uint8Array.from iterator + duplicate atob)
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Dynamic wasm loader from public dir
async function loadWasm(): Promise<typeof WasmTypes> {
  const mod = await (import(/* @vite-ignore */ "/wasm/s_enc_core.js") as Promise<typeof WasmTypes>);
  await mod.default();
  return mod;
}

class App {
  private terminal: Terminal;
  private theme: ThemeManager;
  private i18n = i18n;
  private progress: ProgressBar;
  private passwordGen: PasswordGenerator;
  private worker: MainWorker;
  private clipboard: ClipboardManager;
  private estimator: SizeEstimator;
  private busy = false;
  private lastEncryptedName = "";
  private _lastOp: "encrypt" | "decrypt" | null = null;
  private _lastDecryptMetadata: Record<string, unknown> | null = null;
  private _pendingSplitSize = 0;

  constructor() {
    const appEl = document.getElementById("app")!;
    appEl.innerHTML = this.buildLayout();

    this.terminal = new Terminal(document.getElementById("terminal-output")!);
    this.theme = new ThemeManager();
    this.i18n.load();
    this.progress = new ProgressBar(document.getElementById("progress-area")!);
    this.passwordGen = new PasswordGenerator();
    this.worker = new MainWorker();
    this.clipboard = new ClipboardManager();
    this.estimator = new SizeEstimator();

    void this.worker.init();
    this.worker.onMessage((e) => this.handleWorkerEvent(e));

    this.i18n.apply();

    this.log(this.i18n.t("log.init"));
    this.log(this.i18n.t("log.ready"));
    this.log(this.i18n.t("log.drag"));

    new DragDrop((files) => { void this.handleDrop(files); });
    this.bindEvents();
  }

  private buildLayout(): string {
    return [
      '<div id="header">'
      ,'  <span id="title" data-i18n="app.title">[S-ENC-001 SECURE TERMINAL]</span>'
      ,'  <div id="header-controls">'
      ,'    <button id="btn-lang" class="term-btn" data-i18n="btn.lang">EN</button>'
      ,'    <button id="btn-theme" class="term-btn" data-i18n="btn.theme">[theme]</button>'
      ,'  </div>'
      ,'</div>'
      ,'<div id="main-area">'
      ,'  <div id="sidebar">'
      ,'    <button id="btn-encrypt" class="term-btn" data-i18n="btn.encrypt">[encrypt]</button>'
      ,'    <button id="btn-decrypt" class="term-btn" data-i18n="btn.decrypt">[decrypt]</button>'
      ,'    <button id="btn-password" class="term-btn" data-i18n="btn.password">[password]</button>'
      ,'    <button id="btn-phrase" class="term-btn" data-i18n="btn.phrase">[phrase]</button>'
      ,'    <button id="btn-clear" class="term-btn danger" data-i18n="btn.clear">[clear]</button>'
      ,'  </div>'
      ,'  <div id="content">'
      ,'    <div id="terminal-output"></div>'
      ,'    <div id="progress-area"></div>'
      ,'  </div>'
      ,'</div>'
      ,'<div id="status-bar">'
      ,'  <span id="status-text" data-i18n="status.ready">STATUS: READY</span>'
      ,'  <span data-i18n="status.offline">MODE: OFFLINE</span>'
      ,'</div>'
    ].join("");
  }

  private log(line: string): void {
    this.terminal.log(line);
  }

  private setBusy(b: boolean): void {
    this.busy = b;
    const status = document.getElementById("status-text")!;
    status.textContent = this.i18n.t(b ? "status.busy" : "status.ready");
  }

  private handleWorkerEvent(e: WorkerEvent): void {
    if (e.type === "progress") {
      this.progress.show(e.current, e.total);
    } else if (e.type === "error") {
      // Security: wrong password / corruption - fully silent 10s delay before the
      // error message (prevents timing attacks; matches design doc section 3.5).
      // No progress/log/UI change leaks the failure during the delay.
      if (this._lastOp === "decrypt") {
        setTimeout(() => {
          this.log(this.i18n.t("error.wrong.password"));
        }, 10000);
      } else {
        this.log(this.i18n.t("log.error.generic", { err: e.message }));
      }
      this.progress.clear();
      this.setBusy(false);
    } else if (e.type === "done") {
      if (this._lastOp === "decrypt") this._lastDecryptMetadata = e.metadata ?? null;
      this.progress.clear();
      this.setBusy(false);
      const kind = (e.metadata as Record<string, unknown>)?.kind as string;
      if (kind === "encrypt") {
        this.onEncryptDone(e.data);
      } else if (kind === "decrypt") {
        void this.onDecryptDone(e.data, (e.metadata as Record<string, unknown>)?.headerJson as string);
      }
    }
  }

  private async onEncryptDone(data: ArrayBuffer): Promise<void> {
    const outName = this.lastEncryptedName || "secret.enc";
    const splitMB = this._pendingSplitSize;
    this._pendingSplitSize = 0;

    if (splitMB > 0 && data.byteLength > splitMB * 1024 * 1024) {
      try {
        const wasm = await loadWasm();
        const chunkSize = BigInt(Math.round(splitMB * 1024 * 1024));
        const chunks = wasm.split_file(new Uint8Array(data), chunkSize);
        const base = outName.replace(/\.enc$/, "");
        this.log(this.i18n.t("log.split.parts", { count: chunks.length, mb: splitMB }));
        const pad = String(chunks.length).length;
        for (let i = 0; i < chunks.length; i++) {
          const partName = `${base}.part${String(i + 1).padStart(pad, "0")}`;
          const bytes = chunks[i] as Uint8Array;
          setTimeout(() => triggerDownload(bytes.buffer as ArrayBuffer, partName), 300 * i);
        }
        this.log(this.i18n.t("log.split.done", { count: chunks.length, size: (data.byteLength / 1024).toFixed(1) }));
        this.log(this.i18n.t("log.split.hint"));
      } catch (err) {
        this.log(this.i18n.t("log.split.fail", { err: String(err) }));
        triggerDownload(data, outName);
      }
    } else {
      triggerDownload(data, outName);
      this.log(this.i18n.t("log.generated", { name: outName, size: (data.byteLength / 1024).toFixed(1) }));
    }
    this.log(this.i18n.t("log.encrypt.hint"));
    void this.clipboard.clearClipboard();
  }

  private async onDecryptDone(data: ArrayBuffer, headerJson: string): Promise<void> {
    try {
      const header = JSON.parse(headerJson) as Record<string, unknown>;
      const originalName = (header.originalFilename as string) ?? "decrypted";
      const multiFile = header.multiFile as boolean;
      const items: DecryptResultItem[] = [];
      if (multiFile) {
        const meta = this._lastDecryptMetadata as Record<string, unknown> | undefined;
        const filesJson = meta?.filesJson as string | undefined;
        if (filesJson) {
          try {
            const entries = JSON.parse(filesJson) as { name: string; data_b64: string }[];
            this.log(this.i18n.t("log.multifile", { count: entries.length }));
            for (const f of entries) {
              const bytes = base64ToBytes(f.data_b64);
              items.push(ResultModal.detect(f.name, bytes.buffer as ArrayBuffer));
            }
          } catch (err) {
            this.log(this.i18n.t("log.unpack.fail", { err: String(err) }));
            items.push(ResultModal.detect("decrypted.tar", data));
          }
        } else {
          items.push(ResultModal.detect("decrypted.tar", data));
        }
      } else {
        items.push(ResultModal.detect(originalName, data));
        this.log(this.i18n.t("log.restored", { name: originalName, size: (data.byteLength / 1024).toFixed(1) }));
      }
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
      const shaHex = this.bytesToHex(digest);
      this.log(this.i18n.t("log.sha", { hash: shaHex }));
      const selected = await ResultModal.show(items);
      this._lastDecryptMetadata = null;
      if (!selected) return;
      for (let i = 0; i < selected.length; i++) {
        const item = items[selected[i]];
        setTimeout(() => triggerDownload(item.data, item.name), 200 * i);
      }
      this.log(this.i18n.t("log.files.downloaded", { count: selected.length }));
    } catch (err) {
      this.log(this.i18n.t("log.decrypt.fail", { err: String(err) }));
    }
  }

  private bytesToHex(bytes: Uint8Array): string {
    let out = "";
    for (const b of bytes) out += b.toString(16).padStart(2, "0");
    return out;
  }

  private bindEvents(): void {
    document.getElementById("btn-encrypt")!.onclick = () => void this.askEncrypt();
    document.getElementById("btn-decrypt")!.onclick = () => void this.askDecrypt();
    document.getElementById("btn-password")!.onclick = () => this.passwordGen.show();
    document.getElementById("btn-phrase")!.onclick = () => void this.askPhrase();
    document.getElementById("btn-clear")!.onclick = () => void this.cmdClear();
    document.getElementById("btn-lang")!.onclick = () => {
      this.i18n.toggle();
    };
    document.getElementById("btn-theme")!.onclick = () => this.theme.toggle();
  }

  private async handleDrop(files: File[]): Promise<void> {
    this.log(this.i18n.t("log.received", { count: files.length }));
    for (const f of files) this.log(this.i18n.t("log.select", { name: f.name, size: (f.size / 1024).toFixed(1) }));
    if (this.busy) return;
    await this.runEncrypt(files, "files");
  }

  private async askEncrypt(): Promise<void> {
    const choice = await ModeChoice.show();
    if (!choice) { this.log(this.i18n.t("log.cancelled")); return; }
    if (choice === "text") {
      await this.runEncrypt([], "text");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      for (const f of files) this.log(this.i18n.t("log.select", { name: f.name, size: (f.size / 1024).toFixed(1) }));
      await this.runEncrypt(files, "files");
    };
    input.click();
  }

  private async runEncrypt(files: File[], lockContent?: "files" | "text"): Promise<void> {
    const opts = await PasswordModal.show({ titleKey: "modal.encrypt.title", mode: "encrypt", lockContent });
    if (!opts) { this.log(this.i18n.t("log.cancelled")); return; }

    this.setBusy(true);
    try {
      // Optional key file hash (SHA-256 of key file content via crypto.subtle - non-algorithmic helper)
      let keyFileHash: Uint8Array | undefined;
      if (opts.keyFile) {
        const buf = await opts.keyFile.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buf);
        keyFileHash = new Uint8Array(digest);
        this.log(this.i18n.t("log.keyfile.loaded"));
      }

      // Multi-file: pack into tar via WASM first
      let payload: ArrayBuffer;
      let filename: string;
      let fileListJson: string | undefined;

      if (opts.textContent !== undefined) {
        const enc = new TextEncoder();
        payload = enc.encode(opts.textContent).buffer as ArrayBuffer;
        filename = "text.enc";
        this.log(this.i18n.t("log.text.encrypt", { count: opts.textContent.length }));
      } else if (files.length === 1) {
        payload = await files[0].arrayBuffer();
        filename = files[0].name;
        this.log(this.i18n.t("log.encrypting", { name: files[0].name, size: (files[0].size / 1024).toFixed(1) }));
      } else {
        this.log(this.i18n.t("log.packing", { count: files.length }));
        const entries: { name: string; data_b64: string }[] = [];
        for (const f of files) {
          const buf = new Uint8Array(await f.arrayBuffer());
          const chunks: string[] = [];
          const step = 0x8000;
          for (let i = 0; i < buf.length; i += step) {
            chunks.push(String.fromCharCode(...buf.subarray(i, i + step)));
          }
          entries.push({ name: f.name, data_b64: btoa(chunks.join("")) });
        }
        // Use wasm pack_tar via a direct import (dynamic)
        const wasm = await loadWasm();
        const tarBytes = wasm.pack_tar(JSON.stringify(entries));
        payload = tarBytes.buffer as ArrayBuffer;
        filename = "archive.tar";
        fileListJson = JSON.stringify(files.map((f) => ({ name: f.name, size: f.size, sha256: "" })));
        this.log(this.i18n.t("log.tar.done", { size: (payload.byteLength / 1024).toFixed(1) }));
      }

      const est = await this.estimator.estimate(payload.byteLength, opts.compressLevel ?? 3, opts.mode ?? "auto", filename);
      this.log(this.i18n.t("log.estimate", { size: this.estimator.formatSize(est) }));

      this.lastEncryptedName = (opts.textContent !== undefined ? "text" : (files.length === 1 ? files[0].name : "archive")) + ".enc";
      this._pendingSplitSize = opts.splitSize ?? 0;
      const options: Record<string, unknown> = {
        compressLevel: opts.compressLevel ?? 3,
        mode: opts.mode ?? "auto",
        filename,
        keyFileHash,
        recoveryPhrase: opts.recoveryPhrase,
        fileListJson,
      };
      this._lastOp = "encrypt";
      this.worker.postMessage({ type: "encrypt", data: payload, password: opts.password, options });
    } catch (err) {
      this.log(this.i18n.t("log.encrypt.fail", { err: String(err) }));
      this.setBusy(false);
    }
  }

  private async askDecrypt(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".enc,.part";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      for (const f of files) this.log(this.i18n.t("log.select", { name: f.name, size: (f.size / 1024).toFixed(1) }));
      const opts = await PasswordModal.show({ titleKey: "modal.decrypt.title", mode: "decrypt" });
      if (!opts) { this.log(this.i18n.t("log.cancelled")); return; }

      this.setBusy(true);
      try {
        // Merge .part files if multiple selected
        let data: ArrayBuffer;
        if (files.length > 1 && files.every((f) => /\.part\d+$/.test(f.name))) {
          this.log(this.i18n.t("log.merge", { count: files.length }));
          const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
          const parts = await Promise.all(sorted.map((f) => f.arrayBuffer()));
          const total = parts.reduce((s, p) => s + p.byteLength, 0);
          const merged = new Uint8Array(total);
          let off = 0;
          for (const p of parts) {
            merged.set(new Uint8Array(p), off);
            off += p.byteLength;
          }
          data = merged.buffer as ArrayBuffer;
          this.log(this.i18n.t("log.merged"));
        } else {
          data = await files[0].arrayBuffer();
        }
        this.log(this.i18n.t("log.decrypting"));
        let keyFileHash: Uint8Array | undefined;
        if (opts.keyFile) {
          const buf = await opts.keyFile.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", buf);
          keyFileHash = new Uint8Array(digest);
          this.log(this.i18n.t("log.keyfile.loaded"));
        }
        const options: Record<string, unknown> = {
          keyFileHash,
          recoveryPhrase: opts.recoveryPhrase,
        };
        this._lastOp = "decrypt";
        this.worker.postMessage({ type: "decrypt", data, password: opts.password, options });
      } catch (err) {
        this.log(this.i18n.t("log.decrypt.fail", { err: String(err) }));
        this.setBusy(false);
      }
    };
    input.click();
  }

  private async askPhrase(): Promise<void> {
    const choice = await ConfirmModal.choose({
      titleKey: "modal.phrasechoice.title",
      choices: [
        { id: "24", label: this.i18n.t("modal.phrasechoice.24") },
        { id: "12", label: this.i18n.t("modal.phrasechoice.12") },
      ],
    });
    if (!choice) { this.log(this.i18n.t("log.cancelled")); return; }
    const count = choice === "24" ? 24 : 12;
    this.log(this.i18n.t("log.phrase.gen", { count }));
    try {
      const wasm = await loadWasm();
      const phrase = wasm.generate_recovery_phrase(count);
      this.log(this.i18n.t("log.phrase.value", { phrase }));
      this.log(this.i18n.t("log.phrase.warn"));
      await this.clipboard.copy(phrase);
      this.log(this.i18n.t("log.copied"));
    } catch (err) {
      this.log(this.i18n.t("log.phrase.fail", { err: String(err) }));
    }
  }
  
  private async cmdClear(): Promise<void> {
    const ok = await ConfirmModal.show({ titleKey: "confirm.clear.title", message: this.i18n.t("confirm.clear"), danger: true });
    if (ok) {
      this.terminal.clear();
      this.log(this.i18n.t("log.cleared"));
      void this.clipboard.clearClipboard();
    }
  }
}

new App();

// PWA: register service worker (https or localhost only)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration is optional; works on https/localhost
    });
  });
}