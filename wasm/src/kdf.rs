use argon2::{Argon2, Algorithm, Version, Params};
use hkdf::Hkdf;
use sha2::{Sha512, Digest};
use zeroize::Zeroize;

pub const SALT_LEN: usize = 16;
pub const ENTROPY_LEN: usize = 16;
pub const TIMESTAMP_LEN: usize = 8;

/// Derive encKey and hmacKey from password and auxiliary inputs.
///
/// Pipeline (per design doc section 3.1):
/// 1. input = P + (Fh ? Fh : "") + (R ? R : "")
/// 2. K1 = Argon2id(input, S1, memory=65536, iterations=3, parallelism=1, outputLen=32)
/// 3. H0 = SHA-512(K1 || E || T) -> 64 bytes
///    Split into B1..B4 (16 bytes each); K2 = SHA512(B1)||...||SHA512(B4) = 256 bytes
/// 4. encKey = HKDF(K2, "", "AES-256-GCM", 32)
///    hmacKey = HKDF(K2, "", "HMAC-SHA256", 32)
/// 5. Zeroize all intermediates
pub fn derive_keys(
    password: &str,
    salt: &[u8; SALT_LEN],
    entropy: &[u8; ENTROPY_LEN],
    timestamp: &[u8; TIMESTAMP_LEN],
    key_file_hash: Option<&[u8; 32]>,
    recovery_phrase: Option<&str>,
) -> Result<([u8; 32], [u8; 32]), String> {
    // 1. Build input
    let mut input: Vec<u8> = Vec::with_capacity(256);
    input.extend_from_slice(password.as_bytes());
    if let Some(fh) = key_file_hash {
        input.extend_from_slice(fh);
    }
    if let Some(r) = recovery_phrase {
        input.extend_from_slice(r.as_bytes());
    }

    // 2. Argon2id
    let params = Params::new(65536, 3, 1, Some(32))
        .map_err(|e| format!("Argon2 params error: {e}"))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut k1 = [0u8; 32];
    argon.hash_password_into(&input, salt, &mut k1)
        .map_err(|e| format!("Argon2 error: {e}"))?;

    // 3. SHA-512 mixing
    let mut h0_input: Vec<u8> = Vec::with_capacity(32 + 16 + 8);
    h0_input.extend_from_slice(&k1);
    h0_input.extend_from_slice(entropy);
    h0_input.extend_from_slice(timestamp);
    let h0 = Sha512::digest(&h0_input);

    let mut k2: Vec<u8> = Vec::with_capacity(256);
    for chunk in h0.chunks(16) {
        let mut block = [0u8; 16];
        block.copy_from_slice(chunk);
        let digest = Sha512::digest(&block);
        k2.extend_from_slice(&digest);
        block.zeroize();
    }

    // 4. HKDF split
    let hk = Hkdf::<Sha512>::new(None, &k2);
    let mut enc_key = [0u8; 32];
    let mut hmac_key = [0u8; 32];
    hk.expand(b"AES-256-GCM", &mut enc_key)
        .map_err(|e| format!("HKDF expand error: {e}"))?;
    hk.expand(b"HMAC-SHA256", &mut hmac_key)
        .map_err(|e| format!("HKDF expand error: {e}"))?;

    // 5. Zeroize intermediates
    input.zeroize();
    k1.zeroize();
    h0_input.zeroize();
    k2.zeroize();

    Ok((enc_key, hmac_key))
}

pub fn zeroize_bytes(data: &mut [u8]) {
    data.zeroize();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_keys_deterministic() {
        let salt = [1u8; 16];
        let entropy = [2u8; 16];
        let ts = 0u64.to_be_bytes();
        let (ek1, hk1) = derive_keys("password123", &salt, &entropy, &ts, None, None).unwrap();
        let (ek2, hk2) = derive_keys("password123", &salt, &entropy, &ts, None, None).unwrap();
        assert_eq!(ek1, ek2);
        assert_eq!(hk1, hk2);
        assert_ne!(ek1, hk1);
    }

    #[test]
    fn test_derive_keys_different_password() {
        let salt = [1u8; 16];
        let entropy = [2u8; 16];
        let ts = 0u64.to_be_bytes();
        let (ek1, _) = derive_keys("password123", &salt, &entropy, &ts, None, None).unwrap();
        let (ek2, _) = derive_keys("password124", &salt, &entropy, &ts, None, None).unwrap();
        assert_ne!(ek1, ek2);
    }

    #[test]
    fn test_derive_keys_with_key_file() {
        let salt = [3u8; 16];
        let entropy = [4u8; 16];
        let ts = 1u64.to_be_bytes();
        let fh = [9u8; 32];
        let (ek1, _) = derive_keys("pw", &salt, &entropy, &ts, Some(&fh), None).unwrap();
        let (ek2, _) = derive_keys("pw", &salt, &entropy, &ts, None, None).unwrap();
        assert_ne!(ek1, ek2, "key file hash must change derived key");
    }

    #[test]
    fn test_derive_keys_with_recovery_phrase() {
        let salt = [5u8; 16];
        let entropy = [6u8; 16];
        let ts = 2u64.to_be_bytes();
        let (ek1, _) = derive_keys("pw", &salt, &entropy, &ts, None, Some("abandon ability")).unwrap();
        let (ek2, _) = derive_keys("pw", &salt, &entropy, &ts, None, None).unwrap();
        assert_ne!(ek1, ek2, "recovery phrase must change derived key");
    }
}
