"""Top-up for Imperial ELEC40009 Devices, Power and Communications: 3 recall + 1 exam per topic.
Run: python3 tools/packs/elec40009.py > /tmp/elec40009.sql"""
from common import R, E, emit

T = {}
T[0] = [  # Semiconductor Physics and the PN Junction
    R("State the mass-action law for a semiconductor in equilibrium and give n_i for silicon at 300 K.",
      "n·p = n_i². For silicon at 300 K, n_i ≈ 1 × 10¹⁰ cm⁻³ (1.5 × 10¹⁰ in older texts). So with N_D = 10¹⁶ cm⁻³, n ≈ 10¹⁶ and p ≈ 10⁴ cm⁻³."),
    R("Distinguish drift current from diffusion current, and state the Einstein relation.",
      "Drift is carrier motion caused by an electric field: J = q(nμ_n + pμ_p)E. Diffusion is motion down a concentration gradient: J_n = qD_n dn/dx. The Einstein relation links them: D/μ = kT/q ≈ 25.9 mV at 300 K."),
    R("How does reverse bias affect the depletion region of a PN junction, and what are the two breakdown mechanisms?",
      "Reverse bias widens the depletion region (W ∝ √(V_bi + V_R)), so junction capacitance falls; only a tiny saturation current flows. Breakdown is by Zener tunnelling (heavily doped junctions, below about 5 V) or avalanche multiplication (lighter doping, higher voltages)."),
    E("A 5 V source drives a silicon diode through a 1 kΩ resistor.\n"
      "(a) Find the current using the constant 0.7 V drop model. [2]\n"
      "(b) Using the diode equation with I_S = 10⁻¹⁴ A and V_T = 25 mV, iterate to find the diode voltage and current to 3 significant figures. [4]\n"
      "(c) Find the small-signal resistance of the diode at this operating point. [2]\n"
      "(d) State how the diode voltage changes with temperature at constant current. [2]\n[10 marks]",
      ["Constant-drop model: I = (5 − 0.7)/1 kΩ = 4.3 mA.",
       "Iterate V_D = V_T ln(I/I_S): with I = 4.3 mA, V_D = 0.025 ln(4.3 × 10¹¹) ≈ 0.670 V.",
       "Then I = (5 − 0.670)/1 kΩ = 4.33 mA, and V_D = 0.025 ln(4.33 × 10¹¹) ≈ 0.670 V: converged.",
       "Answer: V_D ≈ 0.670 V, I ≈ 4.33 mA.",
       "r_d = V_T/I = 25 mV / 4.33 mA ≈ 5.8 Ω.",
       "V_D falls by about 2 mV per °C rise at constant current."],
      ["(a) I = (5 − 0.7)/1000 = 4.3 mA.",
       "(b) Start from 4.3 mA: V_D = 0.025 × ln(4.3e-3 / 1e-14) = 0.025 × 26.79 ≈ 0.670 V.",
       "New current (5 − 0.670)/1000 = 4.33 mA; recompute V_D ≈ 0.670 V, so it has converged.",
       "(c) r_d = V_T / I_D ≈ 0.025 / 0.00433 ≈ 5.8 Ω.",
       "(d) Temperature coefficient about −2 mV/°C."],
      "Sets up the iteration correctly, shows convergence, gives r_d with units, and the correct sign of the temperature coefficient.",
      "Correct iteration with one arithmetic slip, or r_d computed from V_D/I instead of V_T/I.",
      "Uses log base 10 in the diode equation, or treats the diode as a 0.7 Ω resistor."),
]
T[1] = [  # Bipolar Junction Transistors
    R("Name the operating regions of a BJT and the junction bias in each.",
      "Forward-active: BE forward, BC reverse (amplifier). Saturation: both forward (closed switch, V_CE ≈ 0.2 V). Cutoff: both reverse (open switch). Reverse-active: BE reverse, BC forward (rarely used)."),
    R("What is the Early effect and how does it appear in the small-signal model?",
      "Increasing V_CE widens the BC depletion region, narrowing the effective base, so I_C rises slightly with V_CE. It appears as an output resistance r_o = V_A / I_C between collector and emitter, where V_A is the Early voltage."),
    R("Why does an emitter resistor stabilise the bias point of a BJT?",
      "R_E gives negative feedback: if I_C rises, V_E rises, which reduces V_BE and so I_C. With a stiff base divider, I_C ≈ (V_B − V_BE)/R_E, almost independent of β and temperature."),
    E("A voltage-divider biased NPN stage has V_CC = 12 V, R1 = 47 kΩ (top), R2 = 10 kΩ (bottom), R_C = 2.2 kΩ, R_E = 1 kΩ, β = 100, V_BE = 0.7 V, V_T = 25 mV.\n"
      "(a) Using a Thevenin equivalent of the divider, find I_B, I_C and V_CE, and confirm the operating region. [5]\n"
      "(b) Recalculate I_C for β = 200 and comment. [2]\n"
      "(c) Find g_m and the small-signal voltage gain with R_E fully bypassed and with R_E unbypassed (ignore r_o). [3]\n[10 marks]",
      ["V_BB = 12 × 10/57 = 2.105 V; R_BB = 47 ‖ 10 = 8.25 kΩ.",
       "I_B = (2.105 − 0.7)/(8.25 + 101 × 1) kΩ = 12.9 µA; I_C = 1.29 mA; I_E ≈ 1.30 mA.",
       "V_C = 12 − 1.29 × 2.2 = 9.17 V; V_E = 1.30 V; V_CE ≈ 7.9 V > 0.2 V, so forward-active.",
       "β = 200: I_B = 1.405/(8.25 + 201) kΩ = 6.7 µA, I_C = 1.34 mA: only about 4% higher despite doubling β.",
       "g_m = I_C/V_T = 1.29/25 ≈ 51 mS.",
       "Bypassed: A_v = −g_m R_C ≈ −113. Unbypassed: A_v = −g_m R_C/(1 + g_m R_E) ≈ −2.2 ≈ −R_C/R_E."],
      ["Thevenin: V_BB = 2.105 V, R_BB = 8.25 kΩ.",
       "Base loop: V_BB = I_B R_BB + V_BE + (β + 1) I_B R_E, so I_B = 1.405 / 109.2 kΩ ≈ 12.9 µA.",
       "I_C = 1.29 mA, V_CE = 12 − 1.29(2.2) − 1.30(1) ≈ 7.9 V: active.",
       "With β = 200: I_C ≈ 1.34 mA, a 4% change: R_E feedback stabilises bias.",
       "g_m ≈ 51 mS; gain −113 bypassed, about −2.2 unbypassed."],
      "Uses the Thevenin base loop with (β + 1)R_E, checks the region, quantifies β sensitivity, and gives both gains with the degeneration formula.",
      "Correct bias point; gains given with one formula misapplied.",
      "Ignores R_BB or the (β + 1) factor, or gives a positive gain for a common-emitter stage."),
]
T[2] = [  # MOSFETs and Digital Logic Circuits
    R("Give the drain current of an n-MOSFET in the triode region and the condition for it.",
      "For V_GS > V_T and V_DS < V_GS − V_T: I_D = k_n[(V_GS − V_T)V_DS − V_DS²/2]. For small V_DS it behaves like a resistor of 1/(k_n(V_GS − V_T)), controlled by the gate voltage."),
    R("Give the dynamic power dissipation of a CMOS gate.",
      "P = α C V_DD² f, where α is the activity factor (fraction of cycles the output switches), C the switched load capacitance and f the clock frequency. It dominates over static power in most digital CMOS."),
    R("How does channel-length modulation change the saturation current and the small-signal model?",
      "I_D = ½k_n(V_GS − V_T)²(1 + λV_DS), so the current rises slightly with V_DS. This gives a finite output resistance r_o ≈ 1/(λI_D) in parallel with the g_m source."),
    E("A common-source amplifier has V_DD = 10 V, R_D = 2 kΩ, V_T = 1 V and I_D = ½k_n(V_GS − V_T)² with k_n = 1 mA/V². It is biased at V_GS = 3 V.\n"
      "(a) Find I_D and V_DS, and confirm saturation. [3]\n"
      "(b) Find g_m and the small-signal gain, first ignoring r_o, then with λ = 0.02 V⁻¹. [4]\n"
      "(c) Find the largest R_D that keeps the transistor in saturation at this bias. [3]\n[10 marks]",
      ["I_D = ½ × 1 × (3 − 1)² = 2 mA; V_DS = 10 − 2 × 2 = 6 V.",
       "Saturation needs V_DS ≥ V_GS − V_T = 2 V: 6 V ≥ 2 V, so saturated.",
       "g_m = k_n(V_GS − V_T) = 2 mA/V (equivalently 2I_D/V_ov).",
       "Without r_o: A_v = −g_m R_D = −4.",
       "With λ: r_o = 1/(0.02 × 2 mA) = 25 kΩ; A_v = −g_m(R_D ‖ r_o) = −2 × 1.85 ≈ −3.7.",
       "Saturation: 10 − 2 mA × R_D ≥ 2 V, so R_D ≤ 4 kΩ."],
      ["Square law: I_D = 0.5 × 1 mA/V² × (2 V)² = 2 mA.",
       "V_DS = V_DD − I_D R_D = 6 V, above V_ov = 2 V, so saturation.",
       "g_m = k_n V_ov = 2 mS; gain −g_m R_D = −4.",
       "r_o = 1/(λ I_D) = 25 kΩ; R_D ‖ r_o = 1.85 kΩ; gain ≈ −3.7.",
       "Edge of saturation at V_DS = 2 V: R_D,max = (10 − 2)/2 mA = 4 kΩ."],
      "Checks the region before using the small-signal model, includes r_o correctly, and derives the R_D limit from the saturation condition.",
      "Correct bias and gains but the R_D limit uses the wrong saturation boundary.",
      "Uses the triode equation at this bias, or computes g_m = I_D/V_T as for a BJT."),
]
T[3] = [  # Operational Amplifiers and Analogue Circuits
    R("For a single-pole op-amp, how is the closed-loop bandwidth related to the gain-bandwidth product?",
      "f_−3dB ≈ GBW / noise gain, where the noise gain is 1 + R_f/R_1 (the non-inverting gain) for both inverting and non-inverting configurations. Gain × bandwidth stays roughly constant."),
    R("What is slew rate, and what is the full-power bandwidth for an output sine of peak V_p?",
      "Slew rate is the maximum rate of change of the output voltage (V/µs), set by internal currents charging the compensation capacitor. A sine V_p sin ωt has maximum slope ωV_p, so the full-power bandwidth is f = SR/(2πV_p)."),
    R("Name three DC non-idealities of a real op-amp.",
      "Input offset voltage (output error even with zero input), input bias currents (flowing into the inputs through source resistances), and input offset current (mismatch between the two bias currents). Finite open-loop gain and CMRR are others."),
    E("(a) An inverting summing amplifier has R_f = 20 kΩ and inputs V1 = 0.5 V via 10 kΩ, V2 = −0.2 V via 20 kΩ and V3 = 1.0 V via 50 kΩ. Find V_out. [3]\n"
      "(b) An op-amp with GBW = 1 MHz is used as a non-inverting amplifier with gain 11. Find the closed-loop bandwidth. [3]\n"
      "(c) The op-amp's slew rate is 0.5 V/µs. Find the highest frequency at which it can deliver a 5 V peak sine without slew distortion, and say what happens to a 50 kHz, 5 V peak output. [4]\n[10 marks]",
      ["V_out = −R_f(V1/R1 + V2/R2 + V3/R3) = −(2 × 0.5 + 1 × (−0.2) + 0.4 × 1.0) = −1.2 V.",
       "Noise gain = 11, so bandwidth ≈ 1 MHz / 11 ≈ 91 kHz.",
       "Full-power bandwidth = SR/(2πV_p) = 0.5 × 10⁶ / (2π × 5) ≈ 15.9 kHz.",
       "At 50 kHz the required slope 2π × 50 k × 5 ≈ 1.57 V/µs exceeds 0.5 V/µs, so the output becomes a triangle-like wave with reduced amplitude: slew-rate distortion."],
      ["Virtual earth: currents add at the inverting input, so V_out = −Σ(R_f/R_i)V_i.",
       "Gains 2, 1 and 0.4: V_out = −(1.0 − 0.2 + 0.4) = −1.2 V.",
       "GBW/gain = 1 MHz/11 ≈ 91 kHz.",
       "Max slope of a sine = 2πfV_p; set equal to SR: f = 0.5e6/(10π) ≈ 15.9 kHz.",
       "50 kHz needs 1.57 V/µs, so the output slews: distorted triangle with lower amplitude."],
      "Applies the virtual-earth sum with signs, uses noise gain for bandwidth, derives full-power bandwidth from the sine slope and explains the distortion.",
      "Correct numbers but the distortion is not described, or small-signal bandwidth confused with full-power bandwidth.",
      "Ignores the sign of V2, or confuses the closed-loop gain with the noise gain when finding bandwidth."),
]
T[4] = [  # Electromagnetism and Magnetic Circuits
    R("State Ampère's circuital law and the magnetic-circuit equivalent of Ohm's law.",
      "∮H·dl = I_enclosed. For a magnetic circuit with N turns carrying I, the mmf F = NI = ΦℛT, where Φ is the flux and ℛT the total reluctance (ℛ = l/(μA) for each section in series)."),
    R("Give the energy stored in an inductor and the energy density of a magnetic field.",
      "W = ½LI². Energy density w = B²/(2μ) = ½BH (J/m³). Because μ is much smaller in air, most of the energy in a gapped core is stored in the gap."),
    R("What are hysteresis and eddy-current losses, and how are they reduced?",
      "Hysteresis loss is energy lost each cycle in reversing magnetic domains (area of the B-H loop), reduced by soft magnetic materials such as silicon steel or ferrite. Eddy-current loss is I²R heating from currents induced in the core, reduced by thin insulated laminations or high-resistivity ferrite."),
    E("A core has mean length 0.30 m, cross-section 5 cm², μ_r = 2000 and an air gap of 1 mm. It carries a 500-turn winding. Take μ₀ = 4π × 10⁻⁷ H/m and ignore fringing.\n"
      "(a) Find the reluctance of the core and of the gap, and the inductance. [4]\n"
      "(b) Find the current needed for B = 1.0 T, and the stored energy. [3]\n"
      "(c) What fraction of the energy is stored in the gap, and what would the inductance be without the gap? [3]\n[10 marks]",
      ["ℛ_core = 0.30/(2000 × 4π × 10⁻⁷ × 5 × 10⁻⁴) ≈ 2.39 × 10⁵ A/Wb.",
       "ℛ_gap = 10⁻³/(4π × 10⁻⁷ × 5 × 10⁻⁴) ≈ 1.59 × 10⁶ A/Wb; total ≈ 1.83 × 10⁶ A/Wb.",
       "L = N²/ℛ = 250,000/1.83 × 10⁶ ≈ 0.137 H.",
       "Φ = BA = 5 × 10⁻⁴ Wb; NI = Φℛ ≈ 915 A-turns, so I ≈ 1.83 A.",
       "W = ½LI² ≈ 0.5 × 0.137 × 1.83² ≈ 0.23 J.",
       "Energy divides like reluctance: gap fraction ≈ 1.59/1.83 ≈ 87%. Without the gap, L = 250,000/2.39 × 10⁵ ≈ 1.05 H."],
      ["μ₀μ_rA = 2000 × 1.257e-6 × 5e-4 = 1.257e-6; ℛ_core = 0.3/1.257e-6 ≈ 2.39e5.",
       "μ₀A = 6.28e-10; ℛ_gap = 1e-3/6.28e-10 ≈ 1.59e6; ℛ_total ≈ 1.83e6 A/Wb.",
       "L = 500²/1.83e6 ≈ 0.137 H.",
       "Flux 5e-4 Wb; I = Φℛ/N ≈ 1.83 A; W = ½LI² ≈ 0.23 J.",
       "Same flux in series sections, so energy ∝ reluctance: 87% in the gap; ungapped L ≈ 1.05 H."],
      "Correct reluctances with units, consistent L, I and W, and explains why energy splits in proportion to reluctance.",
      "Correct reluctances and L, but energy split asserted without reason.",
      "Uses μ_r for the gap, or adds reluctances in parallel."),
]
T[5] = [  # Transformers and Power Systems
    R("Name the elements of a practical transformer's equivalent circuit and the tests used to find them.",
      "Series: winding resistances R1, R2 and leakage reactances X1, X2. Shunt: core-loss resistance R_c and magnetising reactance X_m. The open-circuit test (rated voltage, no load) gives the shunt branch; the short-circuit test (reduced voltage, rated current) gives the series elements."),
    R("For a balanced star-connected three-phase system, relate line and phase quantities and give the total power.",
      "V_line = √3 V_phase, I_line = I_phase. Total real power P = √3 V_L I_L cos φ = 3 V_ph I_ph cos φ, where φ is the phase angle of the load impedance."),
    R("How does a shunt capacitor correct power factor, and what reactive power is needed?",
      "The capacitor supplies reactive power locally, so the supply provides less, reducing current and losses for the same real power. Q_C = P(tan φ₁ − tan φ₂) to go from power factor cos φ₁ to cos φ₂."),
    E("A balanced star-connected load draws 30 kW at 0.75 power factor lagging from a 415 V (line) three-phase supply.\n"
      "(a) Find the line current, phase voltage, reactive power and apparent power. [4]\n"
      "(b) Find the total capacitor reactive power needed to raise the power factor to 0.95 lagging. [3]\n"
      "(c) Find the new line current and the percentage reduction in line losses. [3]\n[10 marks]",
      ["I_L = P/(√3 V_L cos φ) = 30,000/(√3 × 415 × 0.75) ≈ 55.6 A.",
       "V_ph = 415/√3 ≈ 240 V. S = P/cos φ = 40 kVA; Q = P tan φ = 30 × 0.882 ≈ 26.5 kvar.",
       "At 0.95: tan φ₂ = 0.329, so Q₂ ≈ 9.9 kvar and Q_C ≈ 26.5 − 9.9 ≈ 16.6 kvar.",
       "New I_L = 30,000/(√3 × 415 × 0.95) ≈ 43.9 A.",
       "Losses ∝ I²: (43.9/55.6)² ≈ 0.62, so line losses fall by about 38%."],
      ["√3 × 415 = 718.8 V; × 0.75 = 539.1; I_L = 30,000/539.1 ≈ 55.6 A.",
       "φ₁ = cos⁻¹0.75 = 41.4°, tan φ₁ = 0.882: Q₁ = 26.5 kvar, S = 40 kVA.",
       "φ₂ = cos⁻¹0.95 = 18.2°, tan φ₂ = 0.329: Q₂ = 9.9 kvar.",
       "Q_C = 16.6 kvar total (about 5.5 kvar per phase).",
       "New current 43.9 A; loss ratio 0.62, a 38% reduction."],
      "Correct line and phase relations, reactive power from tan φ, capacitor sizing and an I²R argument for the loss saving.",
      "Correct current and Q_C, but loss reduction taken as proportional to I rather than I².",
      "Omits √3, or uses the line voltage as the phase voltage in star."),
]
T[6] = [  # Electrical Machines and Power Electronics
    R("Give the ideal conversion ratio of a boost converter in continuous conduction.",
      "V_out = V_in/(1 − D), where D is the switch duty cycle. The output is always at least V_in, and in practice the gain is limited by losses at high D."),
    R("How can the speed of a separately excited DC motor be controlled?",
      "Below base speed, vary the armature voltage (speed ∝ back-emf ≈ V_a at light load) at constant field, giving constant torque capability. Above base speed, weaken the field: speed rises as flux falls, with torque capability falling (constant power)."),
    R("Define slip for an induction motor and give the synchronous speed.",
      "n_s = 120f/p rpm (p = number of poles). Slip s = (n_s − n)/n_s. Rotor currents have frequency sf; typical full-load slip is 2 to 5%."),
    E("(a) A 4-pole, 50 Hz induction motor runs at 1440 rpm. Find the synchronous speed, the slip and the rotor current frequency. [3]\n"
      "(b) The air-gap power is 10 kW. Find the rotor copper loss, the gross mechanical power and the developed torque. [4]\n"
      "(c) A boost converter steps 12 V up to 48 V at 100 kHz with a 100 µH inductor. Find the duty cycle and the peak-to-peak inductor ripple current. [3]\n[10 marks]",
      ["n_s = 120 × 50/4 = 1500 rpm; s = (1500 − 1440)/1500 = 0.04; rotor frequency = sf = 2 Hz.",
       "Rotor copper loss = sP_ag = 400 W; mechanical power = (1 − s)P_ag = 9.6 kW.",
       "Torque T = P_ag/ω_s = 10,000/(2π × 1500/60) ≈ 63.7 N·m (same as 9600/ω_rotor).",
       "48 = 12/(1 − D), so D = 0.75.",
       "During the on-time the inductor sees V_in: ΔI = V_in D T/L = 12 × 0.75 × 10 µs / 100 µH = 0.9 A."],
      ["n_s = 1500 rpm; s = 60/1500 = 0.04; f_r = 0.04 × 50 = 2 Hz.",
       "Power split: P_cu,r = sP_ag = 400 W, P_mech = 9.6 kW.",
       "ω_s = 157.1 rad/s, so T = 10,000/157.1 ≈ 63.7 N·m.",
       "Boost: 1 − D = 12/48 = 0.25, D = 0.75.",
       "ΔI = 12 × 7.5 µs / 100 µH = 0.9 A peak-to-peak."],
      "Uses the air-gap power split and either torque route consistently, and derives the ripple from V = L di/dt during the on-time.",
      "Correct slip and powers but torque from the wrong speed, or ripple using V_out.",
      "Uses 2-pole synchronous speed (3000 rpm), or buck formula for the boost."),
]
T[7] = [  # Communications Systems and Modulation
    R("State Carson's rule for the bandwidth of an FM signal.",
      "B ≈ 2(Δf + f_m) = 2f_m(β + 1), where Δf is the peak frequency deviation, f_m the highest modulating frequency and β = Δf/f_m the modulation index. It captures about 98% of the signal power."),
    R("State the Shannon–Hartley capacity theorem.",
      "C = B log₂(1 + S/N) bits per second, the maximum error-free data rate over a channel of bandwidth B with additive white Gaussian noise and signal-to-noise ratio S/N (as a ratio, not dB)."),
    R("How do DSB-SC and SSB differ from standard AM?",
      "DSB-SC suppresses the carrier, so no power is wasted on it, but needs coherent detection. SSB also removes one sideband, halving the bandwidth to f_m. Standard AM keeps the carrier so a simple envelope detector works."),
    E("(a) A broadcast FM signal has carrier 100 MHz, peak deviation 75 kHz and maximum audio frequency 15 kHz. Find the modulation index and the Carson bandwidth. [3]\n"
      "(b) A telephone channel has bandwidth 3.1 kHz and SNR 30 dB. Find its Shannon capacity. [3]\n"
      "(c) Audio up to 15 kHz is sampled at 44.1 kHz with 16-bit samples. Check the Nyquist condition, and find the bit rate per channel and the ideal quantisation SNR for a full-scale sine. [4]\n[10 marks]",
      ["β = Δf/f_m = 75/15 = 5. Carson: B ≈ 2(75 + 15) = 180 kHz.",
       "30 dB = 1000; C = 3100 × log₂(1001) ≈ 3100 × 9.97 ≈ 30.9 kbit/s.",
       "Nyquist: 44.1 kHz > 2 × 15 = 30 kHz, satisfied with room for the anti-aliasing filter.",
       "Bit rate = 44,100 × 16 ≈ 705.6 kbit/s per channel.",
       "SQNR ≈ 6.02N + 1.76 = 6.02 × 16 + 1.76 ≈ 98 dB."],
      ["β = 5; B = 2(Δf + f_m) = 180 kHz.",
       "Convert dB: 10^(30/10) = 1000.",
       "log₂(1001) ≈ 9.97, so C ≈ 30.9 kb/s.",
       "Nyquist needs f_s > 30 kHz: 44.1 kHz is fine.",
       "Bit rate 705.6 kb/s; SQNR = 6.02 × 16 + 1.76 ≈ 98 dB."],
      "Correct Carson bandwidth, converts dB before using Shannon, checks Nyquist and gives the 6.02N + 1.76 rule.",
      "Correct values with the dB conversion or SQNR formula stated without explanation.",
      "Uses 30 directly as S/N in Shannon's formula, or Carson bandwidth as 2Δf only."),
]
T[8] = [  # Transmission Lines and Wave Propagation
    R("Give the propagation velocity on a lossless line and its value for a dielectric with ε_r = 4.",
      "v = 1/√(LC) per unit length = c/√ε_r (for μ_r = 1). With ε_r = 4, v = 3 × 10⁸/2 = 1.5 × 10⁸ m/s, so a signal takes about 6.7 ns per metre."),
    R("Define VSWR and relate it to the reflection coefficient.",
      "VSWR is the ratio of maximum to minimum voltage amplitude of the standing wave: VSWR = (1 + |Γ|)/(1 − |Γ|). A matched line has Γ = 0 and VSWR = 1; an open or short gives infinite VSWR."),
    R("What is a quarter-wave transformer and what impedance must it have?",
      "A λ/4 section of line between a load Z_L and a line Z_in. Its input impedance is Z_q²/Z_L, so choosing Z_q = √(Z_in Z_L) matches a resistive load at one frequency."),
    E("A 75 Ω lossless line is terminated in a 25 Ω resistive load.\n"
      "(a) Find the reflection coefficient, the VSWR and the fraction of incident power reflected. [3]\n"
      "(b) Design a quarter-wave transformer to match the load at 300 MHz, using line with ε_r = 2.25: give its characteristic impedance and physical length. [3]\n"
      "(c) The (unmatched) line is 2 m long with ε_r = 2.25. A 10 V step from a source with 75 Ω internal resistance is applied at t = 0. Find the load voltage before and after the wave arrives, and the arrival time. [4]\n[10 marks]",
      ["Γ = (25 − 75)/(25 + 75) = −0.5; VSWR = 1.5/0.5 = 3; reflected power fraction |Γ|² = 25%.",
       "Z_q = √(75 × 25) ≈ 43.3 Ω.",
       "v = 3 × 10⁸/1.5 = 2 × 10⁸ m/s; λ = v/f = 0.667 m; length λ/4 ≈ 16.7 cm.",
       "Launched wave: 10 × 75/(75 + 75) = 5 V (the line looks like 75 Ω).",
       "Delay = 2 m / 2 × 10⁸ m/s = 10 ns. Load voltage is 0 V before 10 ns.",
       "At the load: 5(1 + Γ) = 2.5 V, which equals the DC value 10 × 25/100 = 2.5 V. The source is matched, so no further reflections."],
      ["Γ_L = (Z_L − Z₀)/(Z_L + Z₀) = −0.5.",
       "VSWR = (1 + 0.5)/(1 − 0.5) = 3; reflected power = 0.25.",
       "Quarter-wave: Z_q = √(Z₀Z_L) = 43.3 Ω; λ/4 at 300 MHz in ε_r = 2.25 is 16.7 cm.",
       "Incident step 5 V; travel time 10 ns.",
       "V_load = 5 × (1 − 0.5) = 2.5 V for t ≥ 10 ns; reflected −2.5 V is absorbed by the matched source."],
      "Correct Γ, VSWR and power, a quarter-wave design including the velocity factor, and a bounce analysis checked against the DC result.",
      "Correct parts (a) and (b), but the step analysis misses the initial 5 V launch or the delay.",
      "Uses free-space wavelength for the transformer, or Γ with the wrong sign."),
]

emit("ELEC40009", T, 72)
