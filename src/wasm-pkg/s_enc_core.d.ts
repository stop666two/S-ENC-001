/* tslint:disable */
/* eslint-disable */

export class DecryptResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    data(): Uint8Array;
    header_json(): string;
    hmac_ok(): boolean;
}

export class WasmError {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    message(): string;
}

export function decrypt(container: Uint8Array, password: string, key_file_hash?: Uint8Array | null, recovery_phrase?: string | null): DecryptResult;

export function encrypt(data: Uint8Array, password: string, key_file_hash: Uint8Array | null | undefined, recovery_phrase: string | null | undefined, compress_level: number, mode: string, filename: string, timestamp_utc_minutes: bigint, created_at_iso: string, file_list_json?: string | null): Uint8Array;

export function estimate_encrypted_size(original_size: bigint, compress_level: number, mode: string, filename: string): bigint;

export function generate_password(length: number, use_upper: boolean, use_lower: boolean, use_digits: boolean, use_symbols: boolean, exclude_chars: string): string;

export function generate_recovery_phrase(word_count: number): string;

export function hmac_sha256(key: Uint8Array, data: Uint8Array): Uint8Array;

export function merge_files(chunks: Array<any>): Uint8Array;

export function pack_tar(files_json: string): Uint8Array;

export function sha256(data: Uint8Array): Uint8Array;

export function sha512(data: Uint8Array): Uint8Array;

export function split_file(data: Uint8Array, chunk_size: bigint): Array<any>;

export function unpack_tar(archive: Uint8Array): string;

export function validate_recovery_phrase(phrase: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_decryptresult_free: (a: number, b: number) => void;
    readonly __wbg_wasmerror_free: (a: number, b: number) => void;
    readonly decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly decryptresult_data: (a: number, b: number) => void;
    readonly decryptresult_header_json: (a: number, b: number) => void;
    readonly decryptresult_hmac_ok: (a: number) => number;
    readonly encrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: bigint, p: number, q: number, r: number, s: number) => void;
    readonly estimate_encrypted_size: (a: number, b: bigint, c: number, d: number, e: number, f: number, g: number) => void;
    readonly generate_password: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly generate_recovery_phrase: (a: number, b: number) => void;
    readonly hmac_sha256: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly merge_files: (a: number, b: number) => void;
    readonly pack_tar: (a: number, b: number, c: number) => void;
    readonly sha256: (a: number, b: number, c: number) => void;
    readonly sha512: (a: number, b: number, c: number) => void;
    readonly split_file: (a: number, b: number, c: number, d: bigint) => void;
    readonly unpack_tar: (a: number, b: number, c: number) => void;
    readonly validate_recovery_phrase: (a: number, b: number) => number;
    readonly wasmerror_message: (a: number, b: number) => void;
    readonly rust_zstd_wasm_shim_calloc: (a: number, b: number) => number;
    readonly rust_zstd_wasm_shim_free: (a: number) => void;
    readonly rust_zstd_wasm_shim_malloc: (a: number) => number;
    readonly rust_zstd_wasm_shim_memcmp: (a: number, b: number, c: number) => number;
    readonly rust_zstd_wasm_shim_memcpy: (a: number, b: number, c: number) => number;
    readonly rust_zstd_wasm_shim_memmove: (a: number, b: number, c: number) => number;
    readonly rust_zstd_wasm_shim_memset: (a: number, b: number, c: number) => number;
    readonly rust_zstd_wasm_shim_qsort: (a: number, b: number, c: number, d: number) => void;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
