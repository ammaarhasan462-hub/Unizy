"""Top-up for Imperial ELEC40013 Mathematics 1A: 3 recall + 1 exam per topic.
Run: python3 tools/packs/elec40013.py > /tmp/elec40013.sql"""
from common import R, E, emit

T = {}
T[0] = [  # Complex numbers and phasors
    R("Find the modulus and principal argument of z = −1 + j.",
      "|z| = √(1 + 1) = √2. z is in the second quadrant, so arg z = π − π/4 = 3π/4. Hence z = √2 e^{j3π/4}."),
    R("State three properties of the complex conjugate.",
      "z z* = |z|²; (z₁z₂)* = z₁* z₂* and (z₁ + z₂)* = z₁* + z₂*; Re z = (z + z*)/2. Non-real roots of a polynomial with real coefficients come in conjugate pairs."),
    R("Write the phasor for v(t) = 10 cos(ωt − 30°), and say what differentiation does to a phasor.",
      "V = 10∠−30° = 10e^{−jπ/6}, with v(t) = Re{V e^{jωt}}. Differentiating in time multiplies the phasor by jω (a 90° phase lead and scaling by ω)."),
    E("(a) Find the three cube roots of 8j in Cartesian form and describe their positions on an Argand diagram. [4]\n"
      "(b) Use phasors to write 3 cos ωt + 4 sin ωt in the form R cos(ωt − φ). [3]\n"
      "(c) A series circuit has R = 3 Ω and inductive reactance ωL = 4 Ω. Find the current phasor for a voltage 10∠0° V. [3]\n[10 marks]",
      ["8j = 8e^{jπ/2}, so the roots are 2e^{j(π/6 + 2kπ/3)}, k = 0, 1, 2.",
       "k = 0: 2e^{jπ/6} = √3 + j; k = 1: 2e^{j5π/6} = −√3 + j; k = 2: 2e^{j3π/2} = −2j.",
       "They lie on a circle of radius 2, spaced 120° apart.",
       "cos ωt ↔ 3, sin ωt = cos(ωt − 90°) ↔ −4j. Sum 3 − 4j = 5∠−53.1°, so 5 cos(ωt − 53.1°).",
       "Z = 3 + 4j = 5∠53.1° Ω; I = 10∠0°/5∠53.1° = 2∠−53.1° A (current lags voltage)."],
      ["Write 8j in polar form: modulus 8, argument π/2.",
       "Cube root: modulus 8^{1/3} = 2, arguments π/6, 5π/6, 3π/2.",
       "Convert: √3 + j, −√3 + j, −2j; equally spaced at 120° on |z| = 2.",
       "Phasor sum 3 − 4j has modulus 5 and angle −tan⁻¹(4/3) = −53.1°.",
       "I = V/Z = 10/(5∠53.1°) = 2∠−53.1° A."],
      "Finds all three roots with the 2kπ/3 spacing, handles sin as a −90° phasor, and gives the current with correct lag.",
      "Correct roots and phasor sum with a sign slip in the phase.",
      "Gives only one cube root, or treats sin ωt as the phasor +4j."),
]
T[1] = [  # Functions, limits and continuity
    R("Define even and odd functions and classify cosh x and sinh x.",
      "f is even if f(−x) = f(x) (symmetric about the y-axis) and odd if f(−x) = −f(x) (rotational symmetry about the origin). cosh x is even and sinh x is odd."),
    R("State two standard limits involving sin x and e.",
      "lim_{x→0} (sin x)/x = 1 (x in radians), and lim_{n→∞} (1 + 1/n)ⁿ = e. Also lim_{x→0} (eˣ − 1)/x = 1."),
    R("When does a function have an inverse, and how are their graphs related?",
      "A function has an inverse on a domain where it is one-to-one (e.g. strictly increasing or decreasing). The graph of f⁻¹ is the reflection of the graph of f in the line y = x."),
    E("(a) Show that sinh⁻¹x = ln(x + √(x² + 1)). [4]\n"
      "(b) Evaluate lim_{x→0} (1 − cos x)/x². [2]\n"
      "(c) f(x) = (x² − 4)/(x − 2) for x ≠ 2 and f(2) = k. Find k so that f is continuous. [2]\n"
      "(d) Evaluate lim_{x→∞} (√(x² + x) − x). [2]\n[10 marks]",
      ["Let y = sinh⁻¹x, so x = (eʸ − e⁻ʸ)/2, giving e²ʸ − 2x eʸ − 1 = 0.",
       "Quadratic in eʸ: eʸ = x ± √(x² + 1); take + since eʸ > 0. So y = ln(x + √(x² + 1)).",
       "1 − cos x = 2 sin²(x/2), so the limit is lim 2 sin²(x/2)/x² = 2 × ¼ = ½.",
       "(x² − 4)/(x − 2) = x + 2 for x ≠ 2, which → 4, so k = 4.",
       "Multiply by the conjugate: x/(√(x² + x) + x) = 1/(√(1 + 1/x) + 1) → ½."],
      ["Set x = sinh y and multiply by 2eʸ: e²ʸ − 2xeʸ − 1 = 0.",
       "Solve for eʸ and reject the negative root.",
       "Use 1 − cos x = 2sin²(x/2) and sin u/u → 1: limit ½.",
       "Factor x² − 4 = (x − 2)(x + 2): limit 4, so k = 4.",
       "Rationalise √(x² + x) − x and divide by x: limit ½."],
      "Rigorous derivation including why the negative root is rejected, and each limit justified by a standard result rather than by guesswork.",
      "Correct answers with one step (e.g. root choice) not justified.",
      "Uses L'Hôpital incorrectly on a non-indeterminate form, or gives k = 0."),
]
T[2] = [  # Differentiation and its applications
    R("Give the derivatives of sinh x, cosh x and tan⁻¹x.",
      "d/dx sinh x = cosh x; d/dx cosh x = sinh x (no minus sign, unlike cos); d/dx tan⁻¹x = 1/(1 + x²)."),
    R("How do you find dy/dx and d²y/dx² for a curve given parametrically as x(t), y(t)?",
      "dy/dx = (dy/dt)/(dx/dt). d²y/dx² = [d/dt(dy/dx)] / (dx/dt), not d²y/dt² ÷ d²x/dt²."),
    R("How does the second derivative test classify a stationary point?",
      "At f′(a) = 0: f″(a) > 0 gives a local minimum, f″(a) < 0 a local maximum. If f″(a) = 0 the test is inconclusive; check the sign change of f′ or higher derivatives."),
    E("(a) For f(x) = x³ − 6x² + 9x + 1, find and classify the stationary points and find the point of inflection. [5]\n"
      "(b) A curve is given by x = t², y = t³ − 3t. Find dy/dx in terms of t and the points where the tangent is horizontal. [5]\n[10 marks]",
      ["f′(x) = 3x² − 12x + 9 = 3(x − 1)(x − 3): stationary at x = 1 and x = 3.",
       "f″(x) = 6x − 12: f″(1) = −6 < 0, maximum at (1, 5); f″(3) = 6 > 0, minimum at (3, 1).",
       "f″ = 0 at x = 2 and changes sign there: inflection at (2, 3).",
       "dy/dx = (3t² − 3)/(2t), for t ≠ 0.",
       "Horizontal tangents where dy/dt = 0 and dx/dt ≠ 0: t = ±1, giving (1, −2) and (1, 2)."],
      ["Differentiate and factor: 3(x − 1)(x − 3).",
       "Evaluate f: f(1) = 5, f(3) = 1; f″ gives max at x = 1, min at x = 3.",
       "Inflection where f″ = 6x − 12 = 0: x = 2, f(2) = 3, with a sign change.",
       "Parametric: dx/dt = 2t, dy/dt = 3t² − 3, so dy/dx = 3(t² − 1)/(2t).",
       "t = 1 gives (1, −2); t = −1 gives (1, 2)."],
      "Classifies with reasons, confirms the sign change at the inflection, and checks dx/dt ≠ 0 for the horizontal tangents.",
      "Correct points with classification but no justification of the inflection.",
      "Sets dy/dx = 0 by setting dx/dt = 0, or mixes up maximum and minimum."),
]
T[3] = [  # Integration techniques
    R("Give the standard integrals of 1/(x² + a²) and 1/√(a² − x²).",
      "∫ dx/(x² + a²) = (1/a) tan⁻¹(x/a) + C. ∫ dx/√(a² − x²) = sin⁻¹(x/a) + C (for |x| < a)."),
    R("For which p does ∫₁^∞ x^{−p} dx converge, and what is its value?",
      "It converges for p > 1, with value 1/(p − 1). For p ≤ 1 it diverges (p = 1 gives ln x → ∞)."),
    R("When substituting in a definite integral, what must you do with the limits?",
      "Change them to the corresponding values of the new variable (or substitute back before evaluating). Then you do not need to return to the original variable."),
    E("Evaluate:\n(a) ∫ x² ln x dx. [3]\n(b) ∫₀^{π/2} sin³x dx. [3]\n(c) ∫ dx/(x² + 4x + 13). [2]\n(d) ∫₀^∞ x e^{−x} dx. [2]\n[10 marks]",
      ["(a) By parts with u = ln x, dv = x² dx: (x³/3) ln x − ∫ x²/3 dx = (x³/3) ln x − x³/9 + C.",
       "(b) sin³x = sin x(1 − cos²x); with u = cos x, du = −sin x dx: ∫₀¹ (1 − u²) du = 2/3.",
       "(c) Complete the square: (x + 2)² + 9, so the integral is (1/3) tan⁻¹((x + 2)/3) + C.",
       "(d) By parts: [−x e^{−x}]₀^∞ + ∫₀^∞ e^{−x} dx = 0 + 1 = 1."],
      ["(a) Choose u = ln x because its derivative 1/x simplifies; v = x³/3.",
       "(a) Result (x³/3)ln x − x³/9 + C.",
       "(b) Substitute u = cos x; limits x = 0 → u = 1, x = π/2 → u = 0; flip the sign to get ∫₀¹(1 − u²)du = 2/3.",
       "(c) x² + 4x + 13 = (x + 2)² + 3²: standard tan⁻¹ form.",
       "(d) Limit x e^{−x} → 0 as x → ∞, so the integral is 1 (it equals Γ(2) = 1)."],
      "Chooses u sensibly, changes limits correctly in (b), completes the square, and justifies the vanishing boundary term in (d).",
      "Correct results with limits not changed explicitly or the boundary term assumed.",
      "Takes u = x² in (a) and gets stuck, or gives −2/3 in (b) by not flipping limits."),
]
T[4] = [  # Sequences, series and Taylor expansions
    R("Give the sum of a geometric series and its condition for convergence.",
      "Σ_{n=0}^∞ arⁿ = a/(1 − r) for |r| < 1. The partial sum is a(1 − r^{N})/(1 − r). It diverges for |r| ≥ 1 (a ≠ 0)."),
    R("State Taylor's series for f(x) about x = a.",
      "f(x) = Σ_{n=0}^∞ f⁽ⁿ⁾(a)(x − a)ⁿ/n! = f(a) + f′(a)(x − a) + f″(a)(x − a)²/2! + … The Maclaurin series is the case a = 0."),
    R("Does the harmonic series converge? What about the alternating harmonic series?",
      "Σ 1/n diverges (its partial sums grow like ln n). Σ (−1)^{n+1}/n converges to ln 2 by the alternating series test, but only conditionally, since the series of absolute values diverges."),
    E("(a) Find the Maclaurin series of ln(1 + x) up to x⁴ and state its radius of convergence. [3]\n"
      "(b) Use series to evaluate lim_{x→0} (eˣ − 1 − x)/x². [2]\n"
      "(c) Use the binomial series to estimate √1.1 to 4 decimal places, and bound the error from the next term. [3]\n"
      "(d) Use the ratio test to show Σ n/2ⁿ converges. [2]\n[10 marks]",
      ["ln(1 + x) = x − x²/2 + x³/3 − x⁴/4 + …, radius of convergence 1 (valid for −1 < x ≤ 1).",
       "eˣ − 1 − x = x²/2 + x³/6 + …, so the limit is ½.",
       "√(1 + x) ≈ 1 + x/2 − x²/8 with x = 0.1: 1 + 0.05 − 0.00125 = 1.04875.",
       "Next term + x³/16 = 0.0000625, so √1.1 ≈ 1.0488 (true value 1.04881).",
       "Ratio a_{n+1}/a_n = (n + 1)/(2n) → ½ < 1, so it converges (its sum is 2)."],
      ["Integrate 1/(1 + x) = 1 − x + x² − x³ + … term by term.",
       "Series of eˣ: subtract 1 + x and divide by x²: limit ½.",
       "Binomial with n = ½: coefficients 1, ½, −⅛, +1/16.",
       "Estimate 1.04875 + 0.0000625 ≈ 1.04881, giving 1.0488 to 4 d.p.",
       "Ratio (n + 1)/2n → ½: convergent."],
      "Derives series rather than quoting, includes the error term, and applies the ratio test with the limit computed.",
      "Correct series and limit but the error estimate missing.",
      "Gives ln(1 + x) with all positive signs, or concludes divergence from a ratio of ½."),
]
T[5] = [  # Linear algebra: vectors and matrices
    R("State three properties of determinants.",
      "det(AB) = det A · det B; det(Aᵀ) = det A; swapping two rows changes the sign, and a matrix with two equal rows (or a zero row) has determinant 0. Also det(kA) = kⁿ det A for n × n A."),
    R("When are n vectors in ℝⁿ linearly independent?",
      "When the only solution of c₁v₁ + … + cₙvₙ = 0 is all cᵢ = 0. Equivalently, the matrix with the vectors as columns has non-zero determinant (full rank)."),
    R("What does the scalar triple product a · (b × c) represent?",
      "The signed volume of the parallelepiped with edges a, b, c. It equals the 3 × 3 determinant with rows a, b, c, and is zero exactly when the vectors are coplanar."),
    E("Let A = [[2, 1, 0], [1, 3, 1], [0, 1, 2]].\n"
      "(a) Find det A. [2]\n"
      "(b) Find A⁻¹ using cofactors. [4]\n"
      "(c) Hence solve Ax = (3, 5, 3)ᵀ. [2]\n"
      "(d) Find the angle between u = (1, 0, 1) and v = (0, 1, 1), and u × v. [2]\n[10 marks]",
      ["det A = 2(3·2 − 1·1) − 1(1·2 − 1·0) + 0 = 10 − 2 = 8.",
       "Cofactor matrix (symmetric here): [[5, −2, 1], [−2, 4, −2], [1, −2, 5]].",
       "A⁻¹ = (1/8)[[5, −2, 1], [−2, 4, −2], [1, −2, 5]]; check: first row of A times first column of adj = 10 − 2 = 8.",
       "x = A⁻¹b = (1/8)(15 − 10 + 3, −6 + 20 − 6, 3 − 10 + 15) = (1, 1, 1). Check: (2 + 1, 1 + 3 + 1, 1 + 2) = (3, 5, 3).",
       "u · v = 1, |u| = |v| = √2, cos θ = ½, θ = 60°. u × v = (−1, −1, 1)."],
      ["Expand along the first row: 2 × 5 − 1 × 2 = 8.",
       "Compute each 2 × 2 minor with the checkerboard signs.",
       "Transpose the cofactors (adjugate) and divide by 8; verify A·A⁻¹ = I for one entry.",
       "Multiply A⁻¹ by b to get (1, 1, 1) and substitute back.",
       "Dot product for the angle (60°), determinant formula for the cross product."],
      "Accurate cofactors with signs, verifies the inverse and the solution, and computes both vector products correctly.",
      "Correct determinant and inverse with a sign slip in one cofactor.",
      "Forgets the checkerboard signs, or divides by det A twice."),
]
T[6] = [  # Eigenvalues, eigenvectors and diagonalisation
    R("How are the eigenvalues of a matrix related to its trace and determinant?",
      "The sum of the eigenvalues (with multiplicity) equals the trace; their product equals the determinant. So a matrix is singular exactly when 0 is an eigenvalue."),
    R("What does it mean to diagonalise A, and when is it possible?",
      "Write A = PDP⁻¹ with D diagonal (the eigenvalues) and P's columns the eigenvectors. It is possible when A has n linearly independent eigenvectors, for example when its n eigenvalues are distinct. Then Aᵏ = PDᵏP⁻¹."),
    R("What are the eigenvalues of a triangular matrix?",
      "Its diagonal entries, because det(A − λI) is the product of (aᵢᵢ − λ)."),
    E("Let A = [[5, −2], [4, −1]].\n"
      "(a) Find the eigenvalues and eigenvectors of A. [4]\n"
      "(b) Write A = PDP⁻¹ and hence find a formula for Aⁿ. [4]\n"
      "(c) Evaluate A⁵. [2]\n[10 marks]",
      ["Characteristic equation λ² − 4λ + 3 = 0 (trace 4, det −5 + 8 = 3), so λ = 1, 3.",
       "λ = 1: (A − I)v = 0 with rows (4, −2) gives v = (1, 2). λ = 3: rows (2, −2) give v = (1, 1).",
       "P = [[1, 1], [2, 1]], D = diag(1, 3), P⁻¹ = [[−1, 1], [2, −1]].",
       "Aⁿ = PDⁿP⁻¹ = [[2·3ⁿ − 1, 1 − 3ⁿ], [2·3ⁿ − 2, 2 − 3ⁿ]]. Check n = 1 gives A.",
       "3⁵ = 243: A⁵ = [[485, −242], [484, −241]]."],
      ["λ² − (tr A)λ + det A = λ² − 4λ + 3 = (λ − 1)(λ − 3).",
       "Solve (A − λI)v = 0 for each λ: v₁ = (1, 2), v₃ = (1, 1).",
       "P = [v₁ v₃], det P = −1, so P⁻¹ = [[−1, 1], [2, −1]].",
       "Multiply P Dⁿ P⁻¹ and simplify; verify with n = 1.",
       "Substitute 3⁵ = 243."],
      "Correct eigenpairs, inverse of P, a verified general formula and the numerical power.",
      "Correct eigenpairs and P, with an algebra slip in Aⁿ.",
      "Puts eigenvectors in rows of P, or orders D inconsistently with P."),
]
T[7] = [  # Ordinary differential equations
    R("What are the order and linearity of an ODE?",
      "The order is the highest derivative present. An ODE is linear if the unknown y and its derivatives appear only to the first power, not multiplied together or inside functions (coefficients may depend on x)."),
    R("What is the structure of the general solution of a linear non-homogeneous ODE?",
      "y = y_c + y_p: the complementary function y_c (general solution of the homogeneous equation, with arbitrary constants) plus any one particular integral y_p of the full equation."),
    R("What trial particular integrals are used for polynomial, exponential and sinusoidal right-hand sides?",
      "Polynomial of degree n: general polynomial of degree n. e^{kx}: Ae^{kx}. sin ωx or cos ωx: A cos ωx + B sin ωx. If the trial already solves the homogeneous equation, multiply it by x (or x² for a repeated root)."),
    E("(a) Solve y″ − 3y′ + 2y = 4e^{3x} with y(0) = 0, y′(0) = 1. [6]\n"
      "(b) If the right-hand side were 4e^{2x} instead, explain why the trial Ae^{2x} fails and find the particular integral. [4]\n[10 marks]",
      ["Auxiliary m² − 3m + 2 = 0 gives m = 1, 2: y_c = C₁eˣ + C₂e^{2x}.",
       "Trial Ae^{3x}: (9 − 9 + 2)A = 4, so A = 2.",
       "y(0) = 0: C₁ + C₂ + 2 = 0. y′(0) = 1: C₁ + 2C₂ + 6 = 1. So C₂ = −3, C₁ = 1.",
       "y = eˣ − 3e^{2x} + 2e^{3x}. Check: y(0) = 0, y′(0) = 1 − 6 + 6 = 1.",
       "e^{2x} is part of y_c, so Ae^{2x} gives 0 on the left: try Bxe^{2x}.",
       "Substituting gives Be^{2x}(4 + 4x − 3 − 6x + 2x) = Be^{2x} = 4e^{2x}, so y_p = 4xe^{2x}."],
      ["Roots 1 and 2: y_c = C₁eˣ + C₂e^{2x}.",
       "PI: 2A = 4, A = 2.",
       "Apply both initial conditions to the full solution: C₁ = 1, C₂ = −3.",
       "Solution eˣ − 3e^{2x} + 2e^{3x}, verified at x = 0.",
       "Resonant case: multiply by x; y_p = 4xe^{2x}."],
      "Applies initial conditions to the full solution (not just y_c), verifies it, and explains the resonance modification with full substitution.",
      "Correct solution with initial conditions applied to y_c only, then corrected, or the x factor used without explanation.",
      "Applies initial conditions before adding the particular integral, or keeps Ae^{2x} as the trial."),
]

emit("ELEC40013", T, 64)
