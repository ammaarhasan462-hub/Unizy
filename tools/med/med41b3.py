"""Hand-written starter bank for QMUL MED41B3 (MBBS Year 1, Part 1 Section B: Application of Key Knowledge).
Single best answer (SBA) and very short answer (VSA) questions, matching the QMUL MBBS exam format.
Writes SQL to stdout; options are shuffled with a fixed seed so the right answer isn't always in the same place.
Run: python3 tools/med/med41b3.py > /tmp/med41b3.sql"""
import json, random

CODE = "MED41B3"
random.seed(4113)

def V(q, a, accept=(), why=""):
    return {"kind": "vsa", "tier": "foundation", "q": q, "a": a, "accept": list(accept), "why": why}

def S(q, right, wrong, why, hard=False):
    assert len(wrong) == 4
    return {"kind": "sba", "tier": "first" if hard else "exam", "q": q, "right": right, "wrong": list(wrong), "why": why}

T = {}
T[0] = [  # Cardiovascular system in health and disease
    V("Which coronary artery most commonly supplies the sinoatrial node?", "right coronary artery", ["RCA", "right coronary"],
      "In about 60% of people the SA nodal artery arises from the right coronary artery; in the rest it comes from the circumflex."),
    V("Which heart sound is produced by closure of the aortic and pulmonary valves?", "second heart sound", ["S2", "second sound"],
      "S1 is closure of the mitral and tricuspid valves at the start of systole; S2 is closure of the aortic and pulmonary valves at its end."),
    V("What is the volume of blood ejected by the left ventricle in one beat called?", "stroke volume", ["SV"],
      "Stroke volume = end-diastolic volume minus end-systolic volume. Cardiac output = stroke volume x heart rate."),
    V("Which ECG wave represents ventricular repolarisation?", "T wave", ["T"],
      "P = atrial depolarisation, QRS = ventricular depolarisation, T = ventricular repolarisation."),
    S("A 62-year-old man has had crushing central chest pain for 40 minutes. His ECG shows ST elevation in leads II, III and aVF. Which artery is most likely to be occluded?",
      "Right coronary artery", ["Left anterior descending artery", "Left circumflex artery", "Left main stem", "Obtuse marginal artery"],
      "II, III and aVF look at the inferior wall, which is usually supplied by the right coronary artery (right-dominant in about 80%). LAD occlusion gives anterior changes in V1-V4."),
    S("A 25-year-old woman stands up quickly after lying down. Which immediate response helps maintain her blood pressure?",
      "Increased sympathetic outflow to the heart and arterioles", ["Increased vagal activity to the SA node", "Release of atrial natriuretic peptide", "Reduced renin secretion", "Increased firing of carotid sinus baroreceptors"],
      "Standing pools blood in the legs, so blood pressure and baroreceptor firing fall. The reflex lowers vagal tone and raises sympathetic outflow: heart rate, contractility and vasoconstriction rise."),
    S("During which phase of the cardiac cycle are all four heart valves closed while ventricular pressure is rising?",
      "Isovolumetric contraction", ["Rapid ejection", "Isovolumetric relaxation", "Rapid ventricular filling", "Atrial systole"],
      "After the AV valves close, the ventricles contract against closed semilunar valves until pressure exceeds aortic pressure. In isovolumetric relaxation the valves are also closed, but pressure is falling."),
    S("A 70-year-old man is started on ramipril for hypertension. Two weeks later his creatinine has risen from 95 to 160 µmol/L. Which underlying condition is most likely?",
      "Bilateral renal artery stenosis", ["Primary hyperaldosteronism", "Phaeochromocytoma", "Coarctation of the aorta", "Cushing's syndrome"],
      "With bilateral renal artery stenosis, GFR depends on angiotensin II constricting the efferent arteriole. ACE inhibitors remove this, so GFR falls and creatinine rises sharply (a rise of more than 30% means stop and investigate).", hard=True),
]
T[1] = [  # Respiratory system and gas exchange
    V("Which cells produce pulmonary surfactant?", "type II pneumocytes", ["type 2 pneumocytes", "type II alveolar cells", "type 2 alveolar cells", "type II alveolar epithelial cells"],
      "Type II pneumocytes secrete surfactant, which lowers surface tension and stops small alveoli collapsing. Type I pneumocytes form the thin gas-exchange surface."),
    V("What is the volume of air left in the lungs after a maximal expiration called?", "residual volume", ["RV"],
      "Residual volume can't be measured by spirometry; it needs body plethysmography or gas dilution. It rises in obstructive disease due to air trapping."),
    V("Where are the central chemoreceptors that respond to carbon dioxide located?", "medulla oblongata", ["medulla", "ventral medulla", "ventral surface of the medulla"],
      "Central chemoreceptors near the ventral surface of the medulla respond to the fall in CSF pH caused by a rise in PaCO2. Peripheral chemoreceptors (carotid and aortic bodies) respond mainly to low PaO2."),
    V("Which spirometry ratio is below 0.7 in obstructive lung disease?", "FEV1/FVC", ["FEV1:FVC", "FEV1 FVC", "FEV1/FVC ratio", "FEV1 to FVC ratio"],
      "An FEV1/FVC ratio below 0.7 shows airflow obstruction (asthma, COPD). In restrictive disease both fall, so the ratio is normal or high."),
    S("Which change shifts the oxyhaemoglobin dissociation curve to the right?",
      "Increased 2,3-bisphosphoglycerate", ["Decreased temperature", "Alkalosis", "Decreased PaCO2", "Carbon monoxide poisoning"],
      "A right shift (lower affinity, easier unloading) is caused by raised CO2, acidosis, heat and 2,3-BPG: the Bohr effect helps deliver oxygen to active tissue. Cold, alkalosis, low CO2 and carbon monoxide shift it left."),
    S("A 19-year-old has episodes of wheeze and night-time cough. Spirometry shows obstruction, and her FEV1 rises by 18% after salbutamol. What is the most likely diagnosis?",
      "Asthma", ["Chronic obstructive pulmonary disease", "Bronchiectasis", "Idiopathic pulmonary fibrosis", "Sarcoidosis"],
      "Significant reversibility after a bronchodilator in a young person with variable symptoms points to asthma. COPD gives largely fixed obstruction in older smokers; fibrosis is restrictive."),
    S("In an upright healthy lung, which region has the highest ventilation/perfusion ratio?",
      "Apex", ["Base", "Hilum", "Right middle lobe", "It is the same in all regions"],
      "Both ventilation and perfusion are greater at the base, but perfusion falls more steeply up the lung because of gravity, so V/Q is highest at the apex and lowest at the base."),
    S("A 68-year-old man with COPD has these arterial blood gases on air: pH 7.31, PaCO2 8.2 kPa, PaO2 7.1 kPa, HCO3- 31 mmol/L. Which best describes them?",
      "Type 2 respiratory failure with partly compensated respiratory acidosis", ["Type 1 respiratory failure", "Metabolic acidosis with respiratory compensation", "Respiratory alkalosis with metabolic compensation", "Fully compensated respiratory acidosis"],
      "Low pH with high PaCO2 is respiratory acidosis. A raised bicarbonate shows renal compensation from chronic CO2 retention, but pH is still low, so it is acute-on-chronic. PaO2 under 8 kPa with high PaCO2 is type 2 failure.", hard=True),
]
T[2] = [  # Renal system, fluid and electrolyte balance
    V("Which part of the nephron reabsorbs most of the filtered sodium?", "proximal convoluted tubule", ["PCT", "proximal tubule", "proximal convoluted tubules"],
      "The proximal convoluted tubule reabsorbs about two-thirds of filtered sodium and water, plus almost all glucose and amino acids."),
    V("Which posterior pituitary hormone increases water reabsorption in the collecting duct?", "ADH", ["antidiuretic hormone", "vasopressin", "arginine vasopressin", "AVP"],
      "ADH acts on V2 receptors in the collecting duct, inserting aquaporin-2 channels so more water is reabsorbed."),
    V("Which enzyme, released by juxtaglomerular cells, starts the renin-angiotensin-aldosterone system?", "renin", [],
      "Renin converts angiotensinogen to angiotensin I; ACE in the lungs converts angiotensin I to angiotensin II."),
    V("Which transporter in the thick ascending limb do loop diuretics such as furosemide block?", "NKCC2", ["Na-K-2Cl cotransporter", "Na K 2Cl cotransporter", "sodium potassium chloride cotransporter", "NKCC", "Na+/K+/2Cl- cotransporter"],
      "Loop diuretics block the Na-K-2Cl cotransporter (NKCC2) in the thick ascending limb of the loop of Henle, which makes them powerful diuretics."),
    S("A 70-year-old man with acute kidney injury has a serum potassium of 7.1 mmol/L and peaked T waves on his ECG. Which treatment should be given first?",
      "Intravenous calcium gluconate", ["Intravenous insulin with glucose", "Nebulised salbutamol", "Oral calcium resonium", "Urgent haemodialysis"],
      "With ECG changes, IV calcium is given first to stabilise the myocardium. It doesn't lower potassium, so insulin with glucose (and salbutamol) follow to shift potassium into cells."),
    S("An 80-year-old woman has had diarrhoea and vomiting for 3 days. Her blood pressure is 92/60 mmHg, urea 18 mmol/L and creatinine 150 µmol/L (baseline 80). What is the most likely cause of her kidney injury?",
      "Pre-renal injury from hypovolaemia", ["Post-renal obstruction", "Acute interstitial nephritis", "Rapidly progressive glomerulonephritis", "Renal artery stenosis"],
      "Fluid loss with hypotension reduces renal perfusion. A urea rise out of proportion to creatinine also suggests a pre-renal cause. If perfusion isn't restored it can progress to acute tubular necrosis."),
    S("Which acid-base disturbance does prolonged vomiting typically cause?",
      "Metabolic alkalosis", ["Metabolic acidosis with a raised anion gap", "Respiratory acidosis", "Respiratory alkalosis", "Metabolic acidosis with a normal anion gap"],
      "Vomiting loses gastric hydrochloric acid. The alkalosis is maintained by volume depletion and hypokalaemia, which make the kidney hold on to bicarbonate."),
    S("A 20-year-old woman with type 1 diabetes has vomiting and deep, rapid breathing. Results: pH 7.20, Na+ 140, Cl- 100, HCO3- 10 mmol/L. What is the most likely cause of her acid-base disturbance?",
      "Diabetic ketoacidosis", ["Severe diarrhoea", "Type 1 renal tubular acidosis", "Prolonged vomiting", "Anxiety-related hyperventilation"],
      "The anion gap is 140 - (100 + 10) = 30 mmol/L, well above normal: a raised anion gap metabolic acidosis, here from ketones. Diarrhoea and renal tubular acidosis give a normal anion gap; vomiting gives alkalosis.", hard=True),
]
T[3] = [  # Gastrointestinal system and nutrition
    V("Which cells in the gastric glands secrete hydrochloric acid?", "parietal cells", ["oxyntic cells", "parietal"],
      "Parietal cells secrete acid through the H+/K+ ATPase (the target of proton pump inhibitors) and also make intrinsic factor."),
    V("In which part of the gut is vitamin B12 absorbed?", "terminal ileum", ["distal ileum", "ileum"],
      "B12 binds intrinsic factor and is absorbed in the terminal ileum, so ileal disease or resection (e.g. Crohn's) can cause B12 deficiency."),
    V("Which duodenal hormone, released in response to fat, causes the gallbladder to contract?", "cholecystokinin", ["CCK"],
      "Cholecystokinin is released by I cells in the duodenum. It contracts the gallbladder, relaxes the sphincter of Oddi and stimulates pancreatic enzyme secretion."),
    V("Which enzyme in saliva begins the digestion of starch?", "salivary amylase", ["amylase", "alpha-amylase", "alpha amylase", "ptyalin"],
      "Salivary amylase starts breaking starch down into smaller sugars; pancreatic amylase continues this in the small intestine."),
    S("Where in the gut is dietary iron mainly absorbed?",
      "Duodenum", ["Stomach", "Terminal ileum", "Ascending colon", "Descending colon"],
      "Iron is absorbed mainly in the duodenum (and upper jejunum), helped by stomach acid reducing it to the ferrous form. B12 and bile salts are absorbed in the terminal ileum."),
    S("A 45-year-old woman has constant right upper quadrant pain for 2 days after a fatty meal. Her temperature is 38.5°C and Murphy's sign is positive. She is not jaundiced. What is the most likely diagnosis?",
      "Acute cholecystitis", ["Biliary colic", "Ascending cholangitis", "Acute pancreatitis", "Perforated peptic ulcer"],
      "Constant RUQ pain with fever and a positive Murphy's sign suggests gallbladder inflammation. Biliary colic has no fever; cholangitis usually adds jaundice (Charcot's triad)."),
    S("A patient has jaundice with pale stools, dark urine and itching. Which type of jaundice is most likely?",
      "Post-hepatic (obstructive) jaundice", ["Pre-hepatic (haemolytic) jaundice", "Gilbert's syndrome", "Physiological neonatal jaundice", "Crigler-Najjar syndrome"],
      "Blocked bile flow keeps conjugated bilirubin out of the gut (pale stools) and sends it into urine (dark urine); retained bile salts cause itch. Haemolysis and Gilbert's raise unconjugated bilirubin, which doesn't darken urine."),
    S("A 70-year-old man has painless jaundice and weight loss. Results: bilirubin 98 µmol/L, ALP 620 U/L (30-130), GGT 480 U/L, ALT 65 U/L. What is the most likely cause?",
      "Carcinoma of the head of the pancreas", ["Hepatitis A infection", "Gilbert's syndrome", "Haemolytic anaemia", "Alcoholic hepatitis"],
      "ALP and GGT far higher than ALT is a cholestatic (obstructive) pattern. Painless jaundice with weight loss in an older patient suggests a pancreatic head tumour blocking the common bile duct.", hard=True),
]
T[4] = [  # Endocrine system and metabolic homeostasis
    V("Which cells of the pancreatic islets secrete insulin?", "beta cells", ["B cells", "beta", "beta islet cells"],
      "Beta cells secrete insulin; alpha cells secrete glucagon and delta cells secrete somatostatin."),
    V("Which anterior pituitary hormone stimulates the adrenal cortex to produce cortisol?", "ACTH", ["adrenocorticotropic hormone", "adrenocorticotrophic hormone", "corticotropin", "adrenocorticotrophin"],
      "Hypothalamic CRH stimulates ACTH release, and ACTH stimulates cortisol secretion from the zona fasciculata. Cortisol feeds back negatively on both."),
    V("Which thyroid hormone is the main active form in the tissues?", "T3", ["triiodothyronine", "tri-iodothyronine", "liothyronine"],
      "The thyroid releases mostly T4, which is converted to the more active T3 in peripheral tissues by deiodinase enzymes."),
    V("What HbA1c value (in mmol/mol) is the threshold for diagnosing type 2 diabetes?", "48 mmol/mol", ["48"],
      "An HbA1c of 48 mmol/mol (6.5%) or above supports a diagnosis of type 2 diabetes; without symptoms, it is repeated to confirm."),
    S("A 45-year-old woman has tiredness, weight gain and cold intolerance. TSH is 12 mU/L (0.4-4.0) and free T4 is 6 pmol/L (9-25). What is the most likely diagnosis?",
      "Primary hypothyroidism", ["Secondary (pituitary) hypothyroidism", "Subclinical hypothyroidism", "Graves' disease", "Non-thyroidal illness (sick euthyroid)"],
      "Low T4 with a high TSH means the thyroid itself is failing and the pituitary is driving it harder. In secondary hypothyroidism TSH is low or inappropriately normal; in subclinical hypothyroidism T4 is normal."),
    S("Which test is used first to screen for Cushing's syndrome?",
      "Overnight dexamethasone suppression test", ["Short Synacthen test", "Random serum cortisol", "Plasma ACTH level alone", "CT scan of the adrenal glands"],
      "In a normal person, 1 mg of dexamethasone at night suppresses morning cortisol; failure to suppress suggests Cushing's. The short Synacthen test is for adrenal insufficiency, and imaging comes only after biochemical confirmation."),
    S("A 17-year-old has thirst, weight loss and vomiting. Glucose is 28 mmol/L, blood ketones 4.5 mmol/L and pH 7.15. Which treatment should be started first?",
      "Intravenous 0.9% sodium chloride", ["Subcutaneous long-acting insulin", "Intravenous sodium bicarbonate", "Oral metformin", "Intravenous 50% glucose"],
      "In diabetic ketoacidosis, fluid replacement with 0.9% sodium chloride comes first, followed by a fixed-rate IV insulin infusion. Bicarbonate is not routinely used."),
    S("A 35-year-old woman has fatigue, dizziness on standing and darker skin creases. BP is 92/58 mmHg. Results: Na+ 128 mmol/L, K+ 5.9 mmol/L, glucose 3.4 mmol/L. What is the most likely diagnosis?",
      "Primary adrenal insufficiency (Addison's disease)", ["Syndrome of inappropriate ADH secretion", "Primary hyperaldosteronism", "Cushing's syndrome", "Hypothyroidism"],
      "Low sodium with high potassium, low glucose and low blood pressure points to cortisol and aldosterone deficiency. Pigmentation comes from high ACTH. SIADH doesn't raise potassium; hyperaldosteronism causes hypertension and low potassium.", hard=True),
]
T[5] = [  # Musculoskeletal and nervous system function
    V("Which ion binds to troponin C to trigger skeletal muscle contraction?", "calcium", ["Ca2+", "Ca", "calcium ions", "calcium ion"],
      "Calcium released from the sarcoplasmic reticulum binds troponin C, shifting tropomyosin so myosin heads can bind actin."),
    V("Damage to which nerve at the neck of the fibula causes foot drop?", "common fibular nerve", ["common peroneal nerve", "common peroneal", "common fibular", "peroneal nerve", "fibular nerve"],
      "The common fibular (peroneal) nerve winds around the fibular neck, where it is easily injured. Losing ankle dorsiflexion causes foot drop."),
    V("Which neurotransmitter is released at the neuromuscular junction?", "acetylcholine", ["ACh"],
      "Acetylcholine acts on nicotinic receptors on the motor end plate. Myasthenia gravis is caused by antibodies against these receptors."),
    V("Which spinal nerve root is mainly tested by the biceps reflex?", "C5", ["C5/C6", "C5-C6", "C5 and C6", "C5 C6", "C6"],
      "Biceps reflex: C5 (and C6). Supinator: C6. Triceps: C7. Knee: L3/L4. Ankle: S1."),
    S("A 60-year-old has weakness of the right arm with increased tone, brisk reflexes and an upgoing plantar response on the right. Where is the lesion?",
      "Upper motor neurone", ["Lower motor neurone", "Neuromuscular junction", "Peripheral nerve", "Muscle"],
      "Spasticity, hyperreflexia and an extensor plantar response are upper motor neurone signs. Lower motor neurone lesions cause wasting, fasciculation, low tone and reduced reflexes."),
    S("Which receptor mainly mediates the rise in heart rate caused by noradrenaline?",
      "Beta-1 adrenoceptor", ["Alpha-1 adrenoceptor", "Beta-2 adrenoceptor", "M2 muscarinic receptor", "Nicotinic receptor"],
      "Beta-1 receptors on the SA node and myocardium increase heart rate and contractility. M2 receptors mediate the vagal slowing of the heart; alpha-1 receptors cause vasoconstriction."),
    S("A 30-year-old woman has drooping eyelids and double vision that get worse towards the end of the day. What is the most likely diagnosis?",
      "Myasthenia gravis", ["Multiple sclerosis", "Guillain-Barré syndrome", "Lambert-Eaton myasthenic syndrome", "Bell's palsy"],
      "Weakness that gets worse with use (fatigability), often starting in the eye muscles, is typical of myasthenia gravis. In Lambert-Eaton syndrome, strength briefly improves with repeated use."),
    S("After a fracture of the shaft of the humerus, a man cannot extend his wrist and has numbness over the back of the hand near the first web space. Which nerve is injured?",
      "Radial nerve", ["Ulnar nerve", "Median nerve", "Axillary nerve", "Musculocutaneous nerve"],
      "The radial nerve runs in the radial (spiral) groove of the humeral shaft. Injury there causes wrist drop and sensory loss over the dorsal first web space.", hard=True),
]
T[6] = [  # Immunity, infection and haematology
    V("Which class of immunoglobulin crosses the placenta?", "IgG", ["immunoglobulin G"],
      "IgG is actively transported across the placenta, giving the newborn passive immunity for the first few months."),
    V("Which cells are the most effective at presenting antigen to naive T cells?", "dendritic cells", ["dendritic", "dendritic cell"],
      "Dendritic cells take up antigen in tissues, travel to lymph nodes and present it with co-stimulatory signals to activate naive T cells."),
    V("Deficiency of which vitamin causes a megaloblastic anaemia with neurological signs?", "vitamin B12", ["B12", "cobalamin", "vitamin B12 deficiency"],
      "B12 and folate deficiency both cause megaloblastic anaemia, but only B12 deficiency causes neurological damage (e.g. subacute combined degeneration of the cord)."),
    V("Which blood test is used to monitor warfarin treatment?", "INR", ["international normalised ratio", "international normalized ratio", "PT/INR", "prothrombin time"],
      "Warfarin blocks vitamin K-dependent clotting factors (II, VII, IX, X), prolonging the prothrombin time. It is reported as the INR."),
    S("A 34-year-old woman with heavy periods has Hb 92 g/L, MCV 71 fL and a low ferritin. What is the most likely diagnosis?",
      "Iron deficiency anaemia", ["Anaemia of chronic disease", "Beta-thalassaemia trait", "Vitamin B12 deficiency", "Autoimmune haemolytic anaemia"],
      "A microcytic anaemia with low ferritin means iron deficiency, here from menstrual blood loss. Ferritin is normal or raised in anaemia of chronic disease and normal in thalassaemia trait."),
    S("A 12-year-old has hives, wheeze and lip swelling within minutes of eating peanuts. Which type of hypersensitivity reaction is this?",
      "Type I (IgE-mediated)", ["Type II (antibody against cell-surface antigens)", "Type III (immune complex)", "Type IV (delayed, T cell-mediated)", "Type V (stimulating antibodies)"],
      "Allergen cross-links IgE on mast cells, which release histamine and other mediators within minutes. Type IV reactions take 48-72 hours."),
    S("An adult develops anaphylaxis after a wasp sting. What is the first drug to give?",
      "Intramuscular adrenaline", ["Intravenous chlorphenamine", "Intravenous hydrocortisone", "Nebulised salbutamol", "Oral cetirizine"],
      "Intramuscular adrenaline (500 micrograms for an adult) is first-line in anaphylaxis and is repeated after 5 minutes if needed. Antihistamines and steroids are not first-line treatments."),
    S("A 45-year-old man with sepsis is bleeding from cannula sites. Platelets are 40 x10^9/L, PT and APTT are both prolonged, fibrinogen is low and D-dimer is very high. What is the most likely diagnosis?",
      "Disseminated intravascular coagulation", ["Immune thrombocytopenic purpura", "Haemophilia A", "Vitamin K deficiency", "Von Willebrand disease"],
      "Widespread clotting uses up platelets and clotting factors (low platelets and fibrinogen, long PT and APTT), while fibrinolysis raises D-dimer. ITP causes low platelets only; haemophilia A prolongs only the APTT.", hard=True),
]
T[7] = [  # Clinical skills, professionalism and public health
    V("Which principle of medical ethics means “do no harm”?", "non-maleficence", ["nonmaleficence", "non maleficence"],
      "The four principles are autonomy, beneficence, non-maleficence and justice."),
    V("Which Act sets the legal framework in England and Wales for decisions about adults who lack capacity?", "Mental Capacity Act 2005", ["Mental Capacity Act", "MCA", "MCA 2005"],
      "The Mental Capacity Act 2005 starts from a presumption of capacity. Decisions made for someone who lacks capacity must be in their best interests and as unrestrictive as possible."),
    V("What is the proportion of people with a disease who test positive called?", "sensitivity", ["test sensitivity"],
      "Sensitivity = true positives / all with the disease. Specificity = true negatives / all without the disease."),
    V("What is the number of new cases of a disease in a population over a given period called?", "incidence", ["incidence rate"],
      "Incidence counts new cases over a period; prevalence is the proportion of a population who have the disease at a point in time."),
    S("Under the Mental Capacity Act 2005, what must a person be able to do to have capacity for a decision?",
      "Understand, retain and weigh the information, and communicate a decision", ["Agree with the recommended treatment", "Have no diagnosed mental illness", "Be accompanied by a relative", "Remember the conversation the next day"],
      "Capacity is decision-specific. A person must be able to understand, retain, use or weigh the information, and communicate their decision. An unwise decision does not by itself mean a lack of capacity."),
    S("A patient with poorly controlled epilepsy says he is still driving. What should his doctor do first?",
      "Tell him he must stop driving and inform the DVLA", ["Inform the DVLA straight away without telling him", "Inform the police", "Do nothing, to keep his confidence", "Inform his employer"],
      "GMC guidance: first make sure the patient understands he must stop driving and that he is legally required to tell the DVLA. If he refuses, the doctor tells him they will disclose, then informs the DVLA's medical adviser."),
    S("Which study design gives the strongest evidence that a new drug causes an improvement in outcome?",
      "Randomised controlled trial", ["Prospective cohort study", "Case-control study", "Cross-sectional survey", "Case series"],
      "Randomisation spreads known and unknown confounders evenly between groups, so differences in outcome can be put down to the treatment."),
    S("A new test is positive in 90 of 100 people with a disease, and negative in 160 of 200 people without it. What is its specificity?",
      "80%", ["90%", "69%", "94%", "64%"],
      "Specificity = true negatives / all without the disease = 160 / 200 = 80%. Sensitivity is 90/100 = 90%; PPV is 90/130 = 69%; NPV is 160/170 = 94%.", hard=True),
]

TITLES = {0: "Cardiovascular system in health and disease", 1: "Respiratory system and gas exchange", 2: "Renal system, fluid and electrolyte balance",
          3: "Gastrointestinal system and nutrition", 4: "Endocrine system and metabolic homeostasis", 5: "Musculoskeletal and nervous system function",
          6: "Immunity, infection and haematology", 7: "Clinical skills, professionalism and public health"}

def lit(v):
    return "null" if v is None else "$q$" + str(v) + "$q$"

rows = []
for pos in sorted(T):
    for it in T[pos]:
        if it["kind"] == "vsa":
            rows.append((pos, it["tier"], "vsa", it["q"], it["a"], None, json.dumps(it["accept"], ensure_ascii=False) if it["accept"] else None, it["why"]))
        else:
            opts = [it["right"]] + it["wrong"]
            random.shuffle(opts)
            letter = "ABCDE"[opts.index(it["right"])]
            rows.append((pos, it["tier"], "sba", it["q"], letter, json.dumps(opts, ensure_ascii=False), None, it["why"]))

print("-- " + CODE + ": " + str(len(rows)) + " instant questions")
print("do $$ declare p int; begin")
print(f"if exists (select 1 from module_questions where code = '{CODE}' and kind in ('sba','vsa')) then raise exception 'already has instant questions'; end if;")
print(f"select coalesce(max(position), -1) + 1 into p from module_questions where code = '{CODE}';")
print("insert into module_questions (code, position, topic_pos, topic, tier, kind, question, answer, options, accept, explain) values")
vals = []
for i, (pos, tier, kind, q, a, opts, acc, why) in enumerate(rows):
    vals.append(f"('{CODE}', p + {i}, {pos}, {lit(TITLES[pos])}, '{tier}', '{kind}', {lit(q)}, {lit(a)}, {lit(opts)}::jsonb, {lit(acc)}::jsonb, {lit(why)})")
print(",\n".join(vals) + ";")
print(f"insert into instant_jobs (code, status, finished_at) values ('{CODE}', 'done', now()) on conflict (code) do update set status = 'done', finished_at = now();")
print("end $$;")
