/**
 * Deterministic emergency classifier for the specialty-finder tool.
 *
 * This module exists because we must NEVER let an LLM decide whether a
 * patient's symptoms are a medical emergency. LLMs are non-deterministic
 * and can miss or misclassify life-threatening cases. Instead, we run a
 * deterministic keyword/regex layer at the top of the pipeline. If the
 * input matches any hazard pattern, the tool short-circuits to a
 * "Call 999 now" response — no LLM call, no specialty suggestion,
 * no cache write.
 *
 * Hazard categories reflect the plan's red-flag list (UK CQC compliance
 * workstream 3.4):
 *   - Chest pain / heart attack signs
 *   - Uncontrolled bleeding
 *   - Stroke FAST signs (face drooping, arm weakness, speech difficulty)
 *   - Suicidal ideation / self-harm
 *   - Anaphylaxis / severe allergic reaction
 *   - Seizure
 *   - Loss of consciousness / collapse
 *   - Breathing difficulty
 *   - Severe burns
 *   - Head injury with confusion
 *
 * If you edit this file, update the test fixture at
 * `./emergency-classifier.test.ts` and make sure every hazard still
 * matches. False negatives here are the single most dangerous failure
 * mode of the whole feature.
 */

export type EmergencyResult =
  | { isEmergency: true; reason: string }
  | { isEmergency: false };

interface HazardPattern {
  /** Short reason surfaced to the patient so they know why we routed them to 999. */
  reason: string;
  /**
   * Regex patterns that must match the normalised input for this hazard
   * to fire. Patterns should be simple, bounded, and tolerant of common
   * phrasings. They run over a lower-cased, whitespace-collapsed copy of
   * the user's input.
   */
  patterns: RegExp[];
}

const HAZARDS: HazardPattern[] = [
  {
    reason:
      "Chest pain can be a sign of a heart attack. Call 999 or go to A&E immediately.",
    patterns: [
      /\bchest pain\b/,
      /\bpain in (?:my |the )?chest\b/,
      /\bcrushing chest\b/,
      /\btight(?:ness)? in (?:my |the )?chest\b/,
      /\bchest (?:feels |is )?tight(?:ness|ening)?\b/,
      /\bheart attack\b/,
      /\bpressure in (?:my |the )?chest\b/,
    ],
  },
  {
    reason:
      "Heavy or uncontrolled bleeding needs emergency care. Call 999 or go to A&E immediately.",
    patterns: [
      /\bbleeding (?:a lot|heavily|badly|uncontrollably|won'?t stop)\b/,
      /\bheavy bleeding\b/,
      /\bcan'?t stop (?:the )?bleed(?:ing)?\b/,
      /\bwon'?t stop bleed(?:ing)?\b/,
      /\bhemorrhag(?:e|ing)\b/,
      /\bhaemorrhag(?:e|ing)\b/,
      /\bcough(?:ing|ed) up blood\b/,
      /\bvomit(?:ing|ed) blood\b/,
      /\bthrowing up blood\b/,
    ],
  },
  {
    reason:
      "These may be signs of a stroke (FAST test). Every minute counts — call 999 immediately.",
    patterns: [
      /\bstroke\b/,
      /\bface (?:is )?drooping\b/,
      /\bdroop(?:ing|y) (?:on (?:one|1) side|face)\b/,
      /\bone side of (?:my |the )?face\b/,
      /\bslurr(?:ed|ing) speech\b/,
      /\bspeech (?:is |has gone )?slurr(?:ed|ing)\b/,
      /\bcan'?t speak\b/,
      /\bsudden(?:ly)? (?:weak|numb)/,
      /\barm (?:is )?weak\b/,
      /\bnumb on one side\b/,
      /\bweak on one side\b/,
    ],
  },
  {
    reason:
      "If you are thinking about ending your life, please call 999 or Samaritans on 116 123 right now. You are not alone.",
    patterns: [
      /\bkill(?:ing)? my ?self\b/,
      /\bend(?:ing)? my (?:own )?life\b/,
      /\btake my own life\b/,
      /\bsuicid(?:e|al)\b/,
      /\bwant to die\b/,
      /\bdon'?t want to (?:be alive|live)\b/,
      /\bhurt(?:ing)? my ?self\b/,
      /\bself[- ]harm(?:ing)?\b/,
    ],
  },
  {
    reason:
      "These may be signs of a severe allergic reaction (anaphylaxis). Call 999 and use an adrenaline auto-injector if you have one.",
    patterns: [
      /\banaphylaxis\b/,
      /\banaphylactic\b/,
      /\bsevere allergic reaction\b/,
      /\bthroat (?:is )?closing\b/,
      /\btongue (?:is )?swelling\b/,
      /\blips (?:are )?swelling\b/,
      /\bface (?:is )?swelling (?:up)?\b/,
      /\bcan'?t breathe (?:after|because of) (?:a )?(?:bee sting|sting|nut|peanut|food)\b/,
    ],
  },
  {
    reason:
      "Seizures need emergency help, especially if this is the first one or lasts more than 5 minutes. Call 999.",
    patterns: [
      /\b(?:having|had) a seizure\b/,
      /\bseizure\b/,
      /\bconvuls(?:ing|ion|ions)\b/,
      /\bfit(?:ting)? (?:uncontrollably)?\b/,
      /\bepileptic (?:fit|attack)\b/,
    ],
  },
  {
    reason:
      "Loss of consciousness or sudden collapse is a medical emergency. Call 999.",
    patterns: [
      /\bpassed out\b/,
      /\bloss of consciousness\b/,
      /\blost consciousness\b/,
      /\bunconscious\b/,
      /\bcollaps(?:ed|ing)\b/,
      /\bfain(?:ted|ting) and (?:won'?t|can'?t) wake up\b/,
      /\bnot responding\b/,
      /\bnot waking up\b/,
    ],
  },
  {
    reason:
      "Breathing difficulty can be life-threatening. Call 999 immediately.",
    patterns: [
      /\bcan'?t breathe\b/,
      /\bcannot breathe\b/,
      /\bstruggling to breathe\b/,
      /\bgasping (?:for (?:air|breath))?\b/,
      /\bchoking\b/,
      /\bturning blue\b/,
      /\bstopped breathing\b/,
      /\bnot breathing\b/,
    ],
  },
  {
    reason:
      "Severe or extensive burns need emergency care. Call 999 or go to A&E immediately.",
    patterns: [
      /\bsevere burns?\b/,
      /\bbad burn(?:s)?\b/,
      /\blarge burn(?:s)?\b/,
      /\bbadly burned\b/,
      /\bburn(?:ed|t)? (?:all over|my face|a lot of)\b/,
      /\b(?:third|3rd)[- ]degree burn\b/,
    ],
  },
  {
    reason:
      "A head injury with confusion, vomiting, or drowsiness needs emergency assessment. Call 999 or go to A&E.",
    patterns: [
      /\bhead injur(?:y|ies)\b/,
      /\bhit my head\b/,
      /\bbanged my head\b/,
      /\bhead trauma\b/,
      /\bskull fracture\b/,
      /\bcracked (?:my )?skull\b/,
    ],
  },
];

/**
 * Normalise the input for pattern matching:
 *   - lower-case
 *   - collapse whitespace
 *   - strip leading/trailing punctuation that breaks word boundaries
 */
function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'") // smart quotes → straight quotes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic check: does the input describe a medical emergency?
 *
 * This function must never throw, must never do I/O, and must never call
 * an LLM. It is called synchronously at the top of every symptom-finder
 * request. Adding a hazard here is safer than adding it to an LLM prompt.
 */
export function detectEmergency(input: string): EmergencyResult {
  const normalised = normalise(input);
  if (normalised.length === 0) return { isEmergency: false };

  for (const hazard of HAZARDS) {
    for (const pattern of hazard.patterns) {
      if (pattern.test(normalised)) {
        return { isEmergency: true, reason: hazard.reason };
      }
    }
  }
  return { isEmergency: false };
}
