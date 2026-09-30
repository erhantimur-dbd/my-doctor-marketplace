-- Supabase default privileges grant EXECUTE on new public functions to anon
-- and authenticated. REVOKE ... FROM PUBLIC does not remove those role
-- grants. REVOKE is a no-op when the grant is already gone, so this is safe
-- to re-run on prod.

REVOKE EXECUTE ON FUNCTION public.reserve_correction_offset(uuid,uuid,int), public.release_reserved_offset_holds(uuid[]), public.apply_reserved_offset_holds(uuid), public.restore_offset_for_refund(uuid,text,int,int) FROM anon, authenticated;
