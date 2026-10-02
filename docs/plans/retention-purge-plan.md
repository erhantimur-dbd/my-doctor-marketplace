# Retention purge plan

Status: plan only. No migration, no function, and no scheduler until this is approved.
Date: 2 October 2026.
Base: `origin/main` at `f6559b5` (`Restrict accounts that must keep clinical or booking records`).
Word: accounts that keep records are **restricted**.

Erasure is live in `supabase/migrations/00135_account_erasure.sql` and `supabase/migrations/00141_account_erasure_gaps.sql`, with the app entry in `src/lib/account/erase-account.ts`. Restriction sets `profiles.restricted_at` and keeps the rows. This job is the later delete or scrub, after Legal's periods end. It also closes the sole-member organisation gap below.

Published privacy copy does not match these rules. `src/app/[locale]/(public)/privacy/privacy-uk.tsx` still says booking records for 8 years, payments for 7 years, and audit logs for 2 years. Open draft PR #106 rewrites the "account data is deleted" sentence. This job implements John's rules below. The privacy page is a separate change.

## Rules this job implements

| Rule | Period | Clock starts |
| --- | --- | --- |
| Clinical records, prescriptions, their audit rows, consult messages | Adults: 8 years after the last consultation. Children: the later of 8 years after the last consultation, or the 25th birthday. If the child was 17 at the last consultation, the birthday used is the 26th, not the 25th. | Last consultation date, plus date of birth. Defined below. |
| Bookings, payments, refunds, wallet credit, statements | 6 years after the end of the UK tax year the row falls in | The row's own tax-year timestamp. Year definition is fixed below and flagged for John. |
| Support messages | 2 years | `support_messages.created_at` |
| Doctor GMC, CQC, and indemnity details | 6 years after the doctor leaves | `doctors.left_at`, defined below and flagged |
| Dispute files | 12 months after the dispute closes | `payment_corrections.dispute_resolved_at`, or a new closed timestamp for a Stripe dispute |
| Call join and leave times | The same instant as the booking row they belong to | No such columns exist today |
| Audit log | Stays append-only until its own period ends, then the purge function may delete | Per-log, below |

A row that sits under two rules is deleted only when every rule that applies to it has ended. Clinical text on a booking is scrubbed when the clinical clock ends. The booking row itself stays until the financial clock has also ended.

Contact details on financial rows are scrubbed when the account is restricted, and the amounts, dates, and status stay until the financial clock ends. Erasure does not do that scrub today except for finished `bookings.patient_notes`. This job includes a restricted-account contact sweep. It does not scrub contact on an account that is still open.

## 1. Inventory

Clocks are evaluated in `Europe/London`. A `date` column is already a civil date. A `timestamptz` is converted with `AT TIME ZONE 'Europe/London'` before the tax-year or birthday test.

Missing tables and columns are skipped with `to_regclass` and `pg_attribute`, the same guard `erase_account` uses. The columns marked "may be absent on prod" are called out because `00135` or `PROD_DRIFT.md` says the migration never landed, or because no migration creates the column.

### 1.1 Last consultation

A consultation is a booking with `status = 'completed'`. The date is `bookings.appointment_date` (a `date` from `00006_create_bookings.sql`). `bookings.completed_at` (`00116_booking_completed_at_and_tp_rls.sql`, also the prod file `20260928231134_bookings_completed_at.sql`) is not the clock. A doctor can mark a visit complete the next morning, and that must not move the birthday test.

The last consultation for a subject is the maximum `appointment_date` among the bookings that belong to that subject. A prescription with no completed booking still counts: its consultation date is `(prescribed_at AT TIME ZONE 'Europe/London')::date`, and it moves the subject's maximum if it is later.

Subject:

- The patient, when `bookings.dependent_id` is null. `patient_id` is `profiles.id`.
- The dependent, when `bookings.dependent_id` is set. The parent's own clinical clock does not move because they booked for the child.
- A prescription follows the booking's dependent when `prescriptions.booking_id` points at a booking with `dependent_id`. Otherwise it follows `prescriptions.patient_id`. `prescriptions` has no `dependent_id` (`00065_prescriptions.sql`).

Statuses that are not a consultation: `pending_payment`, `pending_approval`, `confirmed`, `approved`, `rejected`, `cancelled_patient`, `cancelled_doctor`, `no_show`, `expired`, `pending_reschedule_payment`. The check constraint is `00110_booking_expired_status.sql`.

`refunded` is flagged in the questions. A refund replaces `completed` on the same status column, so a visit that happened and was later refunded disappears from `status = 'completed'`.

### 1.2 Date of birth, and the fact that erasure already clears it

| Subject | Column | Where it is created | What erasure does |
| --- | --- | --- | --- |
| Dependent | `dependents.date_of_birth date` | `00064_family_dependents.sql`. Real column. | `00141` sets it to null on the restricted path (around the dependents `UPDATE`). |
| Patient | `profiles.date_of_birth` | No migration in this repo adds it. Not listed in `supabase/migrations/PROD_DRIFT.md`. `00135` and `00141` clear it only when `pg_attribute` says it exists. The prescription page selects `profiles.date_of_birth`. The pglite erasure fixture creates the column. | Cleared on the restricted path when the column exists. May be absent on prod. |

`dependents.relationship` includes `child`, `spouse`, `parent`, `sibling`, `other`. The child rule follows age at the last consultation, not `relationship = 'child'`. A dependent who is 18 is an adult for this job.

Age is completed years on the consultation date: the birthday has occurred. Someone born 15 June 2010 is 17 on 15 June 2027 and 16 on 14 June 2027.

Proposed adult cutoff, flagged below: completed age 18 or over uses the adult rule only. Age 17 uses the 26th birthday. Age 16 or under uses the 25th birthday.

Retention end for one subject:

- Adult: `last_consultation + 8 years`.
- Age 17: the later of `last_consultation + 8 years` and the 26th birthday (`date_of_birth + 25 years` is the 25th birthday; `+ 26 years` is the 26th).
- Younger child: the later of `last_consultation + 8 years` and the 25th birthday.

The anniversary day is still inside the period. A row is eligible on the next London civil day.

Worked examples, for the SQL fixtures:

- Born 15 June 2010, last consultation 15 June 2027 (turns 17 that day). Eight years later is 15 June 2035. The 26th birthday is 15 June 2036. Eligible 16 June 2036.
- Same birth date, last consultation 14 June 2027 (still 16). Eight years later is 14 June 2035. The 25th birthday is 15 June 2035. Eligible 16 June 2035. The 26th birthday must not be used.
- Same birth date, last consultation 15 June 2028 (turns 18). Adult. Eligible 16 June 2036. The 25th and 26th birthdays are not used.
- Born 1 January 1990, last consultation 2 October 2018. Eligible 3 October 2026.

Date of birth after restriction has to live somewhere erasure does not null. This migration adds `public.retention_subjects`:

- `subject_type text` check (`profile`, `dependent`)
- `subject_id uuid` primary key
- `date_of_birth date`
- `recorded_at timestamptz`

No name, no email, no notes. RLS on, no policies for `anon` or `authenticated`, grants to `service_role` only.

`erase_account` is replaced in this migration (do not edit `00135` or `00141`) so that, on the restricted path, it inserts the current date of birth into `retention_subjects` before it nulls the live column. The purge reads `retention_subjects.date_of_birth` for a restricted subject, and the live column for a subject who is not restricted.

Backfill, in the same migration, copies every `dependents.date_of_birth` that is still not null, and `profiles.date_of_birth` when that column exists. Dependents already restricted have already had the column set to null. Those subjects have no date of birth left in the live database. They are held, not purged (`held_missing_dob` in the counts). There is no recovery step in this job.

A missing date of birth on a subject who has a consultation holds that subject's clinical rows. It does not hold unrelated financial rows. Treating "no date of birth" as an adult would delete a child's record at 8 years when the 25th birthday is later.

### 1.3 Clinical rows

Delete or scrub when that row's subject's clinical clock has ended. Held when the subject is `held_missing_dob`, or when an open dispute or legal hold covers the row, the subject, or the booking.

| Table | Columns in scope | Clock | Notes |
| --- | --- | --- | --- |
| `medical_profiles` | `blood_type`, `allergies`, `chronic_conditions`, `current_medications`, `notes`. `emergency_contact_name` and `emergency_contact_phone` are already nulled by erasure. `sharing_consent`, `consent_given_at` from `00058`. | Patient's clinical clock | `patient_id` cascades on profile delete. Unshared profiles are already deleted by erasure and do not, by themselves, restrict the account. |
| `dependent_medical_profiles` | Same clinical columns. Emergency contact already nulled. `sharing_consent` from `00087`. | That dependent's clinical clock | Cascades from `dependents`. |
| `dependents` | `first_name`, `last_name`, `date_of_birth`, `notes`, `relationship` | That dependent's clinical clock, and only after no booking still references `dependent_id` | Names are already blanked on restriction. The row cannot go while `bookings.dependent_id` points at it (`00064` has no `ON DELETE` action, so `NO ACTION`). |
| `prescriptions` | `diagnosis`, `medications`, `notes`, `contains_controlled_drug`, `controlled_drug_justification`, `attested_at`, `prescribed_at`, `valid_until`, `status` | Subject's clinical clock, via `booking_id` when set, else `patient_id` | `00065` plus attestation columns in `00089`. `booking_id` is `ON DELETE SET NULL`. `patient_id` and `doctor_id` cascade, but the audit row does not. |
| `prescription_audit_log` | The whole row: `snapshot`, `attestations`, `ip_address`, `user_agent`, `event_type`, `actor_profile_id`, `created_at` | The prescription's clinical clock | Append-only. `prescription_id` is `ON DELETE RESTRICT` (`00089`). The deny trigger blocks `DELETE` for every role, including `service_role`. See the audit section. `snapshot` can contain the clinical payload and names. It is deleted, not rewritten. |
| `bookings` clinical columns | `doctor_notes` (`00038`), `visit_summary`, `visit_summary_at` (`00057`), `patient_notes` | The booking's subject clinical clock | These are scrubbed to null when the clinical clock ends, even if the booking row stays for the financial clock. `patient_notes` is already nulled for `completed`, `cancelled_patient`, `cancelled_doctor`, and `no_show`. |
| `conversations`, `direct_messages` | `direct_messages.body`, `sender_id`, `sender_role`, `read_at` | Latest clinical end among the patient and every dependent who has a completed booking with that conversation's `doctor_id` | `00040`. One thread per doctor and patient, not per dependent. The stricter clock is deliberate: a child's consult can be in the parent's thread. |
| `message_attachments` | `storage_path`, `file_name`, `file_type` | The message's clock | `00059`. `ON DELETE CASCADE` from `direct_messages` and `conversations`. Storage is a separate delete. `file_name` can be a person's name and must not be written to the purge log. |
| `treatment_plans` | `title`, `description`, `custom_notes`, `doctor_note` is not on this table; `service_name` | Patient's clinical clock, or the dependent's clock when a linked booking (`treatment_plans.booking_id` or `bookings.treatment_plan_id`) has `dependent_id` | Amounts and Stripe ids follow the financial clock. Clinical text is scrubbed at the clinical end. `booking_id` is `ON DELETE SET NULL`, so the link has to be read before the booking goes. |
| `follow_up_invitations.doctor_note` | `doctor_note` | Patient's clinical clock | The rest of the row is financial. `00036`. |
| `satisfaction_surveys.feedback_text` | `feedback_text` | The booking's subject clinical clock | Row cascades when the booking is deleted (`00072`). Text can describe care. Scrub at the clinical end. |
| `post_visit_feedback_notes.free_text` | `free_text` | The booking's subject clinical clock | `00112`. The score row says it is platform experience, not a clinical rating. The free-text note is still scrubbed on the clinical clock because a patient can write symptoms into it. The score row cascades with the booking. |

`reviews.title`, `reviews.comment`, and `reviews.doctor_response` are already nulled by erasure, except when the review's booking has an open dispute. The star `rating` stays so `update_doctor_rating` does not change the doctor's average early. The review row is deleted with the booking, after both clocks, because `reviews.booking_id` is `NOT NULL` with no `ON DELETE` (`00007`). Deleting it will recalculate `doctors.avg_rating`. John did not name reviews. Flagged below.

### 1.4 Financial rows

Tax year used by this plan (flagged for John):

This is the UK tax year, the year of assessment, not a calendar year and not a company's accounting reference date. It runs from 6 April 00:00:00 `Europe/London` through 5 April 23:59:59 `Europe/London` the next calendar year. The label is the calendar year in which it starts. 6 April 2024 through 5 April 2025 is tax year 2024-25.

Six years after the end means the row is kept through the sixth anniversary of 5 April, and is eligible on the next 6 April. A payment on 5 April 2025 falls in 2024-25 and is eligible on 6 April 2031. A payment on 6 April 2025 falls in 2025-26 and is eligible on 6 April 2032.

The boundary is London civil time. 5 April 2025 23:30 UTC is 6 April 2025 00:30 in London (British Summer Time), and falls in the next tax year. A test must use a `timestamptz`, not a UTC date truncation.

There is no `public.payments` table in the migrations. `00141` says `platform_fees` is the payment ledger and consults `public.payments` only when the relation exists. If prod has `public.payments`, it is in this financial rule. If it does not, the function skips it.

There is no statements table. Activity statements are read from `doctor_wallet_credit_transfers.statement_line` and `payment_corrections.statement_line` (see `00113` and the doctor payments page). Open PR #55 draws a statement in the app and adds no table.

| Table | What is kept until the tax-year clock | Contact scrubbed when `profiles.restricted_at` is set | Timestamp that places the row in a tax year |
| --- | --- | --- | --- |
| `bookings` | Status, appointment date, start and end, amounts, currency, `paid_at`, `refunded_at`, `refund_amount_cents`, `customer_refund_codes` (`00138`), Stripe charge and payment-intent ids, `wallet_credit_applied_cents`, fee cents, `is_guest`, `is_test` | `patient_phone`, `dependent_name`, `cancellation_reason`. Not scrubbed by erasure today, except finished `patient_notes`. | `paid_at`. If `refunded_at` is later, the row also waits for the refund's tax year. If `paid_at` is null, `created_at`. |
| `platform_fees` | The whole row (no contact columns) | None | `created_at`. Also not before its booking is eligible, when `booking_id` is set. |
| `invoices` | Number, amounts, currency, status, `due_date`, `paid_at`, Stripe session id, `items` | No email column. `doctor_note` is clinical, not this scrub. `items` is service names; flagged if a name is typed into an item. | `coalesce(paid_at, created_at)` |
| `patient_wallet` | `currency`, `balance_cents` | None | The latest `wallet_transactions.created_at` for that patient and currency. A non-zero balance is a question, not a silent write-off. |
| `wallet_transactions` | Type, amounts, currency, `balance_after_cents`, `source_type`, booking ids, `created_at` | `description` | `created_at` |
| `doctor_wallet_credit_transfers` | Amounts, `statement_line`, Stripe transfer id, status, `reversed_cents` | `statement_line` is the fixed text `Paid with MyDoctors360 credit` (`00113`). Leave it. | `created_at`, and not before the booking |
| `gift_cards` | Code, amounts, currency, status, Stripe payment-intent id, `redeemed_at`, `expires_at` | `purchased_email`, `recipient_email`, `recipient_name`, `message` when `purchased_by` or `redeemed_by` is restricted | `created_at` for the purchase. `redeemed_at` if set and later. |
| `payment_corrections` | Amounts, currency, status, Stripe ids, `statement_line`, `related_payment_at`, `settled_at`, party, direction | Free text that can name a person: `reason`, `clear_risk_reason`. Dispute narrative is the dispute-file rule, not this scrub. | `coalesce(related_payment_at, created_at)`, and `settled_at` if later |
| `payment_correction_offset_holds` | The whole row | None | The correction's clock. Not append-only. |
| `stripe_transfer_reversal_audits` | The whole row | None. Ids only. | `reversed_at`. `booking_id` is `ON DELETE SET NULL`; delete the audit on its own clock rather than orphaning it. |
| `points_transactions` | Points, type, `balance_after`, `source`, `booking_id` | `description` | `created_at`. Loyalty is not cash. Flagged. `patient_points` is the balance and follows the same end. |
| `patient_referrals` | Amounts, status, code | `referred_email` | `created_at` |
| `doctor_subscriptions`, `licenses` | Stripe customer and subscription ids, status, period dates, amounts implied by tier | None on these tables | `coalesce(cancelled_at, current_period_end, created_at)` on `licenses`. `doctor_subscriptions` has no `cancelled_at`; use `updated_at` when `status` is `cancelled`, else do not start the clock while `status` is `active` or `trialing`. |

`bookings` contact columns that stay because they are not contact: `video_room_url`, `daily_room_name`, calendar event ids. They go when the booking row is deleted.

### 1.5 Support messages

| Table | Columns | Clock |
| --- | --- | --- |
| `support_messages` | `message`, `attachments` jsonb, `is_internal_note`, `sender_id`, `sender_role` | `created_at` plus 2 years, and only when the parent ticket `status` is `resolved` or `closed` |
| `support_tickets` | `subject`, `ticket_number`, `user_id` | Deleted when it has no messages left, status is `resolved` or `closed`, and `coalesce(closed_at, resolved_at, updated_at)` is at least 2 years ago |

Open statuses `open`, `in_progress`, and `waiting_on_customer` hold the ticket and its messages. `attachments` is jsonb. No support-attachment bucket exists in the migrations. If an element contains a storage path in a known bucket, it is queued. Paths are not logged.

`contact_inquiries` (`00026`) has `name`, `email`, and `message`, and no user id. John did not name it. It is out of the delete set until he says otherwise. Flagged.

### 1.6 Doctor GMC, CQC, and indemnity

Columns, all on `doctors` unless noted:

- `gmc_number` (`00041_add_gmc_number.sql`)
- `cqc_status`, `cqc_provider_id`, `cqc_location_id`, `cqc_verified_at` (`00088`)
- `indemnity_insurer`, `indemnity_cover_gbp`, `indemnity_expiry`, `indemnity_document_id` (`00088`)
- `mpl_designated_body`, `mpl_attestation_signed_at`, `dbs_check_date`, `dbs_document_id` (`00088`). These are the same UK pack as CQC. Flagged as included by that fact, not because John named DBS or the performers list.
- `doctor_documents` rows with `document_type` in (`medical_license`, `id_document`, `insurance`) and their `storage_path`, `file_name` (`00004`)
- `doctor_approval_checklist.gmc_verified`, `cqc_status_evidenced`, `indemnity_document_verified`, `indemnity_in_date`, `dbs_check_verified`, `notes` (`00049`, `00088`)

`cqc_status` cannot be nulled. The check constraint and default are `unknown`. Scrub sets `unknown`. Booleans on the checklist are set back to false. Text and ids are set to null. Document rows are deleted.

`doctor_documents` is not written by any file under `src/`. The bucket for `storage_path` is not in the migrations. The known buckets are `avatars` (`00021`), `public-read` (`00129`), and `message-attachments` (`00059`). The job deletes a storage object only when `storage.objects` has that path in one of those three buckets. A path with no object increments `missing_object` in the counts. The path is not logged.

What "leaves" means. There is no `left_at`, no `departed_at`, and no member status `left`.

Erasure, on the restricted path, sets `doctors.is_active = false` and `doctors.verification_status = 'suspended'`. It does not clear GMC, CQC, or indemnity. `00135` says those are kept on purpose. `is_active` is also toggled for ordinary listing changes, so it must not start this clock.

This migration adds `doctors.left_at timestamptz`, null by default. It is set once, and a later profile edit must not move it.

- `erase_account`, on the restricted path, sets `left_at = coalesce(left_at, now())` for that doctor's row.
- Backfill: `left_at = profiles.restricted_at` where the doctor's profile is already restricted and `left_at` is null.
- A doctor who is merely inactive, or whose membership is `suspended` without `profiles.restricted_at`, does not get a `left_at`. Their regulatory details stay.

The scrub runs when `left_at` is at least 6 years ago, and no open dispute or legal hold covers that doctor or their organisation. The `doctors` row stays. `bookings.doctor_id` has no `ON DELETE`, so the row cannot be removed while a booking remains. Stripe account ids on `doctors` are not part of this scrub.

### 1.7 Dispute files

Two stores:

1. `payment_corrections` dispute columns: `disputed_at`, `dispute_reason`, `dispute_reply_due_at`, `dispute_findings`, `dispute_resolved_at`, `dispute_outcome`, `customer_response`, `customer_responded_at`, `escalated_by_doctor_at`. Close is `dispute_resolved_at is not null`. Twelve months later, those text and outcome columns are nulled. Amounts, `statement_line`, and Stripe ids stay until the financial clock. Status is not reopened.
2. Stripe dispute columns on `bookings` (`00123`): `stripe_dispute_id`, `stripe_dispute_status`, `stripe_dispute_amount_cents`, `stripe_dispute_reason`, `stripe_dispute_created_at`, `stripe_dispute_account_id`. There is no closed-at column. Open statuses, copied from `00135`, are `needs_response`, `under_review`, `warning_needs_response`, `warning_under_review`. Anything else non-null is treated as closed only once `bookings.stripe_dispute_closed_at` is set. This migration adds that column, nullable. The webhook that writes `stripe_dispute_status` (`src/lib/stripe/connect-event-handlers.ts`) must set `stripe_dispute_closed_at` when the status leaves the open set, and must not move it afterwards. Until that timestamp exists, a Stripe dispute is held. The 12-month scrub nulls `stripe_dispute_reason` and the status text stays until the booking's financial delete, so a later run can still see that a dispute existed.

`payment_correction_events.payload` and `payment_correction_approvals` are append-only (`00124`, trigger `reject_payment_correction_audit_mutation`). They are not rewritten at 12 months. They are deleted with the correction when the financial clock ends, through the purge exception in that trigger. If a payload holds the dispute narrative, that text outlives the 12-month dispute-file rule. Flagged for John.

An open dispute holds every row it touches: the correction, its events and approvals, the booking, the review text, clinical rows for that booking's subject, and the doctor's regulatory scrub.

### 1.8 Call join and leave times

No table and no column stores an actual join or leave time. Searched the migrations and `src/lib/video`. What exists on `bookings` is the scheduled `start_time` and `end_time`, plus `video_room_url` and `daily_room_name` (`00014`). Those identify a Daily room. They are not attendance.

This rule is a no-op until a table exists. The no-op still returns a count of 0 for `call_attendance` so the dry-run shows the rule was considered. A future table needs `booking_id` and `ON DELETE CASCADE`. Its rows become eligible at the same instant as the booking row delete (the later of the clinical and financial clocks), not on their own clock.

When a booking row is deleted, the route deletes the Daily room named by `daily_room_name`, using the existing room-delete helper. The SQL function cannot call Daily. Dry-run does not delete rooms. The room name is queued, not written to the purge log.

### 1.9 Audit logs

| Log | Append-only today | Period this plan uses | Action when the period ends |
| --- | --- | --- | --- |
| `prescription_audit_log` | Yes. `00089` trigger blocks update and delete for every role. | The prescription's clinical clock | `DELETE` the row. No update, so the snapshot is not trimmed in place. |
| `payment_correction_approvals`, `payment_correction_events` | Yes. `00124`. | The correction's financial clock. Not the 12-month dispute-file clock. | `DELETE` with the correction. |
| `stripe_transfer_reversal_audits` | No trigger | Financial clock (`reversed_at`) | `DELETE` |
| `public.audit_log` | No. `00009` is a plain table. `actor_id` references `profiles` with no `ON DELETE`. `metadata jsonb` can hold anything. | Not chosen. John said the audit log stays append-only until its period ends, and did not give the period. The privacy page says 2 years. | This job adds the append-only trigger. It does not delete `public.audit_log` rows until John names the period. |
| `chat_search_intents` | Yes. `00091`. No user id and no raw text. | Out of scope | None |

The purge exception is a transaction-local setting, not a dropped trigger. `purge_expired_retention` calls `set_config('mydoctors360.retention_purge', 'on', true)` and the three deny functions allow `DELETE` only when that setting is `on`. They still reject `UPDATE`. The setting is local to the purge transaction. This is the same trust boundary as `erase_account`: `service_role` can call the function. A direct `DELETE` outside the function keeps failing. The SQL fixture asserts that.

### 1.10 Columns that may be absent on prod

- `profiles.date_of_birth`. Not created by any migration here.
- `doctors.profile_video_path`, `profile_video_status`, `profile_video_uploaded_at`, `profile_video_reviewed_at`, `profile_video_rejection_reason`, `gender`. `00135` says those migrations were never applied. `00094_doctify_parity_features.sql` is in the repo. The purge does not read them.
- `organizations.brand_display_name`, `brand_support_email`, `brand_support_phone`, and the other `brand_*` columns. `00133` adds them with `IF NOT EXISTS` because prod already had them from outside the history. The scrub assigns a brand column only when `pg_attribute` shows it, matching `00141`.
- `public.payments`. Named by `00141` as optional.
- `bookings.completed_at`. Present from `00116` and from the imported prod file. Not required for the clock.
- `bookings.stripe_dispute_closed_at` and `doctors.left_at`. Added by the proposed migration, so they are absent until it runs.

## 2. Sole-member organisation

### 2.1 The real status values

`organization_members.status` is `text not null default 'active'` with a check constraint, from `00047_create_organizations_and_licenses.sql`:

`invited`, `active`, `suspended`, `removed`.

`src/types/index.ts` repeats that union. No migration, and no TypeScript or SQL string in the repo, uses `left`. Leaving a clinic sets `status` to `removed` (`src/actions/organization.ts`, `src/actions/clinic-invitations.ts`).

So `left` is not a value the database can store while the check constraint is in force. `PROD_DRIFT.md` does not say the check was dropped.

### 2.2 How 00141 counts members

Two different predicates.

Erasure block, in `erase_account` and in `findErasureBlock` (`LIVE_MEMBER_STATUSES`): another member blocks erasure when `status` is `active`, `invited`, or `suspended`. `removed` does not block. A value of `left`, if a row had it, would also not block, because it is not in that list.

Scrub, in `erase_account` (`status IS DISTINCT FROM 'removed'`) and in `releaseOrgOwnership` (`status !== "removed"`): another member prevents the organisation scrub when the status is anything other than `removed`. That includes `active`, `invited`, `suspended`, and a hypothetical `left`.

With the check constraint, the two sets are the same. `removed` already counts as a sole-member organisation, and `invited` or `suspended` does not. The hole is only a status outside the check, which is the `left` the request names. Erasure would proceed, and the scrub would keep the organisation's name, email, phone, and brand fields.

`invited` and `suspended` stay "still here". An owner whose other member is invited or suspended is not a sole member.

### 2.3 The fix

One predicate, used by the erasure block, the scrub, and this sweep:

A member is still present when `status` is `active`, `invited`, or `suspended`.

Everyone else, including `removed` and a stored `left` if the check is ever absent, is not present. The owner is a sole member when no other row on that organisation is present.

Do not add `left` to the check constraint. The stored word for a departure remains `removed`.

In `00142`, `CREATE OR REPLACE` `erase_account`. Change only the scrub count from `status IS DISTINCT FROM 'removed'` to `status in ('active', 'invited', 'suspended')`. Leave the block list as it is, so the two sites match. Do not edit `00135` or `00141`.

In `src/lib/account/erase-account.ts`, `releaseOrgOwnership` uses the same present-status list as `LIVE_MEMBER_STATUSES`, not `!== "removed"`.

### 2.4 Sweep of organisations already left in that state

Idempotent, inside the purge function, and safe on a dry-run (the dry-run counts `organizations_scrubbed` and writes nothing).

An organisation is scrubbed when all of the following hold:

- At least one `organization_members` row has `role = 'owner'` and that owner's `profiles.restricted_at` is not null. Erasure is what should have scrubbed it. A live sole owner is not touched.
- No other member is present (`active`, `invited`, or `suspended`), unless that other member's own profile also has `restricted_at` set and their status is `suspended`. A second owner who was also restricted is not a reason to keep the name. An invited or active colleague is.
- `slug` is distinct from `erased-` concatenated with the organisation id.

Scrub, matching `00141` and `scrubOrganization`:

- `name` = `''`
- `email` = null
- `phone` = null
- `brand_display_name` = `''` when the column exists
- `brand_support_email` = null when the column exists
- `brand_support_phone` = null when the column exists
- `slug` = `erased-` plus the organisation id

The owner's membership stays `suspended`, which is what erasure already sets. The sweep does not change membership status.

Columns this scrub does not touch, because `00141` does not: `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`, `website`, `logo_url`, `description`, `stripe_customer_id`, and the other `brand_*` columns (`brand_primary_color`, `brand_custom_css`, and so on). Flagged for the CTO.

## 3. Design

### 3.1 Function

`public.purge_expired_retention(p_dry_run boolean DEFAULT true, p_limit integer DEFAULT 500) returns jsonb`

- `language plpgsql`
- `security definer`
- `set search_path = ''`
- Every name schema-qualified. Dynamic identifiers only through `format` and `%I`, and only after `pg_attribute` confirms the column.
- `revoke all on function ... from public`
- `revoke execute ... from public, anon, authenticated`
- `grant execute ... to service_role`
- Same caller guard as `erase_account`: if `auth.role()` is not `service_role` and `auth.uid()` is not null, raise `forbidden`. A migration session and the SQL fixture have a null `auth.uid()`, so `BEGIN` … `ROLLBACK` can call it. The Vercel route uses the service role.

`p_dry_run` defaults to true. Omitting it returns counts and writes no clinical, financial, or organisation data.

`p_limit` is the maximum rows changed per table per call. Values below 1 or above 2000 are rejected. Default 500.

The return value is counts only:

```json
{
  "dry_run": true,
  "mode": "dry_run",
  "limit": 500,
  "tables": {
    "bookings_scrubbed_clinical": 0,
    "bookings_deleted": 0,
    "prescription_audit_log_deleted": 0,
    "held_missing_dob": 0,
    "held_open_dispute": 0,
    "held_legal_hold": 0,
    "organizations_scrubbed": 0
  }
}
```

No user id, email, name, path, or row payload in the return value or the log.

### 3.2 Kill switch and first runs

`platform_settings` key `retention_purge`, value `{"mode":"dry_run"}`. The migration inserts that row. Allowed modes: `off`, `dry_run`, `apply`.

- `off`: the function writes a log row with `mode = off` and returns zeros, even if `p_dry_run` is false.
- `dry_run`: counts only, even if `p_dry_run` is false.
- `apply`: deletes and scrubs only when `p_dry_run` is false. The default argument is still a dry-run.

The route reads the setting and passes `p_dry_run` false only when the mode is `apply`. Both gates have to agree. The first production runs are report-only, because the inserted mode is `dry_run`. Flipping to `apply` is a later, explicit settings change. It is not part of this migration.

### 3.3 Log

`public.retention_purge_runs`:

- `id uuid`
- `started_at`, `finished_at timestamptz`
- `dry_run boolean`
- `mode text`
- `batch_limit integer`
- `counts jsonb` (the same shape as the return value)
- `sqlstate text` null on success

No subject ids, no emails, no statement text, no storage paths. RLS on, no policies for `anon` or `authenticated`. Inserts come from the definer function.

A failed statement rolls the data changes back and records `sqlstate` only. The function does not swallow `undefined_column` from a column it decided to write. Missing optional columns are skipped before the statement is built.

### 3.4 Idempotency and batches

Scrubs are `update ... where column is distinct from` the target value, so a second run changes 0 rows. Deletes key on primary key. A row already gone is not an error.

Parents are deleted only when no child row remains. If the child's batch fills `p_limit`, the parent stays until a later call. Re-running finishes the work. The function does not remember a cursor. Eligibility is recomputed each time, which is what makes a partial batch safe.

Order inside one call, after the hold and date-of-birth checks:

1. Count or scrub organisation identity (the sweep).
2. Count or scrub restricted-account contact on financial rows.
3. Count or scrub clinical text whose clock has ended (booking notes, medical profiles, message bodies, survey text).
4. Count or delete leaf audit and attachment rows whose clock has ended (`prescription_audit_log` first, then `prescriptions`).
5. Count or delete financial children (`platform_fees`, offset holds, wallet-credit transfers, reversal audits, reviews).
6. Count or delete bookings whose clinical and financial clocks have both ended and whose children are gone.
7. Count or delete support messages, then empty closed tickets.
8. Count or scrub doctor regulatory columns whose `left_at` is 6 years old.
9. Count or delete dependent rows that no booking still references.

Storage and Daily are not deleted inside the function. The function inserts into `public.retention_purge_objects` (`bucket_id`, `object_name`, `daily_room_name`, `enqueued_at`, `deleted_at`) only on an apply run. The route deletes those objects and sets `deleted_at`. The log stores the count of queued objects, not the names. Queue rows are deleted seven days after `deleted_at`. A name can contain a patient file name, so the queue is not a report.

### 3.5 Scheduler

`00127_definer_hardening.sql` records that this project has no `pg_cron`. Do not schedule the job with `pg_cron`.

Use a Vercel cron route, the same pattern as the routes in `vercel.json` and `src/lib/cron/authorize.ts` (`CRON_SECRET`, bearer match, fail closed).

- Path: `/api/cron/retention-purge`
- Schedule: `30 4 * * *` (04:30 UTC). `license-enforcement` is 03:00 and `verify-doctor-credentials` is 04:00. 04:30 is free.
- The route calls `purge_expired_retention` with the service-role client, then drains `retention_purge_objects` through the storage API and the existing Daily room delete. A storage or Daily failure does not roll back the database delete. The queue row stays, with `deleted_at` null, for the next run. The HTTP response is the counts jsonb.

The route's own unit test asserts that a missing secret is rejected, that the default call is a dry-run, and that `mode = off` does not pass an apply flag.

### 3.6 What is out of scope

Reference data (`specialties`, `medications`, `allergies`, `chronic_conditions` catalogues), `blog_posts`, AI caches, `cookie_consents` and `push_subscriptions` (erasure already deletes those), availability, coupons, founding tables, `chat_search_intents`, and `contact_inquiries`.

Deleting `auth.users` for a restricted account whose every row is gone is a later call to `auth.admin.deleteUser` from the route, and only when the function returns that user in a count of `accounts_clear`. The function must not delete `auth.users` itself. The first version returns `accounts_clear` as a count and does not delete auth users. Turning that on is a separate approval, because a missed foreign key would fail `deleteUser` the way erasure already handles.

## 4. Delete versus scrub, foreign keys, storage

| Row | At restriction (existing erasure, plus the contact sweep) | When the short clock ends | When the long clock ends |
| --- | --- | --- | --- |
| Organisation identity for a sole restricted owner | Scrub name, email, phone, brand contact, slug | — | — |
| Financial contact columns | Scrub | — | Delete the row at the tax-year clock, after children |
| Clinical text on a booking | Keep (`patient_notes` already nulled if finished) | Scrub `doctor_notes`, `visit_summary` | Delete the booking row when the financial clock has also ended |
| Medical profile and dependent medical profile | Keep clinical columns. Emergency contact already null. | Delete the row | — |
| Prescription and `prescription_audit_log` | Keep | Delete audit, then prescription | — |
| Consult messages and `message_attachments` | Keep. Erasure keeps them on purpose. | Delete messages. Cascade attachments. Queue storage. | — |
| Dispute narrative | Keep while open, and keep review text while open | 12 months after close: null the narrative columns | Financial row and append-only events stay until the tax-year clock |
| GMC, CQC, indemnity, document rows | Keep. Erasure keeps them on purpose. | — | 6 years after `left_at`: scrub columns, delete `doctor_documents` of those types, queue storage |
| `public.audit_log` | Keep | — | Not deleted in this job |

Foreign keys that force the order:

- `prescription_audit_log.prescription_id` → `prescriptions` `ON DELETE RESTRICT`. Delete the audit first. The trigger must allow that delete.
- `prescriptions.booking_id` → `bookings` `ON DELETE SET NULL`. Read the link before deleting the booking. Deleting the prescription does not delete the booking.
- `reviews.booking_id` is `NOT NULL` with no action. Delete the review before the booking.
- `platform_fees.booking_id` has no action (`00008`; later made nullable). Delete fees before the booking.
- `payment_corrections.booking_id` and `payment_correction_offset_holds.booking_id` have no action. A booking with a correction that is still inside its financial clock is not deleted.
- `doctor_wallet_credit_transfers.booking_id` `ON DELETE CASCADE`. Deleting the booking removes the transfer. Only delete the booking when the transfer's clock has also ended, so the cascade is not an early delete.
- `stripe_transfer_reversal_audits.booking_id` `ON DELETE SET NULL`. Delete the audit on its own clock first.
- `reschedule_requests.booking_id` `ON DELETE CASCADE`.
- `satisfaction_surveys` and `post_visit_feedback` cascade from the booking. Scrub free text first.
- `message_attachments` cascade from `direct_messages`. Queue `storage_path` before the delete.
- `bookings.dependent_id` → `dependents` with no action. Dependents stay until bookings are gone.
- `bookings.patient_id` and `bookings.doctor_id` have no action. Profiles and doctor rows stay.
- `medical_profiles.patient_id` and `dependent_medical_profiles.dependent_id` cascade. Deleting those rows early is safe.
- `wallet_transactions.patient_id` has no action. `patient_wallet.patient_id` cascades. Delete transactions before any later auth-user delete.
- `public.audit_log.actor_id` has no action. Another reason auth users are not deleted in this version.

Storage:

| Object | When | How |
| --- | --- | --- |
| `message-attachments` / `message_attachments.storage_path` | Consult-message clock | Queue, then storage API `remove` |
| `doctor_documents.storage_path` in `avatars`, `public-read`, or `message-attachments` | Regulatory clock | Queue only when an object row matches. Otherwise `missing_object`. |
| `avatars/{userId}/` and `public-read/{userId}/` | Already removed by `deleteAccountStorage` at erasure | Not repeated, except a queue entry if a regulatory document still sits there |
| Daily room `bookings.daily_room_name` | Booking row delete | Route calls the existing delete helper. Dry-run does not. |

## 5. Safety

Never delete or scrub a row when any of these is true:

- `payment_corrections.disputed_at` is not null and `dispute_resolved_at` is null, for that booking, patient, or doctor.
- `payment_corrections.status` is `disputed`, `flagged`, `notified`, `approved`, or `recovering`. Those are unfinished. `settled` and `waived` are closed for the dispute-file clock only when `dispute_resolved_at` is set or `disputed_at` is null. A correction that was never disputed has no dispute file. It still waits for the financial clock.
- `bookings.stripe_dispute_status` is one of the four open values, or is non-null and `stripe_dispute_closed_at` is null.
- `legal_holds.closed_at` is null for the profile, the dependent, the booking, the organisation, the correction, or the support ticket.

`public.legal_holds` is new:

- `subject_type` in (`profile`, `dependent`, `booking`, `organization`, `payment_correction`, `support_ticket`)
- `subject_id uuid`
- `opened_at`, `closed_at`
- `reason_code` in (`litigation`, `regulatory`, `police`, `complaint`, `other`)
- Partial unique index on (`subject_type`, `subject_id`) where `closed_at` is null

No free-text notes column, so the hold table is not a second copy of the file. Staff open and close holds with the service role. This job only reads them.

The kill switch is section 3.2. A dry-run is the default. The first scheduled runs report counts and change nothing.

## 6. Migration number

Checked `origin/main` at `f6559b5` on 2 October 2026. Numbered files run through `00141_account_erasure_gaps.sql`. There is no `00140` and no `00142` on main.

Open pull requests:

- Draft PR #112 adds `supabase/migrations/00140_pin_search_path_and_compliance_notifications.sql`. That is the reservation.
- No open pull request adds `00142`.
- Stale open pull requests still mention `00114` (#60) and `00116` (#64). `00116` is already on main. Neither is `00142`.

Proposed file: `supabase/migrations/00142_retention_purge.sql`.

It may `CREATE OR REPLACE` `public.erase_account(uuid)` and the three audit deny functions. It must not edit `00135` or `00141`. If another branch takes `00142` before approval, renumber. Do not reuse `00140`.

## 7. Test plan

### 7.1 SQL fixture

`supabase/tests/retention_purge_checks.sql`, same shape as `supabase/tests/account_erasure_checks.sql`.

```text
BEGIN;
\i supabase/migrations/00142_retention_purge.sql
\i supabase/tests/retention_purge_checks.sql
ROLLBACK;
```

The script inserts fixture auth users and always raises at the end, so a success cannot be committed. A pass ends with `retention purge dry run PASSED`.

Each case records into a temp results table. Dates are inserted as `timestamptz` and asserted in `Europe/London`.

| Case | Fixture | Expect |
| --- | --- | --- |
| Default is a dry-run | One booking eligible on both clocks. Call `purge_expired_retention()` with no arguments. | Counts show the booking. The row is still there. |
| Apply is refused while the setting is `dry_run` | Same, call with `p_dry_run => false`. | No delete. |
| Apply works only when both gates are open | Set `platform_settings` mode to `apply`, call with false. | One delete. Second call deletes 0. |
| Kill switch `off` | Mode `off`, call with false. | No delete. Log `mode = off`. |
| Adult boundary | Last consultation today minus 8 years. | Not eligible. Minus 8 years and one day: eligible. |
| Child, age 16 | Birth 15 June 2010, consultation 14 June 2027. "Today" inside the fixture is 15 June 2035. | Not eligible (25th birthday is that day). |
| Child, age 16, day after the 25th birthday | Same, today 16 June 2035. | Eligible. The 26th birthday is not required. |
| Child, age 17 | Birth 15 June 2010, consultation 15 June 2027. Today 15 June 2036. | Not eligible on the 26th birthday. Eligible the next day. Not eligible on 16 June 2035. |
| Adult at 18 | Consultation on the 18th birthday. | Eligible at 8 years. The 26th birthday is not used. |
| Missing date of birth | Restricted dependent, `date_of_birth` null, no `retention_subjects` row, consultation 30 years ago. | `held_missing_dob`. Row remains. |
| Date of birth copied before the null | Dependent with a date of birth. Run the copy, then null the live column the way `00141` does. | The clinical clock still uses `retention_subjects`. |
| Tax year, 5 April evening in London | `paid_at` = 5 April 2025 22:30 `Europe/London`. Today 5 April 2031. | Not eligible. |
| Tax year, 5 April 23:30 UTC | `paid_at` = 5 April 2025 23:30+00. That is 6 April 00:30 in London. | Falls in 2025-26. Not eligible on 6 April 2031. Eligible on 6 April 2032. |
| Tax year, 6 April morning | `paid_at` = 6 April 2025 00:30 `Europe/London`. | 2025-26. Eligible 6 April 2032. |
| Refund in a later year | Paid 6 April 2019, `refunded_at` 6 April 2024. Today 6 April 2026. | Not eligible. The refund year has not finished its 6 years. |
| Open correction dispute | `disputed_at` set, `dispute_resolved_at` null, clocks long past. | Booking, prescription, and review text remain. `held_open_dispute`. |
| Open Stripe dispute | `stripe_dispute_status = 'needs_response'`. | Same hold. |
| Stripe dispute with no closed timestamp | Status `won`, `stripe_dispute_closed_at` null. | Held. |
| Dispute closed 12 months ago | `dispute_resolved_at` 12 months and one day ago. Financial clock still running. | Narrative nulled. Amounts and `statement_line` remain. |
| Dispute closed yesterday | — | Narrative remains. |
| Legal hold | Open `legal_holds` row on the booking. Clocks past. | No change. Close the hold and the next apply proceeds. |
| Sole owner, other member `removed` | Owner `restricted_at` set, other status `removed`, name still `Kept Clinic`. | Scrub to empty name, null email and phone, slug `erased-<id>`. |
| Sole owner, other member `left` | Inside the fixture transaction, drop the status check, insert `left`, restore the check after the assertion. | Scrub. This is the predicate bug. |
| Not sole, other member `invited` | — | Name unchanged. |
| Not sole, other member `suspended` and that profile is not restricted | — | Name unchanged. |
| Live sole owner | Owner has no `restricted_at`, only member. | Name unchanged. |
| Already scrubbed | Slug is already `erased-<id>`. | Count 0. Idempotent. |
| Append-only still holds | `DELETE FROM prescription_audit_log` outside the function. | Exception, the row remains. |
| Append-only yields to the purge | Audit row whose prescription clock has ended. Mode `apply`. | The function deletes it. A direct update still fails. |
| `public.audit_log` | Old `audit_log` row. | Not deleted. After the migration, a direct delete fails. |
| Support, open ticket | Message older than 2 years, ticket `open`. | Message remains. |
| Support, closed | Ticket `closed`, `closed_at` and `created_at` older than 2 years. | Message deleted, then the ticket. |
| Batch | Three eligible prescriptions, `p_limit => 1`. | One deletion per call. Three calls clear them. No partial parent. |
| Absent column | Run against a catalog without `profiles.date_of_birth`. | The function returns counts. It does not raise `undefined_column`. |

### 7.2 Unit tests

- `src/lib/account/erase-account.test.ts`: `releaseOrgOwnership` scrubs when the only other statuses are `removed` and `left`, and does not scrub when another status is `invited` or `suspended`.
- A source test, in the style of `src/lib/security`, reads `00142` and asserts the scrub predicate is `status in ('active', 'invited', 'suspended')` and that the file does not contain `is distinct from 'removed'` as the member test.
- `src/app/api/cron/retention-purge/route.test.ts`: missing `CRON_SECRET` returns 401; the route calls the RPC with `p_dry_run: true` unless the settings row says `apply`.

No production data is used. Fixtures are synthetic UUIDs inside the rolled-back transaction.

## 8. Open questions

For John (Legal):

1. Tax year. This plan uses the UK year of assessment, 6 April to 5 April, in `Europe/London`, labelled by the year it starts (2024-25). Six years after the end means eligible on the next 6 April. Confirm this is the year you mean, and not a company accounting reference date. The published privacy page says payments are kept 7 years.
2. Which timestamp places a booking in that year? This plan uses `paid_at`, and also waits for `refunded_at` when the refund falls in a later year. Confirm a refund has its own six years.
3. Is a `refunded` booking that has a `visit_summary`, `doctor_notes`, or a prescription still a consultation? The status column no longer says `completed`.
4. Is completed age 18 the adult cutoff, with 17 reserved for the 26th-birthday case?
5. Consult messages are one thread per doctor and patient. This plan keeps the thread until the latest clinical end of the patient and of any dependent who consulted that doctor. Confirm.
6. Reviews were not in your list. This plan deletes the review row when the booking goes, and leaves the star rating in place until then. Erasure already clears the text unless a dispute is open.
7. Dispute narrative inside `payment_correction_events.payload` cannot be edited, because that table is append-only. It would be deleted with the financial row, which can be longer than 12 months. Confirm the 12-month rule applies to the correction's dispute columns, and the event ledger follows the financial clock.
8. `public.audit_log` has no period in your note. The privacy page says 2 years. This job will make it append-only and will not delete it until you name the period.
9. DBS and the Medical Performers List fields sit on the same doctor row as CQC and indemnity. This plan scrubs them on the same "leaves" clock. Say if they stay longer.
10. Loyalty points and `contact_inquiries` are not in your list. Points follow the wallet clock in this draft. Contact-form messages are not purged.
11. A wallet with a non-zero `balance_cents` at the financial end. This plan will not discard the balance without an instruction.

For the CTO:

1. `left` is not a legal `organization_members.status`. The check constraint allows `invited`, `active`, `suspended`, and `removed`. The live bug is a predicate mismatch: the scrub treats every status other than `removed` as still present, so a stored `left` would skip the scrub after erasure had been allowed. The fix unifies both sites on `active`, `invited`, and `suspended`, and sweeps organisations whose restricted owner was left with only non-present colleagues. Confirm we do not add `left` as a new status.
2. "Leaves" for a doctor is a new `doctors.left_at`, set when the account is restricted, backfilled from `profiles.restricted_at`. `is_active = false` alone does not start the six years. Confirm.
3. Organisation address, website, logo, description, and `stripe_customer_id` are not in the `00141` scrub. The sweep does not add them. Say if the sole-member scrub should.
4. `profiles.date_of_birth` is not in the migrations and may be absent on prod. Erasure nulls `dependents.date_of_birth` today. Already-restricted dependents have no date of birth left to recover. This plan holds their clinical rows (`held_missing_dob`) and copies any date of birth that is still present. Confirm the hold, and whether a backup restore of those dates is in scope.
5. No `pg_cron` on this project (`00127`). The scheduler is a Vercel cron at 04:30 UTC, defaulting to a dry-run. Confirm.
6. Auth users of fully cleared restricted accounts are counted and not deleted in this version. Confirm that stays a follow-up.
7. `00142` is free on main and in open pull requests. `00140` is PR #112. Confirm the number before implementation.
