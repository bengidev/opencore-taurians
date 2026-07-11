import { useState } from "react";
import { useChatStore } from "../../../chat/state/chatStore";
import { appendChunkMessage } from "../../../project/state/projectChat";
import { useProjectStore } from "../../../project/state/projectStore";
import { useShellStore, type ShellMainCard } from "../../state/shellStore";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

const EMPTY_MESSAGES: never[] = [];

function ChatCard() {
  const activeChunkId = useProjectStore((s) => s.activeChunkId);
  const messagesByChunkId = useChatStore((s) => s.messagesByChunkId);
  const messages = activeChunkId
    ? (messagesByChunkId[activeChunkId] ?? EMPTY_MESSAGES)
    : EMPTY_MESSAGES;
  const [draft, setDraft] = useState("");

  if (!activeChunkId) {
    return (
      <p className="mt-2 font-mono text-sm text-muted-foreground">Select a chunk</p>
    );
  }

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    appendChunkMessage({
      chunkId: activeChunkId,
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

export function ShellMainPanel() {
  const activeMainCard = useShellStore((s) => s.activeMainCard);

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
