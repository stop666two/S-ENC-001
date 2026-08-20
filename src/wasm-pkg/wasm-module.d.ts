declare module "/wasm/*" {
  export * from "./s_enc_core.js";
  export default function init(input?: string | URL | Request): Promise<unknown>;
}

declare module "*/wasm/s_enc_core.js" {
  export * from "./s_enc_core.js";
  export default function init(input?: string | URL | Request): Promise<unknown>;
}
