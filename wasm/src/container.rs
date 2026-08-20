use serde::{Serialize, Deserialize};

pub const PARAM_BLOCK_SIZE: usize = 72;

#[derive(Debug, Clone)]
pub struct ParamBlock {
    pub salt: [u8; 16],
    pub entropy: [u8; 16],
    pub timestamp: [u8; 8],
    pub header_nonce: [u8; 12],
    pub header_tag: [u8; 16],
    pub header_len: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedHeader {
    pub encryption: EncryptionInfo,
    pub compression: CompressionInfo,
    pub hmac: HmacInfo,
    #[serde(default)]
    pub multi_file: bool,
    #[serde(default)]
    pub files: Vec<FileInfo>,
    #[serde(default)]
    pub original_filename: String,
    pub original_size: u64,
    pub created_at: String,
    #[serde(default)]
    pub uses_key_file: bool,
    #[serde(default)]
    pub uses_recovery_phrase: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EncryptionInfo {
    pub algorithm: String,
    pub block_size: u32,
    pub nonces: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompressionInfo {
    pub algorithm: String,
    pub level: u8,
    pub mode: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HmacInfo {
    pub algorithm: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub sha256: String,
}

impl ParamBlock {
    /// Parse the 72-byte parameter block.
    pub fn parse(data: &[u8]) -> Result<Self, String> {
        if data.len() < PARAM_BLOCK_SIZE {
            return Err(format!(
                "File too small to be a valid container ({} bytes)",
                data.len()
            ));
        }
        let mut salt = [0u8; 16];
        let mut entropy = [0u8; 16];
        let mut timestamp = [0u8; 8];
        let mut header_nonce = [0u8; 12];
        let mut header_tag = [0u8; 16];
        salt.copy_from_slice(&data[0..16]);
        entropy.copy_from_slice(&data[16..32]);
        timestamp.copy_from_slice(&data[32..40]);
        header_nonce.copy_from_slice(&data[40..52]);
        header_tag.copy_from_slice(&data[52..68]);
        let header_len = u32::from_be_bytes([
            data[68], data[69], data[70], data[71],
        ]);
        Ok(Self {
            salt,
            entropy,
            timestamp,
            header_nonce,
            header_tag,
            header_len,
        })
    }

    /// Serialize to 72 bytes.
    pub fn to_bytes(&self) -> [u8; 72] {
        let mut out = [0u8; 72];
        out[0..16].copy_from_slice(&self.salt);
        out[16..32].copy_from_slice(&self.entropy);
        out[32..40].copy_from_slice(&self.timestamp);
        out[40..52].copy_from_slice(&self.header_nonce);
        out[52..68].copy_from_slice(&self.header_tag);
        out[68..72].copy_from_slice(&self.header_len.to_be_bytes());
        out
    }
}

pub fn build_header(header: &EncryptedHeader) -> Result<Vec<u8>, String> {
    serde_json::to_vec(header).map_err(|e| format!("Header serialize error: {e}"))
}

pub fn parse_header(data: &[u8]) -> Result<EncryptedHeader, String> {
    serde_json::from_slice(data).map_err(|e| format!("Header parse error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_param_block_roundtrip() {
        let pb = ParamBlock {
            salt: [1u8; 16],
            entropy: [2u8; 16],
            timestamp: 1234567890u64.to_be_bytes(),
            header_nonce: [3u8; 12],
            header_tag: [4u8; 16],
            header_len: 512,
        };
        let bytes = pb.to_bytes();
        assert_eq!(bytes.len(), 72);
        let parsed = ParamBlock::parse(&bytes).unwrap();
        assert_eq!(parsed.salt, pb.salt);
        assert_eq!(parsed.entropy, pb.entropy);
        assert_eq!(parsed.timestamp, pb.timestamp);
        assert_eq!(parsed.header_nonce, pb.header_nonce);
        assert_eq!(parsed.header_tag, pb.header_tag);
        assert_eq!(parsed.header_len, 512);
    }

    #[test]
    fn test_param_block_short_input() {
        assert!(ParamBlock::parse(&[0u8; 10]).is_err());
    }

    #[test]
    fn test_header_json_roundtrip() {
        let h = EncryptedHeader {
            encryption: EncryptionInfo {
                algorithm: "AES-256-GCM".to_string(),
                block_size: 1_048_576,
                nonces: vec!["abc".to_string()],
                tags: vec!["def".to_string()],
            },
            compression: CompressionInfo {
                algorithm: "zstd".to_string(),
                level: 3,
                mode: "auto".to_string(),
            },
            hmac: HmacInfo {
                algorithm: "HMAC-SHA256".to_string(),
                value: "deadbeef".to_string(),
            },
            multi_file: true,
            files: vec![FileInfo {
                name: "photo.jpg".to_string(),
                size: 12345,
                sha256: "cafe".to_string(),
            }],
            original_filename: "archive.tar".to_string(),
            original_size: 123456,
            created_at: "2026-08-20T14:35:00Z".to_string(),
            uses_key_file: false,
            uses_recovery_phrase: true,
        };
        let bytes = build_header(&h).unwrap();
        let parsed = parse_header(&bytes).unwrap();
        assert_eq!(parsed.encryption.algorithm, "AES-256-GCM");
        assert_eq!(parsed.compression.level, 3);
        assert_eq!(parsed.files.len(), 1);
        assert_eq!(parsed.files[0].name, "photo.jpg");
        assert!(parsed.uses_recovery_phrase);
        assert!(!parsed.uses_key_file);
    }

    #[test]
    fn test_header_defaults() {
        // missing optional fields should default
        let json = br#"{"encryption":{"algorithm":"AES-256-GCM","blockSize":1048576,"nonces":[],"tags":[]},"compression":{"algorithm":"zstd","level":3,"mode":"off"},"hmac":{"algorithm":"HMAC-SHA256","value":"x"},"originalSize":10,"createdAt":"t"}"#;
        let h = parse_header(json).unwrap();
        assert!(!h.multi_file);
        assert!(h.files.is_empty());
        assert!(h.original_filename.is_empty());
    }
}