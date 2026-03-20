import { useEffect, useEffectEvent } from "react";

const extractTaskId = (input: string) => {
  const trimmed = input.trim().toUpperCase();
  const directMatch = trimmed.match(/^[A-Z0-9]{6}$/);
  if (directMatch) {
    return directMatch[0];
  }

  const embeddedMatch = trimmed.match(/(?:TASK\/|TASK:|\/)([A-Z0-9]{6})(?:$|[^A-Z0-9])/);
  return embeddedMatch?.[1] ?? null;
};

/**
 * Barcode scanners emit keystrokes rapidly and terminate with Enter.
 * This hook buffers that burst and extracts either the raw 6-char id or
 * a deep-link encoded inside the QR value.
 */
export function useScanner(onScan: (taskId: string, rawValue: string) => void) {
  const emitScan = useEffectEvent((buffer: string) => {
    const taskId = extractTaskId(buffer);
    if (taskId) {
      onScan(taskId, buffer);
    }
  });

  useEffect(() => {
    let buffer = "";
    let lastTime = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        buffer = "";
        return;
      }

      const now = Date.now();
      if (now - lastTime > 60) {
        buffer = "";
      }
      lastTime = now;

      if (event.key === "Enter") {
        if (buffer.length >= 6) {
          emitScan(buffer);
        }
        buffer = "";
        return;
      }

      if (event.key.length === 1) {
        buffer += event.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [emitScan]);
}
