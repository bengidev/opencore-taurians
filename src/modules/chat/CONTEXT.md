# Chat

Persisted chat messages keyed by project chunk. History is isolated per chunk; switching chunks shows a different message list.

## Language

**ChatMessage**:
A single persisted message — role (user / assistant / system), content, timestamp, and owning `chunkId`. Appended through the chat store and searchable from the project panel.
_Avoid_: Turn, prompt, completion (when referring to the stored record)

**chunk-scoped history**:
The message list for one `ProjectChunk` — `messagesByChunkId[chunkId]`. Retention and chunk deletion remove the corresponding history; there is no global chat log across chunks.
_Avoid_: Session history, conversation log, global chat (when referring to per-chunk storage)
