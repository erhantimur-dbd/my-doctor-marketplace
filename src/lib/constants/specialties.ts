export interface SpecialtyMeta {
  nameKey: string;
  slug: string;
  icon: string;
  description: string;
  commonConditions: string[];
  relatedSlugs: string[];
}

export const SPECIALTIES: readonly SpecialtyMeta[] = [
  {
    nameKey: "specialty.general_practice",
    slug: "general-practice",
    icon: "Stethoscope",
    description:
      "General practitioners provide comprehensive primary care, including health screenings, chronic disease management, and referrals to specialists.",
    commonConditions: [
      "Routine check-ups and health screenings",
      "Cold, flu, and respiratory infections",
      "Chronic disease management (diabetes, hypertension)",
      "Vaccinations and preventive care",
      "Referral coordination to specialists",
    ],
    relatedSlugs: ["pediatrics", "endocrinology", "pulmonology"],
  },
  {
    nameKey: "specialty.cardiology",
    slug: "cardiology",
    icon: "Heart",
    description:
      "Cardiologists diagnose and treat diseases of the heart and blood vessels, from high blood pressure to heart failure and arrhythmias.",
    commonConditions: [
      "High blood pressure (hypertension)",
      "Coronary artery disease",
      "Heart failure and arrhythmias",
      "Heart valve disorders",
      "Cholesterol management",
    ],
    relatedSlugs: ["general-practice", "endocrinology", "pulmonology"],
  },
  {
    nameKey: "specialty.dermatology",
    slug: "dermatology",
    icon: "Sparkles",
    description:
      "Dermatologists specialise in conditions of the skin, hair, and nails, from acne and eczema to skin cancer screening.",
    commonConditions: [
      "Acne, eczema, and psoriasis",
      "Skin cancer screening and mole checks",
      "Hair loss (alopecia)",
      "Fungal and bacterial skin infections",
      "Rosacea and dermatitis",
    ],
    relatedSlugs: ["allergy", "aesthetic-medicine", "rheumatology"],
  },
  {
    nameKey: "specialty.orthopedics",
    slug: "orthopedics",
    icon: "Bone",
    description:
      "Orthopaedic specialists treat injuries and conditions of the musculoskeletal system, including bones, joints, ligaments, and tendons.",
    commonConditions: [
      "Fractures and sports injuries",
      "Back and neck pain",
      "Arthritis and joint degeneration",
      "Ligament and tendon tears",
      "Carpal tunnel syndrome",
    ],
    relatedSlugs: ["physiotherapy", "rheumatology", "neurology"],
  },
  {
    nameKey: "specialty.neurology",
    slug: "neurology",
    icon: "Brain",
    description:
      "Neurologists diagnose and treat disorders of the brain, spinal cord, and nervous system, from migraines to epilepsy.",
    commonConditions: [
      "Migraines and chronic headaches",
      "Epilepsy and seizure disorders",
      "Multiple sclerosis",
      "Parkinson's disease",
      "Neuropathy and nerve pain",
    ],
    relatedSlugs: ["psychiatry", "orthopedics", "physiotherapy"],
  },
  {
    nameKey: "specialty.psychiatry",
    slug: "psychiatry",
    icon: "Brain",
    description:
      "Psychiatrists are medical doctors who diagnose and treat mental health conditions, often combining therapy with medication management.",
    commonConditions: [
      "Depression and anxiety disorders",
      "Bipolar disorder",
      "ADHD and attention disorders",
      "PTSD and trauma-related conditions",
      "Medication management for mental health",
    ],
    relatedSlugs: ["psychology", "neurology", "general-practice"],
  },
  {
    nameKey: "specialty.psychology",
    slug: "psychology",
    icon: "HeartHandshake",
    description:
      "Psychologists provide therapy, counselling, and behavioural health support to help patients manage emotional and psychological challenges.",
    commonConditions: [
      "Anxiety and stress management",
      "Depression and mood disorders",
      "Relationship and family counselling",
      "Grief and loss therapy",
      "Behavioural and cognitive therapy (CBT)",
    ],
    relatedSlugs: ["psychiatry", "general-practice", "nutrition"],
  },
  {
    nameKey: "specialty.ophthalmology",
    slug: "ophthalmology",
    icon: "Eye",
    description:
      "Ophthalmologists provide medical and surgical eye care, from routine vision tests to cataract surgery and glaucoma treatment.",
    commonConditions: [
      "Vision problems (myopia, hyperopia, astigmatism)",
      "Cataracts and glaucoma",
      "Diabetic retinopathy",
      "Dry eye syndrome",
      "Eye infections and inflammation",
    ],
    relatedSlugs: ["general-practice", "endocrinology", "neurology"],
  },
  {
    nameKey: "specialty.ent",
    slug: "ent",
    icon: "Ear",
    description:
      "ENT specialists (otolaryngologists) treat conditions of the ear, nose, and throat, including hearing loss, sinusitis, and tonsillitis.",
    commonConditions: [
      "Sinusitis and nasal congestion",
      "Hearing loss and ear infections",
      "Tonsillitis and sore throat",
      "Vertigo and balance disorders",
      "Sleep apnoea and snoring",
    ],
    relatedSlugs: ["allergy", "pulmonology", "general-practice"],
  },
  {
    nameKey: "specialty.gynecology",
    slug: "gynecology",
    icon: "Baby",
    description:
      "Gynaecologists specialise in women's reproductive health, from routine screenings and contraception to pregnancy care and fertility.",
    commonConditions: [
      "Routine gynaecological exams and smear tests",
      "Pregnancy care and prenatal monitoring",
      "Menstrual disorders and PCOS",
      "Fertility assessment and treatment",
      "Menopause management",
    ],
    relatedSlugs: ["endocrinology", "urology", "general-practice"],
  },
  {
    nameKey: "specialty.urology",
    slug: "urology",
    icon: "Activity",
    description:
      "Urologists treat conditions of the urinary tract and male reproductive system, from kidney stones to prostate health.",
    commonConditions: [
      "Kidney stones and urinary tract infections",
      "Prostate conditions (BPH, screening)",
      "Bladder disorders and incontinence",
      "Male infertility",
      "Erectile dysfunction",
    ],
    relatedSlugs: ["nephrology", "gynecology", "general-practice"],
  },
  {
    nameKey: "specialty.gastroenterology",
    slug: "gastroenterology",
    icon: "Apple",
    description:
      "Gastroenterologists diagnose and treat conditions of the digestive system, including the stomach, intestines, liver, and pancreas.",
    commonConditions: [
      "Acid reflux (GERD) and heartburn",
      "Irritable bowel syndrome (IBS)",
      "Crohn's disease and ulcerative colitis",
      "Liver disease and hepatitis",
      "Colonoscopy and endoscopy",
    ],
    relatedSlugs: ["nutrition", "general-practice", "oncology"],
  },
  {
    nameKey: "specialty.endocrinology",
    slug: "endocrinology",
    icon: "Droplets",
    description:
      "Endocrinologists treat hormonal imbalances and metabolic disorders, including diabetes, thyroid conditions, and adrenal disorders.",
    commonConditions: [
      "Diabetes (Type 1 and Type 2)",
      "Thyroid disorders (hypo/hyperthyroidism)",
      "Hormonal imbalances",
      "Osteoporosis and calcium disorders",
      "Adrenal and pituitary conditions",
    ],
    relatedSlugs: ["general-practice", "nutrition", "cardiology"],
  },
  {
    nameKey: "specialty.pulmonology",
    slug: "pulmonology",
    icon: "Wind",
    description:
      "Pulmonologists specialise in diseases of the lungs and respiratory system, from asthma and COPD to sleep-related breathing disorders.",
    commonConditions: [
      "Asthma and chronic cough",
      "COPD (chronic obstructive pulmonary disease)",
      "Pneumonia and lung infections",
      "Sleep apnoea",
      "Pulmonary fibrosis",
    ],
    relatedSlugs: ["allergy", "ent", "general-practice"],
  },
  {
    nameKey: "specialty.oncology",
    slug: "oncology",
    icon: "Shield",
    description:
      "Oncologists specialise in the diagnosis, treatment, and management of cancer, providing chemotherapy, immunotherapy, and supportive care.",
    commonConditions: [
      "Cancer diagnosis and staging",
      "Chemotherapy and immunotherapy",
      "Cancer screening and prevention",
      "Palliative and supportive care",
      "Post-treatment follow-up",
    ],
    relatedSlugs: ["radiology", "general-practice", "gastroenterology"],
  },
  {
    nameKey: "specialty.pediatrics",
    slug: "pediatrics",
    icon: "Baby",
    description:
      "Paediatricians provide medical care for infants, children, and adolescents, from routine well-child visits to managing childhood illnesses.",
    commonConditions: [
      "Well-child exams and vaccinations",
      "Childhood infections (ear, throat, chest)",
      "Growth and developmental concerns",
      "Asthma and allergies in children",
      "Behavioural and learning difficulties",
    ],
    relatedSlugs: ["general-practice", "allergy", "ent"],
  },
  {
    nameKey: "specialty.dentistry",
    slug: "dentistry",
    icon: "Smile",
    description:
      "Dentists provide comprehensive oral health care, from routine cleanings and fillings to cosmetic dentistry and oral surgery.",
    commonConditions: [
      "Routine dental check-ups and cleanings",
      "Cavities and fillings",
      "Gum disease (gingivitis, periodontitis)",
      "Teeth whitening and cosmetic treatments",
      "Wisdom tooth removal",
    ],
    relatedSlugs: ["aesthetic-medicine", "ent", "general-practice"],
  },
  {
    nameKey: "specialty.aesthetic_medicine",
    slug: "aesthetic-medicine",
    icon: "Sparkles",
    description:
      "Aesthetic medicine practitioners offer non-surgical and minimally invasive cosmetic treatments to enhance appearance and confidence.",
    commonConditions: [
      "Botox and dermal fillers",
      "Laser skin treatments",
      "Chemical peels and microneedling",
      "Body contouring treatments",
      "Scar and pigmentation correction",
    ],
    relatedSlugs: ["dermatology", "dentistry", "nutrition"],
  },
  {
    nameKey: "specialty.physiotherapy",
    slug: "physiotherapy",
    icon: "Activity",
    description:
      "Physiotherapists help patients recover movement and function after injury, surgery, or illness through exercise and manual therapy.",
    commonConditions: [
      "Post-surgical rehabilitation",
      "Sports injuries and sprains",
      "Back and neck pain management",
      "Joint mobility and flexibility",
      "Stroke and neurological rehabilitation",
    ],
    relatedSlugs: ["orthopedics", "neurology", "rheumatology"],
  },
  {
    nameKey: "specialty.radiology",
    slug: "radiology",
    icon: "Scan",
    description:
      "Radiologists use medical imaging (X-ray, MRI, CT, ultrasound) to diagnose and monitor diseases and injuries.",
    commonConditions: [
      "X-ray and CT scans",
      "MRI and ultrasound imaging",
      "Mammography and breast screening",
      "Interventional radiology procedures",
      "Musculoskeletal imaging",
    ],
    relatedSlugs: ["oncology", "orthopedics", "neurology"],
  },
  {
    nameKey: "specialty.nutrition",
    slug: "nutrition",
    icon: "Apple",
    description:
      "Nutritionists and dietitians create personalised diet plans to manage weight, treat nutritional deficiencies, and support overall health.",
    commonConditions: [
      "Weight management and obesity",
      "Nutritional deficiency assessment",
      "Diabetes and cholesterol diet plans",
      "Food intolerance and allergy diets",
      "Sports and performance nutrition",
    ],
    relatedSlugs: ["endocrinology", "gastroenterology", "general-practice"],
  },
  {
    nameKey: "specialty.allergy",
    slug: "allergy",
    icon: "Flower",
    description:
      "Allergists diagnose and treat allergies, asthma, and immune system disorders, from seasonal hay fever to severe anaphylaxis.",
    commonConditions: [
      "Seasonal allergies (hay fever)",
      "Food allergies and intolerances",
      "Asthma management",
      "Eczema and skin allergies",
      "Allergy testing and immunotherapy",
    ],
    relatedSlugs: ["dermatology", "pulmonology", "ent"],
  },
  {
    nameKey: "specialty.rheumatology",
    slug: "rheumatology",
    icon: "Bone",
    description:
      "Rheumatologists treat autoimmune and inflammatory diseases affecting joints, muscles, and connective tissue.",
    commonConditions: [
      "Rheumatoid arthritis",
      "Lupus (SLE)",
      "Gout and crystal arthropathies",
      "Fibromyalgia",
      "Osteoarthritis management",
    ],
    relatedSlugs: ["orthopedics", "physiotherapy", "dermatology"],
  },
  {
    nameKey: "specialty.nephrology",
    slug: "nephrology",
    icon: "Droplets",
    description:
      "Nephrologists specialise in kidney health, treating conditions from chronic kidney disease and kidney stones to dialysis management.",
    commonConditions: [
      "Chronic kidney disease (CKD)",
      "Kidney stones",
      "Dialysis management",
      "Kidney infections (pyelonephritis)",
      "Electrolyte and fluid balance disorders",
    ],
    relatedSlugs: ["urology", "endocrinology", "cardiology"],
  },
] as const;

/** Look up a specialty by its slug */
export function getSpecialtyMeta(slug: string): SpecialtyMeta | undefined {
  return SPECIALTIES.find((s) => s.slug === slug);
}
