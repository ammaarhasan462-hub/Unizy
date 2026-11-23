"""Flashcards for ELEC40002 Analysis and Design of Circuits (Imperial EEE, Year 1). 12 per topic.
Written to sit alongside the quick-recall questions, not repeat them. Run: python3 cards_elec40002.py > out.sql"""
from common import F, emit_cards

C = {
# 0 Circuit Variables and Resistive Networks
0: [
 F("What is electric current, and what is its unit?", "The rate of flow of charge, i = dq/dt. Unit: the ampere (A) = 1 coulomb per second. Conventional current is the direction positive charge would move, opposite to electron flow."),
 F("What is voltage, and why is it always 'between' two points?", "Energy per unit charge, v = dw/dq, in volts (1 V = 1 J/C). It is a potential difference, so a 'node voltage' always means relative to a chosen reference node (ground)."),
 F("In any complete circuit, what must the absorbed powers of all elements add up to?", "Zero (conservation of energy, Tellegen's theorem): power delivered by sources equals power absorbed by everything else. Summing p = vi over every element is a quick check on your answer."),
 F("Power dissipated in a resistor, in three forms.", "p = vi = i²R = v²/R. It is never negative: a resistor only absorbs power."),
 F("What is conductance, and how do conductances combine in parallel?", "G = 1/R, measured in siemens (S). In parallel they simply add: G_eq = G1 + G2 + … (the reason nodal analysis is often written with conductances)."),
 F("Define node, branch, loop and mesh.", "Node: a point where two or more elements meet. Branch: a single element or path between two nodes. Loop: any closed path. Mesh: a loop with no other loop inside it (planar circuits)."),
 F("A circuit has n nodes and b branches. How many independent KCL and KVL equations are there?", "n − 1 independent KCL equations and b − (n − 1) independent KVL equations (one per mesh). Together they fix all b branch currents."),
 F("How do you tell whether two elements are in series or in parallel?", "Series: they carry the same current (joined end to end, with nothing else connected at the shared node). Parallel: they connect across the same pair of nodes, so they have the same voltage."),
 F("Model of a practical voltage source, and what happens to its terminal voltage under load.", "An ideal source Vs in series with an internal resistance Rs. Terminal voltage Vt = Vs − I·Rs, so it falls as the load current rises."),
 F("Open circuit versus short circuit.", "Open circuit: R → ∞, current is zero and the voltage can be anything. Short circuit: R = 0, voltage is zero and the current can be anything."),
 F("When is a Wheatstone bridge balanced, and why is that useful?", "When the two dividers have the same ratio (R1/R2 = R3/R4), both midpoints sit at the same voltage and no current flows through the detector. The unknown resistor then follows from the other three."),
 F("Delta-to-star (Δ → Y) conversion rule.", "Each star resistor = product of the two delta resistors next to that node ÷ sum of all three delta resistors. For three equal resistors, R_Y = R_Δ / 3."),
],
# 1 Circuit Analysis Methods and Theorems
1: [
 F("The four steps of nodal analysis.", "1) Choose a reference node. 2) Label the other n − 1 node voltages. 3) Write KCL at each node (sum of currents leaving = 0) using Ohm's law in node voltages. 4) Solve the simultaneous equations."),
 F("The steps of mesh analysis.", "Give each mesh a clockwise current, write KVL round each mesh (a shared resistor carries the difference of the two mesh currents), then solve. Works for planar circuits."),
 F("A current source sits on the branch shared by two meshes. What do you do?", "Form a supermesh: write one KVL equation round the loop that avoids the current source, plus the constraint that the difference of the two mesh currents equals the source current."),
 F("Name the four types of dependent source and how you treat them in analysis.", "VCVS, VCCS, CCVS and CCCS (voltage- or current-controlled voltage or current sources). Treat them like independent sources, then add an equation linking the controlling variable to your unknowns."),
 F("Using superposition with dependent sources: which sources do you turn off?", "Only the independent ones (voltage source → short circuit, current source → open circuit). Dependent sources stay in every sub-circuit, because they are set by circuit variables."),
 F("How do you find R_Th when the circuit contains dependent sources?", "Turn off the independent sources, apply a test voltage V_test at the terminals and find the current I_test: R_Th = V_test / I_test. Or use R_Th = V_oc / I_sc."),
 F("Thevenin and Norton values from open-circuit and short-circuit tests.", "V_Th = V_oc, I_N = I_sc, and R_Th = R_N = V_oc / I_sc."),
 F("Why don't power grids run at the maximum power transfer condition?", "At R_L = R_Th only half the power reaches the load (50% efficiency). Grids need high efficiency, so R_L ≫ R_Th. Matching suits signal circuits such as antennas and amplifier stages."),
 F("What does linearity let you do, and what is the 'unit output' method?", "In a linear circuit, scaling every independent source by k scales every voltage and current by k. Unit output: assume the output is 1, work back to the input this needs, then scale. Power is not linear, as it depends on the square."),
 F("Source transformation rule.", "A voltage source Vs in series with R behaves at its terminals exactly like a current source Vs / R in parallel with the same R, and vice versa."),
 F("How do you choose between nodal and mesh analysis?", "Count the equations: nodal needs n − 1 (fewer with voltage sources to the reference), mesh needs b − n + 1 (fewer with current sources). Pick whichever gives fewer: voltage sources favour nodal, current sources favour mesh."),
 F("Millman's theorem for parallel source branches.", "If several branches, each a source Vk in series with Rk, are connected between the same two nodes, the voltage across them is V = (Σ Vk / Rk) ÷ (Σ 1 / Rk)."),
],
# 2 Capacitors, Inductors and First-Order Transients
2: [
 F("Capacitance of a parallel-plate capacitor, and the charge it holds.", "C = εA / d, with ε = ε0·εr (unit: farad). The charge is Q = CV."),
 F("Why can't the voltage across a capacitor change instantly?", "Because i = C dv/dt: a jump in v would need infinite current. So v_C(0+) = v_C(0−). By the same argument (v = L di/dt) an inductor's current cannot jump."),
 F("The defining equation of an inductor, and its flux linkage.", "v = L di/dt, with flux linkage λ = Li. Unit: the henry (H)."),
 F("Time constant of an RL circuit.", "τ = L / R, where R is the Thevenin resistance seen from the inductor's terminals."),
 F("Which resistance goes into τ = RC or τ = L/R?", "The Thevenin resistance seen from the capacitor's (or inductor's) terminals, with the independent sources turned off. It is not necessarily any single resistor in the circuit."),
 F("How far has a first-order step response gone after one time constant?", "About 63% of the way (1 − e⁻¹ ≈ 0.632). A decaying response has fallen to about 37% of its starting value."),
 F("How can you read τ off an oscilloscope trace of an exponential?", "Draw the tangent at the start of the curve: if continued, it reaches the final value after exactly one time constant τ."),
 F("Charging a capacitor to V from a step source through a resistor: where does the energy go?", "The source supplies CV². Half (½CV²) is stored in the capacitor and half is dissipated in the resistor, whatever the value of R."),
 F("What happens if you suddenly break the current through an inductor, and how is this prevented?", "v = L di/dt becomes very large, which can cause arcing or destroy a switch. A flyback (freewheeling) diode across the inductor, as on relay coils, gives the current a safe path."),
 F("A capacitor's voltage in terms of its current.", "v_C(t) = v_C(t0) + (1/C)·∫ i dt from t0 to t. A capacitor integrates current."),
 F("How does an RC low-pass circuit respond to a square wave, compared with its time constant?", "Period ≫ τ: the output nearly reaches each level, a square wave with rounded edges. Period ≪ τ: only a small triangular ripple around the average value (the circuit integrates)."),
 F("The switch closes at t = t0, not at zero. How do you write the step response?", "Shift the time: x(t) = x(∞) + [x(t0+) − x(∞)]·e^(−(t − t0)/τ) for t ≥ t0."),
],
# 3 Sinusoidal Steady State and Phasors
3: [
 F("RMS value of a sinusoid, and the peak voltage of UK mains.", "V_rms = Vm / √2 ≈ 0.707·Vm. UK mains is 230 V rms, so the peak is about 325 V."),
 F("Average power in a resistor using rms values.", "P = V_rms² / R = I_rms²·R. This is why rms values are used: they give the same heating as DC of that value."),
 F("Phase between voltage and current in an inductor and in a capacitor.", "Inductor: current lags voltage by 90°. Capacitor: current leads voltage by 90°. Memory aid: CIVIL (in C, I before V; V before I in L)."),
 F("How do an inductor and a capacitor behave at DC and at very high frequency?", "Inductor: a short circuit at DC, an open circuit as ω → ∞. Capacitor: an open circuit at DC, a short circuit as ω → ∞."),
 F("Converting between rectangular and polar form.", "a + jb = |Z|∠θ, with |Z| = √(a² + b²) and θ = atan2(b, a). Back again: a = |Z|cos θ, b = |Z|sin θ."),
 F("Which form is easier for multiplying and dividing phasors, and for adding them?", "Polar for × and ÷ (multiply or divide the magnitudes, add or subtract the angles). Rectangular for + and −."),
 F("Average and reactive power from rms voltage and current.", "P = V_rms·I_rms·cos(θv − θi) in watts. Q = V_rms·I_rms·sin(θv − θi) in var."),
 F("What is power-factor correction and how does it work?", "Inductive loads such as motors have a lagging power factor. A capacitor in parallel supplies their reactive power locally, cutting the Q drawn from the supply, the line current and the losses. C = Q_c / (ω·V_rms²)."),
 F("Lagging versus leading power factor.", "Lagging: current lags voltage, an inductive load, Q > 0. Leading: current leads voltage, a capacitive load, Q < 0."),
 F("Two sources at different frequencies drive one circuit. Can you add their phasors?", "No. Phasors assume one frequency. Use superposition: solve each frequency separately with its own impedances, convert each to the time domain, then add."),
 F("Series RL with |V_R| = 3 V and |V_L| = 4 V. What is the supply voltage?", "5 V, not 7 V. KVL holds for phasors, which add as vectors: √(3² + 4²) = 5 V."),
 F("How do impedances combine in series and in parallel?", "Just like resistors. Series: Z = Z1 + Z2. Parallel: Z = Z1·Z2 / (Z1 + Z2). In general Z = R + jX, in ohms."),
],
# 4 Frequency Response and Filters
4: [
 F("What is a transfer function H(jω), and what do its magnitude and angle tell you?", "The phasor ratio Vout / Vin at frequency ω. |H| is the gain at that frequency and ∠H is the phase shift."),
 F("Gain in decibels, and the dB values of ×10, ×2 and 1/√2.", "Voltage gain in dB = 20·log10|Vout / Vin| (power uses 10·log10). ×10 = +20 dB, ×2 ≈ +6 dB, 1/√2 ≈ −3 dB."),
 F("Why is the cutoff called the '−3 dB' or 'half-power' point?", "There |H| = 1/√2, so the output power is half its passband value, and 10·log10(0.5) ≈ −3 dB."),
 F("Transfer function and response of a first-order RC high-pass filter.", "H = jωRC / (1 + jωRC). The gain rises at +20 dB/decade below ωc = 1/RC and tends to 1 above it. The phase goes from +90° at low frequency, through +45° at ωc, to 0°."),
 F("Over what range does the phase of a first-order low-pass filter change?", "From about 0° to about −90° across roughly two decades, from 0.1·ωc to 10·ωc, passing −45° at ωc."),
 F("Bode magnitude asymptote rules for poles and zeros.", "Each pole adds −20 dB/decade from its corner frequency and each zero adds +20 dB/decade. At a single corner the real curve is 3 dB from the asymptotes."),
 F("Bandwidth and Q of a band-pass response.", "B = ω2 − ω1, between the two −3 dB points, and Q = ω0 / B. For a series RLC circuit, B = R / L rad/s."),
 F("In a series RLC circuit driven by a voltage source, which output gives low-pass, high-pass and band-pass?", "Across C: low-pass. Across L: high-pass. Across R: band-pass, peaking at ω0 = 1/√(LC)."),
 F("What happens at resonance in a parallel RLC circuit?", "At ω0 = 1/√(LC) the impedance is at its maximum and purely resistive (R). The currents in L and C can be Q times the source current, which is called current magnification."),
 F("What is a notch (band-stop) filter? Give one use.", "A filter that rejects a narrow band around ω0, for example a series LC branch shunting the output, which is a short circuit at resonance. Used to remove 50 Hz mains hum."),
 F("Why can't you just multiply the responses of two cascaded passive RC filters?", "The second stage loads the first and changes its response. Put a buffer, such as an op-amp voltage follower, between the stages to make the product rule hold."),
 F("Roll-off and final phase of a second-order low-pass filter.", "−40 dB/decade beyond ω0, with the phase heading to −180°. If Q > 1/√2, the response peaks near ω0."),
],
# 5 Second-Order Circuits and Natural Response
5: [
 F("Neper frequency α and resonant frequency ω0 for series and parallel RLC circuits.", "Series: α = R / (2L). Parallel: α = 1 / (2RC). Both: ω0 = 1/√(LC)."),
 F("Damped natural frequency, and the underdamped natural response.", "ωd = √(ω0² − α²). Response: x(t) = e^(−αt)·(A1·cos ωd·t + A2·sin ωd·t)."),
 F("Form of the overdamped natural response.", "x(t) = A1·e^(s1·t) + A2·e^(s2·t), with s1,2 = −α ± √(α² − ω0²), both real and negative."),
 F("Value of R that critically damps a series RLC circuit.", "R = 2√(L / C), which makes α = ω0."),
 F("Damping ratio ζ, and what its value tells you.", "ζ = α / ω0. ζ < 1: underdamped (oscillates). ζ = 1: critically damped (fastest with no overshoot). ζ > 1: overdamped (slow, no oscillation)."),
 F("Percentage overshoot of an underdamped second-order step response.", "Overshoot = exp(−ζπ / √(1 − ζ²)) × 100%. For example, ζ = 0.5 gives about 16%."),
 F("Approximate 2% settling time of an underdamped second-order response.", "t_s ≈ 4 / α = 4 / (ζ·ω0), because the envelope e^(−αt) falls below 2% after about 4 time constants of 1/α."),
 F("Where are the poles in the s-plane for each damping case?", "Underdamped: a complex pair at −α ± jωd. Critical: a repeated real pole at −α. Overdamped: two different real poles. Poles in the right half-plane mean an unstable, growing response."),
 F("What happens when R = 0 in an LC circuit?", "α = 0, so the circuit oscillates forever at ω0 = 1/√(LC), with energy swapping between the inductor's magnetic field and the capacitor's electric field."),
 F("A step Vs is applied to a series RLC circuit. What are the final values of v_C and i_L?", "v_C → Vs and i_L → 0, because the capacitor is an open circuit at DC. The full response is this forced value plus the natural response."),
 F("In a decaying RLC circuit, what does the resistor do to the energy?", "It dissipates the stored energy as heat. The amplitude envelope decays as e^(−αt), so the stored energy decays as e^(−2αt)."),
 F("How do you decide the order of a circuit?", "Count the independent energy-storage elements that can't be combined into one. One L and one C give second order. Two capacitors that combine in series or parallel count as one."),
],
# 6 Operational Amplifiers and Active Circuits
6: [
 F("What is a voltage follower and why use one?", "Output fed straight back to the inverting input, so Vout = Vin (gain 1). Very high input impedance and low output impedance make it a buffer that stops one stage loading another."),
 F("Output of the standard difference amplifier with matched resistors.", "Vout = (R2 / R1)·(V2 − V1), with V2 on the non-inverting side. It only amplifies the difference between the inputs."),
 F("Output of the inverting integrator, and the practical fix it needs.", "Vout = −(1/RC)·∫Vin dt. A large resistor across C limits the DC gain, so offset voltage and bias current don't slowly drive the output to a rail."),
 F("Output of the op-amp differentiator, and its main practical problem.", "Vout = −RC·dVin/dt. Its gain rises with frequency, so it amplifies high-frequency noise. A small series input resistor limits the high-frequency gain."),
 F("What is the gain–bandwidth product? Give an example.", "For a dominant-pole op-amp, closed-loop gain × bandwidth ≈ constant = f_T, the unity-gain frequency. With a 1 MHz GBW, a gain of 100 gives about 10 kHz of bandwidth."),
 F("How do input offset voltage and bias current show up at the output of an amplifier?", "The offset Vos is multiplied by the noise gain (1 + Rf/R1). Bias current through Rf adds about I_B·Rf. A resistor equal to R1 ‖ Rf at the non-inverting input cancels most of the bias-current error."),
 F("What happens when an op-amp saturates?", "The output can't go beyond the supply rails (less some headroom unless it is rail-to-rail). Once it saturates, the virtual short no longer holds, so the usual analysis fails."),
 F("Open-loop comparator versus Schmitt trigger.", "Comparator: no feedback, the output goes to +Vsat if V+ > V−, otherwise to −Vsat. Schmitt trigger: positive feedback adds hysteresis (two thresholds), so a noisy input gives one clean switch."),
 F("Negative versus positive feedback in op-amp circuits.", "Negative feedback (to the inverting input) gives stable, set gain and keeps V+ ≈ V−. Positive feedback (to the non-inverting input) drives the output to a rail, which is used in comparators and oscillators."),
 F("Input impedance of an inverting amplifier compared with a non-inverting one.", "Inverting: R_in = R1, because the inverting input is a virtual earth. Non-inverting: very high, close to the op-amp's own input impedance."),
 F("What is CMRR?", "Common-mode rejection ratio = differential gain / common-mode gain, usually in dB: 20·log10(Ad / Acm). A high CMRR rejects noise that appears equally on both inputs."),
 F("Transfer function of an inverting amplifier with a capacitor across Rf (active low-pass).", "H = −(Rf / R1) / (1 + jω·Rf·C). DC gain −Rf/R1 and corner frequency ωc = 1 / (Rf·C)."),
],
# 7 Semiconductor Devices: Diodes and Transistors
7: [
 F("Half-wave versus full-wave rectifier.", "Half-wave passes only one half-cycle, giving ripple at the supply frequency f. Full-wave (bridge or centre-tap) uses both halves, giving ripple at 2f. A bridge loses two diode drops."),
 F("Approximate ripple with a smoothing capacitor.", "Peak-to-peak ripple ≈ I_load / (f_r·C), where f_r is the ripple frequency (f for half-wave, 2f for full-wave). A larger C or a lighter load gives less ripple."),
 F("What is peak inverse voltage (PIV)? Give typical values.", "The largest reverse voltage a diode must withstand. Half-wave with a smoothing capacitor: about 2Vm. Bridge rectifier: about Vm per diode."),
 F("Small-signal resistance of a forward-biased diode.", "r_d = V_T / I_D ≈ 25 mV / I_D at room temperature, so 25 Ω at 1 mA."),
 F("BJT current relationships.", "I_E = I_C + I_B, I_C = β·I_B, and α = I_C / I_E = β / (β + 1), which is slightly less than 1."),
 F("Typical BJT voltages in the active and saturated regions.", "Active: V_BE ≈ 0.6–0.7 V for silicon. Saturation: both junctions are forward-biased and V_CE(sat) ≈ 0.2 V."),
 F("r_π of a BJT, and the gain of a basic common-emitter stage.", "r_π = β / g_m, with g_m = I_C / V_T. Without an emitter resistor, and ignoring r_o, the gain is about −g_m·R_C."),
 F("What does an unbypassed emitter resistor R_E do to a common-emitter amplifier?", "Gain ≈ −R_C / (R_E + 1/g_m) ≈ −R_C / R_E: lower, but stable and almost independent of β. It also raises the input resistance."),
 F("How does voltage-divider biasing make a BJT stage stable?", "R1 and R2 set V_B, so I_C ≈ (V_B − 0.7) / R_E barely depends on β. Make the divider current much larger than I_B (about 10×) so the base current doesn't pull V_B."),
 F("MOSFET drain current in the triode region.", "i_D = k'n(W/L)·[(v_GS − V_t)·v_DS − v_DS²/2] for v_DS < v_GS − V_t, with k'n = μn·Cox. For small v_DS it acts as a voltage-controlled resistor."),
 F("Transconductance of a MOSFET in saturation.", "g_m = 2I_D / (V_GS − V_t) = √(2·k'n·(W/L)·I_D), from the square law I_D = ½·k'n·(W/L)·(V_GS − V_t)²."),
 F("Why is a MOSFET a good switch?", "The insulated gate draws no DC current. With V_GS well above V_t it is fully on (triode, low R_DS(on)), and with V_GS below V_t it is off. Used in logic gates and power switching."),
],
}

if __name__ == "__main__":
    emit_cards("ELEC40002", C)
