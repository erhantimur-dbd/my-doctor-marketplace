"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UIMessage } from "ai";
import type { ChatDoctor } from "@/lib/chat/tools";

type ChatSize = "compact" | "fullscreen";

export const SHORTLIST_LIMIT = 3;

interface ChatState {
  isOpen: boolean;
  size: ChatSize;
  hasAcceptedGdpr: boolean;
  hasAutoExpanded: boolean;
  messages: UIMessage[];
  shortlist: ChatDoctor[];
  compareOpen: boolean;
  // actions
  open: () => void;
  close: () => void;
  toggleSize: () => void;
  setSize: (size: ChatSize) => void;
  markAutoExpanded: () => void;
  acceptGdpr: () => void;
  setMessages: (messages: UIMessage[]) => void;
  toggleShortlist: (doctor: ChatDoctor) => boolean;
  removeFromShortlist: (doctorId: string) => void;
  clearShortlist: () => void;
  setCompareOpen: (open: boolean) => void;
  reset: () => void;
}

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
    (set, get) => ({
      isOpen: false,
      size: "compact",
      hasAcceptedGdpr: false,
      hasAutoExpanded: false,
      messages: [],
      shortlist: [],
      compareOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false, compareOpen: false }),
      setSize: (size) => set({ size }),
      toggleSize: () =>
        set((s) => ({ size: s.size === "compact" ? "fullscreen" : "compact" })),
      markAutoExpanded: () => set({ hasAutoExpanded: true }),
      acceptGdpr: () => set({ hasAcceptedGdpr: true }),
      setMessages: (messages) => set({ messages }),
      toggleShortlist: (doctor) => {
        const current = get().shortlist;
        const exists = current.some((d) => d.id === doctor.id);
        if (exists) {
          set({ shortlist: current.filter((d) => d.id !== doctor.id) });
          return false;
        }
        if (current.length >= SHORTLIST_LIMIT) return false;
        set({ shortlist: [...current, doctor] });
        return true;
      },
      removeFromShortlist: (doctorId) =>
        set((s) => ({ shortlist: s.shortlist.filter((d) => d.id !== doctorId) })),
      clearShortlist: () => set({ shortlist: [], compareOpen: false }),
      setCompareOpen: (open) => set({ compareOpen: open }),
      reset: () =>
        set({
          messages: [],
          isOpen: false,
          size: "compact",
          hasAutoExpanded: false,
          shortlist: [],
          compareOpen: false,
        }),
    }),
    {
      name: "md360-chat",
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        messages: state.messages,
        hasAcceptedGdpr: state.hasAcceptedGdpr,
        isOpen: state.isOpen,
        size: state.size,
        hasAutoExpanded: state.hasAutoExpanded,
        shortlist: state.shortlist,
      }),
    }
  )
);
