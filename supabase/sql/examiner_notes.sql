-- Examiner notes (Nov 2026): short, subject-level notes on what real examiners reward and penalise, written in our
-- own words from published examiners' reports and marking guides (sources listed per row). The marker adds the
-- general note plus up to 2 notes whose pattern matches the module's department, after the grade descriptors.
-- Edit or add rows any time; no redeploy needed.

create table if not exists public.examiner_notes (
  subject text primary key,
  dept_pattern text,            -- case-insensitive regex on ucl_modules.department; null = applies to every module
  body text not null,
  sources text[] not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.examiner_notes enable row level security;  -- no policies: service role only

create or replace function public.notes_for(p_department text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('subject', subject, 'body', body) order by (dept_pattern is null) desc, subject), '[]'::jsonb)
  from (
    (select subject, dept_pattern, body from examiner_notes where active and dept_pattern is null)
    union all
    (select subject, dept_pattern, body from examiner_notes
      where active and dept_pattern is not null and coalesce(p_department, '') ~* dept_pattern order by subject limit 2)
  ) x
$$;
revoke all on function public.notes_for(text) from public, anon, authenticated;

insert into public.examiner_notes (subject, dept_pattern, body, sources) values
('general', null,
$t$How real first-year marks are spread: in published first-year results at selective UK universities, most scripts land between 60 and 69; roughly one in five reaches 70+; marks of 75+ are rare and reserved for exceptional work; marks below 50 are uncommon and go to answers with no sustained argument or serious gaps. So a competent, accurate, relevant answer is normally a 2:1 (60-67), not a First. External examiners also warn against bunching: when an answer genuinely is outstanding, give a high First (75-80), and when it is weak, go into the low 50s rather than hedging at 58-62.
Across subjects, examiners mark down: answers that dump general course material instead of answering the specific question (no credit for irrelevant knowledge, however accurate); recycled lecture notes or prepared essays bent to fit; description in place of argument; vague gestures ("some scholars argue"); and an uneven script where the last part is rushed. They reward: defining the question's key terms, stating a position early and defending it, weighing the limits of your own argument, and precise, specific evidence.$t$,
 array['https://www.law.ox.ac.uk/sites/default/files/inline-files/Mods%20Examiners%27%20Report%202025.pdf',
       'https://ohh.web.ox.ac.uk/sitefiles/history-prelims-2025-examiners-report.pdf',
       'https://www.polis.cam.ac.uk/files/examiners_reports_2019-2020.pdf',
       'https://www.maths.ox.ac.uk/system/files/inline-files/2025_Prelims_CMAP_PublicExaminersReport%20-%20Copy.pdf']),

('law', 'law',
$t$Law examiners: in problem questions, identify every issue raised by each set of facts (deal with each party/scenario separately), state the rule with the leading authority, then apply it to these facts and reach a conclusion. The commonest faults are misidentifying the area of law, missing a key fact, applying the right case to the wrong issue, and spending time on irrelevant doctrine (e.g. discussing offer and acceptance when the issue is consideration). Reciting case facts or listing case names without analysis earns little; saying "there is a case on this" without naming it earns very little. In essays, the best answers clarify what the question asks, state their answer, then defend it, engage with the different judgments in leading cases and with later case law and statute, and place the rule in its wider doctrinal or constitutional scheme. Generic essays on the topic, or answers that ignore the quotation set, stay in the 2:2/low 2:1 range. Missing recent leading authority weakens an otherwise good answer.$t$,
 array['https://www.law.ox.ac.uk/sites/default/files/inline-files/Mods%20Examiners%27%20Report%202025.pdf',
       'https://www.scribd.com/document/436159454/contract-report-2019-A-pdf',
       'https://www.scribd.com/document/485527399/contract-report-2013-B',
       'https://www.scribd.com/document/520083671/Contract-Report-2017-B',
       'https://www.some.ox.ac.uk/wp-content/uploads/2020/09/Somerville-Law-Induction-Course-2020-Materials-for-Session-3-Study-Skills-Part-A.pdf']),

('economics', 'econ|financ|accounting',
$t$Economics examiners: answers must explain, not just assert; a correct conclusion with no mechanism gets limited credit. Strong answers set up the model correctly (state assumptions, draw and label diagrams accurately, show the algebra), then interpret the result in words and apply it to the question. Typical lost marks: misstating standard results (e.g. Ricardian equivalence, the Solow model's steady state), confused or unlabelled diagrams, listing limitations without saying how each biases the conclusion, and including irrelevant material. Evaluation that reaches a first-class mark weighs conditions (short run vs long run, elasticities, who bears the effect), uses evidence or data, and commits to a judgement. Quantitative parts: full working, correct units, and a check that the answer makes economic sense.$t$,
 array['https://ohh.web.ox.ac.uk/sitefiles/heco-prelims-examiners-report-2024.pdf',
       'https://www.scribd.com/document/671029257/EC1002-Commentary-2022']),

('politics_social', 'politic|government|international relations|social policy|sociolog|anthropolog|geograph|society',
$t$Politics and social science examiners: First-class answers take a definite position and sustain a clear, consistent argument; show close knowledge of the core texts and engage critically with the secondary debate, including its limits; and pair conceptual work with concrete empirical cases (answers without specific examples are marked down). They stay tightly on the question as set. Lower marks go to answers that summarise readings without developing a position, offer a generic overview or answer a neighbouring question, string together quotations without analysis, or are overly deferential to established authors. A 2:1 that just misses a First is usually consistent but unoriginal, or has one strong section dragged down by a weaker one.$t$,
 array['https://www.polis.cam.ac.uk/files/examiners_reports_2019-2020.pdf']),

('history', 'histor',
$t$History examiners: the best essays are evaluative, not descriptive, with a clear argument built from close reading of specific primary evidence and placed in the historiographical debate (named historians and positions, not "some historians"). They define the question's key terms and engage with its exact wording; comparisons are used to illuminate the question, not just set side by side. Indicative marks: around 58 = good points but only partly answers the question, leans on description, some unsupported claims, narrow or weak sources; around 65 = clear, coherent argument with the right sources but analysis not fully developed and sources used as evidence without much interrogation; around 74 = nuanced, focused argument from critical analysis of sources that challenges or extends the debate, fluent with a distinct voice. Weak features: recycled tutorial or lecture material, drifting to a neighbouring topic, unexplained narrowing of scope, simplistic claims about bias, unfinished answers.$t$,
 array['https://ohh.web.ox.ac.uk/sitefiles/history-prelims-2025-examiners-report.pdf',
       'https://warwick.ac.uk/fac/arts/history/studenthub/assessment/ugmarkingcriteria/']),

('philosophy', 'philosoph',
$t$Philosophy examiners: answer the question as asked; dumping general course material earns nothing. Strong answers are precise about key terms (say exactly what the concept means before using it), distinguish closely related notions, reconstruct the strongest version of the view they attack, track the central claim and its main objections closely, and engage with the relevant literature in depth. First-class marks need independent thought: a clear thesis defended against objections, not a survey of positions. Typical 2:1 answers are accurate but expository; 2:2 answers are loosely structured, imprecise, or only partly relevant.$t$,
 array['https://www.maths.ox.ac.uk/system/files/inline-files/2025_Prelims_CMAP_PublicExaminersReport%20-%20Copy.pdf',
       'https://www.ucl.ac.uk/arts-humanities/philosophy/current-students/marking-criteria']),

('quantitative', 'math|statist|physics|engineer|material|chemi|comput|data',
$t$Maths, science and engineering examiners: state definitions and theorems fully and correctly, including their assumptions, and check the assumptions hold before applying them (e.g. independence, conditions of a limit theorem). Justify each step where justification is asked for; a bare answer gets little credit. Explain the physical or chemical mechanism, not just the formula. Common lost marks: incomplete statements of standard results, missed cases (e.g. a critical point where a multiplier is zero, or solutions outside the domain), algebra slips, missing or wrong units, orders-of-magnitude errors, unlabelled or wrong diagrams and sketches, undefined boundary conditions, and not stating where a maximum occurs. Efficient methods are rewarded. First-class answers solve unfamiliar set-ups correctly and completely; a diligent average answer to a well-set first-year paper sits in the low-to-mid 60s.$t$,
 array['https://www.maths.ox.ac.uk/system/files/inline-files/2025_Prelims_CMAP_PublicExaminersReport%20-%20Copy.pdf',
       'https://www.materials.ox.ac.uk/sitefiles/materials-examiners-reports-2025-redacted.pdf']),

('life_sciences', 'bio|life science|medic|psycholog|neuro|pharma|dent|health',
$t$Life sciences, psychology and medicine examiners: essay answers need accurate mechanism at the right level of detail (molecules, cells, pathways, experiments), organised around the question rather than a recall of everything on the topic. Strong answers cite specific experimental evidence and say what it shows and its limits, link levels of explanation (gene to phenotype, brain to behaviour), and evaluate competing explanations. Exam answers that repeat lectures without critical engagement are competent but derivative (2:1 at best). Common lost marks: vague or inaccurate terminology, describing a study without its findings or relevance, unexplained diagrams, and claims with no evidence. In data or short-answer parts, justify each answer and link it to the scenario given.$t$,
 array['https://www.hps.cam.ac.uk/files/partii2024-report.pdf',
       'https://www.materials.ox.ac.uk/sitefiles/materials-examiners-reports-2025-redacted.pdf']),

('business', 'business|management|marketing',
$t$Business and management examiners: answers must apply theory to the case or context in the question; generic textbook answers that could be about any firm score low. Strong answers use a framework accurately, then analyse the specific situation with evidence, consider more than one perspective (stakeholders, short vs long term, contingency), and reach a justified recommendation. Common faults: describing models without using them, unsupported assertions, and not addressing the exact question asked.$t$,
 array['https://qualifications.pearson.com/content/dam/pdf/A-Level/Business/2015/Exam-materials/9BS0_01_pef_20201217.pdf',
       'https://www.scribd.com/document/483297128/commercial-report-2014-A'])
on conflict (subject) do update set dept_pattern = excluded.dept_pattern, body = excluded.body, sources = excluded.sources, updated_at = now();
