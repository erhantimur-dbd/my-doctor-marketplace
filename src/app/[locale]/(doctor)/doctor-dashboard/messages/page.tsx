"use client";

import { useEffect, useState, useRef, useTransition, useCallback } from "react";
import {
  getConversations,
  getMessages,
  getEligiblePatients,
  sendMessage,
} from "@/actions/messages";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { createBrowserClient } from "@supabase/ssr";
import { SubscriptionGate } from "@/components/shared/subscription-gate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  Plus,
  Loader2,
  ArrowLeft,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { uploadMessageAttachment } from "@/actions/attachments";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { AttachmentPreview } from "@/components/shared/attachment-preview";

interface MessageAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

interface Conversation {
  id: string;
  doctorId: string;
  patientId: string;
  updatedAt: string;
  otherParty: { id: string; name: string; avatarUrl: string | null };
  lastMessage: {
    body: string;
    senderRole: string;
    createdAt: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  senderRole: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  isMine: boolean;
  attachments?: MessageAttachment[];
}

interface EligiblePatient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
}

export default function DoctorMessagesPage() {
  return (
    <SubscriptionGate feature="Messages">
      <MessagesContent />
    </SubscriptionGate>
  );
}

function MessagesContent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [eligiblePatients, setEligiblePatients] = useState<EligiblePatient[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [pendingFile, setPendingFile] = useState<{ file: File } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current user ID for realtime
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Real-time message subscription
  const handleRealtimeMessage = useCallback(
    (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      loadConversations();
    },
    []
  );

  useRealtimeMessages(selectedConv, currentUserId, handleRealtimeMessage);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const data = await getConversations();
    setConversations(data);
    setLoading(false);
  }

  async function openConversation(convId: string) {
    setSelectedConv(convId);
    setLoadingMessages(true);
    const msgs = await getMessages(convId);
    setMessages(msgs);
    setLoadingMessages(false);
    // Refresh conversation list to update unread counts
    loadConversations();
  }

  async function handleSend() {
    if ((!newMessage.trim() && !pendingFile) || !selectedConv) return;
    const conv = conversations.find((c) => c.id === selectedConv);
    if (!conv) return;

    startTransition(async () => {
      let attachment: { fileName: string; fileType: string; fileSize: number; storagePath: string } | undefined;

      if (pendingFile) {
        const formData = new FormData();
        formData.append("file", pendingFile.file);
        formData.append("conversationId", selectedConv);
        const uploadResult = await uploadMessageAttachment(formData);
        if (uploadResult.error) {
          toast.error(uploadResult.error);
          return;
        }
        attachment = uploadResult.attachment;
      }

      const result = await sendMessage(conv.patientId, newMessage.trim(), attachment);
      if (result.success) {
        setNewMessage("");
        setPendingFile(null);
        const msgs = await getMessages(selectedConv);
        setMessages(msgs);
        loadConversations();
      }
    });
  }

  async function startNewConversation(patientId: string) {
    setNewConvOpen(false);
    startTransition(async () => {
      // Send an initial greeting to create the conversation
      const result = await sendMessage(patientId, newMessage.trim() || "Hello! How can I help you?");
      if (result.success && result.conversationId) {
        setNewMessage("");
        await loadConversations();
        openConversation(result.conversationId);
      }
    });
  }

  async function loadPatients() {
    const patients = await getEligiblePatients();
    setEligiblePatients(patients);
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedConversation = conversations.find((c) => c.id === selectedConv);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Dialog
          open={newConvOpen}
          onOpenChange={(open) => {
            setNewConvOpen(open);
            if (open) loadPatients();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send a Message</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Select a patient who has completed a consultation with you.
            </p>
            <ScrollArea className="max-h-64">
              <div className="space-y-1 pr-4">
                {eligiblePatients.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No eligible patients yet. Patients become available for messaging after completing a consultation.
                  </p>
                ) : (
                  eligiblePatients.map((patient) => {
                    const hasConv = conversations.some(
                      (c) => c.patientId === patient.id
                    );
                    return (
                      <button
                        key={patient.id}
                        className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors"
                        onClick={() => {
                          if (hasConv) {
                            const conv = conversations.find(
                              (c) => c.patientId === patient.id
                            );
                            if (conv) {
                              setNewConvOpen(false);
                              openConversation(conv.id);
                            }
                          } else {
                            startNewConversation(patient.id);
                          }
                        }}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={patient.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(
                              `${patient.first_name} ${patient.last_name}`
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {patient.email}
                          </p>
                        </div>
                        {hasConv && (
                          <Badge variant="secondary" className="text-xs">
                            Existing
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" style={{ height: "calc(100vh - 220px)" }}>
        {/* Conversation List */}
        <Card className="md:col-span-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No conversations yet. Start by messaging a patient who has completed a consultation.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv.id)}
                    className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted ${
                      selectedConv === conv.id ? "bg-muted" : ""
                    }`}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={conv.otherParty.avatarUrl || undefined} />
                      <AvatarFallback>
                        {getInitials(conv.otherParty.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate text-sm">
                          {conv.otherParty.name}
                        </p>
                        {conv.lastMessage && (
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.lastMessage.senderRole === "doctor" ? "You: " : ""}
                          {conv.lastMessage.body}
                        </p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge className="ml-1 shrink-0 h-5 min-w-5 flex items-center justify-center rounded-full text-xs">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Message Thread */}
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          {!selectedConv ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
              <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                Select a conversation to start messaging
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b p-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConv(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={selectedConversation?.otherParty.avatarUrl || undefined}
                  />
                  <AvatarFallback>
                    {selectedConversation
                      ? getInitials(selectedConversation.otherParty.name)
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {selectedConversation?.otherParty.name}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No messages yet. Start the conversation below.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            msg.isMine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.body}
                          </p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {msg.attachments.map((att) => (
                                <AttachmentPreview
                                  key={att.id}
                                  attachment={att}
                                  isMine={msg.isMine}
                                />
                              ))}
                            </div>
                          )}
                          <p
                            className={`text-[10px] mt-1 ${
                              msg.isMine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Compose */}
              <div className="border-t p-4 space-y-2">
                {pendingFile && (
                  <FileUploadButton
                    onFileSelect={(f) => setPendingFile({ file: f })}
                    pendingFile={pendingFile}
                    onClear={() => setPendingFile(null)}
                    disabled={isPending}
                  />
                )}
                <div className="flex gap-2">
                  {!pendingFile && (
                    <FileUploadButton
                      onFileSelect={(f) => setPendingFile({ file: f })}
                      pendingFile={null}
                      onClear={() => setPendingFile(null)}
                      disabled={isPending}
                    />
                  )}
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="min-h-[44px] max-h-32 resize-none"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={(!newMessage.trim() && !pendingFile) || isPending}
                    size="icon"
                    className="shrink-0 h-11 w-11"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
