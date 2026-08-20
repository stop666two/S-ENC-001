export function triggerDownload(data: ArrayBuffer | Uint8Array, filename: string, mime = "application/octet-stream"): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function triggerMultipleDownloads(files: { data: ArrayBuffer; name: string }[]): void {
  for (const [index, f] of files.entries()) {
    setTimeout(() => triggerDownload(f.data, f.name), 200 * index);
  }
}
