import Editor from "@monaco-editor/react";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { editorLanguageFromPath } from "../domain/editorLanguage";
import { useEditorStore } from "../state/editorStore";
import "./monacoSetup";

export function MonacoEditorHost() {
  const activePath = useEditorStore((s) => s.activePath);
  const content = useEditorStore((s) =>
    s.activePath ? (s.buffers[s.activePath]?.content ?? "") : "",
  );
  const setContentFromEditor = useEditorStore((s) => s.setContentFromEditor);
  const mode = useThemeStore((s) => s.mode);
  const theme = mode === "dark" ? "vs-dark" : "vs";

  if (!activePath) {
    return null;
  }

  const language = editorLanguageFromPath(activePath);

  return (
    <Editor
      key={activePath}
      path={activePath}
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
