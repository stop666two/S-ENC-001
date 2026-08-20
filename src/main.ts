import "./styles/terminal.css";
import { Terminal } from "./ui/terminal";
import { ThemeManager } from "./ui/theme";
import { i18n } from "./ui/i18n";
import { DragDrop } from "./ui/dragDrop";
import { ProgressBar } from "./ui/progress";
import { PasswordGenerator } from "./ui/passwordGen";
import { PasswordModal } from "./ui/passwordModal";
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
  private _lastOp: "encrypt" | "decrypt" | "hash" | "hmac" | null = null;
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
      ,'    <button id="btn-hash" class="term-btn" data-i18n="btn.hash">[hash]</button>'
      ,'    <button id="btn-hmac" class="term-btn" data-i18n="btn.hmac">[HMAC]</button>'
      ,'    <button id="btn-password" class="term-btn" data-i18n="btn.password">[password]</button>'
      ,'    <button id="btn-phrase" class="term-btn" data-i18n="btn.phrase">[phrase]</button>'
      ,'    <button id="btn-batch" class="term-btn" data-i18n="btn.batch">[batch]</button>'
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
      // Security: wrong password / corruption - silent 10s delay before any output
      // (prevents timing attacks; matches design doc section 3.5)
      const isDecryptError = this._lastOp === "decrypt";
      if (isDecryptError) {
        this.log(this.i18n.t("log.verifying"));
        const input = document.querySelector("#pm-password") as HTMLInputElement | null;
        if (input) input.disabled = true;
        setTimeout(() => {
          this.log(this.i18n.t("error.wrong.password"));
          if (input) input.disabled = false;
          this.progress.clear();
          this.setBusy(false);
        }, 10000);
      } else {
        this.log(this.i18n.t("log.error.generic", { err: e.message }));
        this.progress.clear();
        this.setBusy(false);
      }
    } else if (e.type === "done") {
      if (this._lastOp === "decrypt") this._lastDecryptMetadata = e.metadata ?? null;
      this.progress.clear();
      this.setBusy(false);
      const kind = (e.metadata as Record<string, unknown>)?.kind as string;
      if (kind === "encrypt") {
        this.onEncryptDone(e.data);
      } else if (kind === "decrypt") {
        this.onDecryptDone(e.data, (e.metadata as Record<string, unknown>)?.headerJson as string);
      } else if (kind === "hash") {
        this.onHashDone(e.data, (e.metadata as Record<string, unknown>)?.algorithm as string);
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

  private onDecryptDone(data: ArrayBuffer, headerJson: string): void {
    try {
      const header = JSON.parse(headerJson) as Record<string, unknown>;
      const originalName = (header.originalFilename as string) ?? "decrypted";
      const multiFile = header.multiFile as boolean;
      if (multiFile) {
        const files = (header.files as { name: string }[]) ?? [];
        this.log(this.i18n.t("log.multifile", { count: files.length }));
        const meta = this._lastDecryptMetadata as Record<string, unknown> | undefined;
        const filesJson = meta?.filesJson as string | undefined;
        if (filesJson) {
          try {
            const entries = JSON.parse(filesJson) as { name: string; data_b64: string }[];
            this.log(this.i18n.t("log.filelist"));
            // Trigger individual downloads (no ZIP per design doc)
            for (let i = 0; i < entries.length; i++) {
              const f = entries[i];
              const bytes = base64ToBytes(f.data_b64);
              this.log(this.i18n.t("log.file.entry", { i: i + 1, name: f.name, size: Math.round(bytes.length / 1024) }));
              setTimeout(() => triggerDownload(bytes.buffer as ArrayBuffer, f.name), 200 * i);
            }
            this.log(this.i18n.t("log.files.downloaded", { count: entries.length }));
          } catch (err) {
            this.log(this.i18n.t("log.unpack.fail", { err: String(err) }));
            triggerDownload(data, "decrypted.tar");
          }
        } else {
          triggerDownload(data, "decrypted.tar");
        }
      } else {
        triggerDownload(data, originalName);
        this.log(this.i18n.t("log.restored", { name: originalName, size: (data.byteLength / 1024).toFixed(1) }));
      }
      const shaHex = this.bytesToHex(new Uint8Array(data));
      this.log(this.i18n.t("log.sha", { hash: shaHex }));
    } catch (err) {
      this.log(this.i18n.t("log.decrypt.fail", { err: String(err) }));
    }
  }

  private onHashDone(data: ArrayBuffer, algorithm: string): void {
    const hex = this.bytesToHex(new Uint8Array(data));
    this.log(`> ${algorithm.toUpperCase()}: ${hex}`);
    void this.clipboard.copy(hex);
    this.log(this.i18n.t("log.hash.copy"));
    // Expected hash comparison
    const expected = window.prompt(this.i18n.t("prompt.hash.compare"), "");
    if (expected && expected.trim()) {
      const clean = expected.trim().toLowerCase();
      if (clean === hex.toLowerCase()) {
        this.log(this.i18n.t("log.match"));
      } else {
        this.log(this.i18n.t("log.mismatch"));
      }
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
    document.getElementById("btn-hash")!.onclick = () => void this.askHash();
    document.getElementById("btn-hmac")!.onclick = () => void this.askHmac();
    document.getElementById("btn-password")!.onclick = () => this.passwordGen.show();
    document.getElementById("btn-phrase")!.onclick = () => void this.askPhrase();
    document.getElementById("btn-batch")!.onclick = () => void this.askBatch();
    document.getElementById("btn-clear")!.onclick = () => this.cmdClear();
    document.getElementById("btn-lang")!.onclick = () => {
      this.i18n.toggle();
    };
    document.getElementById("btn-theme")!.onclick = () => this.theme.toggle();
  }

  private async handleDrop(files: File[]): Promise<void> {
    this.log(this.i18n.t("log.received", { count: files.length }));
    for (const f of files) this.log(this.i18n.t("log.select", { name: f.name, size: (f.size / 1024).toFixed(1) }));
    if (this.busy) return;
    await this.runEncrypt(files);
  }

  private async askEncrypt(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      for (const f of files) this.log(this.i18n.t("log.select", { name: f.name, size: (f.size / 1024).toFixed(1) }));
      await this.runEncrypt(files);
    };
    input.click();
  }

  private async runEncrypt(files: File[]): Promise<void> {
    const opts = await PasswordModal.show({ titleKey: "modal.encrypt.title", mode: "encrypt" });
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
        filename = "text.txt";
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

  private askHash(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const algo = window.prompt(this.i18n.t("prompt.hash.algorithm"), "sha256") === "sha512" ? "sha512" : "sha256";
      this.log(this.i18n.t("log.hash.compute", { algo: algo.toUpperCase(), name: file.name }));
      this.setBusy(true);
      const buf = await file.arrayBuffer();
      this._lastOp = "hash";
      this.worker.postMessage({ type: "hash", data: buf, algorithm: algo });
    };
    input.click();
  }

  private async askHmac(): Promise<void> {
    const key = prompt(this.i18n.t("prompt.hmac.key"));
    if (!key) return;
    const data = prompt(this.i18n.t("prompt.hmac.data"));
    if (!data) return;
    this.log(this.i18n.t("log.hmac.compute"));
    this.setBusy(true);
    try {
      const wasm = await loadWasm();
      const enc = new TextEncoder();
      const result = wasm.hmac_sha256(enc.encode(key), enc.encode(data));
      const hex = this.bytesToHex(result);
      this.log(`> HMAC-SHA256: ${hex}`);
      await this.clipboard.copy(hex);
      this.log(this.i18n.t("log.hmac.copy"));
      this.setBusy(false);
    } catch (err) {
      this.log(this.i18n.t("log.hmac.fail", { err: String(err) }));
      this.setBusy(false);
    }
  }

  private async askBatch(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      this.log(this.i18n.t("log.batch.task", { count: files.length }));
      const opts = await PasswordModal.show({ titleKey: "modal.batch.title", mode: "encrypt" });
      if (!opts) { this.log(this.i18n.t("log.cancelled")); return; }
      this.setBusy(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const buf = await f.arrayBuffer();
          this.log(this.i18n.t("log.batch.encrypt", { i: i + 1, total: files.length, name: f.name }));
          this.lastEncryptedName = f.name + ".enc";
          this._pendingSplitSize = opts.splitSize ?? 0;
          this._lastOp = "encrypt";
          this.worker.postMessage({
            type: "encrypt",
            data: buf,
            password: opts.password,
            options: {
              compressLevel: opts.compressLevel ?? 3,
              mode: opts.mode ?? "auto",
              filename: f.name,
              recoveryPhrase: opts.recoveryPhrase,
            } as Record<string, unknown>,
          });
          // Wait a bit between tasks so downloads don't collide
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch (err) {
        this.log(this.i18n.t("log.batch.fail", { err: String(err) }));
        this.setBusy(false);
      }
    };
    input.click();
  }
  
  private async askPhrase(): Promise<void> {
    const count = window.confirm(this.i18n.t("prompt.phrase.confirm")) ? 24 : 12;
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
  
  private cmdClear(): void {
    if (confirm(this.i18n.t("confirm.clear"))) {
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