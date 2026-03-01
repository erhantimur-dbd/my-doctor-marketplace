export interface SymptomEntry {
  /** Unique identifier */
  id: string;
  /** i18n key for display label (e.g. "symptom.chest_pain") */
  labelKey: string;
  /** Multiple phrasings patients might type */
  keywords: string[];
  /** Primary specialty slug to navigate to */
  primarySpecialty: string;
  /** Additional specialty slugs */
  relatedSpecialties: string[];
}

export const SYMPTOMS: readonly SymptomEntry[] = [
  // ── General Practice ───────────────────────────────────────────
  {
    id: "fever",
    labelKey: "symptom.fever",
    keywords: ["fever", "high temperature", "temperature", "feeling hot", "chills and fever"],
    primarySpecialty: "general-practice",
    relatedSpecialties: ["pediatrics"],
  },
  {
    id: "fatigue",
    labelKey: "symptom.fatigue",
    keywords: ["fatigue", "tired", "exhaustion", "always tired", "low energy", "lethargy"],
    primarySpecialty: "general-practice",
    relatedSpecialties: ["endocrinology"],
  },
  {
    id: "unexplained_weight_loss",
    labelKey: "symptom.unexplained_weight_loss",
    keywords: ["unexplained weight loss", "losing weight", "weight loss without trying", "unintentional weight loss"],
    primarySpecialty: "general-practice",
    relatedSpecialties: ["endocrinology", "oncology"],
  },
  {
    id: "unexplained_weight_gain",
    labelKey: "symptom.unexplained_weight_gain",
    keywords: ["weight gain", "gaining weight", "unexplained weight gain", "sudden weight gain"],
    primarySpecialty: "endocrinology",
    relatedSpecialties: ["general-practice", "nutrition"],
  },
  {
    id: "dizziness",
    labelKey: "symptom.dizziness",
    keywords: ["dizziness", "dizzy", "lightheaded", "light headed", "vertigo", "feeling faint", "room spinning"],
    primarySpecialty: "general-practice",
    relatedSpecialties: ["neurology", "ent"],
  },
  {
    id: "general_malaise",
    labelKey: "symptom.general_malaise",
    keywords: ["feeling unwell", "malaise", "not feeling well", "generally unwell", "sick feeling"],
    primarySpecialty: "general-practice",
    relatedSpecialties: [],
  },
  {
    id: "swollen_lymph_nodes",
    labelKey: "symptom.swollen_lymph_nodes",
    keywords: ["swollen lymph nodes", "swollen glands", "lump in neck", "lump in armpit", "swollen nodes"],
    primarySpecialty: "general-practice",
    relatedSpecialties: ["oncology", "ent"],
  },
  {
    id: "night_sweats",
    labelKey: "symptom.night_sweats",
    keywords: ["night sweats", "sweating at night", "waking up sweating", "excessive night sweating"],
    primarySpecialty: "general-practice",
    relatedSpecialties: ["endocrinology", "oncology"],
  },

  // ── Cardiology ─────────────────────────────────────────────────
  {
    id: "chest_pain",
    labelKey: "symptom.chest_pain",
    keywords: ["chest pain", "chest tightness", "heart pain", "pressure in chest", "chest discomfort", "angina"],
    primarySpecialty: "cardiology",
    relatedSpecialties: ["general-practice", "pulmonology"],
  },
  {
    id: "palpitations",
    labelKey: "symptom.palpitations",
    keywords: ["palpitations", "heart palpitations", "heart racing", "heart skipping", "irregular heartbeat", "heart flutter"],
    primarySpecialty: "cardiology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "shortness_of_breath",
    labelKey: "symptom.shortness_of_breath",
    keywords: ["shortness of breath", "breathlessness", "difficulty breathing", "cant breathe", "out of breath", "dyspnea"],
    primarySpecialty: "cardiology",
    relatedSpecialties: ["pulmonology", "general-practice"],
  },
  {
    id: "leg_swelling",
    labelKey: "symptom.leg_swelling",
    keywords: ["leg swelling", "swollen legs", "swollen ankles", "ankle swelling", "edema", "fluid retention"],
    primarySpecialty: "cardiology",
    relatedSpecialties: ["nephrology", "general-practice"],
  },
  {
    id: "rapid_heartbeat",
    labelKey: "symptom.rapid_heartbeat",
    keywords: ["rapid heartbeat", "fast heart rate", "tachycardia", "heart beating fast", "racing pulse"],
    primarySpecialty: "cardiology",
    relatedSpecialties: ["general-practice", "endocrinology"],
  },
  {
    id: "fainting",
    labelKey: "symptom.fainting",
    keywords: ["fainting", "fainted", "passed out", "syncope", "blacking out", "loss of consciousness"],
    primarySpecialty: "cardiology",
    relatedSpecialties: ["neurology", "general-practice"],
  },

  // ── Dermatology ────────────────────────────────────────────────
  {
    id: "skin_rash",
    labelKey: "symptom.skin_rash",
    keywords: ["skin rash", "rash", "red skin", "skin irritation", "rash on body", "redness on skin"],
    primarySpecialty: "dermatology",
    relatedSpecialties: ["allergy", "general-practice"],
  },
  {
    id: "itchy_skin",
    labelKey: "symptom.itchy_skin",
    keywords: ["itchy skin", "itching", "pruritus", "skin itching", "itchiness", "scratching"],
    primarySpecialty: "dermatology",
    relatedSpecialties: ["allergy"],
  },
  {
    id: "acne",
    labelKey: "symptom.acne",
    keywords: ["acne", "pimples", "spots", "breakouts", "zits", "skin breakout"],
    primarySpecialty: "dermatology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "moles_changing",
    labelKey: "symptom.moles_changing",
    keywords: ["mole changing", "changing mole", "new mole", "mole growing", "suspicious mole", "mole check"],
    primarySpecialty: "dermatology",
    relatedSpecialties: ["oncology"],
  },
  {
    id: "hair_loss",
    labelKey: "symptom.hair_loss",
    keywords: ["hair loss", "losing hair", "bald spot", "thinning hair", "alopecia", "hair falling out"],
    primarySpecialty: "dermatology",
    relatedSpecialties: ["endocrinology"],
  },
  {
    id: "eczema",
    labelKey: "symptom.eczema",
    keywords: ["eczema", "dry skin patches", "flaky skin", "dermatitis", "atopic dermatitis"],
    primarySpecialty: "dermatology",
    relatedSpecialties: ["allergy"],
  },
  {
    id: "psoriasis",
    labelKey: "symptom.psoriasis",
    keywords: ["psoriasis", "scaly skin", "skin patches", "plaque psoriasis", "silvery scales"],
    primarySpecialty: "dermatology",
    relatedSpecialties: ["rheumatology"],
  },

  // ── Orthopedics ────────────────────────────────────────────────
  {
    id: "back_pain",
    labelKey: "symptom.back_pain",
    keywords: ["back pain", "lower back pain", "upper back pain", "backache", "spine pain", "lumbar pain"],
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy", "neurology"],
  },
  {
    id: "joint_pain",
    labelKey: "symptom.joint_pain",
    keywords: ["joint pain", "painful joints", "arthritis", "joint ache", "stiff joints", "joint inflammation"],
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["rheumatology", "physiotherapy"],
  },
  {
    id: "knee_pain",
    labelKey: "symptom.knee_pain",
    keywords: ["knee pain", "painful knee", "knee swelling", "knee injury", "knee problem"],
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy"],
  },
  {
    id: "shoulder_pain",
    labelKey: "symptom.shoulder_pain",
    keywords: ["shoulder pain", "painful shoulder", "frozen shoulder", "shoulder stiffness", "rotator cuff"],
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy"],
  },
  {
    id: "hip_pain",
    labelKey: "symptom.hip_pain",
    keywords: ["hip pain", "painful hip", "hip ache", "groin pain", "hip stiffness"],
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy", "rheumatology"],
  },
  {
    id: "sports_injury",
    labelKey: "symptom.sports_injury",
    keywords: ["sports injury", "sprain", "strain", "pulled muscle", "torn ligament", "sports pain"],
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy"],
  },
  {
    id: "neck_pain",
    labelKey: "symptom.neck_pain",
    keywords: ["neck pain", "stiff neck", "neck stiffness", "neck ache", "sore neck", "whiplash"],
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy", "neurology"],
  },

  // ── Neurology ──────────────────────────────────────────────────
  {
    id: "headache",
    labelKey: "symptom.headache",
    keywords: ["headache", "head pain", "head ache", "tension headache", "chronic headache"],
    primarySpecialty: "neurology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "migraine",
    labelKey: "symptom.migraine",
    keywords: ["migraine", "severe headache", "migraine with aura", "throbbing headache", "visual migraine"],
    primarySpecialty: "neurology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "numbness",
    labelKey: "symptom.numbness",
    keywords: ["numbness", "numb hands", "numb feet", "loss of sensation", "pins and needles"],
    primarySpecialty: "neurology",
    relatedSpecialties: ["orthopedics"],
  },
  {
    id: "tingling",
    labelKey: "symptom.tingling",
    keywords: ["tingling", "tingling hands", "tingling feet", "paresthesia", "prickling sensation"],
    primarySpecialty: "neurology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "seizures",
    labelKey: "symptom.seizures",
    keywords: ["seizures", "seizure", "epilepsy", "convulsions", "fits", "epileptic"],
    primarySpecialty: "neurology",
    relatedSpecialties: [],
  },
  {
    id: "tremor",
    labelKey: "symptom.tremor",
    keywords: ["tremor", "shaking", "trembling hands", "involuntary shaking", "hand tremor"],
    primarySpecialty: "neurology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "memory_problems",
    labelKey: "symptom.memory_problems",
    keywords: ["memory problems", "memory loss", "forgetfulness", "confusion", "cognitive decline", "brain fog"],
    primarySpecialty: "neurology",
    relatedSpecialties: ["psychiatry", "general-practice"],
  },

  // ── Psychiatry ─────────────────────────────────────────────────
  {
    id: "anxiety",
    labelKey: "symptom.anxiety",
    keywords: ["anxiety", "anxious", "worry", "nervous", "anxiety disorder", "constant worry"],
    primarySpecialty: "psychiatry",
    relatedSpecialties: ["psychology"],
  },
  {
    id: "depression",
    labelKey: "symptom.depression",
    keywords: ["depression", "depressed", "feeling low", "sadness", "loss of interest", "hopelessness"],
    primarySpecialty: "psychiatry",
    relatedSpecialties: ["psychology"],
  },
  {
    id: "panic_attacks",
    labelKey: "symptom.panic_attacks",
    keywords: ["panic attacks", "panic attack", "panic disorder", "sudden fear", "panic episode"],
    primarySpecialty: "psychiatry",
    relatedSpecialties: ["psychology"],
  },
  {
    id: "insomnia",
    labelKey: "symptom.insomnia",
    keywords: ["insomnia", "cant sleep", "trouble sleeping", "sleeplessness", "sleep problems", "difficulty sleeping"],
    primarySpecialty: "psychiatry",
    relatedSpecialties: ["psychology", "general-practice"],
  },
  {
    id: "mood_swings",
    labelKey: "symptom.mood_swings",
    keywords: ["mood swings", "mood changes", "emotional instability", "bipolar symptoms", "irritability"],
    primarySpecialty: "psychiatry",
    relatedSpecialties: ["psychology"],
  },

  // ── Psychology ─────────────────────────────────────────────────
  {
    id: "stress",
    labelKey: "symptom.stress",
    keywords: ["stress", "stressed", "burnout", "overwhelmed", "work stress", "chronic stress"],
    primarySpecialty: "psychology",
    relatedSpecialties: ["psychiatry"],
  },
  {
    id: "grief",
    labelKey: "symptom.grief",
    keywords: ["grief", "bereavement", "loss of loved one", "mourning", "grieving"],
    primarySpecialty: "psychology",
    relatedSpecialties: ["psychiatry"],
  },
  {
    id: "relationship_issues",
    labelKey: "symptom.relationship_issues",
    keywords: ["relationship issues", "relationship problems", "couple therapy", "marriage problems", "partner conflict"],
    primarySpecialty: "psychology",
    relatedSpecialties: [],
  },
  {
    id: "low_self_esteem",
    labelKey: "symptom.low_self_esteem",
    keywords: ["low self esteem", "low confidence", "self esteem issues", "feeling worthless", "lack of confidence"],
    primarySpecialty: "psychology",
    relatedSpecialties: ["psychiatry"],
  },
  {
    id: "eating_disorder",
    labelKey: "symptom.eating_disorder",
    keywords: ["eating disorder", "anorexia", "bulimia", "binge eating", "disordered eating", "food obsession"],
    primarySpecialty: "psychology",
    relatedSpecialties: ["psychiatry", "nutrition"],
  },

  // ── Ophthalmology ──────────────────────────────────────────────
  {
    id: "blurry_vision",
    labelKey: "symptom.blurry_vision",
    keywords: ["blurry vision", "blurred vision", "cant see clearly", "fuzzy vision", "vision problems"],
    primarySpecialty: "ophthalmology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "eye_pain",
    labelKey: "symptom.eye_pain",
    keywords: ["eye pain", "painful eye", "sore eyes", "eye ache", "pain behind eye"],
    primarySpecialty: "ophthalmology",
    relatedSpecialties: [],
  },
  {
    id: "red_eyes",
    labelKey: "symptom.red_eyes",
    keywords: ["red eyes", "bloodshot eyes", "eye redness", "pink eye", "conjunctivitis"],
    primarySpecialty: "ophthalmology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "floaters",
    labelKey: "symptom.floaters",
    keywords: ["floaters", "eye floaters", "spots in vision", "seeing spots", "flashes of light"],
    primarySpecialty: "ophthalmology",
    relatedSpecialties: [],
  },
  {
    id: "dry_eyes",
    labelKey: "symptom.dry_eyes",
    keywords: ["dry eyes", "eye dryness", "gritty eyes", "burning eyes", "watery eyes"],
    primarySpecialty: "ophthalmology",
    relatedSpecialties: [],
  },

  // ── ENT ────────────────────────────────────────────────────────
  {
    id: "ear_pain",
    labelKey: "symptom.ear_pain",
    keywords: ["ear pain", "earache", "ear ache", "painful ear", "ear infection"],
    primarySpecialty: "ent",
    relatedSpecialties: ["general-practice", "pediatrics"],
  },
  {
    id: "hearing_loss",
    labelKey: "symptom.hearing_loss",
    keywords: ["hearing loss", "cant hear", "difficulty hearing", "deaf", "hearing problems", "muffled hearing"],
    primarySpecialty: "ent",
    relatedSpecialties: [],
  },
  {
    id: "sore_throat",
    labelKey: "symptom.sore_throat",
    keywords: ["sore throat", "throat pain", "painful throat", "difficulty swallowing", "swollen throat"],
    primarySpecialty: "ent",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "sinus_pain",
    labelKey: "symptom.sinus_pain",
    keywords: ["sinus pain", "sinusitis", "sinus pressure", "blocked sinuses", "sinus headache", "nasal congestion"],
    primarySpecialty: "ent",
    relatedSpecialties: ["general-practice", "allergy"],
  },
  {
    id: "tinnitus",
    labelKey: "symptom.tinnitus",
    keywords: ["tinnitus", "ringing in ears", "ringing ears", "buzzing in ears", "ear ringing"],
    primarySpecialty: "ent",
    relatedSpecialties: ["neurology"],
  },
  {
    id: "nosebleed",
    labelKey: "symptom.nosebleed",
    keywords: ["nosebleed", "nose bleed", "bleeding nose", "epistaxis", "frequent nosebleeds"],
    primarySpecialty: "ent",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "snoring",
    labelKey: "symptom.snoring",
    keywords: ["snoring", "sleep apnea", "snore", "loud snoring", "breathing stops sleep"],
    primarySpecialty: "ent",
    relatedSpecialties: ["pulmonology"],
  },

  // ── Gynecology ─────────────────────────────────────────────────
  {
    id: "irregular_periods",
    labelKey: "symptom.irregular_periods",
    keywords: ["irregular periods", "irregular menstruation", "missed period", "late period", "period problems"],
    primarySpecialty: "gynecology",
    relatedSpecialties: ["endocrinology"],
  },
  {
    id: "pelvic_pain",
    labelKey: "symptom.pelvic_pain",
    keywords: ["pelvic pain", "lower abdominal pain", "pain in pelvis", "cramping", "pelvic discomfort"],
    primarySpecialty: "gynecology",
    relatedSpecialties: ["urology", "general-practice"],
  },
  {
    id: "menstrual_cramps",
    labelKey: "symptom.menstrual_cramps",
    keywords: ["menstrual cramps", "period pain", "dysmenorrhea", "painful periods", "period cramps"],
    primarySpecialty: "gynecology",
    relatedSpecialties: [],
  },
  {
    id: "breast_lump",
    labelKey: "symptom.breast_lump",
    keywords: ["breast lump", "lump in breast", "breast pain", "breast swelling", "breast tenderness"],
    primarySpecialty: "gynecology",
    relatedSpecialties: ["oncology"],
  },
  {
    id: "menopause_symptoms",
    labelKey: "symptom.menopause_symptoms",
    keywords: ["menopause", "hot flashes", "hot flushes", "menopause symptoms", "perimenopause"],
    primarySpecialty: "gynecology",
    relatedSpecialties: ["endocrinology"],
  },
  {
    id: "fertility_concerns",
    labelKey: "symptom.fertility_concerns",
    keywords: ["fertility", "infertility", "trying to conceive", "cant get pregnant", "fertility problems"],
    primarySpecialty: "gynecology",
    relatedSpecialties: ["urology", "endocrinology"],
  },

  // ── Urology ────────────────────────────────────────────────────
  {
    id: "painful_urination",
    labelKey: "symptom.painful_urination",
    keywords: ["painful urination", "burning urination", "pain when peeing", "dysuria", "uti symptoms"],
    primarySpecialty: "urology",
    relatedSpecialties: ["general-practice", "gynecology"],
  },
  {
    id: "blood_in_urine",
    labelKey: "symptom.blood_in_urine",
    keywords: ["blood in urine", "red urine", "hematuria", "bleeding when urinating"],
    primarySpecialty: "urology",
    relatedSpecialties: ["nephrology"],
  },
  {
    id: "frequent_urination",
    labelKey: "symptom.frequent_urination",
    keywords: ["frequent urination", "urinating often", "always needing to pee", "overactive bladder", "urinary frequency"],
    primarySpecialty: "urology",
    relatedSpecialties: ["endocrinology", "gynecology"],
  },
  {
    id: "kidney_pain",
    labelKey: "symptom.kidney_pain",
    keywords: ["kidney pain", "kidney stone", "flank pain", "renal colic", "side pain"],
    primarySpecialty: "urology",
    relatedSpecialties: ["nephrology"],
  },
  {
    id: "erectile_dysfunction",
    labelKey: "symptom.erectile_dysfunction",
    keywords: ["erectile dysfunction", "impotence", "ed", "erection problems", "sexual dysfunction"],
    primarySpecialty: "urology",
    relatedSpecialties: ["endocrinology"],
  },

  // ── Gastroenterology ───────────────────────────────────────────
  {
    id: "stomach_pain",
    labelKey: "symptom.stomach_pain",
    keywords: ["stomach pain", "abdominal pain", "tummy ache", "stomach ache", "belly pain", "stomach cramps"],
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "heartburn",
    labelKey: "symptom.heartburn",
    keywords: ["heartburn", "acid reflux", "gerd", "indigestion", "reflux", "burning stomach"],
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "nausea",
    labelKey: "symptom.nausea",
    keywords: ["nausea", "feeling sick", "nauseous", "queasy", "want to vomit", "sick feeling"],
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "bloating",
    labelKey: "symptom.bloating",
    keywords: ["bloating", "bloated", "swollen stomach", "gas", "flatulence", "abdominal bloating"],
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["nutrition"],
  },
  {
    id: "blood_in_stool",
    labelKey: "symptom.blood_in_stool",
    keywords: ["blood in stool", "rectal bleeding", "bloody stool", "blood when wiping", "dark stool"],
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "constipation",
    labelKey: "symptom.constipation",
    keywords: ["constipation", "constipated", "difficulty passing stool", "hard stool", "cant go to toilet"],
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["general-practice", "nutrition"],
  },
  {
    id: "diarrhea",
    labelKey: "symptom.diarrhea",
    keywords: ["diarrhea", "diarrhoea", "loose stool", "watery stool", "frequent bowel movements", "running stomach"],
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["general-practice"],
  },

  // ── Endocrinology ──────────────────────────────────────────────
  {
    id: "excessive_thirst",
    labelKey: "symptom.excessive_thirst",
    keywords: ["excessive thirst", "always thirsty", "polydipsia", "drinking a lot", "constant thirst"],
    primarySpecialty: "endocrinology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "thyroid_lump",
    labelKey: "symptom.thyroid_lump",
    keywords: ["thyroid lump", "neck lump", "goiter", "goitre", "thyroid swelling", "thyroid nodule"],
    primarySpecialty: "endocrinology",
    relatedSpecialties: ["ent", "general-practice"],
  },
  {
    id: "heat_intolerance",
    labelKey: "symptom.heat_intolerance",
    keywords: ["heat intolerance", "overheating", "always hot", "excessive sweating", "hyperthyroid symptoms"],
    primarySpecialty: "endocrinology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "cold_intolerance",
    labelKey: "symptom.cold_intolerance",
    keywords: ["cold intolerance", "always cold", "feeling cold", "cold sensitivity", "hypothyroid symptoms"],
    primarySpecialty: "endocrinology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "diabetes_symptoms",
    labelKey: "symptom.diabetes_symptoms",
    keywords: ["diabetes", "high blood sugar", "sugar level", "diabetic", "blood sugar problems"],
    primarySpecialty: "endocrinology",
    relatedSpecialties: ["general-practice", "nutrition"],
  },

  // ── Pulmonology ────────────────────────────────────────────────
  {
    id: "persistent_cough",
    labelKey: "symptom.persistent_cough",
    keywords: ["persistent cough", "chronic cough", "cough that wont go away", "long cough", "dry cough"],
    primarySpecialty: "pulmonology",
    relatedSpecialties: ["general-practice", "ent"],
  },
  {
    id: "wheezing",
    labelKey: "symptom.wheezing",
    keywords: ["wheezing", "wheeze", "whistling breath", "asthma", "asthma attack", "breathing sounds"],
    primarySpecialty: "pulmonology",
    relatedSpecialties: ["allergy", "general-practice"],
  },
  {
    id: "coughing_blood",
    labelKey: "symptom.coughing_blood",
    keywords: ["coughing blood", "blood in cough", "hemoptysis", "coughing up blood", "bloody cough"],
    primarySpecialty: "pulmonology",
    relatedSpecialties: ["general-practice", "oncology"],
  },

  // ── Oncology ───────────────────────────────────────────────────
  {
    id: "lump_or_mass",
    labelKey: "symptom.lump_or_mass",
    keywords: ["lump", "mass", "growth", "tumor", "tumour", "unexplained lump", "swelling"],
    primarySpecialty: "oncology",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "persistent_fatigue",
    labelKey: "symptom.persistent_fatigue",
    keywords: ["persistent fatigue", "extreme tiredness", "cancer fatigue", "severe exhaustion", "chronic tiredness"],
    primarySpecialty: "oncology",
    relatedSpecialties: ["general-practice", "endocrinology"],
  },

  // ── Pediatrics ─────────────────────────────────────────────────
  {
    id: "child_fever",
    labelKey: "symptom.child_fever",
    keywords: ["child fever", "baby fever", "kids temperature", "toddler fever", "child high temperature"],
    primarySpecialty: "pediatrics",
    relatedSpecialties: ["general-practice"],
  },
  {
    id: "child_rash",
    labelKey: "symptom.child_rash",
    keywords: ["child rash", "baby rash", "kids skin rash", "toddler rash", "nappy rash", "diaper rash"],
    primarySpecialty: "pediatrics",
    relatedSpecialties: ["dermatology"],
  },
  {
    id: "growth_concerns",
    labelKey: "symptom.growth_concerns",
    keywords: ["growth concerns", "child not growing", "short stature", "growth delay", "developmental delay"],
    primarySpecialty: "pediatrics",
    relatedSpecialties: ["endocrinology"],
  },
  {
    id: "childhood_asthma",
    labelKey: "symptom.childhood_asthma",
    keywords: ["childhood asthma", "child wheezing", "child breathing problems", "kids asthma"],
    primarySpecialty: "pediatrics",
    relatedSpecialties: ["pulmonology", "allergy"],
  },

  // ── Dentistry ──────────────────────────────────────────────────
  {
    id: "toothache",
    labelKey: "symptom.toothache",
    keywords: ["toothache", "tooth pain", "dental pain", "tooth ache", "sore tooth", "teeth pain"],
    primarySpecialty: "dentistry",
    relatedSpecialties: [],
  },
  {
    id: "bleeding_gums",
    labelKey: "symptom.bleeding_gums",
    keywords: ["bleeding gums", "gum bleeding", "gums bleed", "gum disease", "gingivitis", "periodontitis"],
    primarySpecialty: "dentistry",
    relatedSpecialties: [],
  },
  {
    id: "jaw_pain",
    labelKey: "symptom.jaw_pain",
    keywords: ["jaw pain", "tmj", "jaw ache", "jaw clicking", "jaw lock", "temporomandibular"],
    primarySpecialty: "dentistry",
    relatedSpecialties: ["ent"],
  },
  {
    id: "bad_breath",
    labelKey: "symptom.bad_breath",
    keywords: ["bad breath", "halitosis", "mouth odor", "mouth odour", "smelly breath"],
    primarySpecialty: "dentistry",
    relatedSpecialties: ["gastroenterology"],
  },

  // ── Aesthetic Medicine ─────────────────────────────────────────
  {
    id: "wrinkles",
    labelKey: "symptom.wrinkles",
    keywords: ["wrinkles", "fine lines", "aging skin", "botox", "anti aging", "skin aging"],
    primarySpecialty: "aesthetic-medicine",
    relatedSpecialties: ["dermatology"],
  },
  {
    id: "scarring",
    labelKey: "symptom.scarring",
    keywords: ["scarring", "scars", "scar treatment", "acne scars", "keloid", "scar removal"],
    primarySpecialty: "aesthetic-medicine",
    relatedSpecialties: ["dermatology"],
  },

  // ── Physiotherapy ──────────────────────────────────────────────
  {
    id: "muscle_stiffness",
    labelKey: "symptom.muscle_stiffness",
    keywords: ["muscle stiffness", "stiff muscles", "muscle tightness", "body stiffness", "cant move properly"],
    primarySpecialty: "physiotherapy",
    relatedSpecialties: ["orthopedics"],
  },
  {
    id: "post_surgery_rehab",
    labelKey: "symptom.post_surgery_rehab",
    keywords: ["post surgery rehab", "rehabilitation", "recovery after surgery", "physio after surgery", "post operative"],
    primarySpecialty: "physiotherapy",
    relatedSpecialties: ["orthopedics"],
  },
  {
    id: "limited_mobility",
    labelKey: "symptom.limited_mobility",
    keywords: ["limited mobility", "cant move", "range of motion", "stiffness", "mobility problems", "difficulty walking"],
    primarySpecialty: "physiotherapy",
    relatedSpecialties: ["orthopedics", "neurology"],
  },
  {
    id: "chronic_pain",
    labelKey: "symptom.chronic_pain",
    keywords: ["chronic pain", "persistent pain", "long term pain", "pain management", "ongoing pain"],
    primarySpecialty: "physiotherapy",
    relatedSpecialties: ["orthopedics", "neurology"],
  },

  // ── Nutrition ──────────────────────────────────────────────────
  {
    id: "food_intolerance",
    labelKey: "symptom.food_intolerance",
    keywords: ["food intolerance", "food sensitivity", "lactose intolerance", "gluten intolerance", "food reaction"],
    primarySpecialty: "nutrition",
    relatedSpecialties: ["gastroenterology", "allergy"],
  },
  {
    id: "nutritional_deficiency",
    labelKey: "symptom.nutritional_deficiency",
    keywords: ["nutritional deficiency", "vitamin deficiency", "mineral deficiency", "low iron", "low vitamin d"],
    primarySpecialty: "nutrition",
    relatedSpecialties: ["general-practice", "endocrinology"],
  },
  {
    id: "weight_management",
    labelKey: "symptom.weight_management",
    keywords: ["weight management", "want to lose weight", "diet help", "obesity", "overweight", "diet plan"],
    primarySpecialty: "nutrition",
    relatedSpecialties: ["endocrinology", "general-practice"],
  },

  // ── Allergy ────────────────────────────────────────────────────
  {
    id: "sneezing",
    labelKey: "symptom.sneezing",
    keywords: ["sneezing", "constant sneezing", "hay fever", "allergic rhinitis", "runny nose allergy"],
    primarySpecialty: "allergy",
    relatedSpecialties: ["ent", "general-practice"],
  },
  {
    id: "allergic_reaction",
    labelKey: "symptom.allergic_reaction",
    keywords: ["allergic reaction", "allergy", "allergies", "hives", "urticaria", "swelling after eating"],
    primarySpecialty: "allergy",
    relatedSpecialties: ["dermatology", "general-practice"],
  },
  {
    id: "itchy_eyes",
    labelKey: "symptom.itchy_eyes",
    keywords: ["itchy eyes", "watery eyes allergy", "eye allergy", "allergic conjunctivitis"],
    primarySpecialty: "allergy",
    relatedSpecialties: ["ophthalmology"],
  },
  {
    id: "food_allergy",
    labelKey: "symptom.food_allergy",
    keywords: ["food allergy", "nut allergy", "shellfish allergy", "anaphylaxis", "allergic to food"],
    primarySpecialty: "allergy",
    relatedSpecialties: ["general-practice"],
  },

  // ── Rheumatology ───────────────────────────────────────────────
  {
    id: "morning_stiffness",
    labelKey: "symptom.morning_stiffness",
    keywords: ["morning stiffness", "stiff in morning", "joint stiffness morning", "arthritis stiffness"],
    primarySpecialty: "rheumatology",
    relatedSpecialties: ["orthopedics"],
  },
  {
    id: "joint_swelling",
    labelKey: "symptom.joint_swelling",
    keywords: ["joint swelling", "swollen joints", "puffy joints", "inflamed joints", "hot joints"],
    primarySpecialty: "rheumatology",
    relatedSpecialties: ["orthopedics"],
  },
  {
    id: "autoimmune_symptoms",
    labelKey: "symptom.autoimmune_symptoms",
    keywords: ["autoimmune", "lupus", "rheumatoid arthritis", "autoimmune disease", "fibromyalgia"],
    primarySpecialty: "rheumatology",
    relatedSpecialties: ["general-practice"],
  },

  // ── Nephrology ─────────────────────────────────────────────────
  {
    id: "foamy_urine",
    labelKey: "symptom.foamy_urine",
    keywords: ["foamy urine", "bubbly urine", "frothy urine", "protein in urine", "proteinuria"],
    primarySpecialty: "nephrology",
    relatedSpecialties: ["urology"],
  },
  {
    id: "swollen_face",
    labelKey: "symptom.swollen_face",
    keywords: ["swollen face", "puffy face", "facial swelling", "swollen around eyes", "periorbital edema"],
    primarySpecialty: "nephrology",
    relatedSpecialties: ["general-practice", "allergy"],
  },
  {
    id: "high_blood_pressure",
    labelKey: "symptom.high_blood_pressure",
    keywords: ["high blood pressure", "hypertension", "blood pressure high", "elevated blood pressure"],
    primarySpecialty: "cardiology",
    relatedSpecialties: ["nephrology", "general-practice"],
  },
] as const;
