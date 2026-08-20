pub fn split_file(data: &[u8], chunk_size: u64) -> Result<Vec<Vec<u8>>, String> {
    if chunk_size == 0 {
        return Err("chunk_size must be > 0".to_string());
    }
    let cs = chunk_size as usize;
    let mut chunks = Vec::new();
    for chunk in data.chunks(cs) {
        chunks.push(chunk.to_vec());
    }
    if chunks.is_empty() {
        chunks.push(Vec::new());
    }
    Ok(chunks)
}

pub fn merge_files(chunks: &[Vec<u8>]) -> Result<Vec<u8>, String> {
    let total: usize = chunks.iter().map(|c| c.len()).sum();
    let mut out = Vec::with_capacity(total);
    for chunk in chunks {
        out.extend_from_slice(chunk);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_merge() {
        let data: Vec<u8> = (0..1_000_000u32).map(|i| (i % 256) as u8).collect();
        let chunks = split_file(&data, 100_000).unwrap();
        assert_eq!(chunks.len(), 10);
        let merged = merge_files(&chunks).unwrap();
        assert_eq!(merged, data);
    }

    #[test]
    fn test_split_merge_small() {
        let data = b"tiny".to_vec();
        let chunks = split_file(&data, 1024).unwrap();
        assert_eq!(chunks.len(), 1);
        let merged = merge_files(&chunks).unwrap();
        assert_eq!(merged, data);
    }

    #[test]
    fn test_split_merge_exact() {
        let data = vec![5u8; 512];
        let chunks = split_file(&data, 512).unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].len(), 512);
        assert_eq!(merge_files(&chunks).unwrap(), data);
    }

    #[test]
    fn test_empty_data() {
        let chunks = split_file(b"", 1024).unwrap();
        assert_eq!(chunks.len(), 1);
        assert!(chunks[0].is_empty());
        assert!(merge_files(&chunks).unwrap().is_empty());
    }

    #[test]
    fn test_zero_chunk_size_rejected() {
        assert!(split_file(b"x", 0).is_err());
    }
}
