# Production migration drift

Supabase project `zlixmfcppzvbayyjymrv`. The timestamped `.sql` files in this directory are statements already stored in `supabase_migrations.schema_migrations`. This is a record of production. Do not apply them again.

## Why these filenames

`supabase db push` uses the numeric prefix as the migration version and skips a version that is already in `schema_migrations`. These files keep the production versions, so a push does not re-run them. The CLI accepts that next to the repo's `00xxx_` files: any numeric prefix is a version.

Versions sort as text, so `00126` is before `20260302155748`. On an empty database the timestamp files would run after the numbered history. Several of them touch objects the numbered files already create, and they are not a second replay. `00127` stays free for definer hardening.

## Imported, already applied

| Version | File |
| --- | --- |
| 20260302155748 | `20260302155748_add_accepted_payments_column.sql` |
| 20260302163301 | `20260302163301_get_available_dates_in_range.sql` |
| 20260304123012 | `20260304123012_enable_rls_on_unprotected_tables.sql` |
| 20260308011124 | `20260308011124_security_hardening_rls.sql` |
| 20260308015137 | `20260308015137_create_invoices_and_rpc.sql` |
| 20260308181810 | `20260308181810_invoice_reminders_and_expired_status.sql` |
| 20260318102647 | `20260318102647_satisfaction_surveys_recreate.sql` |
| 20260404172754 | `20260404172754_medications_autocomplete_schema.sql` |
| 20260928231134 | `20260928231134_bookings_completed_at.sql` |

## Not imported

| Prod version | Name | Where it lives |
| --- | --- | --- |
| 20260930154959 | revoke_offset_rpc_grants | `00126_revoke_offset_rpc_grants.sql` (#89) |
| 20260930155956 | revoke_definer_service_only_grants | `00127_definer_hardening.sql` (#90) |
| 20260930160536 | revoke_get_org_bookings_anon | `00127_definer_hardening.sql` (#90) |
| 20260930161246 | guard_get_org_bookings | `00127_definer_hardening.sql` (#90) |

## Overlaps with numbered migrations

Numbered files were not edited.

- `doctors.accepted_payments` is only in `20260302155748`. No numbered migration adds it.
- `get_available_dates_in_range(uuid, date, date, text)` is only in `20260302163301`. No numbered migration defines it. The 5-arg `get_available_slots` is not in this export.
- Invoices and `nextval_invoice_number()` match `00043_create_invoices.sql`. Reminder columns and the `expired` status match `00044_invoice_reminders_and_expired.sql`.
- `satisfaction_surveys` is created by `00072_satisfaction_surveys.sql`. The prod file recreates it with `IF NOT EXISTS` and policy guards.
- Medications schema and `search_medications` match the schema half of `00083_medications_autocomplete.sql` (that file also seeds rows). `search_medications` is not `SECURITY DEFINER`. The prod `CREATE POLICY` has no duplicate guard, so it will not replay after `00083`.
- `bookings.completed_at` is also added by `00116_booking_completed_at_and_tp_rls.sql` (`idx_bookings_completed_at`). The prod file adds a different partial index, `bookings_completed_at_status_idx`.
- RLS on `platform_settings`, `ai_symptom_cache`, `ai_search_cache`, `doctor_review_summaries`, `treatment_plans`, and `follow_up_invitations` is also touched by `00034`, `00070`, `00078`, `00090`, `00116`, and `00120`.

## Unpinned `SECURITY DEFINER` in the imported files

Neither function sets `search_path`:

- `public.get_available_dates_in_range(uuid, date, date, text)`
- `nextval_invoice_number()`

The grant test ignores `20` + 12-digit version files. Those two names are the historical allowlist.
