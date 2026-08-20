import { i18n } from "./i18n";

export interface DecryptResultItem {
  name: string;
  size: number;
  data: ArrayBuffer;
  kind: "text" | "binary";
  mime?: string;
  preview?: string;
}

interface MagicSig {
  sig: number[];
  mime: string;
}

const MAGIC: MagicSig[] = [
  { sig: [0x89, 0x50, 0x4e, 0x47], mime: "png" },
  { sig: [0xff, 0xd8, 0xff], mime: "jpeg" },
  { sig: [0x47, 0x49, 0x46, 0x38], mime: "gif" },
  { sig: [0x25, 0x50, 0x44, 0x46], mime: "pdf" },
  { sig: [0x50, 0x4b, 0x03, 0x04], mime: "zip" },
  { sig: [0x1f, 0x8b], mime: "gzip" },
  { sig: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], mime: "7z" },
  { sig: [0x52, 0x61, 0x72, 0x21], mime: "rar" },
  { sig: [0x28, 0xb5, 0x2f, 0xfd], mime: "zstd" },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class ResultModal {
  static detect(name: string, data: ArrayBuffer): DecryptResultItem {
    const bytes = new Uint8Array(data);
    const size = bytes.length;
    if (
      size >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return { name, size, data, kind: "binary", mime: "webp" };
    }
    for (const m of MAGIC) {
      if (size >= m.sig.length && m.sig.every((b, i) => bytes[i] === b)) {
        return { name, size, data, kind: "binary", mime: m.mime };
      }
    }
    const sample = bytes.subarray(0, Math.min(size, 512));
    let printable = 0;
    for (const b of sample) {
      if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126) || b >= 0x80) printable++;
    }
    if (sample.length > 0 && printable / sample.length >= 0.95) {
      let preview = "";
      try {
        preview = new TextDecoder("utf-8", { fatal: false }).decode(
          bytes.subarray(0, Math.min(size, 400))
        );
      } catch {
        preview = "";
      }
      return { name, size, data, kind: "text", preview: preview.slice(0, 100) };
    }
    return { name, size, data, kind: "binary", mime: "binary" };
  }

  static show(items: DecryptResultItem[]): Promise<number[] | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const single = items.length === 1;

      const block = (it: DecryptResultItem): string => {
        const meta = `${it.name} (${(it.size / 1024).toFixed(1)} KB)`;
        if (it.kind === "text") {
          return `
            <div class="result-block">
              <div class="result-meta">${escapeHtml(meta)}</div>
              <div class="result-preview">${escapeHtml(it.preview ?? "")}</div>
              <div class="result-note">${i18n.t("modal.result.preview.note")}</div>
            </div>`;
        }
        return `
          <div class="result-block">
            <div class="result-meta">${escapeHtml(meta)}</div>
            <div class="result-note">${i18n.t("modal.result.binary", {
              mime: i18n.t("mime." + (it.mime ?? "binary")),
              size: (it.size / 1024).toFixed(1),
            })}</div>
          </div>`;
      };

      let rows = "";
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        rows += single
          ? block(it)
          : `<label class="result-item"><input type="checkbox" data-idx="${i}" checked>${block(it)}</label>`;
      }
      const listHeader = single
        ? ""
        : `<div class="result-list-header"><label><input type="checkbox" id="rm-all" checked>${i18n.t("modal.result.select.all")} ${i18n.t("modal.result.list", { count: items.length })}</label></div>`;
      const hint = single ? "" : `<div class="result-note">${i18n.t("modal.result.blocked.hint")}</div>`;
      const downloadLabel = single
        ? i18n.t("modal.result.download")
        : i18n.t("modal.result.download.selected", { n: items.length });

      overlay.innerHTML = `
        <div class="modal">
          <h3>${i18n.t("modal.result.title")}</h3>
          <div class="modal-body">
            ${listHeader}
            ${rows}
            ${hint}
            <div class="modal-actions">
              <button id="rm-download" class="term-btn">${downloadLabel}</button>
              <button id="rm-cancel" class="term-btn">${i18n.t("modal.cancel")}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cleanup = (): void => {
        overlay.remove();
      };
      const allCb = overlay.querySelector<HTMLInputElement>("#rm-all");
      const updateLabel = (): void => {
        if (single) return;
        const cbs = overlay.querySelectorAll<HTMLInputElement>('input[data-idx]');
        let n = 0;
        cbs.forEach((cb) => {
          if (cb.checked) n++;
        });
        const btn = overlay.querySelector("#rm-download") as HTMLElement;
        btn.textContent = i18n.t("modal.result.download.selected", { n });
        if (allCb) {
          allCb.checked = n === cbs.length;
          allCb.indeterminate = n > 0 && n < cbs.length;
        }
      };
      overlay.querySelectorAll<HTMLInputElement>('input[data-idx]').forEach((cb) => {
        cb.addEventListener("change", updateLabel);
      });
      if (allCb) {
        allCb.addEventListener("change", () => {
          overlay.querySelectorAll<HTMLInputElement>('input[data-idx]').forEach((cb) => {
            cb.checked = allCb.checked;
          });
          updateLabel();
        });
      }
      (overlay.querySelector("#rm-download") as HTMLElement).onclick = () => {
        cleanup();
        if (single) {
          resolve([0]);
          return;
        }
        const sel: number[] = [];
        overlay.querySelectorAll<HTMLInputElement>('input[data-idx]').forEach((cb) => {
          if (cb.checked) sel.push(Number(cb.dataset.idx));
        });
        resolve(sel);
      };
      (overlay.querySelector("#rm-cancel") as HTMLElement).onclick = () => {
        cleanup();
        resolve(null);
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(null);
        }
      });
      (overlay.querySelector("#rm-download") as HTMLElement).focus();
    });
  }
}
