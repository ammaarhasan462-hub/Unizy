-- Marking coverage (17 Nov 2026): no packs needed, every module benefits.
-- 1. King's had no marking criteria at all (marking_rubrics had no 'kcl' rows), so King's answers were marked with no
--    criteria. Add King's generic undergraduate criteria, summarised in our own words from the College Marking Framework.
-- 2. Examiner notes for subjects that matched no note before (languages and literature, the built environment,
--    education, archaeology, clinical medicine), written in our own words from subject benchmark statements and
--    professional outcomes; widen the social-science pattern to departments it missed.
-- (Year-of-study expectations live in the marker itself: LEVEL_EXPECT in supabase/functions/marker/index.ts.)

insert into public.marking_rubrics (key, uni, department, title, body, source_url, source_note, updated_at) values
('kcl-college', 'kcl', null, 'King''s College Marking Framework: generic undergraduate criteria (Levels 4–6)',
$t$Apply best fit across four areas: knowledge and understanding; argument and analysis; use of sources and evidence; communication.
80–100 (high First): highly detailed, systematic knowledge informed by wide reading and awareness of competing theories; insightful, well-synthesised argument that may show originality; extensive, well-evaluated sources; excellent communication.
70–79 (First): thorough knowledge with critical awareness of contested ideas; critical, well-structured argument, with some originality at the higher levels; comprehensive sources applied well; very good communication.
60–69 (2:1): good knowledge, possibly with minor gaps or slips in terminology; coherent, critical argument with only minor lapses in synthesis; relevant sources used well; good, clear communication.
50–59 (2:2): understands the key ideas but with gaps or misunderstandings; often descriptive, clearly structured but with limited analysis, and the argument may lack coherence; mostly appropriate sources; communication mostly adequate.
40–49 (Third): general knowledge lacking detail or relevance; mainly descriptive, with flawed or incomplete analysis; basic use of sources; evident weaknesses in expression.
30–39 (marginal fail): limited understanding with inaccuracies; weak or unsupported argument; inadequate evidence.
Below 30: major gaps; largely inaccurate or irrelevant; little analysis.
King's marks pieces on a step scale within each band (e.g. 72, 75 or 78 in the First band; 62, 65 or 68 in the 2:1 band), so place the answer low, mid or high within its band.$t$,
'https://www.kcl.ac.uk/assets/policyzone/assessment/college-marking-framework.pdf',
'Summarised in our own words from the College Marking Framework generic criteria and step-marking scheme.', now())
on conflict (key) do update set body = excluded.body, title = excluded.title, source_url = excluded.source_url, source_note = excluded.source_note, updated_at = now();

insert into public.examiner_notes (subject, dept_pattern, body, sources) values
('languages_literature', 'literat|english|european languages|modern languages|centre for languages|cultur|classic|greek|latin|film|music|theatre|drama|school of the arts|slavonic|translation|comparative',
$t$Literature, languages and culture examiners reward close reading: quote briefly and analyse how the language, form and structure of the text make meaning, rather than retelling the plot or paraphrasing. Answer the question's own terms with a clear thesis and a sustained argument, moving between close detail and wider context (historical, cultural, generic) only where it serves the argument. Use critical or theoretical perspectives to sharpen your own reading, not as name-dropping or a substitute for it. In language and translation answers, accuracy of grammar, vocabulary and register is assessed alongside content. Common faults: plot summary, biographical speculation, generalisations about "the reader", unsupported claims about the author's intention, and quotations left without analysis.$t$,
 array['https://www.qaa.ac.uk/the-quality-code/subject-benchmark-statements']),
('built_environment', 'architect|planning|construction|built environment|urban|landscape|real estate|environment, energy',
$t$Architecture, planning and built-environment examiners reward answers that tie design or policy decisions to evidence and context: precise reference to specific buildings, projects, places, policies or case studies (with dates and actors), correct technical vocabulary, and critical judgement about trade-offs such as cost, sustainability, equity, users and regulation. In history and theory answers, place the example in its intellectual and historical context and argue about its significance rather than describing it. In technical or environmental questions, show the working, state assumptions and units, and check the result is physically plausible. Weak answers stay generic ("sustainable design is important"), describe projects without analysis, or ignore the specific site, brief or policy in the question.$t$,
 array['https://www.qaa.ac.uk/the-quality-code/subject-benchmark-statements']),
('education', 'educat|pedagog|curriculum',
$t$Education examiners look for answers grounded in research evidence and theory rather than opinion or anecdote: name and accurately explain the relevant theories (of learning, development, assessment or policy), support claims with empirical studies and note their limits, and connect theory, policy and practice in the specific context the question sets (phase, country, learners). Strong answers weigh competing perspectives and ask who benefits and who is disadvantaged; weak ones generalise from personal experience, treat contested claims as settled, or describe policy without evaluating it.$t$,
 array['https://www.qaa.ac.uk/the-quality-code/subject-benchmark-statements']),
('archaeology', 'archaeolog|egyptolog|heritage',
$t$Archaeology examiners reward arguments built on specific evidence: named sites, assemblages, dates and methods, with an understanding of how the evidence was recovered and interpreted (excavation, survey, dating, scientific analysis) and what its limits are. Distinguish data from interpretation, weigh alternative explanations, and engage with the theoretical debates behind them. Weak answers list sites or periods descriptively, treat interpretations as facts, or ignore chronology and context.$t$,
 array['https://www.qaa.ac.uk/the-quality-code/subject-benchmark-statements']),
('clinical', 'medic|surg|clinical|nurs|dent|child health|ophthalm|epidemiolog|public health|mbbs',
$t$Medical and clinical examiners expect accurate, mechanistic explanations that link basic science to the clinical picture: anatomy and physiology to signs and symptoms, pathophysiology to investigations and management. Use correct terminology and units, give specific values or criteria where they matter (diagnostic thresholds, drug classes and mechanisms), and structure answers logically (definition, causes, mechanism, features, investigation, management). In case and data questions, interpret the findings given rather than listing every possibility, prioritise the most likely and the most dangerous causes, and justify each step. In epidemiology and public health, distinguish association from causation, name the study design and its biases, and quantify where possible. Factually wrong or unsafe clinical statements are heavily penalised.$t$,
 array['https://www.gmc-uk.org/education/standards-guidance-and-curricula/standards-and-outcomes/outcomes-for-graduates', 'https://www.qaa.ac.uk/the-quality-code/subject-benchmark-statements'])
on conflict (subject) do update set dept_pattern = excluded.dept_pattern, body = excluded.body, sources = excluded.sources;

update public.examiner_notes
   set dept_pattern = 'politic|government|international relations|social policy|sociolog|anthropolog|geograph|society|social research|information studies|science and technology studies|multidisciplinary|communication|media|development studies'
 where subject = 'politics_social';

-- Second pass: departments that still matched no subject note.
update public.examiner_notes set dept_pattern = dept_pattern || '|aeronaut|earth science' where subject = 'quantitative' and dept_pattern !~ 'aeronaut';
update public.examiner_notes set dept_pattern = dept_pattern || '|international studies|war studies|americas|security and crime|risk and disaster' where subject = 'politics_social' and dept_pattern !~ 'war studies';
update public.examiner_notes set dept_pattern = dept_pattern || '|learning and leadership' where subject = 'education' and dept_pattern !~ 'leadership';
update public.examiner_notes set dept_pattern = dept_pattern || '|language centre|language studies|hebrew|jewish|theolog|religio|digital humanities' where subject = 'languages_literature' and dept_pattern !~ 'theolog';
update public.examiner_notes set dept_pattern = dept_pattern || '|ear institute|audiolog' where subject = 'life_sciences' and dept_pattern !~ 'audiolog';
