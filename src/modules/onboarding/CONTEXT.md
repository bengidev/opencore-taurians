# Onboarding

First-run welcome into OpenCore: a single screen that presents the product, theme, and entry into the workspace.

## Language

**Onboarding Screen**:
The single welcome surface shown before the workspace. Not a multi-step wizard.
_Avoid_: Setup wizard, first-run flow, onboarding funnel

**Theme Mode**:
Light or dark appearance for the onboarding surface and document root. Both modes are first-class. Default is **light** (`DEFAULT_THEME_MODE`, mirrored in `public/theme-boot.js` before hydrate).
_Avoid_: Color scheme, appearance preference (when referring to this toggle)

**Galaxy Orb**:
The interactive canvas hero on the Onboarding Screen — the primary visual break.
_Avoid_: Logo animation, background animation (when referring to the orb itself)

**Scene Backdrop**:
The full-bleed animated dot grid behind the Onboarding Screen chrome.
_Avoid_: Wallpaper, background pattern

**Enter**:
The user action that leaves the Onboarding Screen for the workspace (`onEnter`).
_Avoid_: Submit, continue, next, dismiss
