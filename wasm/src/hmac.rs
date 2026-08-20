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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hmac_basic() {
        let key = [7u8; 32];
        let mut calc = HmacCalculator::new(&key);
        calc.update(b"data");
        let expected = calc.finalize();
        assert_eq!(expected.len(), 32);
    }

    #[test]
    fn test_hmac_incremental_vs_oneshot() {
        let key = [8u8; 32];
        let data: Vec<u8> = (0..100_000u32).map(|i| (i % 7) as u8).collect();

        let mut oneshot_calc = HmacCalculator::new(&key);
        oneshot_calc.update(&data);
        let oneshot = oneshot_calc.finalize();

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
        let mut c1 = HmacCalculator::new(&k1);
        c1.update(b"x");
        let mut c2 = HmacCalculator::new(&k2);
        c2.update(b"x");
        assert_ne!(c1.finalize(), c2.finalize());
    }
}