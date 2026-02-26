"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email/client";

// ============================================================
// Helpers
// ============================================================

function generateTicketNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ST-${dateStr}-${rand}`;
}

const VALID_CATEGORIES = [
  "billing",
  "booking",
  "account",
  "technical",
  "verification",
  "other",
] as const;

const VALID_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
] as const;

const VALID_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

// ============================================================
// Patient / Doctor Actions
// ============================================================

export async function createTicket(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "patient" && profile.role !== "doctor")) {
    return { error: "Invalid user role." };
  }

  const subject = (formData.get("subject") as string)?.trim();
  const category = formData.get("category") as string;
  const message = (formData.get("message") as string)?.trim();

  if (!subject || subject.length > 200) {
    return { error: "Subject is required (max 200 characters)." };
  }
  if (!category || !VALID_CATEGORIES.includes(category as any)) {
    return { error: "Please select a valid category." };
  }
  if (!message || message.length > 5000) {
    return { error: "Message is required (max 5,000 characters)." };
  }

  const ticketNumber = generateTicketNumber();

  // Use admin client to insert (RLS: user can insert own tickets, but we also need to insert message)
  const adminSupabase = createAdminClient();

  const { data: ticket, error: ticketError } = await adminSupabase
    .from("support_tickets")
    .insert({
      ticket_number: ticketNumber,
      user_id: user.id,
      user_role: profile.role,
      category,
      subject,
      status: "open",
    })
    .select("id, ticket_number")
    .single();

  if (ticketError || !ticket) {
    console.error("[Support] Failed to create ticket:", ticketError);
    return { error: "Failed to create support ticket." };
  }

  // Insert the initial message
  const { error: messageError } = await adminSupabase
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: profile.role,
      message,
    });

  if (messageError) {
    console.error("[Support] Failed to create initial message:", messageError);
  }

  // Send confirmation email (non-blocking)
  try {
    const { supportTicketCreatedEmail } = await import(
      "@/lib/email/templates"
    );
    const { subject: emailSubject, html } = supportTicketCreatedEmail({
      userName: `${profile.first_name} ${profile.last_name}`,
      ticketNumber: ticket.ticket_number,
      category,
      ticketSubject: subject,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/en/${profile.role === "doctor" ? "doctor-dashboard" : "dashboard"}/support/${ticket.id}`,
    });

    sendEmail({ to: profile.email, subject: emailSubject, html }).catch(
      (err) => console.error("[Support] Confirmation email error:", err)
    );
  } catch (err) {
    console.error("[Support] Email template error:", err);
  }

  return { success: true, ticketNumber: ticket.ticket_number, ticketId: ticket.id };
}

export async function getMyTickets() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in.", tickets: [] };

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select(
      `
      id,
      ticket_number,
      subject,
      category,
      priority,
      status,
      created_at,
      updated_at
    `
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[Support] Failed to fetch tickets:", error);
    return { error: "Failed to load tickets.", tickets: [] };
  }

  // Get message counts per ticket
  const ticketIds = (tickets || []).map((t) => t.id);
  let messageCounts: Record<string, number> = {};

  if (ticketIds.length > 0) {
    const { data: counts } = await supabase
      .from("support_messages")
      .select("ticket_id")
      .in("ticket_id", ticketIds);

    if (counts) {
      for (const row of counts) {
        messageCounts[row.ticket_id] = (messageCounts[row.ticket_id] || 0) + 1;
      }
    }
  }

  return {
    tickets: (tickets || []).map((t) => ({
      ...t,
      message_count: messageCounts[t.id] || 0,
    })),
  };
}

export async function getTicketDetail(ticketId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in." };

  // Check user role for admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch ticket
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select(
      `
      id,
      ticket_number,
      user_id,
      user_role,
      subject,
      category,
      priority,
      status,
      resolved_at,
      closed_at,
      created_at,
      updated_at
    `
    )
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) {
    return { error: "Ticket not found." };
  }

  // Verify access (owner or admin)
  if (!isAdmin && ticket.user_id !== user.id) {
    return { error: "You do not have access to this ticket." };
  }

  // Fetch messages (admins see internal notes, users don't)
  let messagesQuery = supabase
    .from("support_messages")
    .select(
      `
      id,
      sender_id,
      sender_role,
      message,
      is_internal_note,
      created_at
    `
    )
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (!isAdmin) {
    messagesQuery = messagesQuery.eq("is_internal_note", false);
  }

  const { data: messages } = await messagesQuery;

  // Fetch sender names for messages
  const senderIds = [...new Set((messages || []).map((m) => m.sender_id))];
  let senderNames: Record<string, string> = {};

  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .in("id", senderIds);

    if (senders) {
      for (const s of senders) {
        senderNames[s.id] =
          s.role === "admin"
            ? "Support Team"
            : `${s.first_name || ""} ${s.last_name || ""}`.trim() || "User";
      }
    }
  }

  // Get ticket creator info
  const { data: ticketUser } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone, notification_whatsapp")
    .eq("id", ticket.user_id)
    .single();

  return {
    ticket: {
      ...ticket,
      user_name: ticketUser
        ? `${ticketUser.first_name || ""} ${ticketUser.last_name || ""}`.trim()
        : "Unknown",
      user_email: ticketUser?.email || "",
    },
    messages: (messages || []).map((m) => ({
      ...m,
      sender_name: senderNames[m.sender_id] || "Unknown",
    })),
  };
}

export async function replyToTicket(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in." };

  const ticketId = formData.get("ticket_id") as string;
  const message = (formData.get("message") as string)?.trim();

  if (!ticketId) return { error: "Ticket ID is required." };
  if (!message || message.length > 5000) {
    return { error: "Message is required (max 5,000 characters)." };
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const isAdmin = profile.role === "admin";

  // Verify ticket access
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, user_id, ticket_number, status")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: "Ticket not found." };
  if (!isAdmin && ticket.user_id !== user.id) {
    return { error: "You do not have access to this ticket." };
  }

  // Don't allow replies on closed tickets
  if (ticket.status === "closed") {
    return { error: "This ticket is closed. Please open a new ticket." };
  }

  const adminSupabase = createAdminClient();

  // Insert message
  const { error: insertError } = await adminSupabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: profile.role,
      message,
      is_internal_note: false,
    });

  if (insertError) {
    console.error("[Support] Failed to insert reply:", insertError);
    return { error: "Failed to send reply." };
  }

  // If user reply and ticket was waiting_on_customer, reopen it
  if (!isAdmin && ticket.status === "waiting_on_customer") {
    await adminSupabase
      .from("support_tickets")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", ticketId);
  }

  // If admin reply, send notification to ticket creator
  if (isAdmin) {
    // Update status to in_progress if it was open
    if (ticket.status === "open") {
      await adminSupabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", ticketId);
    }

    // Send reply notification email
    try {
      const { data: ticketUser } = await adminSupabase
        .from("profiles")
        .select("email, first_name, last_name, phone, notification_whatsapp, preferred_locale, role")
        .eq("id", ticket.user_id)
        .single();

      if (ticketUser?.email) {
        const { supportTicketReplyEmail } = await import(
          "@/lib/email/templates"
        );
        const dashboardBase = ticketUser.role === "doctor" ? "doctor-dashboard" : "dashboard";
        const { subject, html } = supportTicketReplyEmail({
          userName: `${ticketUser.first_name} ${ticketUser.last_name}`,
          ticketNumber: ticket.ticket_number,
          replyPreview: message.substring(0, 200),
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/en/${dashboardBase}/support/${ticketId}`,
        });

        sendEmail({ to: ticketUser.email, subject, html }).catch((err) =>
          console.error("[Support] Reply email error:", err)
        );

        // Send WhatsApp notification if opted in
        if (ticketUser.notification_whatsapp && ticketUser.phone) {
          const { sendWhatsAppTemplate } = await import(
            "@/lib/whatsapp/client"
          );
          const {
            TEMPLATE_TICKET_UPDATE,
            buildTicketUpdateComponents,
            mapLocaleToWhatsApp,
          } = await import("@/lib/whatsapp/templates");

          sendWhatsAppTemplate({
            to: ticketUser.phone,
            templateName: TEMPLATE_TICKET_UPDATE,
            languageCode: mapLocaleToWhatsApp(ticketUser.preferred_locale),
            components: buildTicketUpdateComponents({
              userName: ticketUser.first_name || "there",
              ticketNumber: ticket.ticket_number,
            }),
          }).catch((err) =>
            console.error("[Support] WhatsApp reply notification error:", err)
          );
        }
      }
    } catch (err) {
      console.error("[Support] Reply notification error:", err);
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// ============================================================
// Admin Actions
// ============================================================

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (
    ADMIN_EMAILS.length > 0 &&
    !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")
  ) {
    return { error: "Access denied" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Access denied" };

  return { user, supabase };
}

export async function getAdminTickets(filters?: {
  status?: string;
  category?: string;
  priority?: string;
}) {
  const { error, user } = await requireAdmin();
  if (error || !user) return { error: error || "Unauthorized", tickets: [] };

  const adminSupabase = createAdminClient();

  let query = adminSupabase
    .from("support_tickets")
    .select(
      `
      id,
      ticket_number,
      user_id,
      user_role,
      subject,
      category,
      priority,
      status,
      created_at,
      updated_at
    `
    )
    .order("updated_at", { ascending: false });

  if (filters?.status && VALID_STATUSES.includes(filters.status as any)) {
    query = query.eq("status", filters.status);
  }
  if (filters?.category && VALID_CATEGORIES.includes(filters.category as any)) {
    query = query.eq("category", filters.category);
  }
  if (filters?.priority && VALID_PRIORITIES.includes(filters.priority as any)) {
    query = query.eq("priority", filters.priority);
  }

  const { data: tickets, error: queryError } = await query;

  if (queryError) {
    console.error("[Support] Admin tickets query error:", queryError);
    return { error: "Failed to load tickets.", tickets: [] };
  }

  // Get user names + message counts
  const userIds = [...new Set((tickets || []).map((t) => t.user_id))];
  const ticketIds = (tickets || []).map((t) => t.id);

  let userNames: Record<string, string> = {};
  let messageCounts: Record<string, number> = {};

  if (userIds.length > 0) {
    const { data: users } = await adminSupabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    if (users) {
      for (const u of users) {
        userNames[u.id] =
          `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email;
      }
    }
  }

  if (ticketIds.length > 0) {
    const { data: msgs } = await adminSupabase
      .from("support_messages")
      .select("ticket_id")
      .in("ticket_id", ticketIds);

    if (msgs) {
      for (const m of msgs) {
        messageCounts[m.ticket_id] = (messageCounts[m.ticket_id] || 0) + 1;
      }
    }
  }

  return {
    tickets: (tickets || []).map((t) => ({
      ...t,
      user_name: userNames[t.user_id] || "Unknown",
      message_count: messageCounts[t.id] || 0,
    })),
  };
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const { error, user, supabase } = await requireAdmin();
  if (error || !user || !supabase) return { error: error || "Unauthorized" };

  if (!VALID_STATUSES.includes(status as any)) {
    return { error: "Invalid status." };
  }

  const adminSupabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "resolved") {
    updateData.resolved_at = new Date().toISOString();
  } else if (status === "closed") {
    updateData.closed_at = new Date().toISOString();
  }

  const { error: updateError } = await adminSupabase
    .from("support_tickets")
    .update(updateData)
    .eq("id", ticketId);

  if (updateError) {
    console.error("[Support] Status update error:", updateError);
    return { error: "Failed to update ticket status." };
  }

  // Log admin action
  await adminSupabase.from("audit_log").insert({
    actor_id: user.id,
    action: "update_ticket_status",
    target_type: "support_ticket",
    target_id: ticketId,
    metadata: { new_status: status },
  });

  // If resolved, send notification to ticket creator
  if (status === "resolved") {
    try {
      const { data: ticket } = await adminSupabase
        .from("support_tickets")
        .select("ticket_number, user_id, subject")
        .eq("id", ticketId)
        .single();

      if (ticket) {
        const { data: ticketUser } = await adminSupabase
          .from("profiles")
          .select("email, first_name, last_name, role")
          .eq("id", ticket.user_id)
          .single();

        if (ticketUser?.email) {
          const { supportTicketResolvedEmail } = await import(
            "@/lib/email/templates"
          );
          const dashboardBase = ticketUser.role === "doctor" ? "doctor-dashboard" : "dashboard";
          const { subject: emailSubject, html } = supportTicketResolvedEmail({
            userName: `${ticketUser.first_name} ${ticketUser.last_name}`,
            ticketNumber: ticket.ticket_number,
            ticketSubject: ticket.subject,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/en/${dashboardBase}/support/${ticketId}`,
          });

          sendEmail({ to: ticketUser.email, subject: emailSubject, html }).catch(
            (err) => console.error("[Support] Resolved email error:", err)
          );
        }
      }
    } catch (err) {
      console.error("[Support] Resolved notification error:", err);
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateTicketPriority(
  ticketId: string,
  priority: string
) {
  const { error, user } = await requireAdmin();
  if (error || !user) return { error: error || "Unauthorized" };

  if (!VALID_PRIORITIES.includes(priority as any)) {
    return { error: "Invalid priority." };
  }

  const adminSupabase = createAdminClient();

  const { error: updateError } = await adminSupabase
    .from("support_tickets")
    .update({ priority, updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (updateError) {
    return { error: "Failed to update priority." };
  }

  // Log admin action
  await adminSupabase.from("audit_log").insert({
    actor_id: user.id,
    action: "update_ticket_priority",
    target_type: "support_ticket",
    target_id: ticketId,
    metadata: { new_priority: priority },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function addInternalNote(ticketId: string, message: string) {
  const { error, user } = await requireAdmin();
  if (error || !user) return { error: error || "Unauthorized" };

  if (!message?.trim() || message.length > 5000) {
    return { error: "Note is required (max 5,000 characters)." };
  }

  const adminSupabase = createAdminClient();

  const { error: insertError } = await adminSupabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: "admin",
      message: message.trim(),
      is_internal_note: true,
    });

  if (insertError) {
    return { error: "Failed to add internal note." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function getAdminTicketStats() {
  const { error } = await requireAdmin();
  if (error) return { error };

  const adminSupabase = createAdminClient();

  const [
    { count: openCount },
    { count: inProgressCount },
    { count: waitingCount },
    { count: resolvedThisWeek },
  ] = await Promise.all([
    adminSupabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    adminSupabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress"),
    adminSupabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "waiting_on_customer"),
    adminSupabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved")
      .gte(
        "resolved_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      ),
  ]);

  return {
    open: openCount || 0,
    in_progress: inProgressCount || 0,
    waiting_on_customer: waitingCount || 0,
    resolved_this_week: resolvedThisWeek || 0,
  };
}
