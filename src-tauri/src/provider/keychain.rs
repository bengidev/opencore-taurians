#![allow(dead_code)] // Keychain DTOs and credential-store helpers consumed by provider commands and tests.

#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::provider::contracts::{
    ProviderCredentialRef, ProviderCredentialSaveInput, ProviderCredentialSaveResult,
    ProviderCredentialStatus, StoredProviderCredential,
};

pub const PROVIDER_CREDENTIAL_SERVICE: &str = "opencore-taurians.provider";

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

pub trait ProviderCredentialStore: Send + Sync {
    fn save(
        &self,
        credential_id: &str,
        credential: &StoredProviderCredential,
    ) -> Result<(), PublicKeychainError>;
    fn read(&self, credential_id: &str) -> Result<StoredProviderCredential, PublicKeychainError>;
    fn delete(&self, credential_id: &str) -> Result<(), PublicKeychainError>;
}

pub struct KeychainCredentialStore;

impl ProviderCredentialStore for KeychainCredentialStore {
    fn save(
        &self,
        credential_id: &str,
        credential: &StoredProviderCredential,
    ) -> Result<(), PublicKeychainError> {
        let payload = serde_json::to_string(credential).map_err(|e| PublicKeychainError {
            kind: KeychainErrorKind::Unknown,
            message: e.to_string(),
        })?;
        os_keychain_save(PROVIDER_CREDENTIAL_SERVICE, credential_id, &payload)
    }

    fn read(&self, credential_id: &str) -> Result<StoredProviderCredential, PublicKeychainError> {
        let payload =
            os_keychain_read(PROVIDER_CREDENTIAL_SERVICE, credential_id)?.ok_or_else(|| {
                PublicKeychainError {
                    kind: KeychainErrorKind::NotFound,
                    message: "Credential not found.".into(),
                }
            })?;
        serde_json::from_str(&payload).map_err(|e| PublicKeychainError {
            kind: KeychainErrorKind::Unknown,
            message: e.to_string(),
        })
    }

    fn delete(&self, credential_id: &str) -> Result<(), PublicKeychainError> {
        os_keychain_delete(PROVIDER_CREDENTIAL_SERVICE, credential_id)
    }
}

#[cfg(test)]
pub struct InMemoryCredentialStore {
    entries: Mutex<HashMap<String, StoredProviderCredential>>,
}

#[cfg(test)]
impl InMemoryCredentialStore {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }
}

#[cfg(test)]
impl Default for InMemoryCredentialStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
impl ProviderCredentialStore for InMemoryCredentialStore {
    fn save(
        &self,
        credential_id: &str,
        credential: &StoredProviderCredential,
    ) -> Result<(), PublicKeychainError> {
        self.entries
            .lock()
            .map_err(|_| PublicKeychainError {
                kind: KeychainErrorKind::Unavailable,
                message: "Credential store lock poisoned.".into(),
            })?
            .insert(credential_id.to_string(), credential.clone());
        Ok(())
    }

    fn read(&self, credential_id: &str) -> Result<StoredProviderCredential, PublicKeychainError> {
        self.entries
            .lock()
            .map_err(|_| PublicKeychainError {
                kind: KeychainErrorKind::Unavailable,
                message: "Credential store lock poisoned.".into(),
            })?
            .get(credential_id)
            .cloned()
            .ok_or_else(|| PublicKeychainError {
                kind: KeychainErrorKind::NotFound,
                message: "Credential not found.".into(),
            })
    }

    fn delete(&self, credential_id: &str) -> Result<(), PublicKeychainError> {
        self.entries
            .lock()
            .map_err(|_| PublicKeychainError {
                kind: KeychainErrorKind::Unavailable,
                message: "Credential store lock poisoned.".into(),
            })?
            .remove(credential_id);
        Ok(())
    }
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
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(PublicKeychainError {
            kind: KeychainErrorKind::Unknown,
            message: e.to_string(),
        }),
    }
}

pub fn save_provider_credential(
    store: &dyn ProviderCredentialStore,
    input: ProviderCredentialSaveInput,
) -> Result<ProviderCredentialSaveResult, PublicKeychainError> {
    let credential_id = uuid::Uuid::new_v4().to_string();
    let credential = StoredProviderCredential {
        kind: input.kind.clone(),
        account: input.account.clone(),
        secret: input.secret,
    };
    store.save(&credential_id, &credential)?;
    Ok(ProviderCredentialSaveResult {
        credential_id,
        kind: input.kind,
        account: input.account,
    })
}

pub fn lookup_provider_credential_status(
    store: &dyn ProviderCredentialStore,
    input: ProviderCredentialRef,
) -> Result<ProviderCredentialStatus, PublicKeychainError> {
    match store.read(&input.credential_id) {
        Ok(credential) => Ok(ProviderCredentialStatus {
            credential_id: input.credential_id,
            kind: credential.kind,
            account: credential.account,
            found: true,
        }),
        Err(error) if error.kind == KeychainErrorKind::NotFound => Ok(ProviderCredentialStatus {
            credential_id: input.credential_id,
            kind: crate::provider::contracts::ProviderKind::Github,
            account: String::new(),
            found: false,
        }),
        Err(error) => Err(error),
    }
}

pub fn delete_provider_credential(
    store: &dyn ProviderCredentialStore,
    input: ProviderCredentialRef,
) -> Result<(), PublicKeychainError> {
    store.delete(&input.credential_id)
}

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

#[tauri::command]
pub fn provider_credential_save(
    input: ProviderCredentialSaveInput,
) -> Result<ProviderCredentialSaveResult, PublicKeychainError> {
    save_provider_credential(&KeychainCredentialStore, input)
}

#[tauri::command]
pub fn provider_credential_status(
    input: ProviderCredentialRef,
) -> Result<ProviderCredentialStatus, PublicKeychainError> {
    lookup_provider_credential_status(&KeychainCredentialStore, input)
}

#[tauri::command]
pub fn provider_credential_delete(input: ProviderCredentialRef) -> Result<(), PublicKeychainError> {
    delete_provider_credential(&KeychainCredentialStore, input)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::contracts::ProviderKind;

    fn sample_credential(secret: &str) -> StoredProviderCredential {
        StoredProviderCredential {
            kind: ProviderKind::Github,
            account: "octocat".into(),
            secret: secret.into(),
        }
    }

    #[test]
    fn in_memory_store_uses_fixed_namespace_semantics_via_credential_id() {
        let store = InMemoryCredentialStore::new();
        let credential_id = "cred-123";
        store
            .save(credential_id, &sample_credential("ghp_secret"))
            .unwrap();

        let loaded = store.read(credential_id).unwrap();
        assert_eq!(loaded.kind, ProviderKind::Github);
        assert_eq!(loaded.account, "octocat");
        assert_eq!(loaded.secret, "ghp_secret");
    }

    #[test]
    fn read_after_delete_returns_not_found() {
        let store = InMemoryCredentialStore::new();
        let credential_id = "cred-456";
        store
            .save(credential_id, &sample_credential("token"))
            .unwrap();
        store.delete(credential_id).unwrap();

        let result = store.read(credential_id);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().kind, KeychainErrorKind::NotFound);
    }

    #[test]
    fn deleting_missing_credential_is_idempotent() {
        let store = InMemoryCredentialStore::new();
        store.delete("missing-id").unwrap();
    }

    #[test]
    fn save_provider_credential_returns_opaque_id_without_secret() {
        let store = InMemoryCredentialStore::new();
        let result = save_provider_credential(
            &store,
            ProviderCredentialSaveInput {
                kind: ProviderKind::Github,
                account: "octocat".into(),
                secret: "ghp_secret".into(),
            },
        )
        .unwrap();

        assert!(!result.credential_id.is_empty());
        assert_eq!(result.kind, ProviderKind::Github);
        assert_eq!(result.account, "octocat");
        let serialized = serde_json::to_string(&result).unwrap();
        assert!(!serialized.contains("ghp_secret"));
        assert!(!serialized.contains("secret"));
    }

    #[test]
    fn provider_credential_status_never_returns_secret() {
        let store = InMemoryCredentialStore::new();
        let saved = save_provider_credential(
            &store,
            ProviderCredentialSaveInput {
                kind: ProviderKind::Gitlab,
                account: "dev".into(),
                secret: "glpat_secret".into(),
            },
        )
        .unwrap();

        let status = lookup_provider_credential_status(
            &store,
            ProviderCredentialRef {
                credential_id: saved.credential_id.clone(),
            },
        )
        .unwrap();

        assert!(status.found);
        assert_eq!(status.account, "dev");
        let serialized = serde_json::to_string(&status).unwrap();
        assert!(!serialized.contains("glpat_secret"));
        assert!(!serialized.contains("secret"));
    }

    #[test]
    fn provider_credential_service_namespace_is_fixed() {
        assert_eq!(PROVIDER_CREDENTIAL_SERVICE, "opencore-taurians.provider");
    }
}
