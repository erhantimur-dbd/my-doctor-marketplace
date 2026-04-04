-- Migration: 00084_allergies_conditions_autocomplete
-- Description: Create allergies and chronic_conditions tables with trigram fuzzy search for autocomplete
-- Date: 2026-04-04

-- ============================================
-- 1. ALLERGIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS allergies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
);

-- Trigram GIN index for fuzzy search
CREATE INDEX IF NOT EXISTS idx_allergies_name_trgm ON allergies USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_allergies_category ON allergies USING btree (category);

-- RLS with public read
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for autocomplete"
  ON allergies
  FOR SELECT
  TO public
  USING (true);

-- Search RPC function
CREATE OR REPLACE FUNCTION search_allergies(search_query TEXT)
RETURNS TABLE(id INT, name TEXT, category TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First try trigram similarity
  RETURN QUERY
    SELECT a.id, a.name, a.category
    FROM allergies a
    WHERE similarity(a.name, search_query) > 0.1
    ORDER BY similarity(a.name, search_query) DESC
    LIMIT 10;

  -- If no results, fallback to ILIKE prefix match
  IF NOT FOUND THEN
    RETURN QUERY
      SELECT a.id, a.name, a.category
      FROM allergies a
      WHERE a.name ILIKE search_query || '%'
      ORDER BY a.name
      LIMIT 10;
  END IF;
END;
$$;

-- Seed allergies data
INSERT INTO allergies (name, category) VALUES
  -- Drug Allergies
  ('Penicillin', 'Drug'),
  ('Amoxicillin', 'Drug'),
  ('Ampicillin', 'Drug'),
  ('Sulfonamides', 'Drug'),
  ('Tetracycline', 'Drug'),
  ('Erythromycin', 'Drug'),
  ('Ciprofloxacin', 'Drug'),
  ('Cephalosporins', 'Drug'),
  ('Aspirin', 'Drug'),
  ('Ibuprofen', 'Drug'),
  ('Naproxen', 'Drug'),
  ('Codeine', 'Drug'),
  ('Morphine', 'Drug'),
  ('Tramadol', 'Drug'),
  ('Lidocaine', 'Drug'),
  ('Novocaine', 'Drug'),
  ('Insulin', 'Drug'),
  ('Metformin', 'Drug'),
  ('ACE Inhibitors', 'Drug'),
  ('Beta-Blockers', 'Drug'),
  ('Statins', 'Drug'),
  ('Warfarin', 'Drug'),
  ('Heparin', 'Drug'),
  ('Phenytoin', 'Drug'),
  ('Carbamazepine', 'Drug'),
  ('Methotrexate', 'Drug'),
  ('Allopurinol', 'Drug'),
  ('Contrast Dye (Iodine)', 'Drug'),
  ('General Anaesthesia', 'Drug'),
  ('Nitrofurantoin', 'Drug'),
  -- Food Allergies
  ('Peanuts', 'Food'),
  ('Tree Nuts', 'Food'),
  ('Almonds', 'Food'),
  ('Cashews', 'Food'),
  ('Walnuts', 'Food'),
  ('Hazelnuts', 'Food'),
  ('Pistachios', 'Food'),
  ('Brazil Nuts', 'Food'),
  ('Macadamia Nuts', 'Food'),
  ('Pecans', 'Food'),
  ('Milk (Dairy)', 'Food'),
  ('Eggs', 'Food'),
  ('Wheat (Gluten)', 'Food'),
  ('Soy', 'Food'),
  ('Fish', 'Food'),
  ('Shellfish', 'Food'),
  ('Shrimp', 'Food'),
  ('Crab', 'Food'),
  ('Lobster', 'Food'),
  ('Sesame', 'Food'),
  ('Mustard', 'Food'),
  ('Celery', 'Food'),
  ('Lupin', 'Food'),
  ('Molluscs', 'Food'),
  ('Corn', 'Food'),
  ('Kiwi', 'Food'),
  ('Banana', 'Food'),
  ('Avocado', 'Food'),
  ('Mango', 'Food'),
  ('Strawberry', 'Food'),
  ('Tomato', 'Food'),
  ('Garlic', 'Food'),
  ('Onion', 'Food'),
  ('Citrus Fruits', 'Food'),
  ('Chocolate', 'Food'),
  ('Caffeine', 'Food'),
  ('Alcohol', 'Food'),
  ('Artificial Sweeteners', 'Food'),
  ('Food Colouring', 'Food'),
  ('MSG (Monosodium Glutamate)', 'Food'),
  ('Sulphites', 'Food'),
  -- Environmental Allergies
  ('Pollen (Grass)', 'Environmental'),
  ('Pollen (Tree)', 'Environmental'),
  ('Pollen (Ragweed)', 'Environmental'),
  ('Dust Mites', 'Environmental'),
  ('Mould', 'Environmental'),
  ('Pet Dander (Cat)', 'Environmental'),
  ('Pet Dander (Dog)', 'Environmental'),
  ('Pet Dander (Horse)', 'Environmental'),
  ('Cockroach', 'Environmental'),
  ('Feathers', 'Environmental'),
  ('Wool', 'Environmental'),
  ('Cigarette Smoke', 'Environmental'),
  ('Perfume / Fragrance', 'Environmental'),
  ('Formaldehyde', 'Environmental'),
  ('Chlorine', 'Environmental'),
  ('Ammonia', 'Environmental'),
  -- Insect Allergies
  ('Bee Stings', 'Insect'),
  ('Wasp Stings', 'Insect'),
  ('Hornet Stings', 'Insect'),
  ('Ant Bites (Fire Ant)', 'Insect'),
  ('Mosquito Bites', 'Insect'),
  ('Tick Bites', 'Insect'),
  -- Contact Allergies
  ('Latex', 'Contact'),
  ('Nickel', 'Contact'),
  ('Chromium', 'Contact'),
  ('Cobalt', 'Contact'),
  ('Hair Dye (PPD)', 'Contact'),
  ('Adhesive / Plasters', 'Contact'),
  ('Detergent / Soap', 'Contact'),
  ('Cosmetics', 'Contact'),
  ('Sunscreen', 'Contact'),
  ('Topical Antibiotics (Neomycin)', 'Contact'),
  -- Severe / Rare
  ('Cold (Cold Urticaria)', 'Severe'),
  ('Sun (Solar Urticaria)', 'Severe'),
  ('Water (Aquagenic Urticaria)', 'Severe'),
  ('Exercise-Induced Anaphylaxis', 'Severe'),
  ('Seminal Fluid', 'Severe'),
  -- Other
  ('No Known Allergies', 'Other'),
  ('Multiple Drug Allergies', 'Other'),
  ('Unknown / Unspecified Allergy', 'Other')
ON CONFLICT (name) DO NOTHING;


-- ============================================
-- 2. CHRONIC CONDITIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chronic_conditions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
);

-- Trigram GIN index for fuzzy search
CREATE INDEX IF NOT EXISTS idx_chronic_conditions_name_trgm ON chronic_conditions USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chronic_conditions_category ON chronic_conditions USING btree (category);

-- RLS with public read
ALTER TABLE chronic_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for autocomplete"
  ON chronic_conditions
  FOR SELECT
  TO public
  USING (true);

-- Search RPC function
CREATE OR REPLACE FUNCTION search_chronic_conditions(search_query TEXT)
RETURNS TABLE(id INT, name TEXT, category TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First try trigram similarity
  RETURN QUERY
    SELECT c.id, c.name, c.category
    FROM chronic_conditions c
    WHERE similarity(c.name, search_query) > 0.1
    ORDER BY similarity(c.name, search_query) DESC
    LIMIT 10;

  -- If no results, fallback to ILIKE prefix match
  IF NOT FOUND THEN
    RETURN QUERY
      SELECT c.id, c.name, c.category
      FROM chronic_conditions c
      WHERE c.name ILIKE search_query || '%'
      ORDER BY c.name
      LIMIT 10;
  END IF;
END;
$$;

-- Seed chronic conditions data
INSERT INTO chronic_conditions (name, category) VALUES
  -- Cardiovascular
  ('Hypertension', 'Cardiovascular'),
  ('Coronary Artery Disease', 'Cardiovascular'),
  ('Heart Failure', 'Cardiovascular'),
  ('Atrial Fibrillation', 'Cardiovascular'),
  ('Peripheral Artery Disease', 'Cardiovascular'),
  ('Deep Vein Thrombosis', 'Cardiovascular'),
  ('Pulmonary Embolism', 'Cardiovascular'),
  ('Aortic Aneurysm', 'Cardiovascular'),
  ('Cardiomyopathy', 'Cardiovascular'),
  ('Valve Disease', 'Cardiovascular'),
  ('Hyperlipidaemia', 'Cardiovascular'),
  ('Atherosclerosis', 'Cardiovascular'),
  ('Raynaud''s Disease', 'Cardiovascular'),
  ('Varicose Veins', 'Cardiovascular'),
  -- Endocrine
  ('Type 1 Diabetes', 'Endocrine'),
  ('Type 2 Diabetes', 'Endocrine'),
  ('Gestational Diabetes', 'Endocrine'),
  ('Hypothyroidism', 'Endocrine'),
  ('Hyperthyroidism', 'Endocrine'),
  ('Hashimoto''s Thyroiditis', 'Endocrine'),
  ('Graves'' Disease', 'Endocrine'),
  ('Cushing''s Syndrome', 'Endocrine'),
  ('Addison''s Disease', 'Endocrine'),
  ('Polycystic Ovary Syndrome (PCOS)', 'Endocrine'),
  ('Metabolic Syndrome', 'Endocrine'),
  ('Obesity', 'Endocrine'),
  ('Hyperparathyroidism', 'Endocrine'),
  ('Hypoparathyroidism', 'Endocrine'),
  ('Pituitary Disorders', 'Endocrine'),
  -- Respiratory
  ('Asthma', 'Respiratory'),
  ('COPD', 'Respiratory'),
  ('Chronic Bronchitis', 'Respiratory'),
  ('Emphysema', 'Respiratory'),
  ('Pulmonary Fibrosis', 'Respiratory'),
  ('Bronchiectasis', 'Respiratory'),
  ('Obstructive Sleep Apnoea', 'Respiratory'),
  ('Sarcoidosis', 'Respiratory'),
  ('Cystic Fibrosis', 'Respiratory'),
  ('Pulmonary Hypertension', 'Respiratory'),
  ('Allergic Rhinitis', 'Respiratory'),
  ('Chronic Sinusitis', 'Respiratory'),
  -- Neurological
  ('Epilepsy', 'Neurological'),
  ('Multiple Sclerosis', 'Neurological'),
  ('Parkinson''s Disease', 'Neurological'),
  ('Alzheimer''s Disease', 'Neurological'),
  ('Migraine', 'Neurological'),
  ('Chronic Headache', 'Neurological'),
  ('Neuropathy (Peripheral)', 'Neurological'),
  ('Trigeminal Neuralgia', 'Neurological'),
  ('Myasthenia Gravis', 'Neurological'),
  ('Motor Neurone Disease (ALS)', 'Neurological'),
  ('Huntington''s Disease', 'Neurological'),
  ('Essential Tremor', 'Neurological'),
  ('Restless Legs Syndrome', 'Neurological'),
  ('Narcolepsy', 'Neurological'),
  ('Cerebral Palsy', 'Neurological'),
  ('Stroke (Cerebrovascular Accident)', 'Neurological'),
  -- Mental Health
  ('Depression', 'Mental Health'),
  ('Generalised Anxiety Disorder', 'Mental Health'),
  ('Bipolar Disorder', 'Mental Health'),
  ('Schizophrenia', 'Mental Health'),
  ('Post-Traumatic Stress Disorder (PTSD)', 'Mental Health'),
  ('Obsessive-Compulsive Disorder (OCD)', 'Mental Health'),
  ('Panic Disorder', 'Mental Health'),
  ('Social Anxiety Disorder', 'Mental Health'),
  ('Eating Disorder (Anorexia)', 'Mental Health'),
  ('Eating Disorder (Bulimia)', 'Mental Health'),
  ('Attention Deficit Hyperactivity Disorder (ADHD)', 'Mental Health'),
  ('Autism Spectrum Disorder', 'Mental Health'),
  ('Borderline Personality Disorder', 'Mental Health'),
  ('Substance Use Disorder', 'Mental Health'),
  ('Insomnia', 'Mental Health'),
  -- Musculoskeletal
  ('Osteoarthritis', 'Musculoskeletal'),
  ('Rheumatoid Arthritis', 'Musculoskeletal'),
  ('Psoriatic Arthritis', 'Musculoskeletal'),
  ('Ankylosing Spondylitis', 'Musculoskeletal'),
  ('Gout', 'Musculoskeletal'),
  ('Osteoporosis', 'Musculoskeletal'),
  ('Fibromyalgia', 'Musculoskeletal'),
  ('Chronic Back Pain', 'Musculoskeletal'),
  ('Chronic Neck Pain', 'Musculoskeletal'),
  ('Lupus (SLE)', 'Musculoskeletal'),
  ('Scleroderma', 'Musculoskeletal'),
  ('Sjögren''s Syndrome', 'Musculoskeletal'),
  ('Polymyalgia Rheumatica', 'Musculoskeletal'),
  ('Ehlers-Danlos Syndrome', 'Musculoskeletal'),
  ('Carpal Tunnel Syndrome', 'Musculoskeletal'),
  -- Gastrointestinal
  ('Irritable Bowel Syndrome (IBS)', 'Gastrointestinal'),
  ('Crohn''s Disease', 'Gastrointestinal'),
  ('Ulcerative Colitis', 'Gastrointestinal'),
  ('Coeliac Disease', 'Gastrointestinal'),
  ('Gastro-Oesophageal Reflux Disease (GORD)', 'Gastrointestinal'),
  ('Peptic Ulcer Disease', 'Gastrointestinal'),
  ('Chronic Pancreatitis', 'Gastrointestinal'),
  ('Fatty Liver Disease (NAFLD)', 'Gastrointestinal'),
  ('Hepatitis B (Chronic)', 'Gastrointestinal'),
  ('Hepatitis C (Chronic)', 'Gastrointestinal'),
  ('Cirrhosis', 'Gastrointestinal'),
  ('Barrett''s Oesophagus', 'Gastrointestinal'),
  ('Diverticular Disease', 'Gastrointestinal'),
  ('Gastroparesis', 'Gastrointestinal'),
  -- Kidney / Urological
  ('Chronic Kidney Disease', 'Kidney'),
  ('Kidney Stones (Recurrent)', 'Kidney'),
  ('Polycystic Kidney Disease', 'Kidney'),
  ('Urinary Incontinence', 'Kidney'),
  ('Overactive Bladder', 'Kidney'),
  ('Interstitial Cystitis', 'Kidney'),
  ('Benign Prostatic Hyperplasia', 'Kidney'),
  ('Chronic Prostatitis', 'Kidney'),
  -- Dermatological
  ('Eczema (Atopic Dermatitis)', 'Dermatological'),
  ('Psoriasis', 'Dermatological'),
  ('Rosacea', 'Dermatological'),
  ('Chronic Urticaria', 'Dermatological'),
  ('Vitiligo', 'Dermatological'),
  ('Alopecia Areata', 'Dermatological'),
  ('Acne (Chronic)', 'Dermatological'),
  ('Hidradenitis Suppurativa', 'Dermatological'),
  -- Blood / Immune
  ('Anaemia (Iron Deficiency)', 'Blood'),
  ('Anaemia (Pernicious)', 'Blood'),
  ('Sickle Cell Disease', 'Blood'),
  ('Thalassaemia', 'Blood'),
  ('Haemophilia', 'Blood'),
  ('Von Willebrand Disease', 'Blood'),
  ('Thrombocytopenia', 'Blood'),
  ('HIV / AIDS', 'Blood'),
  ('Primary Immunodeficiency', 'Blood'),
  -- Cancer (Chronic/Ongoing)
  ('Breast Cancer', 'Cancer'),
  ('Prostate Cancer', 'Cancer'),
  ('Lung Cancer', 'Cancer'),
  ('Colorectal Cancer', 'Cancer'),
  ('Lymphoma', 'Cancer'),
  ('Leukaemia', 'Cancer'),
  ('Melanoma', 'Cancer'),
  ('Thyroid Cancer', 'Cancer'),
  ('Bladder Cancer', 'Cancer'),
  ('Kidney Cancer', 'Cancer'),
  -- Other
  ('Chronic Fatigue Syndrome (ME/CFS)', 'Other'),
  ('Long COVID', 'Other'),
  ('Endometriosis', 'Other'),
  ('Adenomyosis', 'Other'),
  ('Chronic Pelvic Pain', 'Other'),
  ('Tinnitus', 'Other'),
  ('Ménière''s Disease', 'Other'),
  ('Glaucoma', 'Other'),
  ('Macular Degeneration', 'Other'),
  ('Hearing Loss (Sensorineural)', 'Other'),
  ('Down Syndrome', 'Other'),
  ('Turner Syndrome', 'Other'),
  ('Marfan Syndrome', 'Other')
ON CONFLICT (name) DO NOTHING;
