export class SizeEstimator {
  estimate(
    originalSize: number,
    _compressLevel: number,
    _mode: string,
    _filename: string
  ): number {
    // TODO: call WASM estimate function
    // Rough estimate: encrypted size = original + 5% overhead
    return Math.round(originalSize * 1.05 + 4096);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }
}
