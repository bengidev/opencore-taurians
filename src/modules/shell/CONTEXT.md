# Shell

Primary workspace chrome after onboarding: mode bar, side panels, main card stack, and bottom bar.

## Language

**Shell**:
The full workspace layout — mode bar, left/right/bottom panels, and the main card area. Not the onboarding screen or workspace picker popup.
_Avoid_: Main app, IDE chrome, workspace frame (when referring to this layout)

**Main Card**:
One of the three always-mounted center views: chat, terminal, or editor. Only one is visible at a time; inactive cards stay mounted so local UI state is preserved.
_Avoid_: Tab, pane, view mode (when referring to chat/terminal/editor specifically)

**Left Panel**:
The bordered sidebar on the left of the main card area. Can be toggled independently of the right panel.
_Avoid_: Sidebar, navigator, file tree (until those features exist)

**Right Panel**:
The bordered sidebar on the right of the main card area. Can be toggled independently of the left panel.
_Avoid_: Inspector, properties pane, secondary sidebar

**Bottom Panel**:
The bordered strip below the main row — reserved for status, logs, or auxiliary controls.
_Avoid_: Footer bar, status dock

**Mode Bar**:
The top row with main-card switches (chat / terminal / editor) and left/right panel toggles.
_Avoid_: Toolbar, tab bar, navigation header
