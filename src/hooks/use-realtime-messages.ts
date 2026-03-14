"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface RealtimeMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

/**
 * Subscribe to real-time messages for a given conversation.
 * When a new message arrives, onNewMessage is called.
 * Automatically cleans up on unmount or conversation change.
 */
export function useRealtimeMessages(
  conversationId: string | null,
  currentUserId: string | null,
  onNewMessage: (message: {
    id: string;
    senderId: string;
    senderRole: string;
    body: string;
    readAt: string | null;
    createdAt: string;
    isMine: boolean;
    attachments: never[];
  }) => void
) {
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createBrowserClient>["channel"]
  > | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as RealtimeMessage;
          // Don't duplicate messages we just sent
          if (newMsg.sender_id === currentUserId) return;

          onNewMessage({
            id: newMsg.id,
            senderId: newMsg.sender_id,
            senderRole: newMsg.sender_role,
            body: newMsg.body,
            readAt: newMsg.read_at,
            createdAt: newMsg.created_at,
            isMine: false,
            attachments: [],
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, currentUserId, onNewMessage]);
}
