# Source Control Remediation Design

**Date:** 2026-08-01
**Status:** Approved
**PR:** #43 (`feat/source-control-suite`)

## Goal

Make the source-control suite safe and complete end to end: Desktop owns checkout authority, Git and provider I/O, watcher lifecycles, operation coordination, cancellation, credentials, and worktree mutations; the App owns typed calls, view state, persistence metadata, and UI feedback.

## Scope

This remediation covers every issue found in the PR review:

1. Replace frontend-authoritative checkout paths with Desktop-issued opaque scope tokens.
2. Repair Project child-worktree creation, persistence, inspection, and removal.
3. Correct stage, unstage, discard, new-branch commit, and selected-file commit commands.
4. Correct porcelain-v2 rename/copy and unmerged-record parsing.
5. Move Explorer and Source control onto one subscriber-aware watch broker.
6. Implement operation serialization, lifecycle events, cancellation, and quit guarding.
7. Keep staged and working-tree diff state independent.
8. Delete credentials through the keyring deletion API and namespace all credentials.
9. Expose typed hosted-provider repository, pull-request, and release commands.
10. Preserve a green frontend and cross-platform Rust CI matrix.

## Architecture

### SourceControlScopeRegistry

Desktop manages a `SourceControlScopeRegistry`. A scope record contains:

- opaque `scope_id`
- Project ID and ProjectTrunk ID
- canonical Project root
- canonical checkout root
- checkout identity
- optional repository identity
- checkout kind (`project-root` or `worktree`)
- whether a worktree is managed by OpenCore

`git_resolve_checkout` validates persisted restore metadata, registers or refreshes the scope, and returns the opaque scope ID with display metadata. Scope IDs are runtime-only and are never persisted. Project activation calls checkout resolution after every boot or restore.

All subsequent local Git commands accept `scopeId` instead of `checkoutPath`. Desktop rejects missing or stale scope IDs before spawning Git. Scope records are invalidated when their ProjectTrunk or worktree is removed.

### Scoped Paths And Git Arguments

Path-bearing operations accept repository-relative pathspecs only. Desktop rejects:

- absolute paths
- NUL bytes
- lexical parent traversal (`..`)
- targets that resolve outside the registered checkout

Git commands insert `--` before pathspecs and pass every path as a distinct process argument. No shell interpolation is introduced.

Untracked discard resolves each target under the checkout and handles files and directories without escaping the scope. Tracked discard passes individual pathspecs. Stage and unstage pass individual pathspecs and handle unborn repositories explicitly.

New-branch commit validates the branch name and runs `git switch -c` before commit. Selected-file commit uses Git's path-limited commit mode and does not stage into or replace the user's real index as a fake temporary-index implementation.

### Worktrees And Project Persistence

Worktree creation is native-first:

1. App reserves the intended child ProjectTrunk ID and sends it with the parent scope ID, branch, base ref, and history mode.
2. Desktop validates the parent scope and creates the worktree under the canonical OpenCore worktree root.
3. Desktop registers and returns the child scope and exact checkout metadata.
4. Project state persists the child ProjectTrunk using the same ID and metadata.
5. If native creation fails, no child metadata is written.

Attached worktrees are validated against the parent repository and registered as non-managed scopes.

Removal requires exact repository identity equality, an inspection result tied to the expected HEAD, and current dirty/unmerged checks. Managed worktrees may be recursively deleted only when their canonical path is under the canonical OpenCore worktree root. Attached worktrees are detached from Project metadata but are never recursively deleted by OpenCore.

### Porcelain Parsing

The porcelain-v2 parser iterates NUL-delimited records with lookahead. Rename/copy records consume their following original-path record. Ordinary records split into ten fields; unmerged records split into eleven fields so the final value is the path rather than the stage-three object ID plus path.

Tests use real `git status --porcelain=v2 -z` output for renames and conflicts.

### Shared Watch Broker

`WatchBroker` owns one native watcher per canonical root and a set of subscriber identities per root. Subscribe is idempotent for `(root, identity)`. Unsubscribe removes only that identity and destroys the native watcher only after the final subscriber leaves.

Explorer and Source control both call the shared `watch_subscribe` and `watch_unsubscribe` commands. Both listen to `watch://changed`. The old Explorer-only watch seam is removed after all callers migrate.

### Operation Coordination And Cancellation

`SourceControlOperationCoordinator` owns per-repository queues, operation IDs, cancellation state, and active child handles.

- Parsed reads may run concurrently.
- Mutations and network operations serialize per repository.
- Every coordinated operation emits `started` and exactly one terminal event: `completed`, `failed`, or `cancelled`.
- Progress events are emitted when meaningful phase changes occur.
- `git_operation_cancel` records cancellation and kills the registered child process.
- Timeouts use the same terminal cleanup path as cancellation.
- An RAII operation guard updates `QuitGuard` and releases queue state on every exit path.

The App continues to use local action state for immediate button feedback while the store consumes Desktop events for repository-wide operation state.

### Provider Service And Credentials

Provider clients are exposed through typed Desktop commands for repository, pull-request, and release operations already represented by the Rust provider contracts.

A provider credential is saved once using provider kind, account identity, and secret. Desktop stores it under a fixed OpenCore service namespace and returns a credential ID. Later provider commands accept the credential ID and load the secret inside Desktop. Secrets are never returned from provider commands or included in error messages.

The keyring implementation uses `delete_credential`; deleting a missing credential is idempotent. Service names are not caller-controlled.

Provider commands retain HTTPS-only requests, host allowlisting, redirect validation, bounded bodies, timeouts, and sanitized errors. Provider clients receive injectable transport and credential-store interfaces so tests do not require network access or a real OS keychain.

### App Contracts And UI

Resolved checkout runtime data includes `scopeId`; persisted checkout restore data does not. Every App API and memory API migrates to scope-based DTOs in a clean cutover with no deprecated path aliases.

Inline diff state uses a key composed from diff source and path. Expansion and cache entries are independent for staged and working-tree versions. Diff cache entries are invalidated when checkout scope or snapshot revision changes.

Scope-invalid errors move the ProjectTrunk runtime to the existing invalid-checkout state and preserve the safe Project root until activation obtains a new scope.

## Error Handling

Desktop returns typed, sanitized public errors. Scope failures use `checkout-invalid`. Operation cancellation uses a distinct cancelled terminal event rather than a generic process failure. Provider authentication errors identify provider/account context without including credentials, headers, keychain backend details, or response secrets.

Worktree and destructive mutation preconditions fail closed. No fallback path is used after identity, expected-HEAD, or managed-root validation fails.

## Verification

### Rust Regression Coverage

Temporary-repository tests cover:

- valid and stale scope IDs
- absolute/traversing path rejection
- untracked file and directory discard under the checkout
- multi-path stage, unstage, and tracked discard
- new-branch commit
- selected-file commit without disturbing unrelated staged changes
- rename/copy original paths and unmerged paths
- exact worktree identity and managed-root checks
- watch subscriber reference counts
- per-repository serialization and cancellation
- operation terminal-event and quit-guard cleanup invariants
- namespaced credential save/read/delete with an in-memory store
- typed provider commands with fake transport responses

### App Regression Coverage

Vitest covers:

- scope-based invoke payloads
- activation scope refresh and stale-scope errors
- native-first worktree persistence without ghost ProjectTrunks
- shared watcher subscribe/unsubscribe identities
- operation event state transitions
- independent staged and working-tree diff expansion/cache entries
- provider credential IDs without secret echoing

### Browser Smoke

A seeded repository state verifies:

- Files to Source control animation
- reduced-motion behavior
- Changes and Staged rendering
- independent same-path staged and working-tree diffs
- graph selection chrome
- count badge shape
- panel resize borders
- busy/success/error feedback

### CI And Delivery

Run the exact frontend and Rust CI commands locally, including formatting, clippy with warnings denied, full Rust tests, provider-only tests, Vitest, and the production build. Commit and push focused changes to the PR branch, then wait for every GitHub Actions matrix job to complete successfully before reporting completion.

## Cutover Rules

- Migrate every caller; leave no path-based compatibility shim.
- Remove obsolete Explorer watch commands and unused operation/provider scaffolding comments.
- Do not persist scope IDs or secrets.
- Do not add retries, telemetry, or provider capabilities beyond the contracts already present in PR #43.
- Do not merge while a P1 regression or CI job remains unresolved.
