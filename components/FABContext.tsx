"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type FABModalType = "lead" | "invoice" | "cost" | "cashflow";

type FABContextType = {
  activeModal: FABModalType | null;
  openModal: (type: FABModalType) => void;
  closeModal: () => void;
};

const FABContext = createContext<FABContextType | null>(null);

export function FABProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<FABModalType | null>(null);
  const openModal = useCallback((type: FABModalType) => setActiveModal(type), []);
  const closeModal = useCallback(() => setActiveModal(null), []);
  return (
    <FABContext.Provider value={{ activeModal, openModal, closeModal }}>
      {children}
    </FABContext.Provider>
  );
}

export function useFAB() {
  const ctx = useContext(FABContext);
  if (!ctx) throw new Error("useFAB must be used inside FABProvider");
  return ctx;
}
