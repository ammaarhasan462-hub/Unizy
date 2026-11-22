"""Top-up for Imperial ELEC40014 Mathematics 1B: 3 recall + 1 exam per topic.
Also fixes the garbled topic 6 exam question.
Run: python3 tools/packs/elec40014.py > /tmp/elec40014.sql"""
from common import R, E, emit

T = {}
T[0] = [  # Complex numbers and complex functions
    R("Write sin θ in terms of complex exponentials.",
      "sin θ = (e^{jθ} − e^{−jθ})/(2j), and cos θ = (e^{jθ} + e^{−jθ})/2. Both follow from Euler's formula e^{jθ} = cos θ + j sin θ."),
    R("Describe the loci |z − a| = r and arg(z − a) = θ in the Argand diagram.",
      "|z − a| = r is a circle of radius r centred at a. arg(z − a) = θ is a half-line starting at a (not including a) at angle θ to the positive real direction."),
    R("Why is the complex logarithm multi-valued, and what is its principal value?",
      "ln z = ln|z| + j(arg z + 2kπ) for any integer k, because e^{j2kπ} = 1. The principal value Ln z uses the principal argument in (−π, π]."),
    E("(a) Evaluate (1 + j)⁸. [2]\n"
      "(b) Find the principal value of ln(−1 − j√3). [2]\n"
      "(c) Find all z with eᶻ = 1 + j. [3]\n"
      "(d) Show that cos(jx) = cosh x and sin(jx) = j sinh x. [3]\n[10 marks]",
      ["1 + j = √2 e^{jπ/4}, so (1 + j)⁸ = 2⁴ e^{j2π} = 16.",
       "|−1 − j√3| = 2 and the principal argument is −2π/3, so Ln = ln 2 − j2π/3.",
       "Write z = x + jy: eˣe^{jy} = √2 e^{jπ/4}, so x = ½ ln 2 and y = π/4 + 2kπ.",
       "cos(jx) = (e^{j·jx} + e^{−j·jx})/2 = (e^{−x} + eˣ)/2 = cosh x.",
       "sin(jx) = (e^{−x} − eˣ)/(2j) = j(eˣ − e^{−x})/2 = j sinh x."],
      ["Polar form of 1 + j: √2∠45°; raise to the 8th power: 16∠360° = 16.",
       "Third quadrant point: angle −π + π/3 = −2π/3.",
       "Match modulus and argument: e^x = √2, y = π/4 + 2kπ.",
       "Substitute θ = jx into the exponential forms.",
       "Use 1/j = −j to simplify the sine."],
      "Uses polar forms throughout, gives the principal argument in the right quadrant, includes all solutions in (c), and shows both identities.",
      "Correct answers with the 2kπ family missing in (c).",
      "Gives the argument of −1 − j√3 as π/3, or computes (1 + j)⁸ by repeated expansion with errors."),
]
T[1] = [  # Linear algebra: systems and matrices
    R("How do the elementary row operations change a determinant?",
      "Swapping two rows multiplies det by −1; multiplying a row by k multiplies det by k; adding a multiple of one row to another leaves det unchanged."),
    R("State Cramer's rule.",
      "For Ax = b with det A ≠ 0, xᵢ = det(Aᵢ)/det A, where Aᵢ is A with column i replaced by b. It is convenient for 2 × 2 and 3 × 3 systems but inefficient for large ones."),
    R("What is an LU decomposition and why is it useful?",
      "A = LU with L lower triangular (unit diagonal) and U upper triangular, found by Gaussian elimination. Solve Ly = b by forward substitution, then Ux = y by back substitution; once L and U are known, each new right-hand side is cheap to solve."),
    E("A two-mesh circuit has a 10 V source and 2 Ω resistor in mesh 1, a 6 Ω resistor in mesh 2, and a 4 Ω resistor shared by both meshes. With clockwise mesh currents I₁, I₂:\n"
      "(a) Write the mesh equations in matrix form. [2]\n"
      "(b) Solve for I₁ and I₂ using Cramer's rule, and find the current in the 4 Ω resistor. [4]\n"
      "(c) Find the LU decomposition of the coefficient matrix and use it to check det A. [4]\n[10 marks]",
      ["Mesh 1: 6I₁ − 4I₂ = 10. Mesh 2: −4I₁ + 10I₂ = 0. So [[6, −4], [−4, 10]] (I₁, I₂)ᵀ = (10, 0)ᵀ.",
       "det A = 60 − 16 = 44.",
       "I₁ = det[[10, −4], [0, 10]]/44 = 100/44 ≈ 2.27 A; I₂ = det[[6, 10], [−4, 0]]/44 = 40/44 ≈ 0.909 A.",
       "Current in the 4 Ω resistor = I₁ − I₂ ≈ 1.36 A. Check: 1.36 × 4 = 5.45 V = 0.909 × 6, as it must be (they are in parallel).",
       "L = [[1, 0], [−2/3, 1]], U = [[6, −4], [0, 22/3]].",
       "det A = det L × det U = 1 × 6 × 22/3 = 44, as before."],
      ["Mesh 1 self-resistance 2 + 4 = 6, mesh 2 self-resistance 4 + 6 = 10, mutual −4.",
       "det A = 44.",
       "Cramer: I₁ = 100/44, I₂ = 40/44.",
       "Shared resistor current I₁ − I₂ = 60/44 ≈ 1.36 A; voltage check across the parallel branches.",
       "Eliminate with multiplier −4/6 = −2/3: U₂₂ = 10 − (2/3)(4) = 22/3; det = 6 × 22/3 = 44."],
      "Sets up mesh equations with correct mutual terms, solves exactly, checks physically, and gives an LU factorisation consistent with the determinant.",
      "Correct currents but no physical check, or L with the wrong sign of the multiplier.",
      "Mutual resistance with the wrong sign, or treats the shared resistor current as I₁ + I₂."),
]
T[2] = [  # Eigenvalues, eigenvectors and diagonalisation
    R("Write the characteristic equation of a 2 × 2 matrix in terms of its trace and determinant.",
      "λ² − (tr A)λ + det A = 0. For A = [[a, b], [c, d]], tr A = a + d and det A = ad − bc."),
    R("What is orthogonal diagonalisation of a symmetric matrix?",
      "A real symmetric matrix can be written A = QDQᵀ, where Q's columns are orthonormal eigenvectors (Qᵀ = Q⁻¹) and D is diagonal with real eigenvalues."),
    R("Distinguish algebraic and geometric multiplicity of an eigenvalue.",
      "Algebraic multiplicity is the number of times λ is a root of the characteristic polynomial. Geometric multiplicity is the number of independent eigenvectors for λ (the dimension of its eigenspace). If geometric < algebraic for some λ, the matrix is defective and not diagonalisable."),
    E("Two coupled first-order systems obey x′ = Ax with A = [[−3, 1], [1, −3]] and x(0) = (2, 0)ᵀ.\n"
      "(a) Find the eigenvalues and eigenvectors of A. [3]\n"
      "(b) Write the general solution and apply the initial condition. [4]\n"
      "(c) Find the maximum value of x₂(t) and when it occurs. [3]\n[10 marks]",
      ["λ² + 6λ + 8 = 0 gives λ = −2, −4.",
       "λ = −2: v = (1, 1). λ = −4: v = (1, −1).",
       "x(t) = c₁(1, 1)e^{−2t} + c₂(1, −1)e^{−4t}.",
       "x(0) = (2, 0): c₁ + c₂ = 2 and c₁ − c₂ = 0, so c₁ = c₂ = 1: x₁ = e^{−2t} + e^{−4t}, x₂ = e^{−2t} − e^{−4t}.",
       "x₂′ = −2e^{−2t} + 4e^{−4t} = 0 gives e^{−2t} = ½, t = (ln 2)/2 ≈ 0.347.",
       "x₂,max = ½ − ¼ = ¼."],
      ["Trace −6, det 9 − 1 = 8: λ² + 6λ + 8 = 0.",
       "Eigenvectors from (A − λI)v = 0: (1, 1) and (1, −1).",
       "Superpose modes with e^{λt}.",
       "Initial conditions give c₁ = c₂ = 1.",
       "Differentiate x₂, set to zero: t = ln2/2, x₂ = 1/4."],
      "Correct modes, solves the constants, and finds and verifies the maximum, noting both modes decay.",
      "Correct general solution with an initial-condition slip.",
      "Uses e^{−λt}, or eigenvectors that do not satisfy (A − λI)v = 0."),
]
T[3] = [  # Functions of several variables and partial differentiation
    R("What is the gradient of f(x, y), and how does it give the directional derivative?",
      "∇f = (∂f/∂x, ∂f/∂y). The rate of change in the unit direction û is ∇f · û. It is largest in the direction of ∇f, with value |∇f|, and zero along level curves."),
    R("When are the mixed partial derivatives f_xy and f_yx equal?",
      "When they are continuous near the point (Schwarz's or Clairaut's theorem), which holds for the functions met in engineering."),
    R("How is the total differential used to estimate errors?",
      "df ≈ f_x dx + f_y dy. For a worst-case error, add the magnitudes: |Δf| ≤ |f_x||Δx| + |f_y||Δy|."),
    E("(a) Power P = V²/R with V = 10 ± 0.1 V and R = 5 ± 0.05 Ω. Estimate the maximum error in P and the percentage error. [4]\n"
      "(b) For f(x, y) = x²y + e^{xy}, find f_x, f_y and show f_xy = f_yx. [3]\n"
      "(c) For g(x, y) = x² + 3y², find the directional derivative at (1, 1) in the direction of (3, 4), and the maximum rate of increase there. [3]\n[10 marks]",
      ["P = 100/5 = 20 W. ∂P/∂V = 2V/R = 4; ∂P/∂R = −V²/R² = −4.",
       "|ΔP| ≤ 4 × 0.1 + 4 × 0.05 = 0.6 W, i.e. 3% (= 2 × 1% + 1%).",
       "f_x = 2xy + y e^{xy}; f_y = x² + x e^{xy}.",
       "f_xy = 2x + e^{xy} + xy e^{xy} = f_yx.",
       "∇g = (2x, 6y) = (2, 6) at (1, 1); û = (0.6, 0.8); directional derivative = 1.2 + 4.8 = 6.",
       "Maximum rate = |∇g| = √40 ≈ 6.32, in the direction of (2, 6)."],
      ["Find the partial derivatives of P at the nominal values.",
       "Worst case adds magnitudes: 0.4 + 0.2 = 0.6 W (3%).",
       "Differentiate f with the product and chain rules.",
       "Differentiate f_x with respect to y and f_y with respect to x: both 2x + e^{xy}(1 + xy).",
       "Normalise (3, 4), dot with ∇g = (2, 6): 6; max rate √40."],
      "Uses the worst-case sum of magnitudes, checks with relative errors, gets both mixed partials, and normalises the direction vector.",
      "Correct error estimate but signs allowed to cancel, or direction vector not normalised.",
      "Adds errors with signs to get 0.2 W, or uses (3, 4) without normalising (giving 30)."),
]
T[4] = [  # Multiple integrals and coordinate systems
    R("What does Fubini's theorem say about double integrals over a rectangle?",
      "For a continuous f on [a, b] × [c, d], ∬ f dA can be computed as an iterated integral in either order: ∫ₐᵇ∫_cᵈ f dy dx = ∫_cᵈ∫ₐᵇ f dx dy."),
    R("Give the volume element in cylindrical coordinates.",
      "dV = r dr dθ dz, with x = r cos θ, y = r sin θ, z = z. The factor r is the Jacobian."),
    R("How is the centre of mass of a lamina found using double integrals?",
      "Mass M = ∬ ρ dA; x̄ = (1/M)∬ xρ dA and ȳ = (1/M)∬ yρ dA."),
    E("(a) Evaluate ∬_D (x + y) dA, where D is the triangle 0 ≤ y ≤ x ≤ 1. [3]\n"
      "(b) Use polar coordinates to find the area of a disc of radius a. [2]\n"
      "(c) Evaluate ∬ e^{−(x² + y²)} dA over the whole plane and deduce ∫_{−∞}^{∞} e^{−x²} dx. [3]\n"
      "(d) A cylinder of radius 2 and height 3 has density ρ = z. Find its mass. [2]\n[10 marks]",
      ["∫₀¹∫₀ˣ (x + y) dy dx = ∫₀¹ (x² + x²/2) dx = ∫₀¹ 3x²/2 dx = ½.",
       "∫₀^{2π}∫₀ᵃ r dr dθ = 2π × a²/2 = πa².",
       "∫₀^{2π}∫₀^∞ e^{−r²} r dr dθ = 2π × ½ = π.",
       "The integral equals (∫ e^{−x²} dx)², so ∫_{−∞}^{∞} e^{−x²} dx = √π.",
       "Mass = ∫₀^{2π}∫₀²∫₀³ z r dz dr dθ = 2π × 2 × 4.5 = 18π."],
      ["Integrate in y first from 0 to x: xy + y²/2 → 3x²/2; then in x: ½.",
       "Area element r dr dθ: πa².",
       "Polar form makes e^{−r²} r integrable: ∫₀^∞ re^{−r²} dr = ½.",
       "Separate the square: I² = π so I = √π.",
       "Cylindrical: ∫ z dz = 9/2, ∫ r dr = 2, ∫ dθ = 2π: 18π."],
      "Correct limits for the triangle, includes the Jacobian each time, and justifies the Gaussian result via separability.",
      "Correct results with the Jacobian omitted in one part and then corrected.",
      "Integrates over the unit square instead of the triangle, or omits r in polar."),
]
T[5] = [  # First-order differential equations
    R("How is a separable first-order ODE solved?",
      "Write it as g(y) dy = f(x) dx, integrate both sides, add one constant, and apply the initial condition. Check for lost solutions such as y = 0 when dividing by y."),
    R("What is the time constant of an RC circuit, and how close to its final value is it after 5τ?",
      "τ = RC. The response is x_final + (x₀ − x_final)e^{−t/τ}; after 5τ it is within e^{−5} ≈ 0.7% of the final value (99.3% complete)."),
    R("What is a Bernoulli equation and how is it solved?",
      "y′ + P(x)y = Q(x)yⁿ with n ≠ 0, 1. Substitute v = y^{1−n}, which turns it into the linear equation v′ + (1 − n)Pv = (1 − n)Q, solved with an integrating factor."),
    E("(a) Solve dy/dx = xy² with y(0) = 1, and find where the solution blows up. [3]\n"
      "(b) An RL circuit obeys L di/dt + Ri = V with L = 0.5 H, R = 10 Ω, V = 20 V and i(0) = 0. Find i(t), the time constant and i(0.1 s). [4]\n"
      "(c) A body cools by Newton's law dT/dt = −k(T − 20). It is at 90 °C at t = 0 and 55 °C at t = 10 min. Find k and the time to reach 30 °C. [3]\n[10 marks]",
      ["Separate: dy/y² = x dx, so −1/y = x²/2 + C; y(0) = 1 gives C = −1.",
       "y = 2/(2 − x²), which blows up at x = ±√2.",
       "i(t) = (V/R)(1 − e^{−Rt/L}) = 2(1 − e^{−20t}) A; τ = L/R = 0.05 s.",
       "i(0.1) = 2(1 − e^{−2}) ≈ 1.73 A.",
       "T − 20 = 70e^{−kt}; 35 = 70e^{−10k} gives k = (ln 2)/10 ≈ 0.0693 per minute.",
       "30 °C: 10 = 70e^{−kt}, t = ln 7/k ≈ 28.1 min."],
      ["Separate variables and integrate: −1/y = x²/2 − 1.",
       "Rearrange: y = 2/(2 − x²); singular at x² = 2.",
       "Linear ODE: steady state V/R = 2 A, τ = L/R = 0.05 s.",
       "Evaluate at 0.1 s = 2τ: 2(1 − e^{−2}) ≈ 1.73 A.",
       "Newton cooling: half the excess gone in 10 min, so k = ln2/10; reach 10 °C excess at t = 10 ln7/ln2 ≈ 28.1 min."],
      "Separates correctly with the constant handled, identifies the blow-up, uses τ = L/R, and solves the cooling problem exactly with logs.",
      "Correct methods with a slip in the constant or in τ.",
      "Uses τ = RL or RC for the inductor circuit, or loses the minus sign in −1/y."),
]
T[6] = [  # Second-order linear ODEs and forced response
    R("Give the damping ratio and natural frequency of ay″ + by′ + cy = 0.",
      "ω_n = √(c/a) and ζ = b/(2√(ac)). ζ < 1 is underdamped (oscillatory), ζ = 1 critically damped, ζ > 1 overdamped."),
    R("How is the damped natural frequency related to ω_n and ζ?",
      "ω_d = ω_n√(1 − ζ²) for ζ < 1. The roots of the auxiliary equation are −ζω_n ± jω_d."),
    R("Distinguish the transient and steady-state parts of a forced response.",
      "The complementary function is the transient: it depends on initial conditions and decays to zero when there is damping. The particular integral is the steady-state response, which persists and has the forcing's form."),
    E("Solve y″ + 2y′ + 5y = 10 with y(0) = 0 and y′(0) = 0.\n"
      "(a) Find the complementary function and particular integral. [3]\n"
      "(b) Apply the initial conditions to find y(t). [3]\n"
      "(c) Find ω_n, ζ, the time of the first peak and the percentage overshoot. [4]\n[10 marks]",
      ["Auxiliary m² + 2m + 5 = 0 gives m = −1 ± 2j: y_c = e^{−t}(A cos 2t + B sin 2t).",
       "Constant PI: 5k = 10, so y_p = 2.",
       "y(0) = 0: 2 + A = 0, A = −2. y′(0) = −A + 2B = 0, B = −1.",
       "y(t) = 2 − e^{−t}(2 cos 2t + sin 2t).",
       "ω_n = √5 ≈ 2.24 rad/s; ζ = 2/(2√5) ≈ 0.447.",
       "y′ = 5e^{−t} sin 2t, so the first peak is at t = π/2 ≈ 1.57 s with y = 2 + 2e^{−π/2} ≈ 2.42: overshoot ≈ 20.8%."],
      ["Roots −1 ± 2j: underdamped transient.",
       "Steady state y_p = 10/5 = 2.",
       "Differentiate y = 2 + e^{−t}(A cos 2t + B sin 2t) and apply y′(0) = −A + 2B = 0.",
       "y = 2 − e^{−t}(2cos 2t + sin 2t).",
       "y′ = 5e^{−t} sin 2t vanishes first at t = π/2: overshoot e^{−π/2} ≈ 20.8%, matching e^{−ζπ/√(1−ζ²)}."],
      "Correct transient and steady state, both constants, and an overshoot derived from y′ and checked against the standard formula.",
      "Correct y(t) but the peak time found by guessing or overshoot quoted without derivation.",
      "Applies initial conditions to y_c alone, or gives ζ = 2/√5."),
]
T[7] = [  # Laplace transforms and system response
    R("Give the Laplace transforms of e^{at}, tⁿ, sin ωt and cos ωt.",
      "1/(s − a); n!/s^{n+1}; ω/(s² + ω²); s/(s² + ω²)."),
    R("State the final value theorem and when it can be used.",
      "lim_{t→∞} f(t) = lim_{s→0} sF(s), valid only if f(t) settles, i.e. all poles of sF(s) are in the left half-plane. It fails for oscillating or growing signals."),
    R("What is a transfer function, and when is a system stable?",
      "H(s) = Y(s)/X(s) with all initial conditions zero; it is the Laplace transform of the impulse response. A system is (BIBO) stable if all poles of H(s) have negative real parts."),
    E("A system has transfer function H(s) = (s + 3)/((s + 1)(s + 2)) and a unit step input.\n"
      "(a) Show that the output transform is Y(s) = (s + 3)/(s(s + 1)(s + 2)) and find y(t) using partial fractions. [5]\n"
      "(b) Check your answer using the initial and final value theorems. [3]\n"
      "(c) Give the Laplace transform of a unit step delayed by 2 s, and the output if this delayed step is the input. [2]\n[10 marks]",
      ["The step has transform 1/s, so Y = H/s = (s + 3)/(s(s + 1)(s + 2)).",
       "Partial fractions A/s + B/(s + 1) + C/(s + 2): A = 3/2, B = 2/(−1) = −2, C = 1/((−2)(−1)) = ½.",
       "y(t) = 3/2 − 2e^{−t} + ½e^{−2t} for t ≥ 0.",
       "Initial value: lim_{s→∞} sY(s) = 0 = y(0) = 3/2 − 2 + ½.",
       "Final value: lim_{s→0} sY(s) = 3/2 = y(∞); valid since the poles of sY are at −1 and −2.",
       "L{u(t − 2)} = e^{−2s}/s; output is y(t − 2)u(t − 2) by the time-shift theorem."],
      ["Multiply H(s) by the step transform 1/s.",
       "Cover-up: A = 3/(1 × 2), B = (−1 + 3)/((−1)(1)) = −2, C = (−2 + 3)/((−2)(−1)) = ½.",
       "Invert term by term: 3/2 − 2e^{−t} + ½e^{−2t}.",
       "Check y(0) = 0 and y(∞) = 3/2 with the value theorems.",
       "Delay: e^{−2s}/s, output shifted by 2 s."],
      "Correct partial fractions by cover-up, both value theorems with the validity condition, and the time-shift result.",
      "Correct y(t) with the final value theorem used without checking pole locations.",
      "Forgets to multiply by 1/s for the step, or gives B = +2."),
]

FIX = """update module_questions set
question = $q$A series RLC circuit's charge satisfies q″ + 4q′ + 13q = 13. (a) Find the complementary function. (b) Find the particular integral and general solution. (c) With q(0) = 0 and q′(0) = 0, find q(t). (d) State the damping type and the steady-state value. [20 marks]$q$,
answer = $q$• Auxiliary equation m² + 4m + 13 = 0 gives m = −2 ± 3j, so q_c = e^{−2t}(A cos 3t + B sin 3t).
• Constant particular integral: 13k = 13, so q_p = 1; general solution q = 1 + e^{−2t}(A cos 3t + B sin 3t).
• q(0) = 0 gives A = −1; q′(0) = −2A + 3B = 0 gives B = −2/3.
• q(t) = 1 − e^{−2t}(cos 3t + (2/3) sin 3t).
• Complex roots with negative real part: underdamped; the oscillation decays and q → 1 (steady state).$q$
where code = 'ELEC40014' and topic_pos = 6 and tier = 'exam' and question like '%wait:%';"""

emit("ELEC40014", T, 64)
print(FIX)
