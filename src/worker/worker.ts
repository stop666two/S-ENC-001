import type { WorkerCommand, WorkerEvent } from "./mainWorker";
import type * as Wasm from "../wasm-pkg/s_enc_core.js";

type WasmModule = typeof import("../wasm-pkg/s_enc_core.js");

let wasm: WasmModule | null = null;

async function ensureWasm(): Promise<WasmModule> {
  if (!wasm) {
    // Load from /wasm (public dir, single copy in dist)
    const mod = await (import(/* @vite-ignore */ "/wasm/s_enc_core.js") as Promise<WasmModule>);
    await mod.default();
    wasm = mod;
  }
  return wasm;
}

function post(event: WorkerEvent): void {
  (self as unknown as Worker).postMessage(event);
}

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data;
  try {
    const w = await ensureWasm();
    switch (cmd.type) {
      case "encrypt": {
        const { data, password, options } = cmd;
        const {
          compressLevel = 5,
          mode = "auto",
          filename = "data",
          keyFileHash,
          recoveryPhrase,
          fileListJson,
        } = options as Record<string, unknown>;
        const now = Date.now();
        const ts = Math.floor(now / 60000);
        const iso = new Date(now).toISOString();
        post({ type: "progress", current: 0, total: 1 });
        const out = w.encrypt(
          new Uint8Array(data),
          password,
          (keyFileHash as Uint8Array | undefined) ?? null,
          (recoveryPhrase as string | undefined) ?? null,
          compressLevel as number,
          mode as string,
          filename as string,
          BigInt(ts),
          iso,
          (fileListJson as string | undefined) ?? null,
        );
        post({ type: "progress", current: 1, total: 1 });
        post({ type: "done", data: out.buffer as ArrayBuffer, metadata: { kind: "encrypt" } });
        break;
      }
      case "decrypt": {
        const { data, password, options } = cmd;
        const keyFileHash = (options as Record<string, unknown>)?.keyFileHash as Uint8Array | undefined;
        const recoveryPhrase = (options as Record<string, unknown>)?.recoveryPhrase as string | undefined;
        post({ type: "progress", current: 0, total: 1 });
        const result = w.decrypt(
          new Uint8Array(data),
          password,
          keyFileHash ?? null,
          recoveryPhrase ?? null,
        );
        const headerJson = result.header_json();
        const metadata: Record<string, unknown> = {
          kind: "decrypt",
          headerJson,
        };
        try {
          const header = JSON.parse(headerJson) as Record<string, unknown>;
          if (header.multiFile) {
            metadata.filesJson = w.unpack_tar(result.data());
          }
        } catch {
          // best-effort
        }
        post({ type: "progress", current: 1, total: 1 });
        post({
          type: "done",
          data: result.data().buffer as ArrayBuffer,
          metadata,
        });
        break;
      }
      case "cancel":
      case "forceStop":
        break;
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

export {};

// Keep type import referenced for TS
void (0 as unknown as typeof Wasm);