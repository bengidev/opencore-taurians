import Editor from "@monaco-editor/react";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { editorLanguageFromPath } from "../domain/editorLanguage";
import { useEditorStore } from "../state/editorStore";
import "./monacoSetup";

export function MonacoEditorHost() {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const content = useEditorStore((s) =>
    s.activeTabId ? (s.buffers[s.activeTabId]?.content ?? "") : "",
  );
  const setContentFromEditor = useEditorStore((s) => s.setContentFromEditor);
  const mode = useThemeStore((s) => s.mode);
  const theme = mode === "dark" ? "vs-dark" : "vs";

  if (!activeTabId) {
    return null;
  }

  const language = editorLanguageFromPath(activeTabId);

  return (
    <Editor
      key={activeTabId}
      path={activeTabId}
      className="min-h-0 flex-1"
      height="100%"
      language={language}
      theme={theme}
      value={content}
      onChange={(value) => setContentFromEditor(value ?? "")}
      options={{
        minimap: { enabled: false },
        automaticLayout: true,
        fontSize: 13,
      }}
    />
  );
}
