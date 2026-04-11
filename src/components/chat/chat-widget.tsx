"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ChatLauncher } from "./chat-launcher";
import { ChatWindow } from "./chat-window";

/**
 * Orchestrates the chat launcher ↔ window based on the store's `isOpen`.
 *
 * Mounted once on the public layout — NOT on dashboards or admin routes.
 * Keeps hydration clean by delaying any store-reads until after mount so
 * the server and initial client HTML agree.
 */
export function ChatWidget() {
  const [mounted, setMounted] = useState(false);
  const isOpen = useChatStore((s) => s.isOpen);
  const open = useChatStore((s) => s.open);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return isOpen ? <ChatWindow /> : <ChatLauncher onOpen={open} />;
}
