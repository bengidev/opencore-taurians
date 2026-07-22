# Explorer Delete Closes Editor Tabs

**Date:** 2026-07-22  
**Status:** Approved  
**Branch:** `feat/monaco-editor`  

## Goal

When the user deletes a file or folder from the Explorer context menu, matching open editor tabs close after confirm. Unsaved edits on those tabs are discarded (no Save / Don’t Save on this path).

## Problem

Explorer `Delete` calls `api.trash` then `refresh` only. Editor tabs are independent in-memory buffers, so deleted paths stay open.

## Decisions

| Choice | Decision |
| ------ | -------- |
| Tab fate | Close immediately via existing `closeTab` (discard dirty) |
| Confirm | `window.confirm` before trash (same pattern as trunk delete) |
| Open-tab warning | If any matching tabs exist, confirm copy warns they will close and unsaved changes will be discarded |
| Folder delete | Cascade: close tabs whose id equals the folder path or is under `folderPath + "/"` |
| Approach | Confirm + close logic lives in Explorer delete handler (no new shared editor helper in this change) |

## Behavior

1. User chooses **Delete** on a file or folder in Explorer.
2. Before trash, show `window.confirm`:
   - Always ask to move the item to Trash (use entry display name).
   - If any open editor tabs match the deleted path (see Matching), append a warning that those tabs will close and unsaved changes will be discarded.
3. **Cancel** → no trash, no tab changes.
4. **OK** → `api.trash` → explorer `refresh` → `closeTab` for each matching tab id.
5. If trash throws → set explorer error as today; **do not** close tabs.

### Confirm copy

- No matching tabs: `Move "{name}" to Trash?`
- Matching tabs:  
  `Move "{name}" to Trash?\n\n{N} open editor tab(s) will close. Unsaved changes will be discarded.`

### Matching

- **File delete:** tab `id ===` deleted path.
- **Folder delete:** tab `id ===` folder path **or** `id.startsWith(folderPath + "/")`.
- Untitled, outside-project, and unrelated tabs are not closed.
- Closing uses existing `closeTab` (active-tab neighbor selection unchanged).

### Order

`confirm` → `trash` → `refresh` → close matching tabs.

## Out of scope

- Deletes outside Explorer (Finder, terminal, other apps)
- Rename / move path retargeting for open tabs
- Per-tab Save / Don’t Save / Cancel when deleting from Explorer
- Custom in-app `AlertDialog` (stay on `window.confirm`)
- File-system watchers

## Implementation sketch

- **Touch:** `ExplorerContextMenu.tsx` `handleDelete` (confirm + collect matching tab ids from `useEditorStore` + close after successful trash).
- **Tests:** Extend Explorer delete coverage — confirm cancel leaves file and tabs; confirm OK with open/dirty tab closes that tab; folder delete closes nested open tabs; trash failure leaves tabs open.
- **Spy:** `window.confirm` in tests (existing Delete test must accept confirm → return `true`).

## Testing

| Case | Expect |
| ---- | ------ |
| Delete file, confirm Cancel | File remains; tabs unchanged |
| Delete file with open clean tab, confirm OK | File gone; tab closed |
| Delete file with open dirty tab, confirm OK | File gone; tab closed (no Save prompt) |
| Delete folder with nested open tabs, confirm OK | Folder gone; nested tabs closed |
| Confirm shows N when tabs match | Message includes tab count warning |
| Confirm without matching tabs | Message has no tab warning |
| Trash rejects | Explorer error set; tabs still open |

## Acceptance

- Explorer Delete always prompts before trash.
- Confirm warning appears only when matching editor tabs exist.
- After successful trash, matching tabs (including under a deleted folder) are gone from the editor.
- Dirty matching tabs discard without a Save / Don’t Save dialog.
- Failed trash does not close tabs.
