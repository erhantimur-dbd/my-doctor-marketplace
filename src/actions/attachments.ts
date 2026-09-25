"use server";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/utils/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Upload a file attachment for a message in a conversation.
 * Returns the storage path and metadata needed to create the attachment record.
 */
export async function uploadMessageAttachment(
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
  attachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
  };
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  const conversationId = formData.get("conversationId") as string | null;

  if (!file || file.size === 0) {
    return { success: false, error: "No file provided." };
  }
  if (!conversationId) {
    return { success: false, error: "Conversation ID is required." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Maximum size is 10MB." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Unsupported file type. Allowed: images, PDF, Word documents.",
    };
  }

  // Verify user is a participant in this conversation
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, doctor_id, patient_id")
    .eq("id", conversationId)
    .single();

  if (!conv) {
    return { success: false, error: "Conversation not found." };
  }

  // Generate unique path
  const ext = file.name.split(".").pop() || "bin";
  const timestamp = Date.now();
  const storagePath = `${conversationId}/${timestamp}_${file.name}`;

  // Upload to storage
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("message-attachments")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    log.error("[Attachments] Upload error:", { err: uploadError });
    return { success: false, error: "Failed to upload file." };
  }

  return {
    success: true,
    attachment: {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storagePath,
    },
  };
}

/**
 * Get a signed URL for a message attachment.
 */
export async function getAttachmentUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Extract conversation ID from the storage path (first segment)
  const conversationId = storagePath.split("/")[0];

  // Verify user is a participant
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .single();

  if (!conv) return { error: "Access denied." };

  const { data, error } = await supabase.storage
    .from("message-attachments")
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error || !data) {
    log.error("[Attachments] Signed URL error:", { err: error });
    return { error: "Failed to generate download link." };
  }

  return { url: data.signedUrl };
}
