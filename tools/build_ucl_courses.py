#!/usr/bin/env python3
"""Builds site/data/courses-ucl.json: every UCL undergraduate course with the module-code prefixes it draws on.

Course names come from UCL's official undergraduate course listing (ucl.ac.uk/study/prospective-students/undergraduate,
"Browse 436 courses A–Z", Nov 2026). The listing's L and T–Z sections were checked course by course on UCL's own course
pages. Each course is mapped to the UCL catalogue code prefixes for its subjects (e.g. Linguistics -> PLIN, French ->
FREN), which the dashboard uses to suggest that year's modules (level = year + 3). Students can always search and add
any other module, and a course that isn't here can be typed in.

Run: python3 tools/build_ucl_courses.py
"""
import json, re, os

COURSES = """
Ancient History BA
Ancient Languages BA
Anthropology BSc
Anthropology with Study Abroad BSc
Applied Medical Sciences BSc
Archaeology and Anthropology BA
Archaeology BA
Archaeology BSc
Archaeology with Placement Year BA
Archaeology with Study Abroad BA
Architectural and Interdisciplinary Studies BSc
Architectural and Interdisciplinary Studies with Study Abroad BSc
Architecture BSc
Architecture MSci
Art and Technology BA
Arts and Sciences (Cultures) BASc
Arts and Sciences (Cultures) with Study Abroad BASc
Arts and Sciences (Health and Environment) BASc
Arts and Sciences (Health and Environment) with Study Abroad BASc
Arts and Sciences (Sciences and Engineering) BASc
Arts and Sciences (Sciences and Engineering) with Study Abroad BASc
Arts and Sciences (Societies) BASc
Arts and Sciences (Societies) with Study Abroad BASc
Astrophysics BSc
Astrophysics MSci
Audiology BSc
Bachelor of Laws (UCL) and Bachelor of Laws (HKU) with Study Abroad LLB
Biochemical Engineering BEng
Biochemical Engineering MEng
Biochemistry BSc
Biochemistry MSci
Biological Sciences BSc
Biological Sciences MSci
Biomedical Engineering BEng
Biomedical Engineering MEng
Biomedical Sciences BSc
Bioprocessing of New Medicines (Business and Management) BSc
Bulgarian and Czech BA
Bulgarian and Danish BA
Bulgarian and Dutch BA
Bulgarian and East European Studies BA
Bulgarian and Finnish BA
Bulgarian and French BA
Bulgarian and German BA
Bulgarian and Hebrew BA
Bulgarian and Hungarian BA
Bulgarian and Italian BA
Bulgarian and Norwegian BA
Bulgarian and Polish BA
Bulgarian and Portuguese BA
Bulgarian and Romanian BA
Bulgarian and Russian BA
Bulgarian and Serbian/Croatian BA
Bulgarian and Spanish BA
Bulgarian and Swedish BA
Bulgarian and Ukrainian BA
Business and Health BSc
Business and Health MSci
Cancer Biomedicine BSc
Cancer Biomedicine MSci
Chemical Engineering BEng
Chemical Engineering MEng
Chemistry BSc
Chemistry MSci
Chemistry with Study Abroad MSci
Child Health Sciences BSc
Child Health Sciences MSci
Civil Engineering BEng
Civil Engineering MEng
Classical Archaeology and Classical Civilisation BA
Classics and Ancient Middle Eastern Studies BA
Classics and the Ancient World BA
Classics BA
Communications BA
Comparative Literature BA
Comparative Literature with Study Abroad BA
Computer Science and Mathematics MEng
Computer Science BSc
Computer Science MEng
Construction Engineering, Innovation and Leadership MEng
Construction Project Management MSci
Creative Arts and Humanities BA
Crime and Security Science BSc
Crime and Security Science MSci
Czech and Danish BA
Czech and Dutch BA
Czech and East European Studies BA
Czech and Finnish BA
Czech and French BA
Czech and German BA
Czech and Hebrew BA
Czech and Hungarian BA
Czech and Italian BA
Czech and Norwegian BA
Czech and Polish BA
Czech and Portuguese BA
Czech and Romanian BA
Czech and Russian BA
Czech and Serbian/Croatian BA
Czech and Spanish BA
Czech and Swedish BA
Czech and Ukrainian BA
Czech and Yiddish BA
Danish and Dutch BA
Danish and Finnish BA
Danish and French BA
Danish and German BA
Danish and Hebrew BA
Danish and Hungarian BA
Danish and Italian BA
Danish and Polish BA
Danish and Portuguese BA
Danish and Romanian BA
Danish and Russian BA
Danish and Serbian/Croatian BA
Danish and Spanish BA
Danish and Ukrainian BA
Danish and Yiddish BA
Data Science BSc
Dutch and English BA
Dutch and Film Studies BA
Dutch and Finnish BA
Dutch and French BA
Dutch and German BA
Dutch and Hebrew BA
Dutch and History of Art BA
Dutch and Hungarian BA
Dutch and Italian BA
Dutch and Latin BA
Dutch and Management Studies BA
Dutch and Norwegian BA
Dutch and Philosophy BA
Dutch and Polish BA
Dutch and Portuguese BA
Dutch and Romanian BA
Dutch and Russian BA
Dutch and Serbian/Croatian BA
Dutch and Spanish BA
Dutch and Swedish BA
Dutch and Ukrainian BA
Dutch and Yiddish BA
Dutch BA
Early Childhood Education BA
Earth Sciences BSc
Earth Sciences MSci
Earth Sciences (International Programme) MSci
Earth Sciences with Study Abroad MSci
Economics and Business with East European Studies BA
Economics and Business with East European Studies with Study Abroad BA
Economics and Statistics BSc (Econ)
Economics BSc (Econ)
Economics with Study Abroad BSc (Econ)
Education, Society and Culture BA
Electronic and Electrical Engineering BEng
Electronic and Electrical Engineering MEng
Engineering and Architecture MEngArch
Engineering Foundation Year
English BA
Environmental Geoscience BSc
Environmental Geoscience MSci
European Social and Political Studies (Dual Degree) BA
European Social and Political Studies BA
Experimental Linguistics BSc
Experimental Linguistics with Study Abroad BSc
Fine Art BA
Fine Art BFA
Finnish and East European Studies BA
Finnish and French BA
Finnish and German BA
Finnish and Hebrew BA
Finnish and Hungarian BA
Finnish and Italian BA
Finnish and Norwegian BA
Finnish and Polish BA
Finnish and Portuguese BA
Finnish and Romanian BA
Finnish and Russian BA
Finnish and Serbian/Croatian BA
Finnish and Spanish BA
Finnish and Swedish BA
Finnish and Ukrainian BA
Finnish and Yiddish BA
French and English BA
French and Film Studies BA
French and German BA
French and Hebrew BA
French and History of Art BA
French and Hungarian BA
French and Italian BA
French and Latin BA
French and Management Studies BA
French and Norwegian BA
French and Philosophy BA
French and Polish BA
French and Portuguese BA
French and Romanian BA
French and Russian BA
French and Serbian/Croatian BA
French and Spanish BA
French and Swedish BA
French and Ukrainian BA
French and Yiddish BA
French BA
Geography and Economics BSc
Geography BA
Geography BSc
Geography with Study Abroad BA
Geography with Study Abroad BSc
Geology BSc
Geology MSci
Geophysics BSc
Geophysics MSci
German and English BA
German and Film Studies BA
German and Hebrew BA
German and History of Art BA
German and Hungarian BA
German and Italian BA
German and Latin BA
German and Management Studies BA
German and Norwegian BA
German and Philosophy BA
German and Polish BA
German and Portuguese BA
German and Romanian BA
German and Russian BA
German and Serbian/Croatian BA
German and Spanish BA
German and Swedish BA
German and Ukrainian BA
German and Yiddish BA
German BA
Global Humanitarian Studies BSc
Hebrew and Hungarian BA
Hebrew and Italian BA
Hebrew and Jewish Studies BA
Hebrew and Norwegian BA
Hebrew and Polish BA
Hebrew and Portuguese BA
Hebrew and Romanian BA
Hebrew and Russian BA
Hebrew and Serbian/Croatian BA
Hebrew and Spanish BA
Hebrew and Swedish BA
Hebrew and Ukrainian BA
Hebrew and Yiddish BA
History (Central and East European) and Jewish Studies BA
History and Philosophy of Science BSc
History and Politics of the Americas BA
History and Politics of the Americas with Study Abroad BA
History BA
History of Art BA
History of Art, Materials and Technology BA
History with Study Abroad BA
History, Politics and Economics BA
Human Neuroscience BSc
Human Sciences BSc
Human Sciences MSci
Hungarian and East European Studies BA
Hungarian and Italian BA
Hungarian and Norwegian BA
Hungarian and Polish BA
Hungarian and Portuguese BA
Hungarian and Romanian BA
Hungarian and Russian BA
Hungarian and Serbian/Croatian BA
Hungarian and Spanish BA
Hungarian and Swedish BA
Hungarian and Ukrainian BA
Hungarian and Yiddish BA
Icelandic BA
Infection and Immunity BSc
Information Management for Business BSc
Information, Data and Society BSc
International Management BSc
International Social and Political Studies BA
Italian and Film Studies BA
Italian and History of Art BA
Italian and Latin BA
Italian and Management Studies BA
Italian and Norwegian BA
Italian and Philosophy BA
Italian and Polish BA
Italian and Portuguese BA
Italian and Romanian BA
Italian and Russian BA
Italian and Serbian/Croatian BA
Italian and Spanish BA
Italian and Swedish BA
Italian and Ukrainian BA
Italian and Yiddish BA
Italian BA
Language and Culture BA
Law LLB
Law with French Law with Study Abroad LLB
Law with German Law with Study Abroad LLB
Law with Hispanic Law with Study Abroad LLB
Linguistics BA
Linguistics with Study Abroad BA
Management for Social Change BSc
Management Science BSc
Management Science MSci
Mathematics and Physics BSc
Mathematics and Physics MSci
Mathematics and Statistical Science BSc
Mathematics and Statistical Science MSci
Mathematics BSc
Mathematics MSci
Mathematics with Economics BSc
Mathematics with Economics MSci
Mathematics with Management Studies BSc
Mathematics with Management Studies MSci
Mathematics with Modern Languages BSc
Mathematics with Modern Languages MSci
Mathematics with Theoretical Physics BSc
Mathematics with Theoretical Physics MSci
Mechanical Engineering BEng
Mechanical Engineering MEng
Media BA
Medical Innovation and Enterprise BSc
Medical Innovation and Enterprise MSci
Medical Physics MSci
Medicine MBBS BSc
Natural Sciences BSc
Natural Sciences MSci
Neuroscience BSc
Neuroscience MSci
Norwegian and Polish BA
Norwegian and Portuguese BA
Norwegian and Romanian BA
Norwegian and Russian BA
Norwegian and Serbian/Croatian BA
Norwegian and Spanish BA
Norwegian and Ukrainian BA
Norwegian and Yiddish BA
Nutrition and Medical Sciences BSc
Pharmaceutical Sciences MSci
Pharmacology MSci
Pharmacy (with integrated foundation training) MPharm
Pharmacy MPharm
Philosophy and Computer Science BA
Philosophy and Economics BA
Philosophy and History of Art BA
Philosophy BA
Philosophy, Politics and Economics BSc
Physics BSc
Physics MSci
Physics with Medical Physics BSc
Polish and East European Studies BA
Polish and Portuguese BA
Polish and Romanian BA
Polish and Russian BA
Polish and Serbian/Croatian BA
Polish and Spanish BA
Polish and Swedish BA
Polish and Ukrainian BA
Polish and Yiddish BA
Politics and International Relations BSc
Politics, Sociology and East European Studies (with Study Abroad) BA
Politics, Sociology and East European Studies BA
Population Health Sciences (Data Science) BSc
Population Health Sciences (Data Science) MSci
Population Health Sciences BSc
Population Health Sciences MSci
Portuguese and Film Studies BA
Portuguese and Management Studies BA
Portuguese and Yiddish BA
Psychology and Language Sciences BSc
Psychology and Language Sciences MSci
Psychology BSc
Psychology MSci
Psychology with Education BSc
Robotics and Artificial Intelligence MEng
Romanian and East European Studies BA
Romanian and Portuguese BA
Romanian and Russian BA
Romanian and Serbian/Croatian BA
Romanian and Spanish BA
Romanian and Swedish BA
Romanian and Ukrainian BA
Romanian and Yiddish BA
Russian and History BA
Russian and Portuguese BA
Russian and Serbian/Croatian BA
Russian and Spanish BA
Russian and Swedish BA
Russian and Ukrainian BA
Russian and Yiddish BA
Russian Studies BA
Scandinavian Studies and English BA
Scandinavian Studies and Film Studies BA
Scandinavian Studies and History of Art BA
Scandinavian Studies and Latin BA
Scandinavian Studies and Management Studies BA
Scandinavian Studies and Philosophy BA
Scandinavian Studies BA
Science and Engineering for Social Change BSc
Serbian/Croatian and East European Studies BA
Serbian/Croatian and Portuguese BA
Serbian/Croatian and Spanish BA
Serbian/Croatian and Swedish BA
Serbian/Croatian and Ukrainian BA
Serbian/Croatian and Yiddish BA
Social Sciences BSc
Social Sciences with Data Science BSc
Sociology and Politics of Science BSc
Sociology BSc
Spanish and Film Studies BA
Spanish and History of Art BA
Spanish and Latin American Studies BA
Spanish and Latin BA
Spanish and Management Studies BA
Spanish and Philosophy BA
Spanish and Portuguese BA
Spanish and Swedish BA
Spanish and Ukrainian BA
Spanish and Yiddish BA
Sport and Exercise Medical Sciences BSc
Statistics and Management for Business BSc
Statistics BSc
Statistics with Economics and Finance BSc
Statistics with Study Abroad MSci
Sustainable Built Environments, Energy and Resources BSc
Sustainable Built Environments, Energy and Resources MEng
Swedish and Portuguese BA
Swedish and Yiddish BA
Theoretical Physics BSc
Theoretical Physics MSci
Ukrainian and East European Studies BA
Ukrainian and Swedish BA
Ukrainian and Yiddish BA
Urban Planning and Real Estate BSc
Urban Planning, Design and Management BSc
Urban Studies BSc
Viking and Old Norse Studies BA
Youth, Society and Sustainable Futures BA
"""

# subject phrase -> catalogue code prefixes. Checked in order; a matched phrase is removed before the next check,
# so "History of Art" never also counts as "History".
RULES = [
    (r'bachelor of laws|\blaw\b', ['LAWS']),
    (r'history of art', ['HART']),
    (r'history and philosophy of science|sociology and politics of science', ['HPSC']),
    (r'history and politics of the americas', ['AMER', 'HIST']),
    (r'history \(central and east european\)', ['SEES', 'HIST']),
    (r'east european studies', ['SEES', 'SEEE']),
    (r'economics and business', ['SESS']),
    (r'politics, sociology', ['SESS']),
    (r'jewish studies|hebrew|yiddish', ['HEBR']),
    (r'european social and political studies|international social and political studies', ['ESPS']),
    (r'experimental linguistics|\blinguistics\b', ['PLIN']),
    (r'psychology and language sciences', ['PSYC', 'PLIN', 'PALS']),
    (r'psychology with education', ['PHDE', 'PSYC']),
    (r'psychology', ['PSYC', 'PALS']),
    (r'human neuroscience|neuroscience', ['NEUR']),
    (r'biochemical engineering|bioprocessing', ['BENG']),
    (r'biomedical engineering|medical physics', ['MPHY']),
    (r'chemical engineering', ['CENG']),
    (r'civil engineering|construction engineering', ['CEGE']),
    (r'electronic and electrical engineering', ['ELEC']),
    (r'mechanical engineering', ['MECH']),
    (r'robotics', ['COMP', 'ELEC', 'MECH']),
    (r'engineering and architecture', ['BARC', 'CEGE']),
    (r'engineering foundation', ['ENGF']),
    (r'architectur', ['BARC']),
    (r'construction project management', ['BSSC']),
    (r'sustainable built environments', ['BENV']),
    (r'urban|real estate', ['BPLN']),
    (r'business and health', ['GBSH']),
    (r'management science|international management|information management|management studies|management for social change|statistics and management', ['MSIN']),
    (r'biochemistry', ['BIOC']),
    (r'biological sciences', ['BIOL', 'BIOS', 'CELL']),
    (r'biomedical sciences', ['BIOS', 'PHOL', 'ANAT', 'CELL']),
    (r'cancer', ['CINS', 'BIOS']),
    (r'infection and immunity', ['INIM', 'BIOS']),
    (r'pharmacology', ['PHAR']),
    (r'pharmac', ['PHAY']),
    (r'medicine mbbs', ['MBBS']),
    (r'applied medical sciences|nutrition|sport and exercise|medical innovation', ['MEDC', 'SURG']),
    (r'child health', ['CHLD']),
    (r'population health', ['IEHC']),
    (r'audiology', ['EARI']),
    (r'human sciences', ['ANTH', 'BIOL', 'PSYC']),
    (r'archaeology|classical archaeology', ['ARCL']),
    (r'anthropology', ['ANTH']),
    (r'ancient languages', ['GREK', 'LATN', 'HEBR', 'AMEL']),
    (r'ancient middle eastern', ['AMEL', 'HEBR']),
    (r'ancient history|classics|classical civilisation', ['CLAS', 'GREK', 'LATN']),
    (r'\blatin\b(?! american)', ['LATN']),
    (r'spanish and latin american', ['SPAN']),
    (r'philosophy, politics and economics', ['PHIL', 'POLS', 'ECON']),
    (r'history, politics and economics', ['HIST', 'POLS', 'ECON']),
    (r'politics and international relations', ['POLS']),
    (r'philosophy', ['PHIL']),
    (r'economics', ['ECON']),
    (r'statistic|data science', ['STAT']),
    (r'theoretical physics|astrophysics|physics', ['PHAS']),
    (r'computer science', ['COMP']),
    (r'mathematics', ['MATH']),
    (r'chemistry', ['CHEM']),
    (r'natural sciences', ['NSCI']),
    (r'earth sciences|geology|geophysics|environmental geoscience', ['GEOL']),
    (r'geography', ['GEOG']),
    (r'sociology|social sciences', ['SOCS']),
    (r'politics', ['POLS']),
    (r'history', ['HIST']),
    (r'comparative literature', ['LITC']),
    (r'film studies', ['ELCS']),
    (r'english', ['ENGL']),
    (r'media|communications', ['CCME']),
    (r'early childhood', ['LCLL']),
    (r'education|youth, society', ['EDPS', 'CPAS']),
    (r'fine art|art and technology', ['SSFA']),
    (r'arts and sciences|creative arts', ['BASC']),
    (r'crime and security', ['SECU']),
    (r'global humanitarian', ['IRDR']),
    (r'science and engineering for social change', ['STEP']),
    (r'information, data and society', ['INST']),
    (r'language and culture', ['LCUL', 'ELCS']),
    (r'modern languages', ['FREN', 'GERM', 'ITAL', 'SPAN']),
    (r'french', ['FREN']), (r'german', ['GERM']), (r'italian', ['ITAL']), (r'spanish|hispanic', ['SPAN']),
    (r'portuguese', ['PORT']), (r'dutch', ['DUTC']),
    (r'scandinavian|danish|norwegian|swedish|icelandic|viking|old norse', ['SCAN']),
    (r'russian', ['SERS']), (r'polish', ['SEEP']), (r'czech', ['SEEC']), (r'ukrainian', ['SEEU']),
    (r'serbian/croatian', ['SEEY']), (r'finnish', ['SEEF']), (r'hungarian', ['SEEH']), (r'romanian', ['SEER']),
    (r'bulgarian', ['SEEB', 'SEEE']),
]


def years(name):
    n = name.lower()
    y = 4 if re.search(r'\b(meng|msci|mengarch|mpharm)\b', n) else 6 if 'mbbs' in n else 1 if 'foundation year' in n else 3
    if re.search(r'study abroad|placement year|international programme|dual degree', n) and y == 3:
        y = 4
    # most modern-language degrees include a year abroad
    if y == 3 and re.search(r'\b(french|german|italian|spanish|portuguese|dutch|danish|norwegian|swedish|icelandic|scandinavian|viking|russian|polish|czech|ukrainian|serbian|finnish|hungarian|romanian|bulgarian|hebrew|yiddish|language and culture|east european studies)\b', n):
        y = 4
    if re.search(r'\bbfa\b', n):
        y = 4
    return y


def prefixes(name):
    s, out = name.lower(), []
    for pat, pre in RULES:
        if re.search(pat, s):
            s = re.sub(pat, ' ', s)
            for p in pre:
                if p not in out:
                    out.append(p)
    # UCL's engineering degrees share an integrated first year (ENGF modules)
    if re.search(r'\b(beng|meng)\b', name.lower()) and 'ENGF' not in out:
        out.append('ENGF')
    return out


def slug(name):
    return 'ucl-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def main():
    names = [l.strip() for l in COURSES.strip().splitlines() if l.strip()]
    assert len(names) == len(set(names)), 'duplicate course'
    rows, missing = [], []
    for n in names:
        p = prefixes(n)
        if not p:
            missing.append(n)
        rows.append({'id': slug(n), 'n': n, 'y': years(n), 'p': p})
    if missing:
        raise SystemExit('no subject mapping for: ' + ', '.join(missing))
    out = os.path.join(os.path.dirname(__file__), '..', 'site', 'data', 'courses-ucl.json')
    with open(out, 'w') as f:
        json.dump(rows, f, separators=(',', ':'), ensure_ascii=False)
    print(len(rows), 'UCL courses ->', os.path.relpath(out))


if __name__ == '__main__':
    main()
