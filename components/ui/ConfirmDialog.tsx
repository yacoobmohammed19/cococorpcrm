"use client";

import * as Dialog from "@radix-ui/react-dialog";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

export function ConfirmDialog({
  open, onConfirm, onCancel,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Delete",
  destructive = true,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)" }} />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 w-full max-w-sm rounded-xl p-6 shadow-2xl"
          style={{ transform: "translate(-50%, -50%)", background: "var(--card2)", border: "1px solid var(--border)" }}>
          <Dialog.Title className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-sm mb-5" style={{ color: "var(--muted2)" }}>
            {message}
          </Dialog.Description>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>
              Cancel
            </button>
            <button onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: destructive ? "var(--red-c)" : "var(--accent)", color: "#fff" }}>
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
