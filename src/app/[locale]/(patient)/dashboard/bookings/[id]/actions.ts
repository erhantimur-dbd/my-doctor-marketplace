"use server";

/**
 * Patient booking detail actions.
 * Cancellation must go through the shared cancelBooking in @/actions/booking
 * so refunds, Daily room cleanup, calendar removal, and doctor notify run.
 */

export { cancelBooking } from "@/actions/booking";
