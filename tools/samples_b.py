S = {}
S['ECON0002'] = """Real GDP per capita measures the value of goods and services produced per person, adjusted for inflation, so it is useful for comparing countries and seeing how living standards change over time. It is widely available and calculated in a similar way across countries, which makes comparisons easier. A country with higher GDP per capita can usually afford better healthcare, education and infrastructure.

However, GDP per capita has limitations. It is an average, so it does not show how income is distributed. A country could have high GDP per capita but most of the income goes to a small group of people. It also ignores things like unpaid work, leisure time and pollution, so a country could grow quickly while people are not actually better off. It also does not show how stable the economy is, for example whether growth is followed by a recession.

To capture inequality we could use the Gini coefficient, and to capture stability we could look at unemployment and inflation. Overall GDP per capita is a good starting point but should be used alongside other measures."""
S['ECON0004'] = """(a) The mean (£620) is well above the median (£480), and the maximum (£9,800) is far above the mean, so the distribution is positively (right) skewed, with a long upper tail of a few high-income households. The standard deviation (£510) is large relative to the mean, which also shows a lot of spread. The minimum of £0 means some households report no income at all.

(b) I would report the median, because it is not pulled up by the few very high incomes, so it better represents a typical household. The mean is sensitive to outliers in a skewed distribution.

(c) First, check the extreme values and the zeros, for example with a histogram or tabulate, to see whether they are genuine or data entry or coding errors (e.g. missing values recorded as 0). Second, take the natural log of income before using it in regressions, which reduces the skew and makes coefficients easier to interpret as percentage changes. Zero incomes would need to be dealt with first, since log(0) is undefined."""
S['ECON0006'] = """(a) Average cost AC(q) = C(q)/q = q^2 - 6q + 15.
dAC/dq = 2q - 6 = 0, so q* = 3. The second derivative is 2 > 0, so this is a minimum.
AC(3) = 9 - 18 + 15 = 6.

(b) Marginal cost MC(q) = 3q^2 - 12q + 15.
MC(3) = 27 - 36 + 15 = 6, which equals AC(3) = 6. This is expected, because when MC is below AC it pulls AC down and when it is above it pulls AC up, so they are equal at the minimum of AC.

(c) Profit = 24q - (q^3 - 6q^2 + 15q). The first-order condition is p = MC:
24 = 3q^2 - 12q + 15, so 3q^2 - 12q - 9 = 0, so q^2 - 4q - 3 = 0.
q = (4 ± sqrt(16 + 12))/2 = 2 ± sqrt(7). Only the positive root makes sense, q = 2 + sqrt(7) ≈ 4.65.
Second-order condition: d²profit/dq² = -(6q - 12) = -15.9 < 0 at q = 4.65, so this is a maximum."""
S['ECON0007'] = """GDP per capita at PPP adjusts each country's GDP for differences in price levels, using a common basket of goods. This is better than using market exchange rates, because goods and services, especially non-traded ones like haircuts and housing, are often much cheaper in poorer countries. Without the PPP adjustment, living standards in countries like India would be understated. So PPP makes comparisons more meaningful.

However, it is still not fully satisfactory. GDP per capita is an average, so it hides inequality: a country with high oil wealth may have high GDP per capita while most people are poor. It also leaves out non-market activities such as household production, and does not count leisure, health, life expectancy or environmental damage. PPP figures themselves are uncertain, because the basket is hard to compare across very different economies.

This is why alternative measures such as the Human Development Index, which adds education and life expectancy, are also used. Overall, GDP per capita at PPP is a useful starting point but not enough on its own."""
S['ECON0010'] = """(a) Profit π(q) = R(q) - C(q) = 100q - q^2 - (q^3/3 - 6q^2 + 40q + 50)
= -q^3/3 + 5q^2 + 60q - 50.

(b) π'(q) = -q^2 + 10q + 60 = 0, so q^2 - 10q - 60 = 0.
q = (10 ± sqrt(100 + 240))/2 = 5 ± sqrt(85).
So q = 5 + 9.22 = 14.22 or q = 5 - 9.22 = -4.22. Since q ≥ 0, the only relevant stationary point is q ≈ 14.22.

(c) π''(q) = -2q + 10. At q = 14.22, π'' = -18.44 < 0, so it is a maximum. (At q = -4.22, π'' > 0, a minimum, but this is outside the domain.) The profit-maximising output is q ≈ 14.22.

(d) MR = 100 - 2q = 100 - 28.44 = 71.56.
MC = q^2 - 12q + 40 = 202.2 - 170.6 + 40 = 71.6.
So MR = MC at the optimum (allowing for rounding)."""
S['ECS401U'] = """(a) (i) 5 + 3 * 2 = 11, type int (multiplication first).
(ii) 10 / 4 is integer division = 2, then 2 * 2.0 = 4.0, type double.
(iii) (double) 10 / 4: the cast applies to 10 first, so 10.0 / 4 = 2.5, type double.
(iv) "A" + 1 + 2 is evaluated left to right as string concatenation: "A1" then "A12", type String.

(b) 3.7 is a double, and assigning it to an int would lose information, so Java reports a "possible lossy conversion from double to int" error. Fixes: int n = (int) 3.7; which truncates, so n holds 3. Or change the type: double n = 3.7; so n holds 3.7.

(c) (year % 4 == 0) && (year % 100 != 0)"""
S['ECS407U'] = """(a) The truth table has 8 rows. Working through each, (p → q) ∧ (q → r) is true in rows TTT, FTT, FFT, FFF, and in each of these p → r is also true. In every other row the left side is false, so the whole implication is true. So the final column is true in all 8 rows.

(b) It is a tautology, because it is true under every assignment of truth values to p, q and r. (This is the rule known as hypothetical syllogism.)

(c) p → (q → r)
≡ ¬p ∨ (q → r)          (implication)
≡ ¬p ∨ (¬q ∨ r)         (implication)
≡ (¬p ∨ ¬q) ∨ r         (associativity)
≡ ¬(p ∧ q) ∨ r          (De Morgan)
≡ (p ∧ q) → r           (implication)"""
S['ELEC40002'] = """(a) R2 and R3 in parallel: (6 x 12)/(6 + 12) = 72/18 = 4 kΩ.
Total resistance = R1 + 4 = 4 + 4 = 8 kΩ.
Source current I = 12 V / 8 kΩ = 1.5 mA.

(b) Voltage across R1 = 1.5 mA x 4 kΩ = 6 V, so the voltage across the parallel pair (and R2) = 12 - 6 = 6 V.
Current in R3 = 6 V / 12 kΩ = 0.5 mA (and current in R2 = 6/6 = 1 mA, which adds up to 1.5 mA).

(c) P(R1) = I^2 R = (1.5 mA)^2 x 4 kΩ = 9 mW.
P(R2) = V^2/R = 36/6000 = 6 mW.
P(R3) = 36/12000 = 3 mW.
Total dissipated = 18 mW. Power delivered by the source = 12 V x 1.5 mA = 18 mW, so the power balances."""
S['EMS460U'] = """(a) The resultant force is the pressure at the centroid times the area. The centroid is at a depth of 1.5 m and the area is 2 x 3 = 6 m^2.
F = ρ g h_c A = 1000 x 9.81 x 1.5 x 6 = 88,290 N ≈ 88.3 kN.

(b) For a vertical rectangle with its top at the surface, the centre of pressure is at two-thirds of the depth, so the line of action is 2/3 x 3 = 2 m below the free surface. (Using y_cp = y_c + I/(y_c A) = 1.5 + (2 x 3^3/12)/(1.5 x 6) = 1.5 + 0.5 = 2 m.)

(c) The hinge is at the bottom (3 m depth), so the hydrostatic force acts 3 - 2 = 1 m above the hinge. Taking moments about the hinge, the force at the top, which is 3 m above the hinge, must satisfy F_top x 3 = 88.3 x 1.
F_top = 29.4 kN."""
S['GV100'] = """In the Republic, Plato argues that a just city has three classes, the rulers, auxiliaries and producers, each doing its own job. He then argues that the soul has three matching parts, reason, spirit and appetite, and that justice in a person is each part doing its own work, with reason ruling. Since a just soul is harmonious and healthy, Plato concludes the just person is happier, so justice is worth having for its own sake and not just for its consequences, as Glaucon challenged.

One problem is that the analogy assumes the city and the soul must have the same structure, which Plato does not really prove. Another problem, raised by Sachs, is that Plato changes the meaning of justice: Glaucon asked about not stealing or lying, but Plato shows the value of inner harmony. It is not clear that someone with a harmonious soul will act justly in the ordinary sense.

However, Plato could reply that only a well-ordered soul has no motive to act unjustly. Overall, the analogy is suggestive but does not fully establish that justice is valuable in itself."""
S['GV101'] = """Gallie argued that some concepts, like democracy, power and freedom, are "essentially contested": people disagree about their meaning in ways that cannot be settled by evidence, because the disagreement is partly about values. This seems to be a problem for political science, since science needs clear concepts that can be measured in the same way by everyone.

However, contested concepts do not stop political science from being scientific. Researchers can define their concepts clearly and openly for a particular study, for example using a minimal definition of democracy as competitive elections, as Przeworski does. Datasets like Polity and V-Dem make their definitions explicit, so others can test, criticise and replicate the results. Natural sciences also have debates about concepts.

On the other hand, the choice of definition can affect the conclusions, so values may enter the research. Political science may not be a science in the same way as physics, but it can still be systematic and evidence-based, so the claim goes too far."""
S['HIST0003'] = """The claim reflects the debate between empiricist historians such as Elton, who believed the past could be recovered from sources if historians were careful enough, and others such as Carr and later postmodernists, who argued that historians shape what the past looks like.

Sources do not speak for themselves. Historians choose which sources to use, and archives are already selective, because what was recorded and kept depended on who had power, so the voices of women or enslaved people are often missing. Historians also ask questions shaped by their own time, and they interpret and arrange the evidence into a narrative. In this sense, the history we read is constructed.

However, this does not mean history is invented. Historians are constrained by the evidence: claims can be checked against sources, and some interpretations are better supported than others. For example, Holocaust denial can be shown to be false from the evidence. So historians both discover and construct: they find evidence about the past but build interpretations from it."""
S['HY116'] = """The July Crisis shows how diplomacy failed. After the assassination of Franz Ferdinand, Germany gave Austria-Hungary the "blank cheque", Austria sent Serbia an ultimatum designed to be rejected, and Russia's general mobilisation triggered Germany's Schlieffen Plan, which required invading Belgium and bringing in Britain. Christopher Clark argues that the leaders were "sleepwalkers" who made decisions without seeing where they led, which supports the idea that it was a failure of diplomacy.

However, long-term structural forces made war more likely. The alliance system turned a local crisis into a European war, and military plans based on fast mobilisation reduced the time for diplomacy. The naval race, imperial rivalry and nationalism in the Balkans also created tension. Fritz Fischer argued Germany had expansionist aims and was willing to risk war.

Overall, structural factors created the conditions for war, but the decisions made in July 1914 turned the crisis into war. Both were necessary, so the claim is too one-sided."""
S['IR100'] = """Traditional theories such as realism treat sovereignty as a fixed fact: states are the main actors, there is no authority above them, and this anarchy explains their behaviour. In this view theory just describes the world.

Constructivists argue that sovereignty is a social construction. Wendt said "anarchy is what states make of it": the meaning of sovereignty depends on shared ideas and practices. For example, sovereignty has changed over time, from the Peace of Westphalia to decolonisation, and the idea of the "Responsibility to Protect" suggests sovereignty now depends on how a state treats its people. If sovereignty is made by practices, theories that describe states as sovereign and self-interested can help reproduce that behaviour, because policymakers act on them.

Critical theorists like Cox argue that "theory is always for someone and for some purpose", so realism supports the status quo.

However, theories cannot construct anything they like, because material power still matters. Overall theories do help construct sovereignty, but within limits."""
S['LAW4001'] = """The UK constitution is uncodified and flexible: it comes from statutes, common law, conventions and other sources, and Parliament can change it by an ordinary Act because of parliamentary sovereignty. This means it can adapt quickly. For example, devolution in 1998 and the Constitutional Reform Act 2005, which created the Supreme Court, were introduced without needing a special amendment process.

However, flexibility can also be a weakness. Because there is no entrenched constitution, important rights can in theory be removed by a simple majority, and much depends on conventions, which are not legally enforceable, as seen in Miller (No 1). The government's control of the Commons means the executive can push through constitutional change with limited checks. The prorogation in 2019 showed how political actors can test constitutional limits, although the Supreme Court in Miller (No 2) intervened.

So flexibility allows the constitution to evolve, but it relies on political restraint. It is arguably a strength only when combined with checks like the courts and the Human Rights Act 1998."""
S['LAW4006'] = """The distinction between legal and equitable interests comes from the separate history of common law and equity. Under the Law of Property Act 1925, s 1, only the fee simple absolute in possession and the term of years absolute can be legal estates, and other interests, such as interests under a trust, are equitable.

The distinction still matters. Legal interests traditionally bind everyone, while equitable interests depended on the doctrine of notice. Under the Land Registration Act 2002, many interests must be registered or protected by a notice to bind a purchaser, and interests under a trust are overreached if the purchaser pays two trustees (City of London Building Society v Flegg). So whether an interest is equitable affects whether it can be overreached.

On the other hand, registration has reduced the importance of the distinction, as what usually matters now is whether the interest is registered or overriding under Schedule 3, such as an actual occupier in Williams & Glyn's Bank v Boland. Overall, the distinction is still important, but registration has replaced notice as the key protection."""
S['LAW4009'] = """The EU does not follow a strict separation of powers as found in national constitutions. Instead, power is divided between institutions representing different interests, which is called institutional balance.

The Commission represents the general EU interest and has the near monopoly of legislative initiative, but it also has executive functions and enforces EU law through Article 258 TFEU infringement actions. The Council represents the Member States and shares legislative and budgetary power with the European Parliament under the ordinary legislative procedure. The Parliament, which is directly elected, has gained more power over time, including co-decision and approving the Commission. The Court of Justice ensures the law is observed (Article 19 TEU) and has protected institutional balance, for example in Chernobyl, where it allowed Parliament to bring an action to protect its prerogatives.

Legislative power is therefore shared between the Council and Parliament, and executive power between the Commission and Member States. This supports describing it as a separation of functions rather than powers, although the Court's role is close to a separation of judicial power."""
S['LAW4104'] = """For a contract to be enforceable, its terms must be sufficiently certain. In Scammell v Ouston the phrase "on hire purchase terms" was too vague, so there was no contract. Agreements to agree are generally unenforceable: in Walford v Miles, the House of Lords held that an agreement to negotiate in good faith was too uncertain, and in Courtney & Fairbairn v Tolaini an agreement to negotiate a price was void.

However, the courts try to uphold commercial agreements where the parties intended to be bound. In Hillas v Arcos the court used the parties' previous dealings to fill gaps, and in Foley v Classique Coaches a price "to be agreed" was enforceable because there was an arbitration clause and the parties had acted on the agreement. The Sale of Goods Act 1979, s 8, also allows a reasonable price to be implied.

So there is a tension: the law values certainty, but it also tries to give effect to the reasonable expectations of business people. The courts seem more willing to fill gaps when the parties have already performed."""
S['LAW4105'] = """The issue is whether Dev's statement about the mileage is a term of the contract or a mere representation.

The courts look at the intention of the parties, judged objectively. A statement is more likely to be a term if the person making it has special knowledge. In Dick Bentley v Harold Smith, a statement about mileage by a car dealer was a term because the dealer was in a better position to know. In contrast, in Oscar Chess v Williams the private seller had no special knowledge, so the statement was not a term. Here Dev is a dealer and Priya has no mechanical knowledge, so this supports it being a term.

However, the written contract does not mention mileage and includes a clause saying no oral statements form part of the agreement. This is an entire agreement clause, which will usually stop the statement being a term (Inntrepreneur Pub Co v East Crown).

So the statement is probably not a term. But Priya may still claim for misrepresentation, as the clause does not exclude liability for misrepresentation."""
S['LAWS0001'] = """Priya's email is an offer to sell for £400. Her promise to keep it open until Friday is not binding because Omar gave no consideration for it (Routledge v Grant), so she could revoke it at any time before acceptance.

Omar's reply "Would you take £350?" could be a counter-offer, which would destroy the original offer (Hyde v Wrench). However, it looks more like a request for information about whether she would accept less, as in Stevenson v McLean, so the original offer probably survived.

Revocation must be communicated, but it does not have to come from the offeror. In Dickinson v Dodds the offeree heard from a reliable third party that the property had been sold, and this was enough to revoke the offer. Here Omar learned from a friend on Thursday morning that the bicycle had been sold to Lena, before he emailed his acceptance. If the friend is a reliable source, the offer was revoked before acceptance.

Therefore there is probably no contract between Priya and Omar."""
S['LAWS0002'] = """Personal rights can only be enforced against a particular person, while proprietary rights are rights in a thing that can bind third parties, such as purchasers. In National Provincial Bank v Ainsworth, Lord Wilberforce said a right is proprietary if it is definable, identifiable by third parties, capable of assumption by third parties and has some degree of permanence. The wife's right to stay in the matrimonial home was held to be personal.

The distinction is important because it decides who wins when the owner sells or becomes insolvent. However, it is hard to defend in some areas. Licences are supposed to be personal, but in Errington v Errington a contractual licence appeared to bind a third party, although Ashburn Anstalt v Arnold later rejected this. Estoppel interests, recognised in Thorner v Major, can bind third parties under the Land Registration Act 2002, s 116, even though they start as personal expectations. Bruton v London & Quadrant also showed a lease can exist only between the parties.

So the line is blurred, but it is still the foundation of property law."""
S['LAWS0007'] = """Many of the general principles of criminal liability, especially mens rea, have been developed by the courts rather than by Parliament. Murder is still a common law offence, and its mens rea of intention has been defined by judges. In Woollin the House of Lords held that a jury may find intention where death or serious harm was a virtual certainty and the defendant appreciated this.

Recklessness was also developed by the courts. In Caldwell the House of Lords adopted an objective test, but this was criticised as unfair and overruled in R v G, which returned to a subjective test. This shows the judges shaping and correcting the law.

However, Parliament has also played a role. Many offences are statutory, such as those in the Offences Against the Person Act 1861 and the Theft Act 1968, and section 8 of the Criminal Justice Act 1967 deals with proof of intention. Parliament has also created many strict liability offences.

Overall, the courts have shaped the general principles more than Parliament, but they work within statutory frameworks."""
