/// Rough overhead per block: nonce not stored per block in data (nonces live in header),
/// but each 1MB plaintext block gains a 16-byte GCM tag. Plus header (~4KB typical) and
/// the 72-byte param block.
const HEADER_OVERHEAD: u64 = 4096 + 72;
const GCM_TAG_PER_BLOCK: u64 = 16;
const BLOCK: u64 = 1_048_576;

pub fn estimate_encrypted_size(
    original_size: u64,
    _compress_level: u8,
    mode: &str,
    _filename: &str,
) -> Result<u64, String> {
    let use_compression = match mode {
        "on" => true,
        "off" => false,
        "auto" => {
            // Content entropy is unknowable ahead of time. Estimating
            // compression here would risk understating the real size
            // (zstd cannot shrink incompressible data), so use the
            // uncompressed upper bound as a conservative estimate.
            false
        }
        other => return Err(format!("Unknown compression mode: {other}")),
    };

    let payload: u64 = if use_compression {
        // Assume ~70% size after compression for unknown data; conservative
        // but bounded by original size for incompressible data.
        let est = (original_size as f64 * 0.70) as u64;
        est.max(original_size / 2).min(original_size)
    } else {
        original_size
    };

    let blocks = payload.div_ceil(BLOCK);
    let tag_overhead = blocks.saturating_mul(GCM_TAG_PER_BLOCK);
    Ok(payload + tag_overhead + HEADER_OVERHEAD)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_off() {
        let e = estimate_encrypted_size(1_000_000, 3, "off", "a.txt").unwrap();
        assert!(e > 1_000_000, "off mode must add overhead, got {e}");
        assert!(e < 1_100_000);
    }

    #[test]
    fn test_estimate_auto_compressed_ext() {
        // .jpg -> no compression -> overhead only
        let e = estimate_encrypted_size(1_000_000, 3, "auto", "photo.jpg").unwrap();
        assert!(e > 1_000_000 && e < 1_100_000);
    }

    #[test]
    fn test_estimate_auto_text() {
        // .txt -> unknown entropy -> conservative upper bound (no compression assumed)
        let e = estimate_encrypted_size(1_000_000, 3, "auto", "doc.txt").unwrap();
        assert!(e > 1_000_000 && e < 1_100_000);
    }

    #[test]
    fn test_estimate_on() {
        let e = estimate_encrypted_size(100, 3, "on", "any.bin").unwrap();
        assert!(e > 100);
    }

    #[test]
    fn test_unknown_mode_rejected() {
        assert!(estimate_encrypted_size(100, 3, "weird", "a").is_err());
    }
}