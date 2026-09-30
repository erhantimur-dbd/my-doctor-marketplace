-- Drop unused seat-count RPCs.
--
-- Callers checked in app code, edge functions, and SQL (functions and
-- triggers), including the prod-imported timestamp migrations: none.
-- Seat counts are written by recomputeOrgUsedSeats, not by these functions.
-- This migration does not update any licence rows.
--
-- Signatures are the ones prod grants in 00127 (revoke_definer_service_only_grants):
--   public.increment_used_seats(uuid)
--   public.increment_used_seats(uuid, text)
--   public.decrement_used_seats(uuid)
--   public.decrement_used_seats(uuid, text)
-- The 2-arg forms are the DEFAULT 'doctor' overloads from 00076, so a
-- 1-arg call is ambiguous with them. Both overloads are dropped.

DROP FUNCTION IF EXISTS public.increment_used_seats(uuid);
DROP FUNCTION IF EXISTS public.increment_used_seats(uuid, text);
DROP FUNCTION IF EXISTS public.decrement_used_seats(uuid);
DROP FUNCTION IF EXISTS public.decrement_used_seats(uuid, text);
