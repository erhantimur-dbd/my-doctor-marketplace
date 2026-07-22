# Patient Find → Search → Book UI/UX Research
**Product:** MyDoctors360
**Scope:** Research only — enhancements listed, no implementation
**Date:** 2026-07-22

---

## 1. Executive summary

MyDoctors360 already has a **rich discovery stack** (home NL/AI search, multi-filter listing, map, compare, profile calendars, AI chat with slot pills, booking wizard + booking-aware auth). The main patient friction is not "missing search UI" but **conversion and continuity**: mandatory account before checkout, production coming-soon gate, English-heavy book wizard, mobile listing without map/search, thin empty states, and less "reason for visit / insurance / next-available-first" framing than market leaders.

Competitors win on: **trust & taxonomy (Doctify)**, **next-available slots + insurance (Zocdoc)**, **reason-for-visit + calendar depth (Doctolib)**, **specialist SEO + peer endorsement (Doctify / TopDoctors)**.

---

## 2. MyDoctors360 — current patient journey (as-is)

### Journey paths

| Path | Steps |
|------|--------|
| **A. Classic** | Home search → `/doctors` filters/cards/map → profile calendar → `/book` → **login/signup** → wizard (type → schedule → review → Stripe) → confirmation |
| **B. Chat** | Floating assistant → specialty/search tools → doctor cards + slot pills → authed book href or login with **BookingAuthSummary** → wizard |
| **C. Specialty** | Specialty pages / marquee → listing |

### Strengths already built

| Area | Capability | Evidence |
|------|------------|----------|
| **Find** | Home search: specialties, symptoms, tests, doctor names, popular chips, recent searches, voice (mobile), consultation type (all/in-person/video), Places + geolocation | `src/components/search/home-search-bar.tsx` |
| **Find** | AI natural-language parse → structured listing params | same + `parseNaturalLanguageSearch` |
| **Find** | AI chat with doctor cards, shortlist, compare, GDPR gate | `src/components/chat/*` |
| **Search** | Filters: available today, wheelchair, language, price range, sort (incl. nearest), skill, payment methods | `desktop-filter-bar.tsx`, `more-filters-dialog.tsx` |
| **Search** | Multi-day availability on cards, live "available now", distance badges, match scores | `doctor-card.tsx` |
| **Search** | Desktop list + sticky map, hover sync, expand map | `doctor-results-with-map.tsx` |
| **Search** | Compare tray (≤3), favorites, recently viewed | `compare-*`, `favorite-button`, `recently-viewed-carousel` |
| **Book** | Profile sticky calendar (in-person/video), slot → prefilled book URL | `availability-calendar.tsx`, `doctors/[slug]/page.tsx` |
| **Book** | Wizard: dependents, services/first visit, deposits, notes, Stripe Connect | `booking-wizard.tsx` |
| **Book** | Auth handoff keeps doctor/slot context on login/signup | `booking-auth-summary.tsx`, `lib/auth/booking-context.ts` |

### Gaps / friction (code-backed)

| # | Gap | Why it hurts booking | Evidence |
|---|-----|----------------------|----------|
| 1 | **No guest checkout** | Hard stop after slot intent | `book/page.tsx` redirects unauthenticated users to login |
| 2 | **Coming-soon on prod hosts** | Patients cannot open home/search/book on live domains | `middleware.ts` `COMING_SOON_*` |
| 3 | **Wizard largely English** | Non-EN locales lose trust at payment | `booking-wizard.tsx` (no `useTranslations` for steps) |
| 4 | **Double slot selection** | Pick on profile, then schedule step again | profile calendar → wizard schedule |
| 5 | **Mobile listing weaker** | No map; compact search bar desktop-only | `doctors/page.tsx` `hidden lg:block` |
| 6 | **Thin empty state** | Little recovery (clear filters / expand radius / popular) | hardcoded "No doctors found" |
| 7 | **Reason-for-visit / insurance absent** | Competitors use these as primary filters & booking fields | not in patient filter model |
| 8 | **Recurring UI orphaned** | Feature exists as component, not in funnel | `recurring-option.tsx` unmounted |
| 9 | **Dead-end unavailable doctors** | English-only "Booking Unavailable / Payment Setup Pending" | book page states |
| 10 | **Chat > listing for auth continuity** | Profile book URLs hit server redirect; chat uses `getAuthedHref` | `chat-doctor-card.tsx` vs `availability-calendar.tsx` |

---

## 3. Competitor analysis

Sources: public product sites / help docs / industry write-ups (Doctify UK, Zocdoc, Doctolib patient help, TopDoctors-class specialist directories). Patterns below are **UX patterns observed or documented**, not private roadmap claims.

### 3.1 Comparison matrix

| UX pattern | Doctify (UK/EU) | Zocdoc (US) | Doctolib (FR/DE/IT etc.) | TopDoctors-class | MyDoctors360 (today) |
|-----------|-----------------|-------------|---------------------------|-----------------|----------------------|
| **Entity search taxonomy** | Doctor / Dentist / Practice / Hospital / Care home / Pharmacy | Doctors + specialties | Professionals + multi-specialty | Specialists + clinics | Doctors + specialties (+ pharmacy separate) |
| **What / where hero** | Explicit dual fields + city chips + popular specialties **and conditions** | Specialty + location + insurance often first-class | Specialty + place + insurance type | Specialty/city SEO hubs | Query + location + consultation type; symptoms/tests via autocomplete |
| **Condition / procedure discovery** | Strong (popular conditions, "seen for" on reviews) | Symptom/specialty oriented | Reason for visit at book time | Procedure-oriented SEO | Symptoms/tests in search matcher; weaker condition landing SEO |
| **Trust signals** | Verified reviews, peer skill endorsements, "created by doctors" | Ratings, patient reviews, insurance accepted | Ratings + network scale | Specialist prestige, peer recognition | Verified badge, ratings, skills chips, review summary |
| **Next available / same-day** | Availability varies by provider integration | **Core**: next available times on cards | Strong calendar + same-day/video speed | Often request-based or call | **Available today** chip + multi-day slots on cards + live badge |
| **Insurance / payer** | Less central (private self-pay culture varies) | **Primary filter** | Insurance type filter (e.g. DE) | Often private | Payment-method filter; no insurer network UX |
| **In-person vs video** | Present for many GPs/specialists | In-person dominant historically | Explicit video vs office at book | Mixed | First-class consultation type filter + book type step |
| **Map results** | Location-led browse | Map/list common | Location-led | City pages | Desktop map+list; **mobile no map** |
| **Book without deep profile** | Often request/book depending on market | Book from results with times | Book after reason + slot | Frequently enquiry form | Book from card/slots/chat; still multi-step wizard |
| **Reason for visit** | Via reviews "seen for"; not always booking field | Visit reason / type | **Required**: practitioner-defined reasons | Enquiry topic | First-visit / service branching only if doctor configured services |
| **Guest vs account** | Account often required for book | Account typical for manage bookings | Account for manage; book flows push login | Enquiry may be form-first | **Always login/register** before wizard |
| **AI / guided search** | Content/health hub + search | Classic search | Expanding AI assistants (calls, notes) | Content | **Differentiator**: NL home parse + symptom AI + chat tools |
| **Compare doctors** | Implicit via open tabs | Limited | Limited | Limited | **Built-in compare tray (1–3)** |
| **Family / dependents** | App relatives features (Doctolib) | Dependent booking varies | Relatives management | Rare | Dependents step in wizard when configured |

### 3.2 Competitor deep notes

#### Doctify (UK — closest market peer)
- **Find:** Multi-entity switcher (Doctor, Dentist, Practice, Hospital…). Dual "what / where" with popular specialties **and** conditions/procedures, specialist name typeahead, city shortcuts.
- **Trust:** Volume of verified reviews; peer **skill endorsements** ("recommended by [peer] for X"); clinician video intros.
- **Search SEO:** Massive location × specialty landing grid (London Dentistry, etc.) — discovery without app search.
- **Book:** Mix of online book vs contact; less "marketplace payment" framing than MyDoctors360.
- **Lesson for MD360:** Condition/procedure-led find, peer endorsement surface, multi-entity/hospital browse, SEO city×specialty hubs.

#### Zocdoc (US)
- **Find/search:** Insurance-first mental model + specialty + location.
- **Book:** **Next available appointment** as the hero of result cards; reduce profile deep-dives when a time is good enough.
- **Lesson:** Promote earliest bookable slot + "book this time" from results; insurance/self-pay clarity for EU markets (self-pay badge, invoice estimates).

#### Doctolib (EU leader)
- **Book flow:** Choose video vs in-office → **select reason for visit** from practitioner list → pick day/time.
- **Speed narrative:** High share of video consults within 24h — UX prioritises **soonest care**.
- **Post-book product:** Relatives, messaging, vault — increases return use.
- **Lesson:** Reason-for-visit as a first-class booking step; default sort "soonest"; family continuity.

#### TopDoctors / private specialist directories
- **Find:** Prestige specialist profiles, procedure pages, city hubs.
- **Book:** Often **request appointment / call me** rather than instant Stripe checkout.
- **Lesson:** For complex specialties, offer **request callback / enquiry** path when slots are empty or doctor not Stripe-ready (better than dead-end "Payment Setup Pending").

---

## 4. Enhancement list (research recommendations only)

Ranked by **patient impact** on find → search → book. Implementation is **out of scope** for this document.

### HIGH impact

| ID | Stage | Enhancement | Rationale vs competitors / MD360 gaps |
|----|-------|-------------|----------------------------------------|
| H1 | Book | **Guest / progressive checkout** — collect essentials + pay, account optional post-payment | Biggest funnel drop; market leaders optimise time-to-book; MD360 always auth-gates |
| H2 | Book | **One-tap book from next available** on cards/chat (skip re-picking schedule when slot preselected) | Zocdoc "next available"; MD360 still multi-step wizard after profile/chat slot |
| H3 | Find | **Condition / procedure browse hubs** (knee pain → ortho/physio; menopause → gynae) with SEO landings | Doctify popular conditions; MD360 has symptom match but weak destination pages |
| H4 | Search | **"Soonest available" default sort** + earliest slot chip always visible | Doctolib/Zocdoc availability-first; MD360 has data but not always the primary lens |
| H5 | Book | **Reason-for-visit / service as first booking question** (doctor-defined list) | Doctolib core pattern; MD360 service step only when configured |
| H6 | Find/Search | **Mobile parity: map + full search on listing** | Competitors map on phone; MD360 hides map/search below `lg` |
| H7 | Book | **Localise booking wizard + profile CTAs** fully | Trust break for DE/TR/FR users at payment |
| H8 | Book | **Replace dead-ends** (no Stripe / unverified) with Notify Me + enquiry/callback CTA | TopDoctors enquiry path; MD360 English dead-end cards |

### MEDIUM impact

| ID | Stage | Enhancement | Rationale |
|----|-------|-------------|-----------|
| M1 | Search | **Smarter empty states** — one-click clear filters, expand radius, "doctors with video only", popular specialties | Competitors rarely leave users on blank results |
| M2 | Find | **Insurance / self-pay clarity** — badge "self-pay private", optional insurer field later | Zocdoc/Doctolib insurance mental model; EU private = transparent fee |
| M3 | Search | **Gender, language (always visible), hospital/clinic filter** | Common private-care filters; language exists in "more" only |
| M4 | Find | **Peer endorsements / "recommended for skill X"** on cards | Doctify differentiator; MD360 has skills + admin endorsements — surface publicly |
| M5 | Book | **Auth earlier with context** — use `getAuthedHref` on profile calendar/list CTAs (same as chat) | Reduces surprise redirect; already solved for chat |
| M6 | Search | **Save search / alerts** beyond notify-me per doctor (specialty + city + available this week) | Retention pattern across marketplaces |
| M7 | Find | **Entity tabs** (Specialist / Clinic / Dentist) if supply supports | Doctify multi-entity discoverability |
| M8 | Book | **In-wizard progress persistence** (draft booking resume after auth/email verify) | Complements BookingAuthSummary |
| M9 | Search | **Availability calendar strip on mobile cards** (horizontal next 3 days) | Desktop already multi-day; mobile needs denser slots |
| M10 | Find | **"Available for video now / today" homepage shortcut** | Matches Doctolib speed narrative |

### LOW impact (polish / later)

| ID | Stage | Enhancement | Rationale |
|----|-------|-------------|-----------|
| L1 | Book | Wire or hide **recurring** option cleanly | Avoid orphan UX; Pro plan feature |
| L2 | Search | Skeleton content-shaped loaders on listing (not spinner-only) | Perceived performance |
| L3 | Find | Recent searches + "continue where you left off" homepage module | Recently viewed exists; elevate |
| L4 | Book | Address/clinic map after payment (already privacy-safe) with stronger pre-pay location neighbourhood | Trust without full address |
| L5 | Find | Clinician intro video on profile (Doctify pattern) | Trust for high-fee specialities |
| L6 | Search | Sort labels A11y + filter chip overflow design | Accessibility/polish |
| L7 | Book | Guest phone OTP as lighter auth than full email register | Middle ground if guest checkout delayed |

---

## 5. Gap map: MD360 vs market leaders

```
FIND
  MD360 strong: AI NL, chat, voice, symptoms/tests autocomplete
  Gap vs Doctify: condition hubs, multi-entity, peer endorsements front-and-centre
  Gap vs Zocdoc: insurance/self-pay framing

SEARCH
  MD360 strong: filters, available today, map (desktop), compare, live availability
  Gap: mobile map/search, empty recovery, soonest-default, hospital filter

BOOK
  MD360 strong: wizard depth, deposits, chat→auth summary, Stripe Connect
  Gap: guest checkout, reason-for-visit, one-tap from slot, i18n wizard, enquiry fallback
```

**Strategic note:** AI chat + compare + transparent fees are **differentiators** if the product is open to patients. Until coming-soon lifts and checkout friction drops, competitor SEO/trust surfaces matter more for acquisition.

---

## 6. Suggested sequencing (research guidance only)

1. **Unblock demand:** guest/progressive checkout + wizard i18n + non-dead-end unavailable states.
2. **Win mobile search:** map + search bar + denser slot chips.
3. **Win "I need care soon":** soonest sort default + always-on next slot on cards.
4. **Win discovery SEO/content:** condition/procedure hubs + peer endorsement display.
5. **Win book quality:** reason-for-visit + one-tap prefilled slot path.

---

## 7. Sources

### Internal (codebase)
- `src/components/search/home-search-bar.tsx`
- `src/components/doctors/*` (filters, cards, map, compare)
- `src/components/booking/booking-wizard.tsx`, `availability-calendar.tsx`
- `src/components/chat/*`, `src/lib/chat/booking-href.ts`
- `src/components/auth/booking-auth-summary.tsx`
- `src/app/[locale]/(public)/doctors/**`
- `middleware.ts` (coming-soon)

### External
- Doctify public UK homepage & find taxonomy (doctify.com) — multi-entity search, conditions, peer endorsements, reviews
- Zocdoc product positioning — next available appointments, insurance-centric search (industry coverage / product docs)
- Doctolib patient help — video vs office, reason for visit, slot selection; public metrics on video speed
- TopDoctors-class specialist directories — enquiry / prestige profile patterns
- Industry notes on marketplace appointment UX (filters, telehealth, care journey)

---

## 8. Non-goals (this research)

- No code, design mockups, or deploys
- No security/SEO/GTM full audits
- No commitment to ship any enhancement

---

*End of research deliverable.*
