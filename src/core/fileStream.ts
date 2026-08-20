export class FileStream {
  async readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return file.arrayBuffer();
  }

  async readStream(file: File, chunkSize: number = 1_048_576): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const stream = file.stream();
    const reader = stream.getReader();
    void chunkSize;
    return reader;
  }
}
