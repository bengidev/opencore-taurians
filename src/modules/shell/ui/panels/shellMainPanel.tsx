import { useEffect, useState } from "react";
import { useChatStore } from "../../../chat/state/chatStore";
import { createTauriEditorApi } from "../../../editor/api/editorApi";
import { useEditorStore } from "../../../editor/state/editorStore";
import { appendTrunkMessage } from "../../../project/state/projectChat";
import { useProjectStore } from "../../../project/state/projectStore";
import { useShellStore, type ShellMainCard } from "../../state/shellStore";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

const EMPTY_MESSAGES: never[] = [];

function ChatCard() {
  const activeTrunkId = useProjectStore((s) => s.activeTrunkId);
  const messagesByTrunkId = useChatStore((s) => s.messagesByTrunkId);
  const messages = activeTrunkId
    ? (messagesByTrunkId[activeTrunkId] ?? EMPTY_MESSAGES)
    : EMPTY_MESSAGES;
  const [draft, setDraft] = useState("");

  if (!activeTrunkId) {
    return (
      <p className="mt-2 font-mono text-sm text-muted-foreground">Select a trunk</p>
    );
  }

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    appendTrunkMessage({
      trunkId: activeTrunkId,
      role: "user",
      content,
      nowIso: new Date().toISOString(),
    });
    setDraft("");
  };

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto font-mono text-sm">
        {messages.map((message) => (
          <li key={message.id}>
            <span className="text-muted-foreground">{message.role}: </span>
            {message.content}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          aria-label="chat-message"
          className="min-w-0 flex-1 rounded-[6px] border border-border bg-transparent px-2 py-1 font-mono text-sm"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-[6px] border border-border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function EditorCard() {
  const path = useEditorStore((s) => s.path);
  const status = useEditorStore((s) => s.status);

  if (!path) {
    return (
      <p className="mt-2 font-mono text-sm text-muted-foreground">
        Open a file from the explorer
      </p>
    );
  }

  return (
    <p
      className="mt-2 truncate font-mono text-sm text-muted-foreground"
      aria-label="editor-open-file"
    >
      {status === "loading" ? "Loading…" : path}
    </p>
  );
}

export function ShellMainPanel() {
  const activeMainCard = useShellStore((s) => s.activeMainCard);

  useEffect(() => {
    const { api, bindApi } = useEditorStore.getState();
    if (!api) {
      bindApi(createTauriEditorApi());
    }
  }, []);

  return (
    <main className="relative min-h-0 flex-1 bg-background">
      {MAIN_CARDS.map((card) => (
        <section
          key={card}
          hidden={activeMainCard !== card}
          aria-hidden={activeMainCard !== card}
          className="absolute inset-0 flex flex-col p-3"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {card}
          </p>
          {card === "chat" ? (
            <ChatCard />
          ) : card === "editor" ? (
            <EditorCard />
          ) : (
            <input
              aria-label={`${card}-dummy-note`}
              className="mt-2 w-full rounded-[6px] border border-border bg-transparent px-2 py-1 text-sm"
            />
          )}
        </section>
      ))}
    </main>
  );
}
