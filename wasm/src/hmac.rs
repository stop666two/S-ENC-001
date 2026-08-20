pub use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub struct HmacCalculator {
    inner: HmacSha256,
}

impl HmacCalculator {
    pub fn new(key: &[u8; 32]) -> Self {
        Self {
            inner: HmacSha256::new_from_slice(key).expect("HMAC accepts any key length"),
        }
    }

    pub fn update(&mut self, data: &[u8]) {
        self.inner.update(data);
    }

    pub fn finalize(self) -> [u8; 32] {
        self.inner.finalize().into_bytes().into()
    }
}

pub fn compute_hmac(key: &[u8; 32], data: &[u8]) -> [u8; 32] {
    let mut calc = HmacCalculator::new(key);
    calc.update(data);
    calc.finalize()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hmac_basic() {
        let key = [7u8; 32];
        let expected = compute_hmac(&key, b"data");
        assert_eq!(expected.len(), 32);
    }

    #[test]
    fn test_hmac_incremental_vs_oneshot() {
        let key = [8u8; 32];
        let data: Vec<u8> = (0..100_000u32).map(|i| (i % 7) as u8).collect();

        let oneshot = compute_hmac(&key, &data);

        let mut calc = HmacCalculator::new(&key);
        for chunk in data.chunks(4096) {
            calc.update(chunk);
        }
        let incremental = calc.finalize();
        assert_eq!(oneshot, incremental);
    }

    #[test]
    fn test_hmac_different_keys() {
        let k1 = [1u8; 32];
        let k2 = [2u8; 32];
        assert_ne!(compute_hmac(&k1, b"x"), compute_hmac(&k2, b"x"));
    }
}