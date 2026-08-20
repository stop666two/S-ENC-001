// Size estimation backed by WASM estimate_encrypted_size, with a
// rough fallback if the WASM module is unavailable (e.g. offline first run).
let wasmPromise: Promise<typeof import("../wasm-pkg/s_enc_core") | null> | null = null;

async function loadEstimateWasm(): Promise<typeof import("../wasm-pkg/s_enc_core") | null> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      try {
        const mod = await (eval('import("/wasm/s_enc_core.js")') as Promise<typeof import("../wasm-pkg/s_enc_core")>);
        await mod.default();
        return mod;
      } catch {
        return null;
      }
    })();
  }
  return wasmPromise;
}

export class SizeEstimator {
  async estimate(
    originalSize: number,
    compressLevel: number,
    mode: string,
    filename: string
  ): Promise<number> {
    try {
      const wasm = await loadEstimateWasm();
      if (wasm) {
        const est = wasm.estimate_encrypted_size(
          BigInt(originalSize),
          compressLevel,
          mode,
          filename
        );
        return Number(est);
      }
    } catch {
      // fall through to rough estimate
    }
    return Math.round(originalSize * 1.05 + 4096);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }
}
