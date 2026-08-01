# Source Control Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair every blocking finding from PR #43 and deliver a scoped, cancellable, provider-capable source-control suite with green local and GitHub CI.

**Architecture:** Desktop issues runtime-only opaque checkout scope IDs and resolves all filesystem/process authority from managed state. Per-repository operation coordination, subscriber-aware watches, namespaced credentials, provider dispatch, and safe worktree lifecycles remain in Rust; React stores runtime scope IDs and renders typed state only.

**Tech Stack:** Rust 2021, Tauri 2, Git CLI, reqwest, keyring 3, notify 8, React 19, TypeScript 7, Zustand, Vitest, Testing Library.

## Global Constraints

- Follow `src-tauri/docs/adr/0001-rust-first-desktop-boundary.md`: native I/O, processes, credentials, and path authority stay in Desktop.
- Use a clean cutover. Migrate every caller and remove path-based source-control command contracts; leave no aliases or deprecated shims.
- Persist checkout restore metadata but never persist runtime scope IDs or credentials.
- Reject absolute pathspecs, NULs, and lexical parent traversal before Git or filesystem access.
- Pass Git arguments directly without shell interpolation and insert `--` before pathspecs.
- Preserve the existing uncommitted CI repairs; do not revert the Explorer fixture, Rust formatting, or clippy fixes.
- Add behavior tests before production changes and observe each regression fail for the intended reason.
- Keep provider tests deterministic with fake transport and credential stores; CI must not require network or a real keychain.
- Use ASCII in new source and test content.

---

### Task 1: Preserve The Green CI Baseline

**Files:**
- Modify: `src/modules/explorer/ui/ExplorerPanel.test.tsx`
- Modify: `src/modules/explorer/ui/ExplorerTree.test.tsx`
- Modify: Rust files already changed by `cargo fmt`
- Modify: `src-tauri/src/editor/create.rs`
- Modify: `src-tauri/src/editor/mod.rs`
- Modify: `src-tauri/src/explorer/mod.rs`
- Modify: `src-tauri/src/path_scope.rs`

**Interfaces:**
- Consumes: Existing PR branch plus the review-session CI repairs.
- Produces: A focused baseline commit with no behavioral source-control redesign yet.

- [ ] **Step 1: Verify the existing review repairs remain present**

Confirm Explorer UI test fixtures call `useWorkspaceStore` through `createActiveProject`, Rust is formatted, unused internal re-exports are gone, and `PathScopeError` contains only constructed variants.

- [ ] **Step 2: Run the repaired baseline checks**

Run:

```bash
bunx vitest run src/modules/explorer/ui/ExplorerPanel.test.tsx src/modules/explorer/ui/ExplorerTree.test.tsx
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

Expected: 26 Explorer tests pass; formatting and clippy exit 0.

- [ ] **Step 3: Commit the baseline repairs**

```bash
git add src/modules/explorer/ui/ExplorerPanel.test.tsx src/modules/explorer/ui/ExplorerTree.test.tsx src-tauri/src
git commit -m "ci: repair source-control suite checks"
```

---

### Task 2: Add Desktop Checkout Scope Authority

**Files:**
- Create: `src-tauri/src/source_control/scope_registry.rs`
- Modify: `src-tauri/src/source_control/mod.rs`
- Modify: `src-tauri/src/source_control/contracts.rs`
- Modify: `src-tauri/src/source_control/scope.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/source_control/scope_registry.rs`
- Test: `src-tauri/src/source_control/scope.rs`

**Interfaces:**
- Consumes: Canonical checkout information produced by `detect_repository` and persisted `SourceControlCheckoutRestore`.
- Produces:

```rust
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

#[derive(Default)]
pub struct SourceControlScopeRegistry {
    scopes: RwLock<HashMap<String, SourceControlScopeRecord>>,
}

impl SourceControlScopeRegistry {
    pub fn register(&self, record: SourceControlScopeRecord) -> String;
    pub fn resolve(
        &self,
        scope_id: &str,
        operation: &'static str,
    ) -> Result<SourceControlScopeRecord, PublicSourceControlError>;
    pub fn replace_repository_metadata(
        &self,
        scope_id: &str,
        repository_identity: Option<String>,
    ) -> Result<(), PublicSourceControlError>;
    pub fn invalidate(&self, scope_id: &str);
    pub fn invalidate_trunk(&self, trunk_id: &str);
}
```

`ResolvedSourceControlCheckout` gains serialized `scope_id` / `scopeId`. `SourceControlResolveCheckoutResult::Ready` always contains a freshly registered scope.

- [ ] **Step 1: Write failing scope-registry tests**

Add tests proving:

```rust
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
    assert_eq!(registry.resolve(&scope_id, "test").unwrap().trunk_id, "trunk-1");
}

#[test]
fn rejects_unknown_scope_as_checkout_invalid() {
    let error = SourceControlScopeRegistry::default()
        .resolve("missing", "test")
        .unwrap_err();
    assert_eq!(error.code, PublicSourceControlErrorCode::CheckoutInvalid);
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
```

Also update checkout-resolution tests to require a non-empty scope ID that is not a filesystem path.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control::scope
```

Expected: compilation/tests fail because the registry and `scope_id` contract do not exist.

- [ ] **Step 3: Implement the registry and resolution registration**

Create the registry with `RwLock<HashMap<String, SourceControlScopeRecord>>`, UUID v4 scope IDs, cloned records on resolve, and typed `checkout-invalid` failures. Pass `State<SourceControlScopeRegistry>` into `git_resolve_checkout`, register both repository and non-repository Project roots, and manage the registry in `lib.rs`.

- [ ] **Step 4: Run scope tests and verify GREEN**

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control::scope
```

Expected: all scope and checkout-resolution tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/source_control src-tauri/src/lib.rs
git commit -m "feat(source-control): issue scoped checkout tokens"
```

---

### Task 3: Cut Local Git Commands Over To Scope IDs

**Files:**
- Modify: `src-tauri/src/source_control/repository.rs`
- Modify: `src-tauri/src/source_control/diff.rs`
- Modify: `src-tauri/src/source_control/mutations.rs`
- Modify: `src-tauri/src/source_control/history.rs`
- Modify: `src-tauri/src/source_control/refs.rs`
- Modify: `src-tauri/src/source_control/remote.rs`
- Modify: `src-tauri/src/source_control/submodule.rs`
- Modify: `src-tauri/src/source_control/lfs.rs`
- Modify: `src-tauri/src/source_control/hooks.rs`
- Modify: `src-tauri/src/source_control/clone.rs`
- Modify: `src-tauri/src/source_control/mod.rs`
- Modify: `src/modules/source-control/api/sourceControlContracts.ts`
- Modify: `src/modules/source-control/api/sourceControlApi.ts`
- Modify: `src/modules/source-control/api/createMemorySourceControlApi.ts`
- Modify: `src/modules/source-control/api/sourceControlApi.test.ts`
- Modify: `src/modules/source-control/state/sourceControlStore.ts`
- Modify: `src/modules/source-control/state/sourceControlStore.test.ts`
- Modify: `src/modules/project/state/projectActivation.ts`
- Modify: `src/modules/project/state/projectActivation.test.ts`

**Interfaces:**
- Consumes: `SourceControlScopeRegistry::resolve` and `ResolvedSourceControlCheckout.scopeId`.
- Produces: Every local Git input uses `scope_id: String` / `scopeId: string`; command implementations obtain checkout, Project, trunk, and repository identity from Desktop state.

Representative Rust DTO:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlStageInput {
    pub scope_id: String,
    pub paths: Vec<String>,
    pub mode: SourceControlStageMode,
}
```

Representative App call:

```ts
api.stage({ scopeId: checkout.scopeId, paths: [file.path], mode: "stage" });
```

- [ ] **Step 1: Change API tests first**

Update invoke tests to expect `scopeId` and explicitly assert that payloads contain no `checkoutPath` for snapshot, initialize, diff, mutation, remote, refs, history, submodule, LFS, hooks, and scoped clone operations.

- [ ] **Step 2: Run App API tests and verify RED**

```bash
npx --no-install vitest run src/modules/source-control/api/sourceControlApi.test.ts src/modules/source-control/state/sourceControlStore.test.ts src/modules/project/state/projectActivation.test.ts
```

Expected: failures show existing path-based payloads and missing `scopeId`.

- [ ] **Step 3: Migrate Rust DTOs and commands**

Inject `State<SourceControlScopeRegistry>` into every Tauri command. Keep pure `_with` functions testable by accepting `&SourceControlScopeRecord`. Delete direct `Path::new(&input.checkout_path)` use from public command paths.

For clone, use a registered directory scope as the destination parent and accept a relative `destination_name`; reject separators and traversal in the name.

- [ ] **Step 4: Migrate App contracts, API, memory API, stores, and activation**

Add `scopeId` to runtime checkout data, remove path fields from operation inputs, and update all callers. Keep `checkoutPath` only as display/runtime metadata on the resolved checkout and snapshot, never as command authority.

- [ ] **Step 5: Run targeted Rust and App tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control
npx --no-install vitest run src/modules/source-control src/modules/project/state/projectActivation.test.ts
```

Expected: all migrated contracts compile and pass; no production App caller sends `checkoutPath` as authority.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/source_control src-tauri/src/lib.rs src/modules/source-control src/modules/project/state/projectActivation.ts src/modules/project/state/projectActivation.test.ts
git commit -m "refactor(source-control): enforce scoped command authority"
```

---

### Task 4: Correct Git Mutations And Porcelain Parsing

**Files:**
- Modify: `src-tauri/src/source_control/mutations.rs`
- Modify: `src-tauri/src/source_control/parse.rs`
- Modify: `src-tauri/src/source_control/process.rs`
- Test: `src-tauri/src/source_control/mutations.rs`
- Test: `src-tauri/src/source_control/parse.rs`

**Interfaces:**
- Consumes: A validated `SourceControlScopeRecord` and relative pathspecs.
- Produces:

```rust
pub fn validate_relative_pathspec(path: &str) -> Result<PathBuf, PublicSourceControlError>;
pub fn resolve_scoped_target(
    scope: &SourceControlScopeRecord,
    pathspec: &str,
) -> Result<PathBuf, PublicSourceControlError>;
```

Mutation commands pass individual path arguments after `--`. Selected-file commit adds Git's `--only` flag and passes each selected path as its own argument after `--`.

- [ ] **Step 1: Add failing real-repository mutation tests**

Add this regression first, using the existing repository initializer plus a `scope_for(path)` fixture returning a canonical `SourceControlScopeRecord`:

```rust
#[test]
fn discards_multiple_tracked_paths() {
    let dir = tempdir().unwrap();
    init(dir.path());
    fs::write(dir.path().join("a.txt"), "base").unwrap();
    fs::write(dir.path().join("b.txt"), "base").unwrap();
    git(dir.path(), &["add", "a.txt", "b.txt"]);
    git(dir.path(), &["commit", "-m", "base"]);
    fs::write(dir.path().join("a.txt"), "changed").unwrap();
    fs::write(dir.path().join("b.txt"), "changed").unwrap();

    discard_with(
        &SystemGitProcess,
        &scope_for(dir.path()),
        SourceControlDiscardInput {
            scope_id: "scope-1".into(),
            paths: vec!["a.txt".into(), "b.txt".into()],
            mode: SourceControlDiscardMode::Tracked,
        },
    )
    .unwrap();

    assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "base");
    assert_eq!(fs::read_to_string(dir.path().join("b.txt")).unwrap(), "base");
}
```

Add equally focused tests named `discards_untracked_file_and_directory_inside_scope`, `rejects_absolute_and_parent_traversing_pathspecs`, `commits_on_new_branch`, and `selected_file_commit_preserves_unrelated_staged_change`. Each test creates its own temporary repository, invokes the public behavior through `*_with`, and asserts filesystem, HEAD branch, commit contents, and unrelated index contents rather than mock call counts.

- [ ] **Step 2: Add failing parser tests from real porcelain bytes**

Create temporary repositories that produce a staged rename and merge conflict, then feed `git status --porcelain=v2 --branch -z --ignored=no` output into `parse_porcelain_v2`. Assert `old_path == "old.txt"` for the rename and `path == "conflict.txt"` for the unmerged record.

- [ ] **Step 3: Run tests and verify RED**

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control::mutations source_control::parse
```

Expected: multi-path discard, untracked discard, new branch, selected file, rename old path, and conflict path tests fail for the reviewed reasons.

- [ ] **Step 4: Implement scoped mutation helpers and valid Git commands**

Use `Component` validation for pathspecs. Resolve untracked targets beneath the canonical checkout and remove files or directories only after `starts_with(checkout_path)`. Build tracked/stage/unstage arguments as separate `OsString`s with `--`.

Create a new branch using `git switch -c <name>` before commit. Use `--only` plus selected pathspecs for selected-file commit and leave unrelated staged entries intact.

- [ ] **Step 5: Implement NUL-record parsing with lookahead**

Iterate with `peekable()`. Record kind `2` consumes the next NUL record as `old_path`; kind `u` uses `splitn(11, ' ')` and field 10 as the path.

- [ ] **Step 6: Run targeted tests and verify GREEN**

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control::mutations source_control::parse
```

Expected: all regression tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/source_control/mutations.rs src-tauri/src/source_control/parse.rs src-tauri/src/source_control/process.rs
git commit -m "fix(source-control): scope mutations and parse status records"
```

---

### Task 5: Implement Operation Coordination And Cancellation

**Files:**
- Modify: `src-tauri/src/source_control/coordinator.rs`
- Modify: `src-tauri/src/source_control/process.rs`
- Modify: `src-tauri/src/source_control/mod.rs`
- Modify: `src-tauri/src/source_control/contracts.rs`
- Modify: `src-tauri/src/quit.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/source_control/mutations.rs`
- Modify: `src-tauri/src/source_control/remote.rs`
- Modify: `src-tauri/src/source_control/refs.rs`
- Modify: `src-tauri/src/source_control/submodule.rs`
- Modify: `src-tauri/src/source_control/lfs.rs`
- Modify: `src-tauri/src/source_control/worktree.rs`
- Modify: `src-tauri/src/source_control/clone.rs`
- Modify: `src/modules/source-control/api/sourceControlApi.ts`
- Modify: `src/modules/source-control/state/sourceControlStore.ts`
- Test: `src-tauri/src/source_control/coordinator.rs`
- Test: `src-tauri/src/source_control/process.rs`
- Test: `src/modules/source-control/state/sourceControlStore.test.ts`

**Interfaces:**
- Consumes: scope repository/trunk identity and `tauri::AppHandle`.
- Produces:

```rust
pub struct SourceControlOperationContext {
    pub operation_id: String,
    pub repository_id: String,
    pub trunk_id: String,
    pub cancellation: Arc<AtomicBool>,
}

impl SourceControlOperationCoordinatorState {
    pub fn begin(
        &self,
        scope: &SourceControlScopeRecord,
        app: &tauri::AppHandle,
        quit: &QuitGuard,
        phase: &'static str,
    ) -> Result<SourceControlOperationGuard, PublicSourceControlError>;
    pub fn cancel(&self, operation_id: &str) -> Result<(), PublicSourceControlError>;
}
```

`SourceControlCommandSpec` carries an optional cancellation flag. `SystemGitProcess::run` checks it in the existing poll loop, kills and waits for the child, and returns `PublicSourceControlError::cancelled`.

- [ ] **Step 1: Write failing coordinator invariant tests**

Test that same-repository mutations serialize, different repositories proceed independently, cancellation while running sets the flag, unknown operation IDs return `not-found`, and every guard drop restores `QuitGuard` and queue counts.

- [ ] **Step 2: Write failing process cancellation test**

Run a deterministic long-lived child through a test-only process fixture, cancel it, and assert the returned public code is `Cancelled` and no child remains active.

- [ ] **Step 3: Run Rust tests and verify RED**

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control::coordinator source_control::process quit
```

Expected: failures show the existing no-op cancellation and missing guard cleanup.

- [ ] **Step 4: Implement queue permits, cancellation flags, events, and RAII cleanup**

Emit `sourceControl://operation` started/progress/terminal events from the guard. Ensure the terminal event is emitted once. Register `git_operation_cancel` in `mod.rs` and `lib.rs`.

- [ ] **Step 5: Wrap mutation and network commands**

Use the coordinator for stage, discard, commit, stash, fetch, pull, push, ref mutations, submodule mutations, LFS mutations, worktree mutations, and clone. Parsed reads remain uncoordinated. Provider mutations introduced in Task 8 use this same coordinator contract.

- [ ] **Step 6: Update App lifecycle tests**

Assert `activeOperations` adds on started, removes on every terminal kind, and `cancelOperation` invokes the now-registered command contract.

- [ ] **Step 7: Run Rust and App tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control::coordinator source_control::process quit
npx --no-install vitest run src/modules/source-control/state/sourceControlStore.test.ts src/modules/source-control/api/sourceControlApi.test.ts
```

Expected: coordinator, cancellation, event, and store tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/source_control src-tauri/src/quit.rs src-tauri/src/lib.rs src/modules/source-control
git commit -m "feat(source-control): coordinate and cancel operations"
```

---

### Task 6: Repair Worktree Lifecycle And Project Persistence

**Files:**
- Modify: `src-tauri/src/source_control/worktree.rs`
- Modify: `src-tauri/src/source_control/scope_registry.rs`
- Modify: `src/modules/project/state/projectStore.ts`
- Modify: `src/modules/project/state/projectWorktreeActions.ts`
- Modify: `src/modules/project/domain/projectDeletionActions.ts`
- Modify: `src/modules/project/ui/projectTrunkTree.tsx`
- Test: `src-tauri/src/source_control/worktree.rs`
- Test: `src/modules/project/state/projectStore.test.ts`
- Test: `src/modules/project/state/projectWorktreeActions.test.ts`
- Test: `src/modules/project/domain/projectDeletionActions.test.ts`

**Interfaces:**
- Consumes: parent scope ID and exact parent Project/ProjectTrunk state.
- Produces:

```ts
addChildTrunk(input: {
  trunkId: string;
  parentTrunkId: string;
  title: string;
  nowIso: string;
  gitCheckout: SourceControlCheckoutRestore;
}): ProjectTrunk | null;
```

```ts
projectCreateChildTrunk(input: {
  projectId: string;
  projectFolderPath: string;
  parentTrunkId: string;
  parentScopeId: string;
  baseRefName: string;
  branchName: string;
  historyMode: "normal" | "orphan";
  nowIso: string;
  sourceControlApi: Pick<SourceControlApi, "createWorktree">;
}): Promise<{ trunk: ProjectTrunk; checkout: ResolvedSourceControlCheckout }>;
```

Worktree removal inputs use a registered `scopeId`, exact expected repository identity, and expected HEAD.

- [ ] **Step 1: Write failing Rust worktree safety tests**

Assert exact identity equality, empty/prefix identity rejection, canonical managed-root membership, attached worktree non-deletion, expected-HEAD mismatch rejection, and scope invalidation after successful removal.

- [ ] **Step 2: Write failing Project native-first tests**

Assert the native call receives real Project ID/path and the reserved child trunk ID; metadata appears only after native success; native failure leaves no child; runtime scope ID and restore metadata use the returned checkout; deletion inspects/removes managed worktrees before deleting metadata.

- [ ] **Step 3: Run tests and verify RED**

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_control::worktree
npx --no-install vitest run src/modules/project/state/projectWorktreeActions.test.ts src/modules/project/domain/projectDeletionActions.test.ts src/modules/project/state/projectStore.test.ts
```

Expected: tests fail because child creation is a placeholder and identity/root checks are permissive.

- [ ] **Step 4: Implement safe Rust lifecycle**

Use exact identity equality. Canonicalize the configured managed worktree root once and require managed paths to be descendants. Remove substring-based classification and deletion. Register child scopes and invalidate removed scopes.

- [ ] **Step 5: Implement native-first Project actions**

Implement `addChildTrunk` with supplied ID and checkout restore. Call Desktop before storing the child. Wire deletion confirmation/action to inspect/remove managed worktrees; attached worktrees only lose metadata.

- [ ] **Step 6: Run targeted tests and verify GREEN**

Run the commands from Step 3. Expected: all worktree and Project lifecycle tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/source_control/worktree.rs src-tauri/src/source_control/scope_registry.rs src/modules/project
git commit -m "fix(project): complete safe worktree lifecycle"
```

---

### Task 7: Migrate Explorer And Source Control To Shared Watches

**Files:**
- Modify: `src-tauri/src/watch/broker.rs`
- Modify: `src-tauri/src/watch/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Remove: `src-tauri/src/explorer/watch.rs` after caller migration
- Modify: `src-tauri/src/explorer/mod.rs`
- Modify: `src/modules/explorer/api/explorerApi.ts`
- Modify: `src/modules/explorer/api/createMemoryExplorerApi.ts`
- Modify: `src/modules/explorer/ui/ExplorerPanel.tsx`
- Modify: `src/modules/source-control/state/useSourceControlWatchLifecycle.ts`
- Test: `src-tauri/src/watch/broker.rs`
- Test: `src/modules/explorer/ui/ExplorerPanel.test.tsx`
- Test: `src/modules/source-control/state/useSourceControlWatchLifecycle.test.tsx`

**Interfaces:**
- Consumes: checkout roots resolved from `SourceControlScopeRegistry` and stable App subscriber identities.
- Produces:

```rust
struct WatchHandle {
    watcher: RecommendedWatcher,
    subscribers: HashSet<String>,
    debounce_tx: mpsc::Sender<()>,
}
```

```ts
watchSubscribe(input: { scopeId: string; mode: "live" | "on-activate"; identity: string }): Promise<void>;
watchUnsubscribe(input: { scopeId: string; identity: string }): Promise<void>;
```

Desktop resolves the canonical root from `scopeId`; the App never supplies watcher path authority. Explorer identity is `explorer`; Source control identity is `source-control:<scopeId>`.

- [ ] **Step 1: Write failing broker reference-count tests**

Test duplicate subscribe idempotence, two subscribers sharing one handle, one unsubscribe preserving the handle, final unsubscribe removing it, and root canonicalization.

- [ ] **Step 2: Write failing App lifecycle tests**

Assert Explorer and Source control both subscribe/unsubscribe their own identities and that Source control subscribes before relying on `watch://changed`.

- [ ] **Step 3: Run tests and verify RED**

```bash
cargo test --manifest-path src-tauri/Cargo.toml watch::broker
npx --no-install vitest run src/modules/explorer/ui/ExplorerPanel.test.tsx src/modules/source-control/state/useSourceControlWatchLifecycle.test.tsx
```

Expected: failures show ignored identities and missing Source-control subscription.

- [ ] **Step 4: Implement subscriber-aware broker and App APIs**

Store subscriber sets, preserve the native watcher until the set is empty, and migrate both App modules to shared commands/events.

- [ ] **Step 5: Remove the Explorer-only watch seam**

Delete old commands, registrations, API methods, event listener, state, and tests made obsolete by the shared broker.

- [ ] **Step 6: Run targeted tests and verify GREEN**

Run the commands from Step 3. Expected: broker and both App lifecycle suites pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/watch src-tauri/src/explorer src-tauri/src/lib.rs src/modules/explorer src/modules/source-control/state
git commit -m "refactor(watch): share subscriber-aware repository watches"
```

---

### Task 8: Implement Namespaced Credentials And Provider Commands

**Files:**
- Modify: `src-tauri/src/provider/contracts.rs`
- Modify: `src-tauri/src/provider/keychain.rs`
- Modify: `src-tauri/src/provider/transport.rs`
- Modify: `src-tauri/src/provider/github.rs`
- Modify: `src-tauri/src/provider/gitlab.rs`
- Modify: `src-tauri/src/provider/bitbucket.rs`
- Modify: `src-tauri/src/provider/azure.rs`
- Modify: `src-tauri/src/provider/release.rs`
- Create: `src-tauri/src/provider/service.rs`
- Modify: `src-tauri/src/provider/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/modules/source-control/api/providerContracts.ts`
- Create: `src/modules/source-control/api/providerApi.ts`
- Modify: `src/modules/source-control/index.ts`
- Test: `src-tauri/src/provider/keychain.rs`
- Test: `src-tauri/src/provider/service.rs`
- Test: `src/modules/source-control/api/providerApi.test.ts`

**Interfaces:**
- Consumes: Existing normalized `ProviderRepository`, `ProviderPullRequest`, `ProviderRelease`, and provider clients.
- Produces:
```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProviderCredential {
    pub kind: ProviderKind,
    pub account: String,
    pub secret: String,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderHttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderHttpRequest {
    pub method: ProviderHttpMethod,
    pub url: String,
    pub body: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderHttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub type ProviderHttpFuture = Pin<Box<
    dyn Future<Output = Result<ProviderHttpResponse, ProviderTransportError>> + Send,
>>;

pub trait ProviderHttpTransport: Send + Sync {
    fn execute(&self, request: ProviderHttpRequest) -> ProviderHttpFuture;
}
```

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialSaveInput {
    pub kind: ProviderKind,
    pub account: String,
    pub secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialRef {
    pub credential_id: String,
}
```

Commands:

- `provider_credential_save`
- `provider_credential_status`
- `provider_credential_delete`
- `provider_list_repositories`
- `provider_get_repository`
- `provider_create_repository`
- `provider_list_pull_requests`
- `provider_get_pull_request`
- `provider_create_pull_request`
- `provider_create_release`
- `provider_release_capabilities`

- [ ] **Step 1: Write failing credential-store tests**

Use an in-memory store to prove fixed `opencore-taurians.provider` namespacing, opaque credential IDs, read-after-delete returns `NotFound`, deleting missing credentials succeeds, and no public result includes the secret.

- [ ] **Step 2: Write failing provider-dispatch tests**

Use fake transport responses for each provider. Assert repository list/get/create and pull-request list/get/create dispatch to the selected provider, load the credential by ID, normalize results, enforce Azure organization where required, and sanitize auth/network errors. Test GitHub/GitLab release success and Bitbucket/Azure capability errors without network.

- [ ] **Step 3: Run provider tests and verify RED**

```bash
cargo test --manifest-path src-tauri/Cargo.toml provider
```

Expected: failures show missing service/commands, caller-controlled service names, token-per-request release input, and non-deleting keychain behavior.

- [ ] **Step 4: Implement credential store and real deletion**

Use a constant service namespace and `Entry::delete_credential()`. Treat `NoEntry` as idempotent success only for delete. Do not expose a command that reads and returns a secret.

- [ ] **Step 5: Add injectable transport and provider service dispatch**

Refactor clients to consume a transport trait/factory while preserving production `ProviderTransport`. Replace release `token` with `credential_id`. Register async Tauri commands in `lib.rs`.

- [ ] **Step 6: Add typed App provider API and tests**

Wrap every provider command with `invoke`, assert camelCase payloads, and assert response contracts contain credential IDs/status but no secrets.

- [ ] **Step 7: Run Rust and App provider tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml provider
npx --no-install vitest run src/modules/source-control/api/providerApi.test.ts
```

Expected: all deterministic provider and credential tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/provider src-tauri/src/lib.rs src/modules/source-control/api src/modules/source-control/index.ts
git commit -m "feat(provider): expose scoped hosted-provider APIs"
```

---

### Task 9: Separate Diff State And Complete App Lifecycle Handling

**Files:**
- Modify: `src/modules/source-control/ui/SourceControlPanel.tsx`
- Modify: `src/modules/source-control/ui/SourceControlPanel.test.tsx`
- Modify: `src/modules/source-control/state/sourceControlStore.ts`
- Modify: `src/modules/source-control/state/sourceControlStore.test.ts`
- Modify: `src/modules/project/state/projectActivation.ts`
- Test: `src/modules/source-control/ui/SourceControlPanel.test.tsx`

**Interfaces:**
- Consumes: scope-based checkout runtime and snapshot revisions.
- Produces:

```ts
type DiffKind = "working-tree" | "staged";
type DiffKey = `${DiffKind}:${string}`;

function sourceControlDiffKey(kind: DiffKind, path: string): DiffKey;
```

`expandedDiffKey` and `diffByKey` use `DiffKey`. Scope-invalid errors call the existing Project checkout-invalid transition with the safe Project root.

- [ ] **Step 1: Write failing same-path diff tests**

Render a file with both index and worktree modifications. Click the Changes row and assert only it expands and requests `{ kind: "working-tree" }`; click the Staged row and assert only it expands and requests `{ kind: "staged" }`.

- [ ] **Step 2: Write failing cache invalidation and scope-error tests**

Assert cached diffs clear when `scopeId` or snapshot `revision` changes. Reject a plain-object Tauri `checkout-invalid` error and assert the ProjectTrunk runtime becomes invalid with the safe Project root.

- [ ] **Step 3: Run tests and verify RED**

```bash
npx --no-install vitest run src/modules/source-control/ui/SourceControlPanel.test.tsx src/modules/source-control/state/sourceControlStore.test.ts src/modules/project/state/projectActivation.test.ts
```

Expected: both same-path rows currently expand together, stale cache remains, and structured errors are flattened incorrectly.

- [ ] **Step 4: Implement source-qualified keys and typed error preservation**

Use `working-tree:${path}` and `staged:${path}` everywhere. Reset expansion/cache on scope/revision change. Preserve plain-object `PublicSourceControlError` values instead of coercing them to `[object Object]`.

- [ ] **Step 5: Run targeted tests and verify GREEN**

Run the command from Step 3. Expected: all UI, store, and activation tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/source-control src/modules/project/state/projectActivation.ts src/modules/project/state/projectActivation.test.ts
git commit -m "fix(source-control): isolate diff and scope lifecycle state"
```

---

### Task 10: Verify End-To-End UI Behavior

**Files:**
- Modify only if smoke reveals a real regression: `src/modules/shell/ui/panels/shellRightPanel.tsx`
- Modify only if smoke reveals a real regression: `src/modules/source-control/ui/SourceControlPanel.tsx`
- Test: existing shell and source-control UI tests

**Interfaces:**
- Consumes: completed Desktop/App contracts and seeded browser repository state.
- Produces: Observed evidence for TP1 through TP5.

- [ ] **Step 1: Run focused App UI tests**

```bash
npx --no-install vitest run src/modules/source-control src/modules/shell/ui/shellRightPanelFeatureControls.test.tsx
```

Expected: source-control and shell suites pass.

- [ ] **Step 2: Start the Vite app and seed a repository state**

Run `bun run dev --host 127.0.0.1` as a managed process. In Chromium, seed one file with both staged and working-tree modifications, one untracked file, a graph entry, upstream divergence, and a ready scope-based checkout.

- [ ] **Step 3: Exercise the visual test plan**

Observe Files to Source control normal transition, `0s` reduced-motion transition, independent same-path diffs, graph card selection, 4px badge corners, visible trailing borders while changing panel width, and busy/success/error feedback.

- [ ] **Step 4: Fix only reproduced UI regressions with a failing test first**

For each observed failure, add one focused Testing Library assertion, verify it fails, make the minimal UI change, and rerun the focused file.

- [ ] **Step 5: Commit any UI smoke fixes**

```bash
git add src/modules/source-control src/modules/shell
git commit -m "fix(source-control): finish right-panel interaction polish"
```

Skip the commit when no UI file changes are required.

---

### Task 11: Full Verification, Cleanup, Push, And CI Watch

**Files:**
- Modify: source files only when formatter output requires it
- Modify: `.github/workflows/ci.yml` only if a reproduced cross-platform workflow defect remains
- Modify: PR #43 body test-plan checkboxes after observed verification

**Interfaces:**
- Consumes: all completed implementation tasks.
- Produces: formatted code, passing local CI equivalents, focused commits on the PR branch, and a green GitHub Actions matrix.

- [ ] **Step 1: Remove obsolete scaffolding**

Delete dead-code allowances and comments that claim the operation coordinator, provider service, watch broker, or worktree lifecycle is not wired. Remove obsolete commands, DTOs, imports, and tests rather than leaving aliases.

- [ ] **Step 2: Run frontend verification**

```bash
npx --no-install vitest run src/modules/source-control
bun run test
bun run build
```

Expected: source-control slice and full App suite pass; TypeScript/Vite build exits 0.

- [ ] **Step 3: Run Rust verification**

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
cargo test --manifest-path src-tauri/Cargo.toml --all-features provider
```

Expected: formatting and clippy exit 0; full and provider Rust suites pass.

- [ ] **Step 4: Inspect the final change inventory**

Confirm every App caller uses `scopeId`, no source-control command trusts an App checkout path, no secret-returning keychain command remains, no operation stub remains, and no Explorer-only watch command remains.

- [ ] **Step 5: Commit final formatter or cleanup changes**

```bash
git add .
git commit -m "chore(source-control): finalize remediation"
```

Skip the commit if the working tree is already clean.

- [ ] **Step 6: Push the PR branch**

Push `feat/source-control-suite` without force. Do not amend or rewrite existing commits.

- [ ] **Step 7: Watch GitHub Actions**

Watch every workflow run for the pushed HEAD. If any matrix job fails, inspect its complete log, reproduce locally when possible, add a regression test for behavioral failures, fix the root cause, rerun the relevant local command, push a new commit, and watch again.

- [ ] **Step 8: Update PR test-plan evidence**

Mark only observed test-plan items complete and record exact commands/results. Leave no manual item checked based only on code inspection.
