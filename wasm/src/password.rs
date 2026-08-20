use rand::Rng;

const UPPERCASE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const DIGITS: &[u8] = b"0123456789";
const SYMBOLS: &[u8] = b"!@#$%^&*()_+-=[]{}|;:',.<>/?~";
const DEFAULT_AMBIGUOUS: &[u8] = b"0oOlLiI1";

pub fn generate_password(
    length: u8,
    use_upper: bool,
    use_lower: bool,
    use_digits: bool,
    use_symbols: bool,
    exclude_chars: &str,
) -> Result<String, String> {
    if length < 8 || length > 64 {
        return Err("Password length must be 8-64".to_string());
    }

    // Build the allowed charset, applying exclusions
    let mut charset: Vec<u8> = Vec::new();
    if use_upper {
        charset.extend_from_slice(UPPERCASE);
    }
    if use_lower {
        charset.extend_from_slice(LOWERCASE);
    }
    if use_digits {
        charset.extend_from_slice(DIGITS);
    }
    if use_symbols {
        charset.extend_from_slice(SYMBOLS);
    }

    // Default exclusions (ambiguous) plus user-specified
    let mut excluded: Vec<u8> = DEFAULT_AMBIGUOUS.to_vec();
    for c in exclude_chars.chars() {
        let b = c as u8;
        if !excluded.contains(&b) {
            excluded.push(b);
        }
    }

    charset.retain(|c| !excluded.contains(c));

    if charset.is_empty() {
        return Err("No characters available after exclusions".to_string());
    }

    let mut rng = rand::thread_rng();
    let mut out = String::with_capacity(length as usize);
    for _ in 0..length {
        let idx = rng.gen_range(0..charset.len());
        out.push(charset[idx] as char);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_password_length() {
        for len in [8u8, 15, 32, 64] {
            let p = generate_password(len, true, true, true, true, "").unwrap();
            assert_eq!(p.len() as u8, len);
        }
    }

    #[test]
    fn test_generate_password_charset() {
        // digits only -> all chars must be digits
        let p = generate_password(20, false, false, true, false, "").unwrap();
        assert!(p.bytes().all(|b| b.is_ascii_digit()));
        // uppercase only
        let p = generate_password(20, true, false, false, false, "").unwrap();
        assert!(p.bytes().all(|b| b.is_ascii_uppercase()));
    }

    #[test]
    fn test_generate_password_exclude_ambiguous() {
        let p = generate_password(64, true, true, true, true, "").unwrap();
        for bad in DEFAULT_AMBIGUOUS {
            assert!(!p.as_bytes().contains(bad), "ambiguous char {bad} leaked");
        }
    }

    #[test]
    fn test_custom_exclude() {
        let p = generate_password(32, true, false, false, false, "A,B,C").unwrap();
        assert!(!p.contains('A') && !p.contains('B') && !p.contains('C'));
    }

    #[test]
    fn test_invalid_length() {
        assert!(generate_password(7, true, true, true, true, "").is_err());
        assert!(generate_password(65, true, true, true, true, "").is_err());
    }

    #[test]
    fn test_randomness() {
        let a = generate_password(32, true, true, true, true, "").unwrap();
        let b = generate_password(32, true, true, true, true, "").unwrap();
        assert_ne!(a, b);
    }
}
