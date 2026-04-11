import { describe, it, expect } from "vitest";
import { detectEmergency } from "../emergency-classifier";

describe("detectEmergency — plan-required fixtures", () => {
  // These five fixtures are explicitly called out in the UK CQC
  // compliance plan (workstream 3.4). They are the minimum bar — all of
  // them MUST route to `isEmergency: true` with no LLM call. If any of
  // these start failing, ship nothing until it is fixed.
  const planFixtures = [
    "I have chest pain",
    "I'm bleeding a lot",
    "I want to kill myself",
    "my face is drooping",
    "I can't breathe",
  ];

  for (const fixture of planFixtures) {
    it(`flags "${fixture}" as an emergency`, () => {
      const result = detectEmergency(fixture);
      expect(result.isEmergency).toBe(true);
    });
  }
});

describe("detectEmergency — hazard categories", () => {
  // Chest pain / heart attack
  it.each([
    "I have chest pain",
    "There's a crushing pain in my chest",
    "I think I'm having a heart attack",
    "My chest feels tight and I feel clammy",
    "I feel pressure in my chest",
  ])("flags chest-pain phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Uncontrolled bleeding
  it.each([
    "I'm bleeding a lot",
    "The wound won't stop bleeding",
    "I can't stop the bleeding",
    "I keep coughing up blood",
    "I vomited blood this morning",
  ])("flags bleeding phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Stroke FAST signs
  it.each([
    "My face is drooping on one side",
    "I have sudden weakness on my left side",
    "My speech is slurred and I can't find words",
    "I think I'm having a stroke",
    "One side of my face has gone numb",
  ])("flags stroke phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Suicidal ideation
  it.each([
    "I want to kill myself",
    "I'm thinking about ending my life",
    "I don't want to be alive anymore",
    "I'm having suicidal thoughts",
    "I've been self-harming",
  ])("flags suicidal ideation phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Anaphylaxis
  it.each([
    "I think I'm having an anaphylactic reaction",
    "My throat is closing after a bee sting",
    "My tongue is swelling up",
    "I'm having a severe allergic reaction to peanuts",
  ])("flags anaphylaxis phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Seizure
  it.each([
    "My child is having a seizure",
    "I just had a seizure",
    "He's convulsing",
    "I had an epileptic fit",
  ])("flags seizure phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Collapse / loss of consciousness
  it.each([
    "She passed out and won't wake up",
    "He collapsed suddenly",
    "I lost consciousness",
    "My dad is unconscious",
    "He's not responding",
  ])("flags collapse phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Breathing difficulty
  it.each([
    "I can't breathe",
    "I'm struggling to breathe",
    "She's gasping for air",
    "He's choking",
    "The baby is turning blue",
    "He stopped breathing",
  ])("flags breathing phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Severe burns
  it.each([
    "I have severe burns on my arm",
    "He's badly burned",
    "It's a third-degree burn",
    "I burnt my face with hot oil",
  ])("flags severe burns phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });

  // Head injury
  it.each([
    "I hit my head hard and I'm confused",
    "He has a head injury",
    "I banged my head and feel drowsy",
    "I think I cracked my skull",
  ])("flags head injury phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(true);
  });
});

describe("detectEmergency — non-emergencies pass through", () => {
  // These must NOT trip the classifier. False positives push real users
  // away from the specialty finder unnecessarily, but false negatives are
  // far worse — we err on the side of flagging. These fixtures are chosen
  // to be deliberately benign so that drift can be caught.
  it.each([
    "I have a runny nose and a cough",
    "My back hurts a bit after gardening",
    "I need a skin check for a mole",
    "I'd like a dermatology appointment",
    "I have mild acne",
    "I need a general checkup",
    "Looking for a dentist for a filling",
    "My knee hurts when I run",
    "I need my blood pressure checked",
  ])("does not flag benign phrasing: %s", (input) => {
    expect(detectEmergency(input).isEmergency).toBe(false);
  });

  it("returns isEmergency: false for empty input", () => {
    expect(detectEmergency("").isEmergency).toBe(false);
    expect(detectEmergency("   ").isEmergency).toBe(false);
  });
});

describe("detectEmergency — reason text", () => {
  it("returns a 999-directive reason when flagged", () => {
    const result = detectEmergency("I have chest pain");
    if (!result.isEmergency) throw new Error("expected emergency");
    expect(result.reason).toMatch(/999|A&E/);
  });

  it("uses Samaritans number for suicidal-ideation reason", () => {
    const result = detectEmergency("I want to kill myself");
    if (!result.isEmergency) throw new Error("expected emergency");
    expect(result.reason).toMatch(/Samaritans|116 123/);
  });
});
