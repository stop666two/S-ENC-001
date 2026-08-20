use std::io::{Read, Write};

/// Compress data using zstd.
/// level: 1-19 (default 5)
pub fn compress(data: &[u8], level: i32) -> Result<Vec<u8>, String> {
    let clamped = level.clamp(1, 9);
    let mut encoder = zstd::stream::Encoder::new(Vec::new(), clamped)
        .map_err(|e| format!("zstd encoder init error: {e}"))?;
    encoder
        .write_all(data)
        .map_err(|e| format!("zstd compress error: {e}"))?;
    let out = encoder
        .finish()
        .map_err(|e| format!("zstd finish error: {e}"))?;
    Ok(out)
}

/// Decompress zstd-compressed data.
pub fn decompress(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = zstd::stream::Decoder::new(data)
        .map_err(|e| format!("zstd decoder init error: {e}"))?;
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|e| format!("zstd decompress error: {e}"))?;
    Ok(out)
}

/// Check if a file extension suggests already-compressed format.
pub fn is_already_compressed(filename: &str) -> bool {
    let compressed = [
        ".zip", ".gz", ".bz2", ".xz", ".zst", ".7z", ".rar",
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4",
        ".mp3", ".aac", ".flac", ".ogg", ".m4a", ".webm",
        ".pdf", ".docx", ".xlsx", ".pptx",
    ];
    let lower = filename.to_lowercase();
    compressed.iter().any(|ext| lower.ends_with(ext))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_decompress() {
        let data = vec![b'a'; 1_000_000];
        let comp = compress(&data, 3).unwrap();
        assert!(comp.len() < data.len(), "compressible data should shrink");
        let out = decompress(&comp).unwrap();
        assert_eq!(out, data);
    }

    #[test]
    fn test_compress_incompressible() {
        // Random data should stay ~same size but still round-trip
        let data: Vec<u8> = (0..100_000u32).map(|i| (i.wrapping_mul(2654435761)) as u8).collect();
        let comp = compress(&data, 1).unwrap();
        let out = decompress(&comp).unwrap();
        assert_eq!(out, data);
    }

    #[test]
    fn test_is_already_compressed() {
        assert!(is_already_compressed("photo.jpg"));
        assert!(is_already_compressed("archive.zip"));
        assert!(is_already_compressed("audio.MP3"));
        assert!(!is_already_compressed("document.txt"));
        assert!(!is_already_compressed("data.bin"));
    }
}