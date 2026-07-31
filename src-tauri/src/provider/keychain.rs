#![allow(dead_code)] // Keychain DTOs behind GIT_SUITE_RELEASE_ENABLED; keychain commands are test-covered.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainSaveInput {
    pub service: String,
    pub account: String,
    pub secret: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainReadInput {
    pub service: String,
    pub account: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainResult {
    pub found: bool,
    pub secret: Option<String>,
    pub error_kind: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum KeychainErrorKind {
    Locked,
    Denied,
    Unavailable,
    NotFound,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicKeychainError {
    pub kind: KeychainErrorKind,
    pub message: String,
}

fn os_keychain_save(service: &str, account: &str, secret: &str) -> Result<(), PublicKeychainError> {
    let entry = keyring::Entry::new(service, account).map_err(|_| PublicKeychainError {
        kind: KeychainErrorKind::Unavailable,
        message: "Keychain is unavailable on this platform.".into(),
    })?;
    entry.set_password(secret).map_err(|e| match e {
        keyring::Error::NoEntry => PublicKeychainError {
            kind: KeychainErrorKind::Unavailable,
            message: "Keychain entry not found.".into(),
        },
        keyring::Error::Ambiguous(_) => PublicKeychainError {
            kind: KeychainErrorKind::Unknown,
            message: "Ambiguous keychain entry.".into(),
        },
        e => PublicKeychainError {
            kind: KeychainErrorKind::Unknown,
            message: e.to_string(),
        },
    })
}

fn os_keychain_read(service: &str, account: &str) -> Result<Option<String>, PublicKeychainError> {
    let entry = keyring::Entry::new(service, account).map_err(|_| PublicKeychainError {
        kind: KeychainErrorKind::Unavailable,
        message: "Keychain is unavailable.".into(),
    })?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(PublicKeychainError {
            kind: KeychainErrorKind::Unknown,
            message: e.to_string(),
        }),
    }
}

fn os_keychain_delete(service: &str, account: &str) -> Result<(), PublicKeychainError> {
    let entry = keyring::Entry::new(service, account).map_err(|_| PublicKeychainError {
        kind: KeychainErrorKind::Unavailable,
        message: "Keychain is unavailable.".into(),
    })?;
    // keyring v3: delete by setting empty secret
    match entry.set_password("") {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(PublicKeychainError {
            kind: KeychainErrorKind::Unknown,
            message: e.to_string(),
        }),
    }
}

// Tauri commands — registered in lib.rs

#[tauri::command]
pub fn keychain_save(input: KeychainSaveInput) -> Result<(), PublicKeychainError> {
    os_keychain_save(&input.service, &input.account, &input.secret)
}

#[tauri::command]
pub fn keychain_read(input: KeychainReadInput) -> Result<String, PublicKeychainError> {
    os_keychain_read(&input.service, &input.account).and_then(|s| {
        s.ok_or_else(|| PublicKeychainError {
            kind: KeychainErrorKind::NotFound,
            message: "Secret not found.".into(),
        })
    })
}

#[tauri::command]
pub fn keychain_delete(input: KeychainReadInput) -> Result<(), PublicKeychainError> {
    os_keychain_delete(&input.service, &input.account)
}
