"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { useChatStore } from "@/stores/chat-store";
import { ChatLauncher } from "./chat-launcher";
import { ChatWindow } from "./chat-window";

/**
 * Single patient AI surface: typed chat + Grok voice in one widget.
 * Mounted once from [locale]/layout. Hidden on staff/auth shells.
 */
export function ChatWidget() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isOpen = useChatStore((s) => s.isOpen);
  const open = useChatStore((s) => s.open);
  const openWithVoice = useChatStore((s) => s.openWithVoice);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hide =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname?.startsWith("/login/") ||
    pathname?.startsWith("/register/") ||
    pathname?.startsWith("/doctor-dashboard") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/verify-");

  if (!mounted || hide) return null;

  return isOpen ? (
    <ChatWindow />
  ) : (
    <ChatLauncher onOpen={open} onOpenVoice={openWithVoice} />
  );
}
