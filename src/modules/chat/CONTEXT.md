# Chat

Persisted chat messages keyed by project trunk. History is isolated per trunk; switching trunks shows a different message list.

## Language

**ChatMessage**:
A single persisted message — role (user / assistant / system), content, timestamp, and owning `trunkId`. Appended through the chat store and searchable from the project panel.
_Avoid_: Turn, prompt, completion (when referring to the stored record)

**trunk-scoped history**:
The message list for one `ProjectTrunk` — `messagesByTrunkId[trunkId]`. Retention and trunk deletion remove the corresponding history; there is no global chat log across trunks.
_Avoid_: Session history, conversation log, global chat (when referring to per-trunk storage)
