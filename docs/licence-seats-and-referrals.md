# Licence seats vs referrals

**Updated:** 2026-07-24

## Two ways to invite someone

| | **Seat invite** (team) | **Referral** (growth) |
|--|------------------------|------------------------|
| Who | Professional / Clinic owner or admin | Any doctor (any plan) |
| Result | Joins **your organization** under **your** licence | Creates their **own** account + org |
| Seats | Doctor role uses a doctor seat | **Zero** seat impact on you |
| Path | Members / clinic invite → `/invite/[token]` | Referrals + `?ref=` code |
| Reward | None (they’re on your bill) | Referral reward when they subscribe |

Never mix the copy: referrals are not “add to my plan.”

## Doctor seats by package

| Package | Capacity | Billing |
|---------|----------|---------|
| Free / Starter | 1 | Single doctor |
| **Professional** | **1–4** | £299 **per user** (Stripe quantity) |
| **Clinic** | **5 included, max 15** | Flat pack + £299 extra seats |
| Enterprise | Custom | Custom |

- **Counted:** active members with role `doctor` or `owner`.
- **Not counted:** `admin`, `staff`.
- **Pending doctor invites** soft-reserve capacity (`used + pending ≤ max`) but do not charge until the seat is accepted / capacity purchased.

## Add / remove / reassign

1. **Add** — invite doctor if capacity; else add seat (Pro: increase quantity ≤4; Clinic: extra seat ≤15) then invite.
2. **Remove** — deactivate membership; recompute `used_seats`; capacity kept for rehire (no mid-period refund).
3. **Reassign** — remove or revoke invite, then invite a new email into free capacity.

Invitees complete **their own** profile and verification; bookings still need verified + Connect.

## Solo doctor in a practice

They can stay Free/Starter/Pro alone and **refer** peers. When the practice buys Clinic, the owner invites them; if they have a personal paid sub they confirm **transfer** (cancel personal sub → join Clinic).

## Implementation pointers

- Capacity helpers: `src/lib/license/seats.ts`
- Effective licence: `pickEffectiveLicense`
- Clinic invites: `src/actions/clinic-invitations.ts`
- Org members: `src/actions/organization.ts`
- Referrals: `src/actions/referral.ts` (must never touch `used_seats`)
