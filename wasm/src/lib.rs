//! S-ENC-001 Core WASM Module
//! All cryptographic operations live here. The frontend JS only
//! handles UI, file streaming and data transfer.

mod kdf;
mod crypto;
mod hmac;
mod compress;
mod tar;
mod container;
mod password;
mod recovery;
mod estimate;
mod split;

use wasm_bindgen::prelude::*;
use kdf::derive_keys;
use container::{EncryptedHeader, EncryptionInfo, CompressionInfo, HmacInfo, FileInfo, ParamBlock};
use base64::Engine;
use zeroize::Zeroize;

#[derive(Debug)]
#[wasm_bindgen]
pub struct WasmError {
    message: String,
}

#[wasm_bindgen]
impl WasmError {
    pub fn message(&self) -> String {
        self.message.clone()
    }
}

impl std::fmt::Display for WasmError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for WasmError {}

fn to_wasm_error(e: impl std::fmt::Display) -> WasmError {
    WasmError { message: e.to_string() }
}

const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

// =====================
// Encryption
// =====================

#[wasm_bindgen]
pub fn encrypt(
    data: &[u8],
    password: &str,
    key_file_hash: Option<Vec<u8>>,
    recovery_phrase: Option<String>,
    compress_level: u8,
    mode: &str,
    filename: &str,
    timestamp_utc_minutes: u64,
    created_at_iso: &str,
    file_list_json: Option<String>,
) -> Result<Vec<u8>, WasmError> {
    let result = encrypt_inner(
        data, password, key_file_hash, recovery_phrase,
        compress_level, mode, filename, timestamp_utc_minutes, created_at_iso, file_list_json,
    );
    result.map_err(to_wasm_error)
}

fn encrypt_inner(
    data: &[u8],
    password: &str,
    key_file_hash: Option<Vec<u8>>,
    recovery_phrase: Option<String>,
    compress_level: u8,
    mode: &str,
    filename: &str,
    timestamp_utc_minutes: u64,
    created_at_iso: &str,
    file_list_json: Option<String>,
) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; 16];
    let mut entropy = [0u8; 16];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut salt);
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut entropy);
    let timestamp = timestamp_utc_minutes.to_be_bytes();

    let kfh: Option<&[u8; 32]> = key_file_hash.as_deref().and_then(|v| v.try_into().ok());
    let (mut enc_key, mut hmac_key) = derive_keys(
        password, &salt, &entropy, &timestamp, kfh, recovery_phrase.as_deref(),
    )?;

    let use_compression = match mode {
        "on" => true,
        "off" => false,
        "auto" => !compress::is_already_compressed(filename),
        other => return Err(format!("Unknown compression mode: {other}")),
    };
    let level = compress_level.max(1).min(19);

    let payload: Vec<u8> = if use_compression {
        compress::compress(data, level as i32)?
    } else {
        data.to_vec()
    };

    let (ciphertext, nonces) = crypto::encrypt_stream(&enc_key, &payload)?;

    let mut calc = hmac::HmacCalculator::new(&hmac_key);
    calc.update(&ciphertext);
    let hmac_value = calc.finalize();

    let nonces_b64: Vec<String> = nonces.iter().map(|n| B64.encode(n)).collect();
    let files: Vec<FileInfo> = if let Some(json) = file_list_json {
        serde_json::from_str(&json).map_err(|e| format!("file_list_json parse error: {e}"))?
    } else {
        Vec::new()
    };
    let multi_file = !files.is_empty();

    let header = EncryptedHeader {
        encryption: EncryptionInfo {
            algorithm: "AES-256-GCM".to_string(),
            block_size: crypto::BLOCK_SIZE as u32,
            nonces: nonces_b64,
            tags: Vec::new(),
        },
        compression: CompressionInfo {
            algorithm: "zstd".to_string(),
            level: if use_compression { level } else { 0 },
            mode: mode.to_string(),
        },
        hmac: HmacInfo {
            algorithm: "HMAC-SHA256".to_string(),
            value: B64.encode(hmac_value),
        },
        multi_file,
        files,
        original_filename: filename.to_string(),
        original_size: data.len() as u64,
        created_at: created_at_iso.to_string(),
        uses_key_file: key_file_hash.is_some(),
        uses_recovery_phrase: recovery_phrase.is_some(),
    };

    let header_json = container::build_header(&header)?;
    let (header_ct, header_nonce) = crypto::encrypt_block(&enc_key, &header_json)?;
    let header_tag: [u8; 16] = header_ct[header_ct.len() - 16..]
        .try_into()
        .map_err(|_| "header tag extraction failed".to_string())?;

    let param = ParamBlock {
        salt,
        entropy,
        timestamp,
        header_nonce,
        header_tag,
        header_len: header_ct.len() as u32,
    };

    let mut out = Vec::with_capacity(72 + header_ct.len() + ciphertext.len());
    out.extend_from_slice(&param.to_bytes());
    out.extend_from_slice(&header_ct);
    out.extend_from_slice(&ciphertext);

    enc_key.zeroize();
    hmac_key.zeroize();
    Ok(out)
}


// =====================
// Decryption
// =====================

#[wasm_bindgen]
pub struct DecryptResult {
    data: Vec<u8>,
    header_json: String,
    hmac_ok: bool,
}

#[wasm_bindgen]
impl DecryptResult {
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }
    pub fn header_json(&self) -> String {
        self.header_json.clone()
    }
    pub fn hmac_ok(&self) -> bool {
        self.hmac_ok
    }
}

#[wasm_bindgen]
pub fn decrypt(
    container: &[u8],
    password: &str,
    key_file_hash: Option<Vec<u8>>,
    recovery_phrase: Option<String>,
) -> Result<DecryptResult, WasmError> {
    let result = decrypt_inner(container, password, key_file_hash, recovery_phrase);
    result.map_err(to_wasm_error)
}

fn decrypt_inner(
    container: &[u8],
    password: &str,
    key_file_hash: Option<Vec<u8>>,
    recovery_phrase: Option<String>,
) -> Result<DecryptResult, String> {
    let param = ParamBlock::parse(container)?;

    let kfh: Option<&[u8; 32]> = key_file_hash.as_deref().and_then(|v| v.try_into().ok());
    let (mut enc_key, mut hmac_key) = derive_keys(
        password, &param.salt, &param.entropy, &param.timestamp, kfh, recovery_phrase.as_deref(),
    )?;

    let header_start = 72usize;
    let header_end = header_start + param.header_len as usize;
    if header_end > container.len() {
        return Err("Container header exceeds file size".to_string());
    }
    let header_ct = &container[header_start..header_end];
    let header_json_bytes = crypto::decrypt_block(&enc_key, header_ct, &param.header_nonce)?;
    let header: EncryptedHeader = container::parse_header(&header_json_bytes)?;

    let ciphertext = &container[header_end..];
    let mut calc = hmac::HmacCalculator::new(&hmac_key);
    calc.update(ciphertext);
    let computed = calc.finalize();

    let expected_b64 = &header.hmac.value;
    let expected: Vec<u8> = B64.decode(expected_b64).map_err(|e| format!("HMAC decode error: {e}"))?;
    let hmac_ok = computed.as_slice() == expected.as_slice();
    if !hmac_ok {
        enc_key.zeroize();
        hmac_key.zeroize();
        return Err("WRONG_PASSWORD_OR_CORRUPT".to_string());
    }

    let nonces: Vec<[u8; 12]> = header
        .encryption
        .nonces
        .iter()
        .map(|n| {
            let raw = B64.decode(n).map_err(|e| format!("nonce decode error: {e}"))?;
            let arr: [u8; 12] = raw.try_into().map_err(|_| "nonce length invalid".to_string())?;
            Ok(arr)
        })
        .collect::<Result<Vec<_>, String>>()?;

    let payload = crypto::decrypt_stream(&enc_key, ciphertext, &nonces)?;

    let data = if header.compression.level > 0 {
        compress::decompress(&payload)?
    } else {
        payload
    };

    enc_key.zeroize();
    hmac_key.zeroize();
    Ok(DecryptResult {
        data,
        header_json: serde_json::to_string(&header).map_err(|e| format!("header serialize error: {e}"))?,
        hmac_ok,
    })
}



// =====================
// Hashing
// =====================

#[wasm_bindgen]
pub fn sha256(data: &[u8]) -> Result<Vec<u8>, WasmError> {
    use sha2::Digest;
    Ok(sha2::Sha256::digest(data).to_vec())
}

#[wasm_bindgen]
pub fn sha512(data: &[u8]) -> Result<Vec<u8>, WasmError> {
    use sha2::Digest;
    Ok(sha2::Sha512::digest(data).to_vec())
}

#[wasm_bindgen]
pub fn hmac_sha256(key: &[u8], data: &[u8]) -> Result<Vec<u8>, WasmError> {
    use hmac::Mac;
    let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(key)
        .map_err(|e| to_wasm_error(format!("HMAC init error: {e}")))?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

// =====================
// Password / Recovery
// =====================

#[wasm_bindgen]
pub fn generate_password(
    length: u8,
    use_upper: bool,
    use_lower: bool,
    use_digits: bool,
    use_symbols: bool,
    exclude_chars: &str,
) -> Result<String, WasmError> {
    password::generate_password(length, use_upper, use_lower, use_digits, use_symbols, exclude_chars)
        .map_err(to_wasm_error)
}

#[wasm_bindgen]
pub fn generate_recovery_phrase(word_count: usize) -> Result<String, WasmError> {
    recovery::generate_recovery_phrase(word_count).map_err(to_wasm_error)
}

#[wasm_bindgen]
pub fn validate_recovery_phrase(phrase: &str) -> bool {
    recovery::validate_recovery_phrase(phrase)
}

// =====================
// Estimation
// =====================

#[wasm_bindgen]
pub fn estimate_encrypted_size(
    original_size: u64,
    compress_level: u8,
    mode: &str,
    filename: &str,
) -> Result<u64, WasmError> {
    estimate::estimate_encrypted_size(original_size, compress_level, mode, filename)
        .map_err(to_wasm_error)
}

// =====================
// Split / Merge
// =====================

#[wasm_bindgen]
pub fn split_file(data: &[u8], chunk_size: u64) -> Result<js_sys::Array, WasmError> {
    let chunks = split::split_file(data, chunk_size).map_err(to_wasm_error)?;
    let arr = js_sys::Array::new();
    for c in chunks {
        let u8arr = js_sys::Uint8Array::from(c.as_slice());
        arr.push(&u8arr);
    }
    Ok(arr)
}

#[wasm_bindgen]
pub fn merge_files(chunks: js_sys::Array) -> Result<Vec<u8>, WasmError> {
    let mut vec_chunks: Vec<Vec<u8>> = Vec::with_capacity(chunks.length() as usize);
    for i in 0..chunks.length() {
        let item = chunks.get(i);
        let u8arr = js_sys::Uint8Array::new(&item);
        vec_chunks.push(u8arr.to_vec());
    }
    split::merge_files(&vec_chunks).map_err(to_wasm_error)
}

// =====================
// Tar (multi-file)
// =====================

#[wasm_bindgen]
pub fn pack_tar(files_json: &str) -> Result<Vec<u8>, WasmError> {
    #[derive(serde::Deserialize)]
    struct InFile {
        name: String,
        data_b64: String,
    }
    let files: Vec<InFile> =
        serde_json::from_str(files_json).map_err(|e| to_wasm_error(format!("pack_tar input error: {e}")))?;
    let entries: Vec<tar::TarEntry> = files
        .into_iter()
        .map(|f| {
            let data = B64.decode(&f.data_b64)
                .map_err(|e| to_wasm_error(format!("base64 decode error: {e}")))?;
            Ok(tar::TarEntry { name: f.name, data })
        })
        .collect::<Result<Vec<_>, WasmError>>()?;
    tar::pack(&entries).map_err(to_wasm_error)
}

#[wasm_bindgen]
pub fn unpack_tar(archive: &[u8]) -> Result<String, WasmError> {
    let entries = tar::unpack(archive).map_err(to_wasm_error)?;
    #[derive(serde::Serialize)]
    struct OutFile {
        name: String,
        data_b64: String,
    }
    let out: Vec<OutFile> = entries
        .into_iter()
        .map(|e| OutFile {
            name: e.name,
            data_b64: B64.encode(e.data),
        })
        .collect();
    serde_json::to_string(&out).map_err(|e| to_wasm_error(format!("unpack_tar serialize error: {e}")))
}

