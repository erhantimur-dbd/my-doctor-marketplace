# Licence seats vs referrals

**Updated:** 2026-07-24

## Packaging model (D-simple)

| Package | Seats | Price model | Job |
|---------|-------|-------------|-----|
| Free | 1 | £0 | List & prepare |
| Starter | 1 | Flat £199 | Solo paid marketplace |
| **Professional** | **1** | Flat £299 | Solo growth tools (not multi-user) |
| **Clinic** | **3 included → 15** | Flat £1,495 + £299 extra seats | Practice / multi-doctor |
| Enterprise | Custom | Custom | Large orgs |

**Rule:** Multi-doctor seats exist only on **Clinic** (and Enterprise). Professional is a **solo** feature tier.

## Two ways to invite someone

| | **Seat invite** (team) | **Referral** (growth) |
|--|------------------------|------------------------|
| Who | **Clinic** (or Enterprise) owner/admin | Any doctor (any plan) |
| Result | Joins **your organization** under **your** licence | Creates their **own** account + org |
| Seats | Doctor role uses a doctor seat | **Zero** seat impact on you |
| Path | Members / clinic invite → `/invite/[token]` | Referrals + `?ref=` code |
| Reward | None (they’re on your bill) | Referral reward when they subscribe |

Never mix the copy: referrals are not “add to my plan.”

## Add / remove / reassign (Clinic)

1. **Add** — invite doctor if capacity; else buy extra seats (≤15) then invite.
2. **Remove** — deactivate membership; recompute `used_seats`; capacity kept (no mid-period refund).
3. **Reassign** — remove or revoke invite, then invite a new email.

Invitees complete **their own** profile and verification.

## Solo doctor in a practice

Stay Free/Starter/Pro alone; **refer** peers. When the practice buys Clinic, the owner invites them (transfer path if they have a personal paid sub).

## Implementation

- Capacity: `src/lib/license/seats.ts` (`multiDoctor` only when maxSeats > 1)
- Recompute: `src/lib/license/recompute-seats.ts`
- Clinic invites: `src/actions/clinic-invitations.ts`
- Referrals: `src/actions/referral.ts` (never touches `used_seats`)
