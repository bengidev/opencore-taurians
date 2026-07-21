# Trunk Indent Under Project Design

## Goal

Make trunks under an expanded project in the left **Projects** panel nest visually like first-level children in the explorer (right panel).

## Decisions

| Topic | Choice |
| --- | --- |
| Indent amount | Match explorer depth-1: `paddingLeft: 20px` (`depth * 12 + 8` with `depth = 1`) |
| Where applied | `ProjectTrunkTree` list or row wrappers |
| Shared helper | Not in this pass — duplicate the constant/formula value only |
| Behavior | Unchanged (activate, context menu, rename, pin/delete, drag reorder) |

## Layout

Today trunks sit nearly flush with the project row (`px-2` chrome). After this change, trunk rows under a project use **20px** left padding on the trunk list container (preferred) or each row wrapper — same step the explorer uses for depth-1 entries.

Do **not** change:

- Project row padding, chevron, or tool buttons
- Trunk typography, truncation, or active/hover styles
- Expand/collapse animation wrapper around the trunk list
- Nested trunk hierarchy (trunks remain a flat root list under the project)

## Testing

- Existing left-panel UI tests still pass (no new interaction requirements).
- Optional light assertion or visual check that the trunk list uses the depth-1 indent; not required if CSS-only and covered by review.

## Implementation order

1. Apply explorer depth-1 left padding in `ProjectTrunkTree`
2. Run targeted left-panel / trunk UI tests if present
