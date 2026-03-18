"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { newMessageEmail } from "@/lib/email/templates";
import { revalidatePath } from "next/cache";

/**
 * Get patients eligible for messaging — those with at least one completed booking.
 */
export async function getEligiblePatients() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!doctor) return [];

  const { data: patients } = await supabase
    .from("bookings")
    .select(
      "patient:profiles!bookings_patient_id_fkey(id, first_name, last_name, email, avatar_url)"
    )
    .eq("doctor_id", doctor.id)
    .eq("status", "completed")
    .order("appointment_date", { ascending: false });

  if (!patients) return [];

  // Deduplicate by patient id
  const seen = new Set<string>();
  const unique: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  }[] = [];

  for (const row of patients) {
    const p: any = Array.isArray(row.patient) ? row.patient[0] : row.patient;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    unique.push(p);
  }

  return unique;
}

/**
 * Get all conversations for the current user (doctor or patient) with last message preview.
 */
export async function getConversations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return [];

  const isDoctor = profile.role === "doctor";

  // Fetch conversations
  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      `
      id,
      doctor_id,
      patient_id,
      updated_at,
      doctor:doctors!inner(
        id,
        profile:profiles!doctors_profile_id_fkey(id, first_name, last_name, avatar_url)
      ),
      patient:profiles!conversations_patient_id_fkey(id, first_name, last_name, avatar_url)
    `
    )
    .order("updated_at", { ascending: false });

  if (!conversations || conversations.length === 0) return [];

  // Fetch last message + unread count for each conversation
  const result = [];
  for (const conv of conversations) {
    const doctor: any = Array.isArray(conv.doctor)
      ? conv.doctor[0]
      : conv.doctor;
    const doctorProfile: any = Array.isArray(doctor?.profile)
      ? doctor.profile[0]
      : doctor?.profile;
    const patient: any = Array.isArray(conv.patient)
      ? conv.patient[0]
      : conv.patient;

    // Last message
    const { data: lastMsg } = await supabase
      .from("direct_messages")
      .select("id, body, sender_role, created_at, read_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Unread count (messages sent by the other party that I haven't read)
    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .neq("sender_id", user.id)
      .is("read_at", null);

    result.push({
      id: conv.id,
      doctorId: conv.doctor_id,
      patientId: conv.patient_id,
      updatedAt: conv.updated_at,
      otherParty: isDoctor
        ? {
            id: patient?.id,
            name: `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim(),
            avatarUrl: patient?.avatar_url,
          }
        : {
            id: doctorProfile?.id,
            name: `Dr. ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim(),
            avatarUrl: doctorProfile?.avatar_url,
          },
      lastMessage: lastMsg
        ? {
            body: lastMsg.body,
            senderRole: lastMsg.sender_role,
            createdAt: lastMsg.created_at,
            isRead: !!lastMsg.read_at,
          }
        : null,
      unreadCount: count || 0,
    });
  }

  return result;
}

/**
 * Get messages for a specific conversation and mark unread ones as read.
 */
export async function getMessages(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Verify user is a participant
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, doctor_id, patient_id")
    .eq("id", conversationId)
    .single();

  if (!conv) return [];

  // Fetch messages
  const { data: messages } = await supabase
    .from("direct_messages")
    .select("id, sender_id, sender_role, body, read_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Mark unread messages from other party as read
  const adminSupabase = createAdminClient();
  await adminSupabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  // Fetch attachments for all messages in this conversation
  const messageIds = (messages || []).map((m) => m.id);
  const { data: attachments } = messageIds.length > 0
    ? await supabase
        .from("message_attachments")
        .select("id, message_id, file_name, file_type, file_size, storage_path")
        .in("message_id", messageIds)
    : { data: [] };

  const attachmentMap = new Map<string, typeof attachments>();
  (attachments || []).forEach((a) => {
    const existing = attachmentMap.get(a.message_id) || [];
    existing.push(a);
    attachmentMap.set(a.message_id, existing);
  });

  return (messages || []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    senderRole: m.sender_role,
    body: m.body,
    readAt: m.read_at,
    createdAt: m.created_at,
    isMine: m.sender_id === user.id,
    attachments: (attachmentMap.get(m.id) || []).map((a: any) => ({
      id: a.id,
      fileName: a.file_name,
      fileType: a.file_type,
      fileSize: a.file_size,
      storagePath: a.storage_path,
    })),
  }));
}

/**
 * Send a message to a patient (doctor) or reply (patient).
 * Optionally includes a file attachment.
 * Creates the conversation if it doesn't exist.
 * Triggers email notification to the recipient.
 */
export async function sendMessage(
  recipientId: string,
  body: string,
  attachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
  }
): Promise<{ success: boolean; conversationId?: string; messageId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (!profile) return { success: false, error: "Profile not found" };

  const isDoctor = profile.role === "doctor";
  const adminSupabase = createAdminClient();

  let doctorId: string;
  let patientId: string;

  if (isDoctor) {
    // Doctor sending to patient
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .single();
    if (!doctor) return { success: false, error: "Doctor not found" };

    doctorId = doctor.id;
    patientId = recipientId;

    // Verify eligibility: patient must have a completed booking with this doctor
    const { count } = await adminSupabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .eq("patient_id", patientId)
      .eq("status", "completed");

    if (!count || count === 0) {
      return {
        success: false,
        error: "You can only message patients who have completed a consultation with you",
      };
    }
  } else {
    // Patient replying — must have an existing conversation
    patientId = user.id;

    // recipientId here is the doctor's profile_id
    const { data: doctor } = await adminSupabase
      .from("doctors")
      .select("id")
      .eq("profile_id", recipientId)
      .single();
    if (!doctor) return { success: false, error: "Doctor not found" };

    doctorId = doctor.id;

    // Verify conversation exists (patients can only reply, not initiate)
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("patient_id", patientId)
      .maybeSingle();

    if (!existingConv) {
      return {
        success: false,
        error: "You can only reply to conversations started by your doctor",
      };
    }
  }

  // Get or create conversation
  let conversationId: string;
  const { data: existing } = await adminSupabase
    .from("conversations")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: newConv, error: convError } = await adminSupabase
      .from("conversations")
      .insert({ doctor_id: doctorId, patient_id: patientId })
      .select("id")
      .single();
    if (convError || !newConv)
      return { success: false, error: "Failed to create conversation" };
    conversationId = newConv.id;
  }

  // Insert message
  const senderRole = isDoctor ? "doctor" : "patient";
  const { data: insertedMsg, error: msgError } = await adminSupabase
    .from("direct_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: senderRole,
      body: body.trim() || (attachment ? `Sent a file: ${attachment.fileName}` : ""),
    })
    .select("id")
    .single();

  if (msgError || !insertedMsg) return { success: false, error: msgError?.message || "Failed to send message" };

  const messageId = insertedMsg.id;

  // Save attachment record if present
  if (attachment) {
    await adminSupabase.from("message_attachments").insert({
      message_id: messageId,
      conversation_id: conversationId,
      file_name: attachment.fileName,
      file_type: attachment.fileType,
      file_size: attachment.fileSize,
      storage_path: attachment.storagePath,
      uploaded_by: user.id,
    });
  }

  // Update conversation timestamp
  await adminSupabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Send notification + email to recipient
  const recipientProfileId = isDoctor ? patientId : (
    await adminSupabase.from("doctors").select("profile_id").eq("id", doctorId).single()
  ).data?.profile_id;

  if (recipientProfileId) {
    const { data: recipientProfile } = await adminSupabase
      .from("profiles")
      .select("email, first_name")
      .eq("id", recipientProfileId)
      .single();

    const senderName = isDoctor
      ? `Dr. ${profile.first_name} ${profile.last_name}`
      : `${profile.first_name} ${profile.last_name}`;

    const dashboardPath = isDoctor ? "/dashboard/messages" : "/doctor-dashboard/messages";

    if (recipientProfile?.email) {
      const emailContent = newMessageEmail({
        recipientName: recipientProfile.first_name || "there",
        senderName,
        messagesUrl: `${process.env.NEXT_PUBLIC_APP_URL}/en${dashboardPath}`,
      });

      await createNotification({
        userId: recipientProfileId,
        type: "new_message",
        title: "New Message",
        message: `You have a new message from ${senderName}`,
        channels: ["in_app", "email"],
        metadata: { conversationId, senderRole },
        email: {
          to: recipientProfile.email,
          subject: emailContent.subject,
          html: emailContent.html,
        },
      });
    }
  }

  revalidatePath("/doctor-dashboard/messages");
  revalidatePath("/dashboard/messages");

  return { success: true, conversationId, messageId };
}

/**
 * Get total unread message count for the current user.
 */
export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get all conversation IDs for this user
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) return 0;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id");

  if (!conversations || conversations.length === 0) return 0;

  const convIds = conversations.map((c) => c.id);

  const { count } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", convIds)
    .neq("sender_id", user.id)
    .is("read_at", null);

  return count || 0;
}
