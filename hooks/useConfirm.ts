"use client";

import { useState, useCallback } from "react";

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  resolve: ((confirmed: boolean) => void) | null;
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false, title: "", message: "", resolve: null,
  });

  const confirm = useCallback((title: string, message = "This action cannot be undone."): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ open: true, title, message, resolve });
    });
  }, []);

  const onConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const onCancel = useCallback(() => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false, resolve: null }));
  }, [state]);

  return {
    confirm,
    dialogProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      onConfirm,
      onCancel,
    },
  };
}
