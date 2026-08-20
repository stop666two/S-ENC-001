use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

pub const BLOCK_SIZE: usize = 1_048_576; // 1 MB
pub const TAG_SIZE: usize = 16;

/// Encrypt a single block with AES-256-GCM.
/// Returns (ciphertext_including_tag, nonce).
/// The GCM tag is appended to the ciphertext (last 16 bytes).
pub fn encrypt_block(
    key: &[u8; 32],
    plaintext: &[u8],
) -> Result<(Vec<u8>, [u8; 12]), String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("AES init error: {e}"))?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("AES encrypt error: {e}"))?;

    Ok((ciphertext, nonce_bytes))
}

/// Decrypt a single AES-256-GCM block.
/// ciphertext includes the 16-byte tag at the end.
pub fn decrypt_block(
    key: &[u8; 32],
    ciphertext: &[u8],
    nonce: &[u8; 12],
) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("AES init error: {e}"))?;
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Authentication failed".to_string())
}

/// Encrypt data in 1MB blocks.
/// Returns (concatenated_ciphertext, nonces).
pub fn encrypt_stream(
    key: &[u8; 32],
    data: &[u8],
) -> Result<(Vec<u8>, Vec<[u8; 12]>), String> {
    let mut out = Vec::with_capacity(data.len() + data.len() / BLOCK_SIZE * TAG_SIZE + 16);
    let mut nonces = Vec::new();

    for chunk in data.chunks(BLOCK_SIZE) {
        let (ct, nonce) = encrypt_block(key, chunk)?;
        nonces.push(nonce);
        out.extend_from_slice(&ct);
    }

    Ok((out, nonces))
}

/// Decrypt data from blocks.
/// ciphertext is the concatenation; nonces are per-block in order.
pub fn decrypt_stream(
    key: &[u8; 32],
    ciphertext: &[u8],
    nonces: &[[u8; 12]],
) -> Result<Vec<u8>, String> {
    let block_ct_len = BLOCK_SIZE + TAG_SIZE;
    let expected = nonces.len().saturating_mul(block_ct_len);
    if ciphertext.len() > expected + BLOCK_SIZE {
        return Err("Ciphertext longer than expected".to_string());
    }

    let mut out = Vec::with_capacity(ciphertext.len().saturating_sub(nonces.len() * TAG_SIZE));
    let mut offset = 0usize;

    for (i, nonce) in nonces.iter().enumerate() {
        let is_last = i == nonces.len() - 1;
        let chunk_len = if is_last {
            ciphertext.len() - offset
        } else {
            block_ct_len
        };
        if offset + chunk_len > ciphertext.len() || chunk_len < TAG_SIZE {
            return Err("Ciphertext truncated".to_string());
        }
        let ct = &ciphertext[offset..offset + chunk_len];
        let pt = decrypt_block(key, ct, nonce)?;
        out.extend_from_slice(&pt);
        offset += chunk_len;
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> [u8; 32] {
        [42u8; 32]
    }

    #[test]
    fn test_encrypt_decrypt_block() {
        let key = test_key();
        let plaintext = b"hello world, this is a secret message";
        let (ct, nonce) = encrypt_block(&key, plaintext).unwrap();
        let pt = decrypt_block(&key, &ct, &nonce).unwrap();
        assert_eq!(pt, plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_stream() {
        let key = test_key();
        // 2.5 MB -> spans 3 blocks
        let data: Vec<u8> = (0..2_621_440u32).map(|i| (i % 251) as u8).collect();
        let (ct, nonces) = encrypt_stream(&key, &data).unwrap();
        assert_eq!(nonces.len(), 3);
        let pt = decrypt_stream(&key, &ct, &nonces).unwrap();
        assert_eq!(pt, data);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key = test_key();
        let wrong = [1u8; 32];
        let (ct, nonce) = encrypt_block(&key, b"secret").unwrap();
        assert!(decrypt_block(&wrong, &ct, &nonce).is_err());
    }

    #[test]
    fn test_wrong_nonce_fails() {
        let key = test_key();
        let (ct, _nonce) = encrypt_block(&key, b"secret").unwrap();
        let bad_nonce = [9u8; 12];
        assert!(decrypt_block(&key, &ct, &bad_nonce).is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let key = test_key();
        let (mut ct, nonce) = encrypt_block(&key, b"secret").unwrap();
        ct[0] ^= 0xFF;
        assert!(decrypt_block(&key, &ct, &nonce).is_err());
    }

    #[test]
    fn test_empty_data() {
        let key = test_key();
        let (ct, nonces) = encrypt_stream(&key, b"").unwrap();
        assert!(ct.is_empty());
        assert!(nonces.is_empty());
        let pt = decrypt_stream(&key, &ct, &nonces).unwrap();
        assert!(pt.is_empty());
    }
}
