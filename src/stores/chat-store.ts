"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UIMessage } from "ai";

interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  hasAcceptedGdpr: boolean;
  nudgeShown: boolean;
  showNudge: boolean;
  messages: UIMessage[];
  // actions
  open: () => void;
  close: () => void;
  minimize: () => void;
  toggleMinimized: () => void;
  acceptGdpr: () => void;
  markNudgeShown: () => void;
  setShowNudge: (show: boolean) => void;
  setMessages: (messages: UIMessage[]) => void;
  reset: () => void;
}

// SSR-safe storage: returns a noop stub on the server, sessionStorage in the browser.
function getStorage(): Storage {
  if (typeof window === "undefined") {
    const noop: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    };
    return noop;
  }
  return window.sessionStorage;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      isOpen: false,
      isMinimized: false,
      hasAcceptedGdpr: false,
      nudgeShown: false,
      showNudge: false,
      messages: [],
      open: () => set({ isOpen: true, isMinimized: false }),
      close: () => set({ isOpen: false, isMinimized: false }),
      minimize: () => set({ isMinimized: true }),
      toggleMinimized: () => set((s) => ({ isMinimized: !s.isMinimized })),
      acceptGdpr: () => set({ hasAcceptedGdpr: true }),
      markNudgeShown: () => set({ nudgeShown: true, showNudge: false }),
      setShowNudge: (show) => set({ showNudge: show }),
      setMessages: (messages) => set({ messages }),
      reset: () => set({ messages: [], isOpen: false, isMinimized: false, nudgeShown: false, showNudge: false }),
    }),
    {
      name: "md360-chat",
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        messages: state.messages,
        hasAcceptedGdpr: state.hasAcceptedGdpr,
        isOpen: state.isOpen,
        isMinimized: state.isMinimized,
        nudgeShown: state.nudgeShown,
      }),
    }
  )
);
