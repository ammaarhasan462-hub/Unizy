S = {}
S['LIFE40001'] = """(a) Water is polar and can form hydrogen bonds, and it has a high dielectric constant. Ions and polar molecules are surrounded by water molecules oriented with their partial charges towards them (hydration shells), and the high dielectric constant weakens the attraction between oppositely charged ions, so they dissolve. Hydrocarbons are non-polar and cannot form hydrogen bonds with water, so dissolving them breaks water-water hydrogen bonds without making new favourable interactions.

(b) When a non-polar molecule is in water, the surrounding water molecules become more ordered in a cage-like structure, which decreases entropy. When non-polar groups cluster together, fewer water molecules are ordered, so entropy increases. In protein folding, hydrophobic side chains are buried in the core, releasing ordered water, and this increase in entropy is a major driving force for folding.

(c) Each hydrogen bond is weak (only a few kJ/mol) and can easily break, but DNA has very many of them along the double helix, two per A-T pair and three per G-C pair, so together they hold the strands together and give specificity. Base stacking also contributes."""
S['LIFE40006'] = """(a) The bilayer is made of phospholipids, which have a hydrophilic phosphate head and two hydrophobic fatty acid tails. In water they arrange with the heads facing the water on both sides and the tails facing each other in the middle. This happens spontaneously because of the hydrophobic effect: burying the tails away from water increases the entropy of the water, so it is energetically favourable.

(b) Integral proteins are embedded in the bilayer, often spanning it, and can only be removed with detergents, e.g. aquaporins or GLUT transporters. Peripheral proteins are attached to the surface, often by binding to integral proteins or lipid heads, and can be removed by changing pH or salt concentration, e.g. spectrin on red blood cells.

(c) Shorter fatty acid chains have fewer van der Waals interactions with each other, so the membrane is more fluid. Unsaturated fatty acids have cis double bonds that create kinks, which stop the tails packing tightly, also increasing fluidity. Long, saturated chains pack closely and make the membrane less fluid."""
S['MA100'] = """(a) AB = [[1x1 + 2x3, 1x0 + 2x1],[0x1 + 1x3, 0x0 + 1x1]] = [[7, 2],[3, 1]].
BA = [[1x1 + 0x0, 1x2 + 0x1],[3x1 + 1x0, 3x2 + 1x1]] = [[1, 2],[3, 7]].
So AB ≠ BA.

(b) A^2 = [[1, 4],[0, 1]], A^3 = [[1, 6],[0, 1]], so the formula seems to be A^n = [[1, 2n],[0, 1]].
Proof by induction: for n = 1, A^1 = [[1, 2],[0, 1]], which is true.
Assume A^k = [[1, 2k],[0, 1]]. Then A^(k+1) = A^k A = [[1, 2k],[0, 1]][[1, 2],[0, 1]] = [[1, 2 + 2k],[0, 1]] = [[1, 2(k+1)],[0, 1]].
So it holds for k + 1, and by induction for all positive integers n.

(c) det(AB) = 7x1 - 2x3 = 1.
(AB)^-1 = (1/1)[[1, -2],[-3, 7]] = [[1, -2],[-3, 7]]."""
S['MATH0003'] = """(a) sup A is the least upper bound of A: a number s such that a ≤ s for all a in A, and if t is any upper bound of A then s ≤ t.

(b) For every n, 1 - 1/n < 1, so 1 is an upper bound of A. Now let ε > 0. By the Archimedean property there is n with n > 1/ε, so 1/n < ε and 1 - 1/n > 1 - ε. So 1 - ε is not an upper bound, and no number smaller than 1 is an upper bound. Hence sup A = 1. Also 1 is not in A, because 1 - 1/n = 1 would need 1/n = 0, which is impossible.

(c) The Archimedean property says that for every real x there is a natural number n with n > x. Proof: suppose not, so x is an upper bound for N. N is non-empty, so by the completeness axiom it has a supremum s. Then s - 1 is not an upper bound, so there is m in N with m > s - 1. But then m + 1 > s and m + 1 is in N, which contradicts s being an upper bound. So the property holds."""
S['MATH0004'] = """(a) (i) Use the ratio test. a_n = n!/n^n, so a_(n+1)/a_n = (n+1)! n^n / ((n+1)^(n+1) n!) = n^n/(n+1)^n = (1/(1 + 1/n))^n, which tends to 1/e < 1. So the series converges.
(ii) For large n, (n^2 + 1)/(n^4 + 3n) behaves like n^2/n^4 = 1/n^2. Using the limit comparison test with 1/n^2: the ratio of the terms tends to 1, and ∑1/n^2 converges, so the series converges.

(b) Integral test: if f is positive, continuous and decreasing on [N, ∞) and a_n = f(n), then ∑a_n converges if and only if the integral from N to ∞ of f(x) dx converges.
Here f(x) = 1/(x log x) is positive, continuous and decreasing for x ≥ 2. The integral from 2 to R of 1/(x log x) dx = log(log R) - log(log 2), which tends to infinity as R → ∞. So the integral diverges, and therefore ∑1/(n log n) diverges."""
S['MATH0005'] = """(a) (i) This is a subspace. It contains (0,0,0). If (x,y,z) and (x',y',z') satisfy the equation, their sum satisfies (x+x') + (y+y') + (z+z') = 0, and for any scalar λ, λx + λy + λz = λ(0) = 0. So it is closed under addition and scalar multiplication.
(ii) Not a subspace, because (0,0,0) does not satisfy x + y + z = 1.
(iii) Not a subspace. (1,0,0) and (0,1,0) are both in the set (xy = 0), but their sum (1,1,0) has xy = 1, so it is not closed under addition.

(b) If U ⊆ W then U ∪ W = W, which is a subspace (and similarly if W ⊆ U).
Conversely, suppose U ∪ W is a subspace but neither is contained in the other. Then there is u in U not in W, and w in W not in U. Since U ∪ W is a subspace, u + w is in U ∪ W. If u + w is in U, then w = (u + w) - u is in U, a contradiction. If u + w is in W, then u = (u + w) - w is in W, also a contradiction. So one must be contained in the other."""
S['MATH0006'] = """(a) 221 = 2 x 91 + 39
91 = 2 x 39 + 13
39 = 3 x 13 + 0
So gcd(221, 91) = 13.
Working backwards: 13 = 91 - 2 x 39 = 91 - 2 x (221 - 2 x 91) = 5 x 91 - 2 x 221.
So x = -2, y = 5.

(b) Since gcd(91, 221) = 13 and 13 divides 13, there are solutions. Dividing by 13 gives 7z ≡ 1 (mod 17). 7 x 5 = 35 = 2 x 17 + 1, so z ≡ 5 (mod 17).
So the solutions modulo 221 are z = 5, 22, 39, ..., 209, i.e. z = 5 + 17k for k = 0, ..., 12 (13 solutions).

(c) An element is a unit in Z/221Z if it is coprime to 221. 221 = 13 x 17, so the number of units is φ(221) = (13 - 1)(17 - 1) = 12 x 16 = 192."""
S['MATH40002'] = """(a) Let S be non-empty and bounded above. sup S is the real number s such that (i) x ≤ s for all x in S, and (ii) if t is any upper bound of S, then s ≤ t.

(b) Every element 1 - 1/n is less than 1, so 1 is an upper bound. Now take any t < 1. By the Archimedean property, there is n in N with n > 1/(1 - t), so 1/n < 1 - t, which means 1 - 1/n > t. So t is not an upper bound. Hence 1 is the least upper bound, and sup S = 1.

(c) Let x < y. Since y - x > 0, by the Archimedean property there is n in N with 1/n < y - x. Let m be the smallest integer greater than nx, so m - 1 ≤ nx < m. Then x < m/n, and m/n ≤ x + 1/n < x + (y - x) = y. So m/n is a rational number with x < m/n < y."""
S['MATH40004'] = """(a) We need: for every ε > 0 there is δ > 0 such that 0 < |x - 2| < δ implies |(3x + 1) - 7| < ε. Now |(3x + 1) - 7| = |3x - 6| = 3|x - 2|. Choose δ = ε/3. Then if |x - 2| < δ, |(3x + 1) - 7| < 3(ε/3) = ε. So the limit is 7.

(b) Using the Taylor series e^x = 1 + x + x^2/2 + x^3/6 + ..., we get e^x - 1 - x = x^2/2 + x^3/6 + ..., so (e^x - 1 - x)/x^2 = 1/2 + x/6 + ... → 1/2 as x → 0. (L'Hôpital's rule twice gives the same answer.)

(c) f'(0) = lim (f(h) - f(0))/h = lim h^2 sin(1/h)/h = lim h sin(1/h) as h → 0. Since |sin(1/h)| ≤ 1, we have |h sin(1/h)| ≤ |h| → 0, so by the squeeze theorem the limit is 0. So f is differentiable at 0 and f'(0) = 0."""
S['MECH40003'] = """(a) An intensive property does not depend on the size or mass of the system, for example temperature or pressure. An extensive property depends on the size of the system, for example volume or mass. (Dividing an extensive property by mass gives a specific property, such as specific volume, which is intensive.)

(b) Using the ideal gas law pV = mRT:
m = pV/(RT) = (200,000 x 0.5)/(287 x 300) = 100,000/86,100 = 1.16 kg.

(c) A quasi-equilibrium process happens slowly enough that the system passes through a series of equilibrium states, so it is only slightly away from equilibrium at every point. This matters because properties like pressure and temperature are only well-defined for the whole system when it is in equilibrium. It means the process can be drawn as a line on a p-V diagram and the boundary work can be calculated as W = ∫p dV. Real processes are not quasi-equilibrium, but many are close enough for this to be a useful model."""
S['MED41B3'] = """(a) The left anterior descending (LAD) artery, a branch of the left coronary artery.

(b) The ECG gives an immediate picture of the heart's electrical activity, so it can show ischaemia or infarction (such as ST elevation) and which area is affected, and it guides urgent treatment. However, an ECG can be normal or non-specific in some myocardial infarctions. Troponin is released when cardiac muscle cells are damaged, so a rise shows myocardial necrosis, but it takes a few hours to rise and can be raised in other conditions. Using both together improves diagnosis, especially for NSTEMI, where the ECG may not show ST elevation.

(c) Atherosclerosis begins with endothelial damage, allowing LDL to enter the arterial wall, where it is oxidised. Monocytes enter and become macrophages, which take up the LDL and become foam cells, forming a fatty streak. Smooth muscle cells migrate and form a fibrous cap over a lipid core. Inflammation weakens the cap, and if it ruptures, the core is exposed to blood, activating platelets and clotting, which forms a thrombus that can block the artery."""
S['MED52B3'] = """(a) 12-lead ECG: to look for ST elevation or other ischaemic changes, which decides whether he needs emergency reperfusion. High-sensitivity troponin: to confirm myocardial injury, repeated after a few hours. Full blood count: to check for anaemia, which can cause or worsen ischaemia, and before antiplatelet treatment. U&Es: to check renal function and potassium before contrast and drugs. (A chest X-ray could also be done to look for other causes.)

(b) A STEMI shows ST elevation in two or more contiguous leads (or new left bundle branch block), showing full-thickness infarction from a blocked artery. In NSTEMI there is no ST elevation, but there may be ST depression or T wave inversion, or the ECG may be normal, and the diagnosis is made by a raised troponin.

(c) Give aspirin 300 mg, plus a second antiplatelet such as ticagrelor. GTN for the pain and morphine with an antiemetic if needed. Oxygen only if saturations are below 94%. For STEMI, arrange primary PCI if it can be done within 120 minutes, otherwise thrombolysis. Anticoagulation, for example with heparin, is also given."""
S['MSIN0002'] = """A PESTEL list on its own is not a strategy, so the manager needs to move from listing trends to judging which ones matter. First, they should prioritise the trends by how big their impact on the banking sector could be and how likely or uncertain they are. For example, the growth of digital banking and fintech competitors, and interest rate changes, are probably more important than many of the other items. Second, they should consider what the key trends mean for industry structure, for example using Porter's Five Forces, as fintech increases the threat of new entrants and substitutes. The most uncertain high-impact trends can be used to build scenarios. Finally, the manager should link these to the bank's own resources and capabilities to decide on opportunities and threats.

Two weaknesses of PESTEL are that it tends to produce long lists of factors without saying which are most important, and that it is static: it gives a snapshot of the environment at one time, which can quickly become out of date."""
S['MSIN0004'] = """Companies are required to publish audited financial statements prepared under accounting standards mainly because of the separation of ownership and control. Shareholders own the company but managers run it, which creates an agency problem: managers may act in their own interests and have an incentive to present results favourably. If companies could report however they chose, managers could hide losses or overstate profits, as happened at Enron.

Accounting standards, such as IFRS, make financial statements consistent and comparable, so investors can compare companies and years. This reduces information asymmetry. The audit adds credibility because an independent auditor gives an opinion on whether the statements give a true and fair view, so users can rely on them.

Reliable information also benefits the wider economy, because investors and lenders can make better decisions and the cost of capital is lower. Other stakeholders such as lenders, employees and tax authorities also use the accounts.

However, regulation has costs, especially for small companies, and audits do not always detect fraud, as shown by Carillion."""
S['MSIN0012'] = """(a) 120 - 2P = 20 + 3P
100 = 5P
P = 20, Q = 120 - 40 = 80.

(b) With a £5 tax on sellers, supply becomes Qs = 20 + 3(P - 5) = 5 + 3P, where P is the price buyers pay.
120 - 2P = 5 + 3P
115 = 5P
P = 23, so buyers pay £23 and sellers receive 23 - 5 = £18.
Q = 120 - 2(23) = 74.

(c) Buyers pay £3 more than before (23 - 20) and sellers receive £2 less (20 - 18), so buyers bear the larger share, 60% of the tax. This is because the burden falls more on the less elastic side of the market. At the original equilibrium, supply is more responsive to price than demand (the supply slope is 3 compared with 2 for demand), so sellers can pass more of the tax on to buyers."""
S['MTH5123'] = """(a) The equation is separable: dy/(1 + y^2) = x dx.
Integrating both sides: arctan(y) = x^2/2 + C.
So the general solution is y = tan(x^2/2 + C).

(b) dy/y = 2x dx, so ln|y| = x^2 + C, and y = A e^(x^2).
Using y(0) = 3 gives A = 3, so y = 3e^(x^2).

(c) With y(0) = 0 in (a), arctan(0) = 0 so C = 0, and y = tan(x^2/2). tan becomes infinite when its argument reaches π/2, so we need x^2/2 < π/2, i.e. x^2 < π. So the maximal interval is -√π < x < √π."""
S['MTH5129'] = """(a) The density must integrate to 1:
∫0^1 ∫0^1 c(x + y) dy dx = c ∫0^1 (x + 1/2) dx = c(1/2 + 1/2) = c.
So c = 1.

(b) f_X(x) = ∫0^1 (x + y) dy = x + 1/2 for 0 < x < 1, and 0 otherwise.

(c) The conditional density is f(y | x) = f(x, y)/f_X(x) = (x + y)/(x + 1/2). At x = 1/2 this is (1/2 + y)/1 = 1/2 + y.
P(Y > 1/2 | X = 1/2) = ∫1/2^1 (1/2 + y) dy = [y/2 + y^2/2] from 1/2 to 1 = (1/2 + 1/2) - (1/4 + 1/8) = 1 - 3/8 = 5/8.

(d) By symmetry f_Y(y) = y + 1/2. Then f_X(x) f_Y(y) = (x + 1/2)(y + 1/2) = xy + x/2 + y/2 + 1/4, which is not equal to x + y. So X and Y are not independent."""
S['NEUR0004'] = """(a) At rest the membrane is at about -70 mV. A stimulus depolarises it, and if it reaches threshold (about -55 mV), voltage-gated Na+ channels open and Na+ rushes in, causing the rapid rising phase up to about +30 mV. The Na+ channels then inactivate and voltage-gated K+ channels open, so K+ leaves and the membrane repolarises. The K+ channels close slowly, so there is a brief hyperpolarisation (undershoot) before the membrane returns to rest. The Na+/K+ pump maintains the ion gradients.

(b) After an action potential, the Na+ channels in the part of the axon that has just fired are inactivated, so that region is in its refractory period and cannot fire again straight away. So the depolarisation can only spread forward to the next region of the axon, which makes the action potential travel in one direction.

(c) Myelin insulates the axon so current spreads quickly to the next node of Ranvier, where the action potential is regenerated. This saltatory conduction greatly increases conduction velocity."""
S['PALS0007'] = """Gibson's ecological approach says perception is direct: the light reaching the eye (the optic array) contains enough information to specify the environment, especially as the observer moves. Invariants such as texture gradients and optic flow give information about depth and movement, and we perceive affordances, what objects allow us to do, without needing inference. Gregory, in contrast, argued that the retinal image is ambiguous, so the brain must form hypotheses about what is out there using prior knowledge, making perception a kind of unconscious inference.

Evidence for Gregory comes from visual illusions, such as the Müller-Lyer illusion and the hollow face illusion, where knowledge seems to override the sensory input. However, many illusions use artificial or static 2D images, which Gibson would say lack the rich information of real environments. Gibson's theory explains well how people act fluently, for example in driving or catching a ball, but says less about how we recognise objects.

Overall, neither explains everything. Gibson may better explain perception for action and Gregory perception for recognition, which fits Milner and Goodale's two visual streams."""
S['PALS0008'] = """Craik and Lockhart (1972) proposed that memory depends on the depth of processing at encoding rather than on separate memory stores. Shallow processing, such as attending to what a word looks like, leads to poor memory, while deep, semantic processing of its meaning leads to better memory. Craik and Tulving (1975) supported this: words processed semantically were recalled much better than words processed by case or rhyme.

However, the framework has problems. "Depth" is hard to measure independently, so the argument becomes circular: deep processing is defined as what leads to good memory. It also focuses on encoding and says little about retrieval. Morris, Bransford and Franks (1977) showed that rhyme processing led to better performance on a rhyme recognition test, which supports transfer-appropriate processing: memory is best when processing at encoding matches the processing needed at retrieval. Later work also showed that elaboration and distinctiveness matter, not just depth.

So the levels of processing framework was useful in showing encoding matters, but it is an incomplete account."""
S['PH103'] = """The sceptic argues: I cannot know I am not a brain in a vat; if I know I have hands, I would know I am not a brain in a vat; so I do not know I have hands. If this works, we know very little about the external world.

One response is Moore's. He argued he is more certain that he has hands than he is of any of the sceptic's premises, so he can reverse the argument: I know I have hands, so I know I am not a brain in a vat. Many people find this unsatisfying because it seems to assume what is in question.

Another response is contextualism (DeRose, Lewis), which says the standards for "knowing" change with context. In everyday contexts we know we have hands, but when the sceptic raises the brain in a vat, the standards rise and we no longer count as knowing. This explains why the argument seems convincing without meaning we know very little in ordinary life.

So logical possibility alone does not show we lack knowledge, unless we accept that knowledge requires ruling out every possibility, which seems too strict."""
S['PHAS0002'] = """(a) Multiply the top and bottom by the conjugate (1 + 2i):
z = (3 + 4i)(1 + 2i)/((1 - 2i)(1 + 2i)) = (3 + 6i + 4i + 8i^2)/(1 + 4) = (3 - 8 + 10i)/5 = (-5 + 10i)/5 = -1 + 2i.

(b) |z| = sqrt((-1)^2 + 2^2) = sqrt(5) ≈ 2.24.
z is in the second quadrant, so arg z = π - arctan(2/1) = 3.1416 - 1.1071 = 2.03 rad (3 s.f.).

(c) z = -1 + 2i is plotted at (-1, 2) and z* = -1 - 2i at (-1, -2) on the Argand diagram. z* is the reflection of z in the real axis."""
S['PHAS0010'] = """(a) Horizontally there is no force, so x = v0 cosθ t. Vertically, y = v0 sinθ t - g t^2/2. Eliminating t = x/(v0 cosθ):
y = x tanθ - g x^2/(2 v0^2 cos^2θ).

(b) On level ground y = 0 at landing, so x(tanθ - g x/(2 v0^2 cos^2θ)) = 0, giving R = 2 v0^2 sinθ cosθ / g = v0^2 sin(2θ)/g. This is maximised when sin(2θ) = 1, i.e. θ = 45°.

(c) At maximum height the vertical velocity is zero: v0 sinθ - g t = 0, so t = v0 sinθ/g. Then
H = v0^2 sin^2θ/g - v0^2 sin^2θ/(2g) = v0^2 sin^2θ/(2g).
The mass m does not affect the motion.

(d) If launched from a height h, the projectile has extra time in the air before landing, so it is better to throw it at a flatter angle to use more of the speed horizontally. The optimum angle is therefore less than 45°, and it decreases as h increases."""
S['PHIL0003'] = """Realists about universals argue that when two things are both red, there is one thing, the universal redness, that they share. Their main argument is that universals explain similarity: the two things resemble each other because they instantiate the same universal. The claim says we should accept universals only if this explanation is needed, following Ockham's razor.

Nominalists argue we can explain similarity without universals. Resemblance nominalism says things are red because they resemble each other, taking resemblance as basic. Russell objected that resemblance itself would then be a universal. Trope theory says each red thing has its own particular redness (a trope), and similarity is the exact resemblance of tropes. Predicate nominalism says things are red because "red" applies to them, but this seems to get the explanation the wrong way round.

Armstrong argued universals are needed, but only for genuine properties discovered by science. Overall, nominalist accounts face problems but trope theory offers a strong alternative, so it is not clear that similarity requires universals."""
S['PHIL0006'] = """Hume argues that reason alone can never motivate action. Reason has two jobs: discovering relations of ideas, as in maths, and discovering matters of fact, such as cause and effect. Neither can produce a desire on its own. Reason can tell me that exercise causes health, but this only motivates me if I already want to be healthy. So passions (desires) are needed, and "reason is, and ought only to be, the slave of the passions". Since moral judgements do motivate us, Hume concludes they cannot come from reason alone.

This view has been developed into the Humean theory of motivation, which says action needs both a belief and a desire. A strength is that it explains why two people with the same beliefs can act differently.

However, Kantians argue reason can motivate through recognising the moral law. Nagel argues that prudence shows reasons can motivate without a prior desire: I can be moved by my future interests. Hume could reply that a "calm passion" is still involved.

Overall, Hume's argument is persuasive but depends on his narrow view of reason."""
S['PHOL0001'] = """(a) 0.9% NaCl has about the same osmolarity as the inside of the red cell (about 300 mOsm/L), and Na+ and Cl- do not readily cross the membrane, so it is isotonic: there is no net movement of water and the cell keeps its volume. Pure water has much lower osmolarity, so water moves into the cell by osmosis, the cell swells and eventually bursts (lyses), because red cells have no cell wall.

(b) The Na+/K+-ATPase pumps 3 Na+ out of the cell and 2 K+ in. The cell contains many impermeant anions, such as proteins, which would draw water in. By keeping Na+ effectively outside, the pump balances this, so the cell does not swell. If the pump is blocked, Na+ and water enter and the cell swells.

(c) In the intestine, the Na+-glucose cotransporter (SGLT1) on the apical membrane uses the energy of Na+ moving down its concentration gradient into the cell to carry glucose in against its concentration gradient. The low intracellular Na+ is maintained by the Na+/K+-ATPase on the basolateral membrane, so this is secondary active transport. Glucose then leaves the cell by GLUT2."""
S['PHYS40002'] = """(a) F = -dV/dx, so V(x) = -∫F dx = kx^2/2 - bx^4/4, with V(0) = 0.

(b) Equilibrium points are where F = 0: -kx + bx^3 = x(bx^2 - k) = 0, so x = 0 or x = ±sqrt(k/b).
V''(x) = k - 3bx^2. At x = 0, V'' = k > 0, so it is a minimum of V and a stable equilibrium. At x = ±sqrt(k/b), V'' = k - 3k = -2k < 0, so these are maxima and unstable.

(c) The particle escapes if its energy is greater than the height of the potential barrier at x = ±sqrt(k/b):
V(sqrt(k/b)) = k^2/(2b) - k^2/(4b) = k^2/(4b).
At x = 0 its energy is all kinetic, (1/2) m v0^2, so it escapes if (1/2) m v0^2 > k^2/(4b), i.e.
v0 > k/sqrt(2mb)."""
S['POL105'] = """Weber defined legitimacy as the belief that rule is rightful, and argued that authority, power accepted as legitimate, comes in three ideal types: traditional (e.g. monarchy), charismatic (based on a leader's personal qualities) and legal-rational (based on rules and procedures, as in modern bureaucratic states). For Weber, a stable regime cannot rely on force alone and needs belief in legitimacy. This supports the quote: without legitimacy, rule depends on coercion.

However, this may be too simple. Marxist theorists like Gramsci argue that people may obey because of hegemony, where the ruling class's ideas seem like common sense, so consent is manufactured rather than reflecting real legitimacy. Others argue that people obey out of habit, apathy or self-interest, without believing rule is rightful. Lukes' third dimension of power also shows that power can shape people's preferences so they do not even recognise their own interests.

So there can be obedience without legitimacy that is not simply power as force. The quote is partly right, but it ignores forms of power that work through consent."""
S['POL108'] = """The Glorious Revolution of 1688-89, when James II was replaced by William and Mary, is often seen as the foundation of modern British politics. The Bill of Rights 1689 established that the monarch could not suspend laws, levy taxes or keep a standing army in peacetime without Parliament's consent, and required regular parliaments and free elections. This established the principle of parliamentary sovereignty and limited monarchy.

However, the settlement did not create modern democracy. Power stayed with a small landowning elite, and the monarch still had significant powers, such as choosing ministers. Cabinet government and the office of Prime Minister developed later, under Walpole in the 18th century, and the franchise was only gradually extended through the Reform Acts of 1832, 1867 and 1884 and universal suffrage in 1928. The Parliament Acts of 1911 and 1949 also reduced the power of the Lords.

So 1688-89 created the key principle of parliamentary sovereignty, but much of modern British politics developed later through gradual change."""
S['POL110'] = """Lukes argued that power is an essentially contested concept, meaning people disagree about it in ways that reflect their values. This can be seen in competing accounts of power.

Dahl's one-dimensional view says A has power over B if A gets B to do something they would not otherwise do, which can be seen in observable decisions. Bachrach and Baratz added a second dimension: power is also exercised by keeping issues off the agenda (non-decision-making). Lukes added a third dimension, where power shapes people's preferences so that conflict never arises, which links to ideas of false consciousness. Foucault went further, arguing power is not held by anyone but is spread through everyday practices and knowledge.

The disagreement between these is not just about evidence but about values, for example whether we can say people's "real interests" differ from what they want, which is a normative claim. This supports the idea that power is essentially contested.

However, the views overlap, and some argue the concept can still be used clearly if defined for a particular purpose."""
S['POL263'] = """In The Prince, Machiavelli advises that a ruler must "learn to be able not to be good" and use cruelty and deception when necessary, and that it is safer to be feared than loved. This seems to support the view that he tells rulers to abandon morality for success.

However, other readings are possible. Machiavelli is concerned with the stability of the state, and he argues that cruelty "well used" can prevent greater disorder and suffering, as with Cesare Borgia in the Romagna. This suggests a different kind of morality, a political ethic focused on outcomes, rather than abandoning morality. Isaiah Berlin argued that Machiavelli separates two incompatible moral systems: Christian virtue and the pagan civic virtue needed for politics. In the Discourses, he also praises republics and the common good.

Some, like Rousseau, have even read The Prince as satire exposing tyrants. So the claim is too simple: Machiavelli argues that politics needs a different morality, not none at all."""
S['POLS0002'] = """Comparison is important for explaining political systems because it lets us test theories. Studying one country shows what happened but not why. By comparing cases, we can see which factors are associated with outcomes. For example, Lijphart compared democracies to argue that consensus democracies perform better on some measures than majoritarian ones. Mill's methods of agreement and difference provide a logic for this, and the most similar systems design compares similar countries that differ on the outcome to isolate the cause.

However, the comparative method has weaknesses. There are often "many variables, small N", so it is hard to rule out other explanations. Case selection can bias results, especially selecting on the dependent variable, such as only studying revolutions that happened. Concepts like "democracy" may also mean different things in different countries ("conceptual stretching", Sartori).

Comparison is not the only way to explain: single case studies can trace causal processes in depth, and experiments are increasingly used. So comparison is very valuable, but the claim that it is the only way is too strong."""
S['POLS0006'] = """The claim reflects the fact-value distinction: political science, like other sciences, studies how the world is using evidence, while normative political theory asks how it ought to be. Behaviouralists argued political science should be value-free and focus on observable behaviour.

There is some truth in this. Empirical research can tell us, for example, whether proportional representation increases turnout, but it cannot on its own tell us whether higher turnout is good.

However, the distinction is not so clear. Values influence what questions researchers choose and how they define concepts like democracy or power. Empirical findings can also be relevant to normative questions, because "ought implies can": if a policy is impossible or has bad effects, that affects whether we should support it. Normative theorists also make empirical assumptions about human nature and institutions.

So political science cannot by itself decide what ought to be, but it is not completely separate from normative questions and can inform them."""
S['POLS0061'] = """The claim describes negative freedom. Hobbes saw freedom as the absence of external impediments, and Berlin defined negative liberty as the area in which a person can act without interference from others. This view protects individuals from coercion by the state.

However, other conceptions challenge it. Berlin also described positive liberty, being one's own master, which focuses on self-government and acting on one's rational will. Berlin worried this could be used to justify coercion "for people's own good". Republicans such as Pettit argue freedom is non-domination: a slave with a kind master who never interferes is still unfree, because they are subject to the master's arbitrary power. This shows freedom can be lost without any actual interference.

Taylor also argued that negative liberty is an "opportunity concept" and that freedom should be understood as an exercise concept, actually being able to direct one's life.

So freedom cannot simply be the absence of interference, as the republican example shows domination matters too."""
S['PSY121'] = """(a) When a neuron is depolarised to threshold, voltage-gated Na+ channels open and Na+ flows in, rapidly depolarising the membrane. Then the Na+ channels inactivate and voltage-gated K+ channels open, so K+ flows out and repolarises the membrane, with a brief hyperpolarisation. In a myelinated axon, the myelin insulates the axon so current flows quickly along the inside to the next node of Ranvier, where the channels are concentrated and the action potential is regenerated. The action potential "jumps" between nodes (saltatory conduction), which is faster and uses less energy.

(b) An EPSP is a small depolarisation of the postsynaptic membrane, usually caused by Na+ entry, which makes firing more likely. An IPSP is a hyperpolarisation, often by Cl- entry or K+ exit, which makes firing less likely. Temporal summation is when PSPs from the same synapse arrive close together in time and add up. Spatial summation is when PSPs from different synapses add together. If the total reaches threshold at the axon hillock, the neuron fires.

(c) Oligodendrocytes and Schwann cells form myelin. Astrocytes support neurons and help regulate the chemical environment."""
S['PSY211'] = """Cognitive neuropsychology studies people with brain damage to learn about the normal cognitive system. It assumes the mind is modular, so damage can impair one function while sparing others.

Its main contribution is the use of dissociations. A double dissociation between two patients shows that two functions rely on separate processes. For example, patient HM had severe anterograde amnesia but could learn new motor skills, suggesting separate systems for declarative and procedural memory. KF had impaired short-term memory but normal long-term learning, which challenged the multi-store model's assumption that information must pass through STM. In reading, the contrast between surface and deep dyslexia supported dual-route models of reading.

However, there are limitations. Brain damage is rarely limited to one area, and patients may develop compensatory strategies, so performance may not reflect the normal system. The approach relies on single cases, which makes generalisation hard. The assumption of modularity may also be too strong, as many functions depend on networks.

Overall, cognitive neuropsychology has made important contributions, especially when combined with other methods such as neuroimaging."""
S['PSY215'] = """Deception is used in social psychology to stop participants changing their behaviour because they know the aim of a study (demand characteristics). For example, in Milgram's obedience studies, participants believed they were giving real shocks, and in Asch's conformity studies, the other group members were confederates. Without deception, these studies could not have shown how people really behave.

However, deception has ethical costs. It prevents fully informed consent, and it can cause distress, as some of Milgram's participants were very anxious. It may also reduce trust in psychologists. Methodologically, if participants expect to be deceived, they may become suspicious and behave differently, which reduces validity. Repeated deception could make this worse.

The BPS Code of Ethics allows deception only when there is no alternative and the study is important, with full debriefing afterwards. Alternatives such as role-play have been suggested, but these may not produce realistic behaviour.

So deception can be justified in some cases, if the scientific value is high and harm is minimised, but it should be a last resort."""
S['ST102'] = """(a) Mean = (2 + 4 + 4 + 6 + 9 + 15)/6 = 40/6 = 6.67.
Median = average of the 3rd and 4th values = (4 + 6)/2 = 5.
Sample variance: the deviations from the mean are -4.67, -2.67, -2.67, -0.67, 2.33, 8.33. Their squares are 21.78, 7.11, 7.11, 0.44, 5.44, 69.44, which sum to 111.33.
s^2 = 111.33/(6 - 1) = 22.27.

(b) Lower half: 2, 4, 4, so Q1 = 4. Upper half: 6, 9, 15, so Q3 = 9.
IQR = 9 - 4 = 5.

(c) Upper fence = Q3 + 1.5 x IQR = 9 + 7.5 = 16.5. Since 15 < 16.5, 15 is not an outlier by this rule.
The mean (6.67) is greater than the median (5), and the largest value is far from the rest, so the data are positively (right) skewed."""
S['STAT0002'] = """(a) P(M ∪ P) = P(M) + P(P) - P(M ∩ P) = 120/200 + 90/200 - 50/200 = 160/200 = 0.8.

(b) P(neither) = 1 - P(M ∪ P) = 1 - 0.8 = 0.2.

(c) Only mathematics: 120 - 50 = 70 students. Only physics: 90 - 50 = 40 students. So exactly one subject: 110 students, and the probability is 110/200 = 0.55.

(d) No. Mutually exclusive means they cannot happen together, i.e. P(M ∩ P) = 0. Here P(M ∩ P) = 50/200 = 0.25, which is not 0, since 50 students study both."""
S['STAT0003'] = """(a) A and A^c are disjoint and A ∪ A^c = S, so by the axioms P(A) + P(A^c) = P(S) = 1, giving P(A^c) = 1 - P(A).
For the union, write A ∪ B as the disjoint union of A and B ∩ A^c, so P(A ∪ B) = P(A) + P(B ∩ A^c). Also B is the disjoint union of B ∩ A and B ∩ A^c, so P(B) = P(A ∩ B) + P(B ∩ A^c). Subtracting gives P(A ∪ B) = P(A) + P(B) - P(A ∩ B).

(b) Choose 2 of the 4 aces, 2 of the 4 kings and 1 card from the 44 that are neither:
C(4,2) x C(4,2) x C(44,1) = 6 x 6 x 44 = 1584.
Total hands = C(52,5) = 2,598,960.
Probability = 1584/2,598,960 ≈ 0.000609.

(c) P(at least one ace) = 1 - P(no aces) = 1 - C(48,5)/C(52,5) = 1 - 1,712,304/2,598,960 = 1 - 0.6588 = 0.341."""
