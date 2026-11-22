"""Top-up for Imperial ELEC40006 Electronics Design Project 1: 3 recall + 1 exam per topic.
Run: python3 tools/packs/elec40006.py > /tmp/elec40006.sql"""
from common import R, E, emit

T = {}
T[0] = [  # project planning and requirements
    R("What makes a requirement SMART or testable?",
      "It is specific, measurable, achievable, relevant and time-bound, and states a pass criterion that a test can check, e.g. 'the node reports temperature to ±0.5 °C every 60 s' rather than 'it should be accurate'."),
    R("What is a risk register and what does each entry contain?",
      "A table of project risks, each with a description, likelihood, impact, owner and mitigation or contingency plan. It is reviewed regularly so high risks are tackled early."),
    R("What is a design review and why hold one before ordering a PCB?",
      "A structured check of the design by people other than its author against the specification (schematic, footprints, power budget, test points). Errors caught on paper cost far less than a respin after fabrication."),
    E("Your team is building a battery-powered temperature logger. It must sample every 10 s, store a week of data and run for 30 days on two AA cells (assume 2000 mAh usable at 3 V).\n"
      "(a) Turn these needs into three testable specification statements. [3]\n"
      "(b) Find the maximum average current the design may draw. [3]\n"
      "(c) The microcontroller draws 5 mA for 20 ms per sample and 10 µA asleep. Find the average current and whether the budget is met. [4]\n[10 marks]",
      ["Spec examples: 'samples temperature every 10 s ± 0.1 s'; 'stores ≥ 60,480 samples (7 days) without loss'; 'operates ≥ 30 days from 2 × AA at 20 °C'.",
       "Battery: 2000 mAh over 30 × 24 = 720 h gives I_avg,max ≈ 2.78 mA.",
       "Active duty cycle = 20 ms/10 s = 0.2%. Active contribution = 5 mA × 0.002 = 10 µA.",
       "Sleep contribution ≈ 10 µA × 0.998 ≈ 10 µA. Total ≈ 20 µA.",
       "20 µA ≪ 2.78 mA, so the budget is easily met (about 11 years in theory, in practice limited by battery self-discharge); the margin can cover sensor and memory current."],
      ["Write each need as a measurable statement with a test method.",
       "Hours in 30 days: 720. Max average current = 2000 mAh/720 h ≈ 2.78 mA.",
       "Duty cycle 0.02 s/10 s = 0.002; active average 5 mA × 0.002 = 10 µA.",
       "Add sleep current ≈ 10 µA: total ≈ 20 µA.",
       "Compare: well within budget; note self-discharge and other loads."],
      "Writes genuinely testable specs, computes the budget and duty-cycle current correctly, and comments on real limits such as self-discharge.",
      "Correct numbers but specs that are vague or not testable.",
      "Ignores the sleep current, or confuses mAh with mA."),
]
T[1] = [  # op-amps and filters
    R("Give the gain of a non-inverting amplifier and its input resistance with an ideal op-amp.",
      "G = 1 + R_f/R_1. The input goes straight to the non-inverting input, so the input resistance is ideally infinite, which makes it a good buffer for high-impedance sensors."),
    R("What is a voltage follower and why is it used?",
      "An op-amp with its output tied to the inverting input and the signal on the non-inverting input: gain 1, very high input resistance and low output resistance. It buffers a source so the load does not draw current from it."),
    R("How does a first-order RC high-pass filter respond, and what is its cutoff frequency?",
      "It blocks DC and passes high frequencies: |H| = (f/f_c)/√(1 + (f/f_c)²), rising at 20 dB/decade below f_c. f_c = 1/(2πRC), where the gain is 1/√2 (−3 dB) and the phase lead is 45°."),
    E("A sensor gives 0 to 50 mV and must drive a 0 to 3.3 V ADC input.\n"
      "(a) Design a non-inverting amplifier giving full-scale output, choosing standard resistor values. [4]\n"
      "(b) Add a first-order low-pass filter at the output with f_c ≈ 100 Hz using C = 100 nF: find R. [3]\n"
      "(c) With an op-amp GBW of 1 MHz, find the amplifier's bandwidth and say whether it is adequate. [3]\n[10 marks]",
      ["Required gain = 3.3 V/50 mV = 66.",
       "1 + R_f/R_1 = 66, so R_f/R_1 = 65: e.g. R_1 = 1 kΩ, R_f = 65 kΩ (use 64.9 kΩ E96, giving gain 65.9 and 3.30 V).",
       "R = 1/(2πf_cC) = 1/(2π × 100 × 100 × 10⁻⁹) ≈ 15.9 kΩ (use 16 kΩ).",
       "Bandwidth ≈ GBW/noise gain = 1 MHz/66 ≈ 15 kHz.",
       "This is far above the 100 Hz signal band, so it is adequate; a rail-to-rail output op-amp is needed to reach 3.3 V on a 3.3 V supply."],
      ["Gain needed: 3.3/0.05 = 66.",
       "Choose R_1 = 1 kΩ and R_f ≈ 65 kΩ (64.9 kΩ).",
       "Filter: R = 1/(2π × 100 × 100 nF) ≈ 15.9 kΩ.",
       "Op-amp bandwidth ≈ 1 MHz/66 ≈ 15 kHz.",
       "Adequate for a 100 Hz band; check rail-to-rail output swing."],
      "Correct gain, sensible standard values with the resulting error, correct filter R, and a bandwidth check including the output-swing point.",
      "Correct design but non-standard values or the bandwidth not checked.",
      "Uses the inverting gain formula, or forgets the 2π in f_c."),
]
T[2] = [  # diodes, MOSFET switches, power
    R("What is a flyback (freewheeling) diode and why is it needed across a relay coil or motor?",
      "A diode reverse-biased across the inductive load. When the switch turns off, the inductor current continues through the diode instead of producing a large voltage spike (V = L di/dt) that could destroy the transistor."),
    R("What does a linear voltage regulator such as an LDO do, and how is its efficiency limited?",
      "It drops the excess voltage across a pass transistor to give a steady output. Its efficiency is at most V_out/V_in, so it wastes (V_in − V_out) × I as heat; the dropout voltage is the minimum V_in − V_out it needs."),
    R("Why choose a logic-level MOSFET for switching from a 3.3 V microcontroller?",
      "Its R_DS(on) is specified at V_GS = 2.5 to 4.5 V, so it turns fully on from a logic output. A standard MOSFET may need V_GS ≈ 10 V and would sit in a partly-on, high-resistance state, overheating."),
    E("A 5 V LDO regulator supplies 200 mA from a 9 V battery.\n"
      "(a) Find the power dissipated in the regulator and its efficiency. [3]\n"
      "(b) The regulator package has thermal resistance 50 °C/W junction-to-ambient. Find the junction temperature at 25 °C ambient and comment. [3]\n"
      "(c) A MOSFET with R_DS(on) = 0.05 Ω switches a 2 A load. Find its conduction loss and compare it with an LDO-style linear drop for the same load. [4]\n[10 marks]",
      ["P_reg = (9 − 5) × 0.2 = 0.8 W; efficiency = 5/9 ≈ 56%.",
       "T_j = 25 + 0.8 × 50 = 65 °C: acceptable (below a typical 125 °C limit) but warm.",
       "At higher input voltage or current it would need a heatsink, or a switching regulator.",
       "MOSFET loss = I²R = 2² × 0.05 = 0.2 W, with only 0.1 V dropped.",
       "Dropping several volts linearly at 2 A would waste several watts, so a fully-on switch (or a switching converter) is far more efficient."],
      ["Power dropped = ΔV × I = 4 V × 0.2 A = 0.8 W.",
       "Efficiency ≈ V_out/V_in = 56%.",
       "Junction temperature = T_a + PθJA = 25 + 40 = 65 °C.",
       "MOSFET conduction loss = I²R_DS(on) = 0.2 W.",
       "Compare: switching fully on wastes little; linear regulation wastes ΔV × I."],
      "Correct dissipation, efficiency and junction temperature with a safety judgement, and a clear comparison between switching and linear losses.",
      "Correct numbers but no comment on thermal limits.",
      "Uses V_out × I as the regulator loss, or adds θJA to temperature without multiplying by power."),
]
T[3] = [  # combinational logic
    R("What is a full adder and how are full adders combined into a ripple-carry adder?",
      "A circuit adding bits A, B and carry-in to give sum S = A ⊕ B ⊕ Cin and carry Cout = AB + Cin(A ⊕ B). An n-bit ripple-carry adder chains n full adders, each carry-out feeding the next carry-in."),
    R("What is a seven-segment decoder?",
      "A combinational circuit that converts a 4-bit binary (or BCD) input into the 7 signals that light segments a to g to display the digit. Each output is a Boolean function of the 4 inputs, often simplified with K-maps."),
    R("What are don't-care conditions and how are they used in a K-map?",
      "Input combinations that never occur or whose output does not matter (e.g. BCD codes 10 to 15). They are marked X and can be treated as 1 or 0, whichever gives larger groups and a simpler expression."),
    E("Design a circuit with a 4-bit BCD input (ABCD, A the MSB) whose output F = 1 when the digit is 5 or more.\n"
      "(a) Write F as a sum of minterms, listing the don't-cares. [3]\n"
      "(b) Use a K-map to find the minimal sum-of-products expression. [4]\n"
      "(c) Implement it using NAND gates only. [3]\n[10 marks]",
      ["F = Σm(5, 6, 7, 8, 9) with don't-cares d(10, 11, 12, 13, 14, 15).",
       "Group A = 1 (minterms 8 to 15 using don't-cares): term A.",
       "Group 5, 7, 13, 15 (B = 1, D = 1): BD. Group 6, 7, 14, 15 (B = 1, C = 1): BC.",
       "F = A + BD + BC = A + B(C + D).",
       "NAND form: F = ((A')·(BD)'·(BC)')' — invert A, NAND B with D and B with C, then NAND the three results."],
      ["Digits 5 to 9 are minterms 5, 6, 7, 8, 9; codes 10 to 15 cannot occur.",
       "Plot on a 4-variable K-map with X in cells 10 to 15.",
       "Largest groups: A (8 cells), BD (4 cells), BC (4 cells).",
       "Minimal SOP: F = A + BD + BC.",
       "Two-level NAND-NAND: first-level NANDs for BD, BC and A' (a NAND with inputs tied), then a 3-input NAND."],
      "Uses don't-cares to get the minimal three-term form, checks it against digits 5 to 9, and gives a correct NAND-NAND realisation.",
      "Correct SOP but without using don't-cares fully (extra literals).",
      "Treats codes 10 to 15 as 0, giving a longer expression, or a NAND circuit that implements the complement."),
]
T[4] = [  # sequential logic and FSMs
    R("What is switch bounce and how can it be removed?",
      "A mechanical switch makes and breaks contact several times over a few milliseconds when pressed. Remove it with an RC filter plus Schmitt trigger, an SR latch on a changeover switch, or software that waits for a stable reading for 10 to 20 ms."),
    R("What does a shift register do, and give one use.",
      "A chain of D flip-flops on a common clock, each passing its value to the next on every edge. Uses include serial-to-parallel conversion (e.g. driving many LEDs from three microcontroller pins) and delays."),
    R("Why are synchronous designs, with one clock edge for all flip-flops, preferred?",
      "All state changes happen at the same instant, so timing can be checked with setup and hold analysis and combinational glitches settle before the next edge. Asynchronous or gated clocks risk races, skew and glitches."),
    E("A traffic light controller is a Moore FSM with states RED (30 s), RED+AMBER (2 s), GREEN (25 s) and AMBER (3 s), cycling in that order. A 1 Hz tick and a down-counter time each state.\n"
      "(a) Draw the state diagram and give a state table with outputs R, A, G. [4]\n"
      "(b) Choose a binary state encoding and state how many flip-flops are needed. [2]\n"
      "(c) Explain how the counter and FSM interact, and how long one full cycle takes. [4]\n[10 marks]",
      ["States in order: RED (R = 1) → RED+AMBER (R = A = 1) → GREEN (G = 1) → AMBER (A = 1) → RED.",
       "Each transition happens when the timer signals done; otherwise the state holds.",
       "Encoding: RED = 00, RED+AMBER = 01, GREEN = 10, AMBER = 11: 2 flip-flops (a Gray-style order 00, 01, 11, 10 also works and changes one bit per step).",
       "On entering a state the FSM loads the counter with that state's duration; the counter decrements on each 1 Hz tick and asserts done at zero, moving the FSM on.",
       "Full cycle = 30 + 2 + 25 + 3 = 60 s.",
       "A reset should force RED so the lights start in a safe state."],
      ["Four states with Moore outputs: R, RA, G, A.",
       "Next state = following state when done = 1, same state otherwise.",
       "Four states need 2 flip-flops.",
       "FSM loads the counter with 30, 2, 25 or 3 on entry; counter counts 1 Hz ticks to zero.",
       "Cycle time 60 s; reset to RED for safety."],
      "Correct sequence and outputs, sensible encoding, a clear datapath-plus-controller explanation and a safe reset state.",
      "Correct diagram and encoding but the counter interaction described vaguely.",
      "Wrong UK sequence (e.g. AMBER before RED+AMBER), or one state per second of timing."),
]
T[5] = [  # microcontrollers, ADC, interrupts
    R("What is PWM and how can it control the brightness of an LED or the speed of a motor?",
      "Pulse-width modulation switches the output fully on and off at a fixed frequency while varying the duty cycle. The average power is proportional to the duty cycle, so brightness or speed changes with little loss in the switch."),
    R("Compare UART, SPI and I²C.",
      "UART: two wires (TX, RX), asynchronous, point-to-point, agreed baud rate. SPI: clock, MOSI, MISO plus a chip select per device; fast, full-duplex. I²C: two wires (SDA, SCL) with open-drain pull-ups, addressed devices on a shared bus, slower."),
    R("Why should variables shared between an interrupt service routine and main code be declared volatile?",
      "volatile tells the compiler the value can change outside normal program flow, so it must reread memory every time instead of keeping a cached copy in a register. Multi-byte shared data also needs interrupts disabled briefly (atomic access)."),
    E("A 12-bit ADC with a 3.3 V reference samples a light sensor through a potential divider.\n"
      "(a) Find the ADC's LSB size and the code produced by 1.25 V. [3]\n"
      "(b) An LED is driven by PWM at 1 kHz from a 3.3 V pin. Find the on-time for 30% brightness and the average voltage. [3]\n"
      "(c) Outline a timer-interrupt design that samples the ADC at 100 Hz and updates the PWM duty cycle in proportion to the reading. [4]\n[10 marks]",
      ["LSB = 3.3 V/4096 ≈ 0.806 mV.",
       "Code = 1.25/3.3 × 4096 ≈ 1551 (round down to 1551).",
       "Period = 1 ms; 30% duty gives 0.3 ms on-time; average voltage = 0.3 × 3.3 ≈ 0.99 V.",
       "Configure a hardware timer to interrupt every 10 ms; in the ISR start (or read) the ADC conversion and store the result in a volatile variable with a flag.",
       "In the main loop (or ISR if short), set duty = reading/4095 × PWM period register, e.g. compare = reading × TOP/4095.",
       "Keep the ISR short, and optionally average several readings to reduce noise."],
      ["LSB = V_ref/2¹² = 0.806 mV.",
       "Code = V_in/LSB = 1.25/0.000806 ≈ 1551.",
       "PWM: T = 1 ms, t_on = 0.3 ms, V_avg ≈ 0.99 V.",
       "Timer interrupt every 10 ms triggers sampling.",
       "Map 0 to 4095 to duty 0 to 100% in the PWM compare register."],
      "Correct LSB and code, PWM timing and average, and a sound interrupt design with short ISRs and shared-variable care.",
      "Correct calculations but polling used instead of a timer, or no mapping given.",
      "Uses 2¹² − 1 inconsistently, or treats duty cycle as frequency."),
]
T[6] = [  # sampling, signals and noise
    R("What is aliasing?",
      "When a signal containing frequencies above half the sampling rate is sampled, those components fold back and appear as false lower frequencies (f_alias = |f − kf_s|). It cannot be removed after sampling, so it must be prevented with an anti-aliasing filter."),
    R("Define signal-to-noise ratio in decibels.",
      "SNR = 10 log₁₀(P_signal/P_noise) = 20 log₁₀(V_signal,rms/V_noise,rms) dB. For example, 1 V rms signal and 10 mV rms noise give 40 dB."),
    R("How does averaging N independent samples affect random noise?",
      "Random (uncorrelated) noise adds in power, so averaging N samples reduces the noise standard deviation by √N, improving SNR by 10 log₁₀N dB (e.g. 16 samples: 4× less noise, +12 dB). It does not reduce correlated interference such as mains hum."),
    E("A signal of interest occupies 0 to 1 kHz but the input also contains interference at 9 kHz. It is sampled at 8 kHz.\n"
      "(a) At what frequency does the 9 kHz interference appear after sampling? [2]\n"
      "(b) Specify a first-order anti-aliasing filter cutoff and find how much it attenuates 9 kHz. Comment. [4]\n"
      "(c) The signal is 50 mV rms and the noise 5 mV rms. Find the SNR in dB, and the improvement if 16 samples are averaged. [4]\n[10 marks]",
      ["Alias = |9 − 8| = 1 kHz: it lands inside the signal band.",
       "Choose f_c ≈ 1.5 kHz (passes 1 kHz with |H| ≈ 0.83).",
       "At 9 kHz: |H| = 1/√(1 + 6²) ≈ 0.164, about −15.7 dB: only modest attenuation.",
       "A higher-order filter or a higher sampling rate is needed for strong rejection (a first-order filter falls only 20 dB/decade).",
       "SNR = 20 log₁₀(50/5) = 20 dB.",
       "Averaging 16 samples cuts random noise by 4: SNR ≈ 32 dB (+12 dB)."],
      ["Fold: 9 kHz − 8 kHz = 1 kHz.",
       "Pick f_c a little above the band, e.g. 1.5 kHz.",
       "|H(9 kHz)| = 1/√(1 + (9/1.5)²) ≈ 0.164 (−15.7 dB).",
       "Conclude a steeper filter or higher f_s is needed.",
       "SNR 20 dB; averaging 16 gives +12 dB to about 32 dB."],
      "Correct alias, filter design with the attenuation calculated and its weakness recognised, and correct SNR with the √N rule.",
      "Correct alias and SNR but filter attenuation not quantified.",
      "Claims the alias is at 17 kHz, or uses 10 log for voltage ratios."),
]
T[7] = [  # PCB, test and verification
    R("Why are wide traces used for power and high-current paths on a PCB?",
      "Trace resistance is inversely proportional to width (for a given copper thickness), so wider traces reduce I²R heating and voltage drop. IPC tables give the width needed for a given current and temperature rise."),
    R("What are test points and why include them on a PCB?",
      "Exposed pads or pins on key nets (supply rails, clocks, signals) where probes can be attached. They make measurement, debugging and production testing easier without damaging components."),
    R("What is a bill of materials (BOM) and what should it list?",
      "A list of every part needed to build the board: reference designators, quantity, value, package or footprint, manufacturer part number, supplier and cost. It is used for ordering, assembly and costing."),
    E("A board's 3.3 V rail reads 2.1 V and the regulator is hot.\n"
      "(a) Describe a systematic fault-finding procedure. [5]\n"
      "(b) The 3.3 V regulator can supply 500 mA. Measured current is 480 mA, but the design should draw about 60 mA. Give two likely causes and how you would confirm each. [3]\n"
      "(c) State one design change that would make this kind of fault easier to find on the next revision. [2]\n[10 marks]",
      ["Power down; inspect visually for solder bridges, reversed parts (diodes, electrolytics, ICs) and wrong values.",
       "Measure resistance from 3.3 V to ground unpowered: a very low value indicates a short.",
       "Power from a current-limited bench supply; check input voltage, regulator enable and output.",
       "Locate the heat or current: feel/thermal camera for hot parts, or isolate sections one at a time.",
       "Likely causes: a component fitted the wrong way round (e.g. a reversed IC or tantalum capacitor), or a solder bridge or wrong footprint shorting the rail.",
       "Confirm by removing or lifting the suspect part (or cutting a link) and seeing whether the current returns to about 60 mA.",
       "Next revision: add 0 Ω links or jumpers between the regulator and each section, plus labelled test points on every rail."],
      ["Inspect first, then measure rail-to-ground resistance unpowered.",
       "Power with a current limit and measure voltages and current.",
       "Find the hot spot or isolate sections to localise the load.",
       "Suspect reversed parts or shorts; confirm by removing the suspect and remeasuring.",
       "Design for test: isolation links and test points."],
      "Logical, safe sequence from inspection to isolation, plausible causes with concrete confirmation tests, and a design-for-test improvement.",
      "Reasonable steps but out of order or without confirmation of causes.",
      "Replaces the regulator without finding the cause, or powers the board without a current limit."),
]

emit("ELEC40006", T, 64)
