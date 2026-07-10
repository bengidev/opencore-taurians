# Session

Cross-cutting session lifecycle: persisted flags, window sizing, boot hydration, and the root UI that routes between onboarding, shell, and workspace popup.

## Language

**Session**:
The persisted app session — onboarding completion, workspace path, shell UI, and theme — backed by Tauri store (production) or in-memory storage (tests).
_Avoid_: User session, auth session, login state

**Session Root**:
The top-level React component that boots persistence, applies window sizes, and renders onboarding, shell, workspace popup, or loading state based on session flags.
_Avoid_: App root, main router, layout wrapper (when referring to this component specifically)

**Debug Reset**:
The floating control that clears all persisted session data and returns the app to the onboarding window size. Development aid only.
_Avoid_: Logout, factory reset, clear cache (when referring to this button specifically)

**Window Controller**:
Infrastructure port (`applyOnboardingSize` / `applyShellSize`) abstracting Tauri window resize and center. Production uses the Tauri window API; tests inject `createMemoryWindowController`.
_Avoid_: Window manager, resize handler, OS chrome
