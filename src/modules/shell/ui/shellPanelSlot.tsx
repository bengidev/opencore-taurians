import { useEffect, useState, type ReactNode } from "react";

type ShellPanelSlotProps = {
  visible: boolean;
  width: number;
  children: ReactNode;
};

export function ShellPanelSlot({ visible, width, children }: ShellPanelSlotProps) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  if (!mounted) return null;

  const displayWidth = visible ? width : 0;

  return (
    <div
      className="min-h-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ width: displayWidth }}
      onTransitionEnd={(event) => {
        if (event.propertyName === "width" && !visible) {
          setMounted(false);
        }
      }}
    >
      <div className="h-full" style={{ width }}>
        {children}
      </div>
    </div>
  );
}
