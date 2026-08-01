use crate::source_control::contracts::PublicSourceControlError;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceControlScopeRecord {
    pub scope_id: String,
    pub project_id: String,
    pub trunk_id: String,
    pub project_root: PathBuf,
    pub checkout_path: PathBuf,
    pub checkout_identity: String,
    pub repository_identity: Option<String>,
    pub managed_by_app: bool,
}

#[derive(Clone, Default)]
pub struct SourceControlScopeRegistry {
    scopes: Arc<RwLock<HashMap<String, SourceControlScopeRecord>>>,
}

impl SourceControlScopeRegistry {
    pub fn register(&self, mut record: SourceControlScopeRecord) -> String {
        let scope_id = uuid::Uuid::new_v4().to_string();
        record.scope_id = scope_id.clone();
        let mut scopes = self
            .scopes
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        scopes.insert(scope_id.clone(), record);
        scope_id
    }

    pub fn resolve(
        &self,
        scope_id: &str,
        operation: &'static str,
    ) -> Result<SourceControlScopeRecord, PublicSourceControlError> {
        let scopes = self
            .scopes
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        scopes.get(scope_id).cloned().ok_or_else(|| {
            PublicSourceControlError::checkout_invalid(
                operation,
                "The SourceControl checkout scope is invalid.",
            )
        })
    }

    pub fn replace_repository_metadata(
        &self,
        scope_id: &str,
        repository_identity: Option<String>,
    ) -> Result<(), PublicSourceControlError> {
        let mut scopes = self
            .scopes
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let Some(record) = scopes.get_mut(scope_id) else {
            return Err(PublicSourceControlError::checkout_invalid(
                "replace_repository_metadata",
                "The SourceControl checkout scope is invalid.",
            ));
        };
        record.repository_identity = repository_identity;
        Ok(())
    }

    pub fn invalidate(&self, scope_id: &str) {
        self.scopes
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(scope_id);
    }

    pub fn invalidate_trunk(&self, trunk_id: &str) {
        self.scopes
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .retain(|_, record| record.trunk_id != trunk_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scope_record(trunk_id: &str) -> SourceControlScopeRecord {
        SourceControlScopeRecord {
            scope_id: String::new(),
            project_id: "project-1".into(),
            trunk_id: trunk_id.into(),
            project_root: PathBuf::from("/project"),
            checkout_path: PathBuf::from("/project"),
            checkout_identity: "checkout:/project".into(),
            repository_identity: Some("repository:/project/.git".into()),
            managed_by_app: false,
        }
    }

    #[test]
    fn issues_opaque_scope_and_resolves_canonical_record() {
        let registry = SourceControlScopeRegistry::default();
        let scope_id = registry.register(scope_record("trunk-1"));
        assert!(!scope_id.is_empty());
        assert!(!scope_id.contains('/'));
        assert_eq!(
            registry.resolve(&scope_id, "test").unwrap().trunk_id,
            "trunk-1"
        );
    }

    #[test]
    fn rejects_unknown_scope_as_checkout_invalid() {
        let error = SourceControlScopeRegistry::default()
            .resolve("missing", "test")
            .unwrap_err();
        assert_eq!(
            error.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );
    }

    #[test]
    fn invalidating_trunk_removes_every_scope_for_that_trunk() {
        let registry = SourceControlScopeRegistry::default();
        let first = registry.register(scope_record("trunk-1"));
        let second = registry.register(scope_record("trunk-1"));
        registry.invalidate_trunk("trunk-1");
        assert!(registry.resolve(&first, "test").is_err());
        assert!(registry.resolve(&second, "test").is_err());
    }
}
