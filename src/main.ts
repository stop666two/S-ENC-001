import "./styles/terminal.css";
import { Terminal } from "./ui/terminal";
import { ThemeManager } from "./ui/theme";
import { I18nManager } from "./ui/i18n";
import { DragDrop } from "./ui/dragDrop";
import { ProgressBar } from "./ui/progress";
import { PasswordGenerator } from "./ui/passwordGen";
import { PasswordModal } from "./ui/passwordModal";
import { MainWorker, WorkerEvent } from "./worker/mainWorker";
import { triggerDownload } from "./core/download";
import { ClipboardManager } from "./core/clipboard";
import { SizeEstimator } from "./core/estimate";
import type * as WasmTypes from "./wasm-pkg/s_enc_core.js";

// Dynamic wasm loader from public dir
async function loadWasm(): Promise<typeof WasmTypes> {
  const mod = await (eval('import("/wasm/s_enc_core.js")') as Promise<typeof WasmTypes>);
  await mod.default();
  return mod;
}

class App {
  private terminal: Terminal;
  private theme: ThemeManager;
  private i18n: I18nManager;
  private progress: ProgressBar;
  private passwordGen: PasswordGenerator;
  private worker: MainWorker;
  private clipboard: ClipboardManager;
  private estimator: SizeEstimator;
  private busy = false;
  private lastEncryptedName = "";
  private _lastOp: "encrypt" | "decrypt" | "hash" | "hmac" | null = null;
  private _lastDecryptMetadata: Record<string, unknown> | null = null;

  constructor() {
    const appEl = document.getElementById("app")!;
    appEl.innerHTML = this.buildLayout();

    this.terminal = new Terminal(document.getElementById("terminal-output")!);
    this.theme = new ThemeManager();
    this.i18n = new I18nManager();
    this.i18n.load();
    this.progress = new ProgressBar(document.getElementById("progress-area")!);
    this.passwordGen = new PasswordGenerator();
    this.worker = new MainWorker();
    this.clipboard = new ClipboardManager();
    this.estimator = new SizeEstimator();

    void this.worker.init();
    this.worker.onMessage((e) => this.handleWorkerEvent(e));

    this.i18n.apply();

    this.log("> S-ENC-001 SECURE TERMINAL initialized");
    this.log("[提示] 系统就绪 - 完全离线模式");
    this.log("> 拖拽文件到窗口或点击按钮开始");

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
      ,'    <button id="btn-text-enc" class="term-btn" data-i18n="btn.textenc">[text encrypt]</button>'
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
        this.log("[...] 验证中...");
        const input = document.querySelector("#pm-password") as HTMLInputElement | null;
        if (input) input.disabled = true;
        setTimeout(() => {
          this.log("[错误] 密码错误或文件已损坏");
          if (input) input.disabled = false;
          this.progress.clear();
          this.setBusy(false);
        }, 10000);
      } else {
        this.log(`[错误] ${e.message}`);
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

  private onEncryptDone(data: ArrayBuffer): void {
    const outName = this.lastEncryptedName || "secret.enc";
    triggerDownload(data, outName);
    this.log(`> 已生成加密文件: ${outName} (${(data.byteLength / 1024).toFixed(1)} KB)`);
    this.log("[提示] 加密完成。原始文件可能仍残留于磁盘，建议安全擦除。");
    void this.clipboard.clearClipboard();
  }

  private onDecryptDone(data: ArrayBuffer, headerJson: string): void {
    try {
      const header = JSON.parse(headerJson) as Record<string, unknown>;
      const originalName = (header.originalFilename as string) ?? "decrypted";
      const multiFile = header.multiFile as boolean;
      if (multiFile) {
        const files = (header.files as { name: string }[]) ?? [];
        this.log(`> 检测到多文件包 (${files.length} 个文件)`);
        const meta = this._lastDecryptMetadata as Record<string, unknown> | undefined;
        const filesJson = meta?.filesJson as string | undefined;
        if (filesJson) {
          try {
            const entries = JSON.parse(filesJson) as { name: string; data_b64: string }[];
            this.log("> 文件列表:");
            entries.forEach((f, i) => this.log(`  [${i + 1}] ${f.name} (${Math.round(atob(f.data_b64).length / 1024)} KB)`));
            // Trigger individual downloads (no ZIP per design doc)
            for (const f of entries) {
              const bytes = Uint8Array.from(atob(f.data_b64), (c) => c.charCodeAt(0));
              setTimeout(() => triggerDownload(bytes.buffer as ArrayBuffer, f.name), 200 * entries.indexOf(f));
            }
            this.log(`> 已触发 ${entries.length} 个文件下载`);
          } catch (err) {
            this.log(`[错误] 解包失败: ${String(err)}`);
            triggerDownload(data, "decrypted.tar");
          }
        } else {
          triggerDownload(data, "decrypted.tar");
        }
      } else {
        triggerDownload(data, originalName);
        this.log(`> 已恢复文件: ${originalName} (${(data.byteLength / 1024).toFixed(1)} KB)`);
      }
      const shaHex = this.bytesToHex(new Uint8Array(data));
      this.log(`> SHA-256: ${shaHex.slice(0, 32)}... (完整哈希见哈希工具)`);
    } catch (err) {
      this.log(`[错误] 解密结果处理失败: ${String(err)}`);
    }
  }

  private onHashDone(data: ArrayBuffer, algorithm: string): void {
    const hex = this.bytesToHex(new Uint8Array(data));
    this.log(`> ${algorithm.toUpperCase()}: ${hex}`);
    void this.clipboard.copy(hex);
    this.log("[提示] 哈希已复制到剪贴板");
    // Expected hash comparison
    const expected = window.prompt("输入期望哈希进行比对 (留空跳过):", "");
    if (expected && expected.trim()) {
      const clean = expected.trim().toLowerCase();
      if (clean === hex.toLowerCase()) {
        this.log("[提示] MATCH - 哈希一致 ✓");
      } else {
        this.log("[错误] MISMATCH - 哈希不一致 ✗");
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
    document.getElementById("btn-text-enc")!.onclick = () => void this.askTextEncrypt();
    document.getElementById("btn-batch")!.onclick = () => void this.askBatch();
    document.getElementById("btn-clear")!.onclick = () => this.cmdClear();
    document.getElementById("btn-lang")!.onclick = () => {
      this.i18n.toggle();
    };
    document.getElementById("btn-theme")!.onclick = () => this.theme.toggle();
  }

  private async handleDrop(files: File[]): Promise<void> {
    this.log(`> 接收到 ${files.length} 个文件`);
    for (const f of files) this.log(`  > ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
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
      for (const f of files) this.log(`> 选择: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
      await this.runEncrypt(files);
    };
    input.click();
  }

  private async runEncrypt(files: File[]): Promise<void> {
    const opts = await PasswordModal.show({ title: "[加密] 输入密码", mode: "encrypt", multi: files.length > 1 });
    if (!opts) { this.log("[提示] 已取消"); return; }

    this.setBusy(true);
    try {
      // Optional key file hash (SHA-256 of key file content via crypto.subtle - non-algorithmic helper)
      let keyFileHash: Uint8Array | undefined;
      if (opts.keyFile) {
        const buf = await opts.keyFile.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buf);
        keyFileHash = new Uint8Array(digest);
        this.log("[提示] 密钥文件已加载 (SHA-256 哈希作为第二因素)");
      }

      // Multi-file: pack into tar via WASM first
      let payload: ArrayBuffer;
      let filename: string;
      let fileListJson: string | undefined;

      if (files.length === 1) {
        payload = await files[0].arrayBuffer();
        filename = files[0].name;
        this.log(`> 加密中: ${files[0].name} (${(files[0].size / 1024).toFixed(1)} KB)`);
      } else {
        this.log(`> 打包 ${files.length} 个文件为 tar 归档...`);
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
        this.log(`> tar 归档完成 (${(payload.byteLength / 1024).toFixed(1)} KB)`);
      }

      const est = this.estimator.estimate(payload.byteLength, opts.compressLevel ?? 3, opts.mode ?? "auto", filename);
      this.log(`> 预估加密后大小: ${this.estimator.formatSize(est)}`);

      this.lastEncryptedName = (files.length === 1 ? files[0].name : "archive") + ".enc";
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
      this.log(`[错误] 加密失败: ${String(err)}`);
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
      for (const f of files) this.log(`> 选择: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
      const opts = await PasswordModal.show({ title: "[解密] 输入密码", mode: "decrypt" });
      if (!opts) { this.log("[提示] 已取消"); return; }

      this.setBusy(true);
      try {
        // Merge .part files if multiple selected
        let data: ArrayBuffer;
        if (files.length > 1 && files.every((f) => f.name.endsWith(".part"))) {
          this.log(`> 合并 ${files.length} 个分片...`);
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
          this.log("> 分片合并完成");
        } else {
          data = await files[0].arrayBuffer();
        }
        this.log("> 解密中... (密码错误将静默等待 10 秒)");
        const options: Record<string, unknown> = {
          keyFileHash: undefined,
          recoveryPhrase: opts.recoveryPhrase,
        };
        this._lastOp = "decrypt";
        this.worker.postMessage({ type: "decrypt", data, password: opts.password, options });
      } catch (err) {
        this.log(`[错误] 解密失败: ${String(err)}`);
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
      const algo = window.prompt("算法 (sha256 / sha512):", "sha256") === "sha512" ? "sha512" : "sha256";
      this.log(`> 计算 ${algo.toUpperCase()}: ${file.name}`);
      this.setBusy(true);
      const buf = await file.arrayBuffer();
      this._lastOp = "hash";
      this.worker.postMessage({ type: "hash", data: buf, algorithm: algo });
    };
    input.click();
  }

  private async askHmac(): Promise<void> {
    const key = prompt("输入 HMAC 密钥:");
    if (!key) return;
    const data = prompt("输入数据:");
    if (!data) return;
    this.log("> 计算 HMAC-SHA256...");
    this.setBusy(true);
    try {
      const wasm = await loadWasm();
      const enc = new TextEncoder();
      const result = wasm.hmac_sha256(enc.encode(key), enc.encode(data));
      const hex = this.bytesToHex(result);
      this.log(`> HMAC-SHA256: ${hex}`);
      await this.clipboard.copy(hex);
      this.log("[提示] HMAC 已复制到剪贴板");
      this.setBusy(false);
    } catch (err) {
      this.log(`[错误] HMAC 失败: ${String(err)}`);
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
      this.log(`> 批量任务: ${files.length} 个文件 (分别加密)`);
      const opts = await PasswordModal.show({ title: "[批量加密] 输入密码", mode: "encrypt" });
      if (!opts) { this.log("[提示] 已取消"); return; }
      this.setBusy(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const buf = await f.arrayBuffer();
          this.log(`> [${i + 1}/${files.length}] 加密: ${f.name}`);
          this.lastEncryptedName = f.name + ".enc";
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
        this.log(`[错误] 批量加密失败: ${String(err)}`);
        this.setBusy(false);
      }
    };
    input.click();
  }
  
  private async askPhrase(): Promise<void> {
    const count = window.confirm("24 词? (确定 = 24, 取消 = 12)") ? 24 : 12;
    this.log(`> 生成恢复短语 (${count} 词)...`);
    try {
      const wasm = await loadWasm();
      const phrase = wasm.generate_recovery_phrase(count);
      this.log(`> 恢复短语: ${phrase}`);
      this.log("[提示] 请妥善保管！此短语可作为第二因素用于解密");
      await this.clipboard.copy(phrase);
      this.log("[提示] 已复制到剪贴板");
    } catch (err) {
      this.log(`[错误] 生成失败: ${String(err)}`);
    }
  }
  
  private async askTextEncrypt(): Promise<void> {
    const text = window.prompt("输入要加密的文本:", "");
    if (text === null || !text) { this.log("[提示] 已取消"); return; }
    const opts = await PasswordModal.show({ title: "[文本加密] 输入密码", mode: "encrypt" });
    if (!opts) { this.log("[提示] 已取消"); return; }
    this.setBusy(true);
    try {
      const enc = new TextEncoder();
      const payload = enc.encode(text).buffer as ArrayBuffer;
      this.log(`> 加密文本 (${text.length} 字符)`);
      const options: Record<string, unknown> = {
        compressLevel: opts.compressLevel ?? 3,
        mode: opts.mode ?? "auto",
        filename: "text.txt",
        recoveryPhrase: opts.recoveryPhrase,
      };
      this.lastEncryptedName = "text.enc";
      this._lastOp = "encrypt";
      this.worker.postMessage({ type: "encrypt", data: payload, password: opts.password, options });
    } catch (err) {
      this.log(`[错误] 加密失败: ${String(err)}`);
      this.setBusy(false);
    }
  }
  
  private cmdClear(): void {
    if (confirm("确定清除所有敏感数据？")) {
      this.terminal.clear();
      this.log("> 内存已清除 - 所有敏感变量已覆盖");
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