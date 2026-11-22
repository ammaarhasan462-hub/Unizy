"""Top-up for Imperial ELEC40003 Digital Electronics and Computer Architecture: 3 recall + 1 exam per topic.
Run: python3 tools/packs/elec40003.py > /tmp/elec40003.sql"""
from common import R, E, emit

T = {}
T[0] = [  # Number Systems and Boolean Algebra
    R("Convert 0xB7 to binary and to unsigned decimal.",
      "0xB7 = 1011 0111 in binary (B = 1011, 7 = 0111). As unsigned decimal: 11 × 16 + 7 = 183."),
    R("State the absorption laws of Boolean algebra, and the related identity for A + A'B.",
      "A + AB = A and A(A + B) = A. The related identity is A + A'B = A + B (and dually A(A' + B) = AB)."),
    R("What is binary-coded decimal (BCD), and how is the decimal number 93 written in BCD?",
      "BCD encodes each decimal digit separately in 4 bits (0000 to 1001; codes 1010 to 1111 are unused). 93 is 1001 0011. Note this differs from 93 in plain binary, which is 0101 1101."),
    E("(a) Simplify F = A'B'C + A'BC + AB'C + ABC' + ABC using Boolean algebra, and confirm with the minterm list. [4]\n"
      "(b) Write 0.625 as a binary fraction. [2]\n"
      "(c) Represent −6.5 as an 8-bit two's complement fixed-point number with 4 integer bits and 4 fraction bits (Q4.4), giving the result in hex, and state the range this format can represent. [4]\n[10 marks]",
      ["F = Σm(1, 3, 5, 6, 7). The four terms with C = 1 combine to C; ABC' with ABC gives AB. So F = C + AB.",
       "Check: C covers minterms 1, 3, 5, 7 and AB covers 6, 7, which is exactly the list.",
       "0.625 = 0.5 + 0.125 = 0.101 in binary.",
       "+6.5 in Q4.4 is 0110.1000. Invert and add 1: 1001.0111 + 1 = 1001.1000 = 0x98.",
       "Check: 0x98 = 152, and 152 − 256 = −104; −104 / 16 = −6.5.",
       "Range of Q4.4: −8 to +7.9375 in steps of 1/16 = 0.0625."],
      ["Group the C terms: A'B'C + A'BC + AB'C + ABC = C(A'B' + A'B + AB' + AB) = C.",
       "ABC' + ABC = AB(C' + C) = AB, so F = C + AB.",
       "Minterm check: C gives 1, 3, 5, 7; AB gives 6, 7; union is 1, 3, 5, 6, 7 as required.",
       "0.625 × 2 = 1.25 → 1; 0.25 × 2 = 0.5 → 0; 0.5 × 2 = 1.0 → 1. So 0.101.",
       "6.5 = 0110.1000 in Q4.4. Two's complement: invert to 1001.0111, add one LSB to get 1001.1000 = 0x98.",
       "Range: most negative 1000.0000 = −8; most positive 0111.1111 = 7.9375; resolution 2⁻⁴."],
      "Simplifies cleanly with named laws, checks against the minterms, negates correctly in fixed point and verifies the hex result, and states range and resolution.",
      "Correct simplification and conversion, but no check of the result or the range is incomplete.",
      "Simplification left part-way, or the fixed-point negation applied to the integer part only."),
]
T[1] = [  # Combinational Logic Design
    R("What does a multiplexer do, and how many select lines does an 8-to-1 multiplexer need?",
      "A multiplexer routes one of several data inputs to a single output, chosen by the select lines. An 8-to-1 mux needs log₂8 = 3 select lines."),
    R("Give the sum and carry-out equations of a full adder.",
      "S = A ⊕ B ⊕ Cin. Cout = AB + Cin(A ⊕ B), which equals the majority function AB + ACin + BCin."),
    R("How can a 3-to-8 decoder plus an OR gate implement any 3-variable Boolean function?",
      "Each decoder output is high for exactly one input combination, so the outputs are the 8 minterms. OR together the outputs for the minterms where the function is 1 (sum of minterms)."),
    E("F(A, B, C) = Σm(1, 2, 4, 7).\n"
      "(a) Implement F using one 4-to-1 multiplexer with A and B as the select inputs. State what is connected to each data input. [4]\n"
      "(b) Show that F = A ⊕ B ⊕ C. [3]\n"
      "(c) Explain why a Karnaugh map gives no simplification of F in sum-of-products form. [3]\n[10 marks]",
      ["AB = 00 covers minterms 0, 1: F = 1 only at C = 1, so I0 = C.",
       "AB = 01 covers 2, 3: F = 1 at C = 0, so I1 = C'. AB = 10 covers 4, 5: I2 = C'. AB = 11 covers 6, 7: I3 = C.",
       "F is 1 exactly when an odd number of inputs are 1 (001, 010, 100, 111), which is the definition of A ⊕ B ⊕ C.",
       "Algebra: A ⊕ B ⊕ C = (A ⊕ B)C' + (A ⊕ B)'C, matching I0..I3 above.",
       "On the K-map the 1s form a checkerboard: no two 1s are adjacent, so no grouping is possible and SOP needs all four 3-literal minterms.",
       "XOR gates (or the mux) are much cheaper than the 4-term SOP."],
      ["Split the truth table into pairs by AB: (0,1), (2,3), (4,5), (6,7).",
       "For each pair, F as a function of C: 00 → C, 01 → C', 10 → C', 11 → C.",
       "Connect I0 = C, I1 = C', I2 = C', I3 = C; select lines S1 = A, S0 = B.",
       "Minterms 1, 2, 4, 7 have one or three 1s: odd parity, so F = A ⊕ B ⊕ C.",
       "On the K-map each 1 has only 0s as neighbours (checkerboard), so every prime implicant is a single minterm and no reduction is possible."],
      "Derives each mux input from the truth table, proves the XOR form by parity and algebra, and explains the checkerboard pattern and its cost consequence.",
      "Mux inputs correct with brief reasoning; the XOR claim is asserted rather than shown.",
      "Mux inputs muddled (e.g. using C as a select line), or claims the K-map does simplify."),
]
T[2] = [  # Sequential Logic: Latches and Flip-Flops
    R("Why is S = R = 1 not allowed for a NOR-based SR latch?",
      "Both outputs Q and Q' are forced to 0, so they are no longer complements. If S and R then return to 0 together, the latch races and its final state is unpredictable."),
    R("Give the characteristic equation of a JK flip-flop and say what J = K = 1 does.",
      "Q⁺ = JQ' + K'Q. With J = K = 1 the flip-flop toggles on each active clock edge (Q⁺ = Q')."),
    R("State the setup-time and hold-time constraints for a path between two flip-flops on the same clock.",
      "Setup: T_clk ≥ t_clk-to-Q + t_comb,max + t_setup. Hold: t_clk-to-Q + t_comb,min ≥ t_hold. Setup violations can be fixed by slowing the clock; hold violations cannot."),
    E("(a) Design a 3-bit synchronous binary up-counter using T flip-flops. Give the T input equations. [4]\n"
      "(b) Each flip-flop has t_clk-to-Q = 0.8 ns and t_setup = 0.4 ns, and each 2-input AND gate has delay 0.6 ns. Find the maximum clock frequency. [3]\n"
      "(c) Compare this with a 3-bit ripple counter made of toggling flip-flops, explaining why decoded outputs of the ripple counter can glitch. [3]\n[10 marks]",
      ["A bit toggles when all lower bits are 1: T0 = 1, T1 = Q0, T2 = Q0Q1.",
       "Longest path: Q0/Q1 → AND gate → T2. T_min = 0.8 + 0.6 + 0.4 = 1.8 ns, so f_max ≈ 556 MHz.",
       "In a ripple counter each flip-flop is clocked by the previous output, so bit n changes about n × t_clk-to-Q after the clock edge.",
       "Going from 011 to 100 the counter passes briefly through 010 and 000. A decoder on these outputs sees false states: glitches.",
       "Synchronous counter: all bits change together after one t_clk-to-Q, so outputs are clean and timing does not grow with width (apart from the AND chain)."],
      ["Count sequence 000 → 001 → … → 111: Q0 toggles every clock, Q1 when Q0 = 1, Q2 when Q0 = Q1 = 1.",
       "So T0 = 1, T1 = Q0, T2 = Q0·Q1.",
       "Critical path: clock-to-Q (0.8) + AND (0.6) + setup (0.4) = 1.8 ns.",
       "f_max = 1/1.8 ns ≈ 556 MHz.",
       "Ripple counter: MSB settles after 3 × 0.8 = 2.4 ns and passes through intermediate codes, so decoded outputs glitch."],
      "Derives the T equations from the toggle pattern, identifies the critical path correctly, and explains ripple glitches with a concrete transition.",
      "Correct equations and frequency; ripple discussion correct but general.",
      "Uses D-flip-flop logic for T inputs, or adds every gate delay in the circuit to the critical path."),
]
T[3] = [  # Finite State Machines
    R("How many flip-flops does an FSM with 6 states need using binary encoding, and using one-hot encoding?",
      "Binary: ⌈log₂6⌉ = 3 flip-flops. One-hot: 6 flip-flops, one per state, which uses more flip-flops but usually simpler next-state and output logic."),
    R("When are two states of an FSM equivalent, and why does it matter?",
      "Two states are equivalent if, for every input sequence, they produce the same outputs, i.e. same outputs now and equivalent next states for every input. Equivalent states can be merged, reducing the state count and logic."),
    R("Why should an FSM have a reset input, and what is the risk with unused state codes?",
      "Reset puts the machine in a known start state at power-up, when flip-flops hold random values. Unused codes could otherwise be entered (power-up or noise) and may lock up the machine if they never lead back to a valid state."),
    E("A Moore FSM has one input X and output Z. Z = 1 when the number of 1s received so far is a multiple of 3 (including zero).\n"
      "(a) Draw the state diagram. [3]\n"
      "(b) Using the encoding S0 = 00, S1 = 01, S2 = 10 (state Q1Q0), derive next-state equations for D flip-flops and the output equation. [4]\n"
      "(c) Determine what happens if the machine powers up in the unused state 11, and suggest a fix. [3]\n[10 marks]",
      ["States S0, S1, S2 count 1s mod 3. X = 0: stay. X = 1: S0 → S1 → S2 → S0. Z = 1 only in S0.",
       "Q1⁺ = X'Q1 + XQ0. Q0⁺ = X'Q0 + XQ1'Q0'. Z = Q1'Q0'.",
       "Check X = 1: 00 → 01, 01 → 10, 10 → 00. X = 0 holds the state.",
       "From 11: X = 0 keeps it in 11 with Z = 0; X = 1 gives Q1⁺ = 1, Q0⁺ = 0, i.e. S2. It escapes only when a 1 arrives, and is wrong until then.",
       "Fix: add a synchronous reset to S0, or assign 11 next states explicitly (e.g. 11 → 00) instead of leaving them as don't-cares."],
      ["Diagram: S0 (Z=1) –1→ S1 (Z=0) –1→ S2 (Z=0) –1→ S0, with self-loops on 0.",
       "Next-state table: hold on X = 0; on X = 1, 00→01, 01→10, 10→00.",
       "Q1⁺ = X'Q1 + XQ0 (on X = 1, Q1 becomes 1 only from 01).",
       "Q0⁺ = X'Q0 + XQ1'Q0' (on X = 1, Q0 becomes 1 only from 00). Z = Q1'Q0'.",
       "Unused 11: X = 0 → 11; X = 1 → 10. So it stays stuck while X = 0 with a wrong count; add reset or define 11 → 00."],
      "Correct diagram and equations with verification, and a precise analysis of state 11 under both inputs with a sound fix.",
      "Correct equations but analysis of the unused state incomplete or only one input case considered.",
      "Mealy-style output used, or next-state equations that do not hold the state on X = 0."),
]
T[4] = [  # Memory and Programmable Logic
    R("How can a ROM be used to implement combinational logic, and what size ROM implements a function with 6 inputs and 4 outputs?",
      "The inputs drive the address lines and the stored word at each address is the truth-table row of outputs. 6 inputs and 4 outputs needs a 2⁶ × 4 = 64 × 4 ROM (256 bits)."),
    R("What is a lookup table (LUT) in an FPGA?",
      "A small memory (typically 4 to 6 inputs) whose contents are set at configuration so it can implement any Boolean function of its inputs. LUTs are paired with flip-flops in logic blocks and joined by programmable routing."),
    R("Why does DRAM need refreshing?",
      "Each bit is stored as charge on a tiny capacitor that leaks away. Every row must be read and rewritten periodically (typically every 64 ms) or the data is lost. SRAM uses cross-coupled inverters and needs no refresh."),
    E("A processor has a 16-bit address bus and an 8-bit data bus. An 8K × 8 ROM is placed at address 0x0000 and a 16K × 8 RAM at 0x8000.\n"
      "(a) Give the address range of each chip and the number of address lines each needs. [4]\n"
      "(b) Write full chip-select equations using the high address lines. [3]\n"
      "(c) If, to save logic, the RAM is selected by A15 alone, explain what happens to the memory map. [3]\n[10 marks]",
      ["ROM: 8K = 0x2000 bytes, so 0x0000 to 0x1FFF, 13 address lines (A12 to A0).",
       "RAM: 16K = 0x4000 bytes, so 0x8000 to 0xBFFF, 14 address lines (A13 to A0).",
       "CS_ROM = A15' A14' A13'. CS_RAM = A15 A14'. (Active-low chips use the complements.)",
       "With CS_RAM = A15, A14 is ignored, so the RAM also appears at 0xC000 to 0xFFFF: every RAM byte has two addresses (aliasing/mirroring).",
       "This is partial decoding: cheaper but wastes address space and blocks later use of 0xC000 to 0xFFFF."],
      ["8K = 8192 = 2¹³ → 13 lines; range 0x0000 to 0x1FFF.",
       "16K = 2¹⁴ → 14 lines; range 0x8000 to 0x8000 + 0x3FFF = 0xBFFF.",
       "ROM occupies addresses with A15 A14 A13 = 000; RAM occupies A15 A14 = 10.",
       "CS_ROM = A15'A14'A13'; CS_RAM = A15·A14'.",
       "Using A15 only: addresses 0xC000 to 0xFFFF (A14 = 1) also select the RAM with the same A13..A0, so RAM is mirrored there."],
      "Correct ranges, line counts and decoding equations, with a clear explanation of aliasing and its cost.",
      "Ranges and lines right but decode equations incomplete, or aliasing named without giving the mirrored range.",
      "Confuses bits with bytes in sizing, or gives overlapping ranges."),
]
T[5] = [  # Instruction Set Architecture and Assembly
    R("What is a load/store architecture?",
      "Only load and store instructions access memory; arithmetic and logic instructions operate on registers only. This is typical of RISC ISAs (e.g. ARM, RISC-V, MIPS) and simplifies pipelining."),
    R("What does the program counter hold, and how does a branch change it?",
      "The PC holds the address of the next instruction to fetch and normally advances by the instruction size. A taken branch loads the PC with the target address, usually computed as PC plus a signed offset from the instruction."),
    R("How are subroutine call and return implemented, and why must nested calls use the stack?",
      "A branch-and-link instruction jumps to the subroutine and saves the return address in a link register; return jumps to that address. A nested call would overwrite the link register, so the caller pushes it (and other saved registers) on the stack first and pops it before returning."),
    E("Consider this generic RISC code (R0, R1 are registers; BNE branches if the last comparison was not equal):\n"
      "      MOV R0, #0\n      MOV R1, #5\nloop: ADD R0, R0, R1\n      SUB R1, R1, #1\n      CMP R1, #0\n      BNE loop\n"
      "(a) Give the final values of R0 and R1. [2]\n"
      "(b) How many instructions are executed? [2]\n"
      "(c) Every instruction takes 1 cycle except a taken branch, which takes 3. How many cycles does the code take? [3]\n"
      "(d) Rewrite the loop using a flag-setting subtract (SUBS) to remove CMP, and give the new instruction count. [3]\n[10 marks]",
      ["The loop adds 5, 4, 3, 2, 1: R0 = 15, R1 = 0.",
       "Instructions: 2 setup + 5 iterations × 4 = 22.",
       "BNE is taken 4 times and not taken once: cycles = 22 + 4 × 2 = 30.",
       "loop: ADD R0, R0, R1; SUBS R1, R1, #1; BNE loop. SUBS sets the Z flag when R1 reaches 0.",
       "New count: 2 + 5 × 3 = 17 instructions (and 17 + 8 = 25 cycles)."],
      ["Trace: R1 = 5, 4, 3, 2, 1 added into R0; after the fifth pass R1 = 0 and BNE falls through.",
       "R0 = 5 + 4 + 3 + 2 + 1 = 15; R1 = 0.",
       "Count: 2 + 5 × 4 = 22 instructions.",
       "Branch taken on iterations 1 to 4 (extra 2 cycles each): 22 + 8 = 30 cycles.",
       "Use SUBS so the subtract sets flags: 3 instructions per iteration, 2 + 15 = 17 instructions."],
      "Accurate trace and counts, distinguishes taken and not-taken branches, and gives a correct optimised loop with the flag-setting reasoning.",
      "Correct trace and counts but counts all five branches as taken, or the rewrite is correct without the new count.",
      "Off-by-one in loop iterations, or treats CMP as changing R1."),
]
T[6] = [  # Datapath and Control Unit Design
    R("What does the control unit of a simple processor do?",
      "It decodes the opcode (and function fields) of the current instruction and generates control signals such as RegWrite, ALUSrc, ALU operation, MemRead, MemWrite, MemtoReg and Branch that steer the datapath."),
    R("Why does a datapath include a sign-extension unit?",
      "Immediate fields are shorter than the word size. Sign-extending copies the sign bit into the upper bits so that negative offsets and constants keep their two's complement value when used by the ALU or for address calculation."),
    R("How does a multi-cycle processor differ from a single-cycle one?",
      "A single-cycle CPU does every instruction in one long clock cycle set by the slowest instruction. A multi-cycle CPU splits instructions into steps (fetch, decode, execute, memory, write-back), each one shorter cycle, so instructions take different numbers of cycles and hardware like the ALU and memory can be reused."),
    E("(a) For a load-word instruction lw rt, offset(rs) in a single-cycle datapath, describe the path the data takes and give the values of RegWrite, ALUSrc, MemRead, MemWrite and MemtoReg. [4]\n"
      "(b) A single-cycle version runs with an 800 ps clock. A multi-cycle version has a 250 ps clock and takes 5 cycles for loads, 4 for stores, 4 for R-type and 3 for branches. For a mix of 25% loads, 10% stores, 45% R-type and 20% branches, find the average CPI and time per instruction of the multi-cycle design. [4]\n"
      "(c) Which design is faster for this mix, and why might the multi-cycle design still be preferred? [2]\n[10 marks]",
      ["lw: PC → instruction memory; rs read from the register file; offset sign-extended; ALU adds rs + offset; data memory read at that address; result written to rt.",
       "Signals: RegWrite = 1, ALUSrc = 1 (immediate), MemRead = 1, MemWrite = 0, MemtoReg = 1.",
       "CPI = 0.25 × 5 + 0.10 × 4 + 0.45 × 4 + 0.20 × 3 = 1.25 + 0.40 + 1.80 + 0.60 = 4.05.",
       "Time per instruction = 4.05 × 250 ps = 1012.5 ps, versus 800 ps single-cycle.",
       "The single-cycle design is faster here: the 250 ps step is well above a fifth of 800 ps (160 ps), so 3 to 5 steps cost more than one long cycle.",
       "Multi-cycle still saves hardware (one memory, one ALU) and allows variable-length instructions."],
      ["Trace lw through fetch, register read, sign-extend, ALU address add, memory read, write-back.",
       "Control: RegWrite 1, ALUSrc 1, MemRead 1, MemWrite 0, MemtoReg 1.",
       "Weighted CPI: 1.25 + 0.40 + 1.80 + 0.60 = 4.05.",
       "Average time = 4.05 × 250 = 1012.5 ps.",
       "Compare with 800 ps: single-cycle is about 1.27× faster; multi-cycle wins on hardware cost and flexibility."],
      "Traces the datapath in order with correct control values, computes CPI and time accurately, and gives a balanced judgement.",
      "Correct numbers with one control signal wrong or a thin comparison.",
      "Uses an unweighted average of cycle counts, or sets MemtoReg = 0 for a load."),
]
T[7] = [  # Pipelining and Hazards
    R("How long does an ideal k-stage pipeline take to execute n instructions, and what does the speedup tend to?",
      "(k + n − 1) cycles: k cycles to fill, then one instruction completes per cycle. Compared with an unpipelined design the speedup tends to k for large n (ignoring register overhead and hazards)."),
    R("What is a structural hazard? Give an example and a fix.",
      "Two instructions need the same hardware resource in the same cycle. Example: one memory shared by instruction fetch and a load's data access. Fix: separate instruction and data memories (caches), or duplicate the resource."),
    R("Why does a load-use hazard still need a stall when the pipeline has forwarding?",
      "A load's data is only available at the end of the MEM stage, but the next instruction needs it at the start of EX in the same cycle. Forwarding cannot send data back in time, so one bubble is inserted."),
    E("An unpipelined processor takes 1000 ps per instruction. It is split into 5 equal stages, and each pipeline register adds 20 ps.\n"
      "(a) Find the pipelined clock period and the time to run 1000 instructions with no hazards. Hence give the speedup. [4]\n"
      "(b) 20% of instructions are loads, and half of these are followed immediately by a dependent instruction (1-cycle stall each). 15% are branches; 60% of branches are taken, costing 2 stall cycles each. Find the CPI. [4]\n"
      "(c) Find the effective speedup over the unpipelined processor and name one way to reduce the branch penalty. [2]\n[10 marks]",
      ["Clock period = 1000/5 + 20 = 220 ps.",
       "1000 instructions: (5 + 999) × 220 = 220,880 ps versus 1,000,000 ps, so speedup ≈ 4.53.",
       "CPI = 1 + 0.20 × 0.5 × 1 + 0.15 × 0.6 × 2 = 1 + 0.10 + 0.18 = 1.28.",
       "Time per instruction = 1.28 × 220 = 281.6 ps; speedup = 1000/281.6 ≈ 3.55.",
       "Reduce the branch penalty with branch prediction, resolving branches earlier (in ID), or delay slots."],
      ["Stage time 1000/5 = 200 ps, plus 20 ps register overhead = 220 ps.",
       "Cycles = k + n − 1 = 1004; time = 1004 × 220 = 220,880 ps; speedup = 1,000,000/220,880 ≈ 4.53.",
       "Load-use stalls per instruction: 0.20 × 0.5 = 0.10. Branch stalls: 0.15 × 0.6 × 2 = 0.18.",
       "CPI = 1.28; time per instruction = 281.6 ps.",
       "Effective speedup ≈ 3.55; add branch prediction or earlier resolution to cut it."],
      "Includes register overhead and fill time, weights both hazard types correctly, and links the result to a concrete mitigation.",
      "Correct CPI but ignores fill time or register overhead in part (a).",
      "Counts every branch as stalling, or claims an ideal speedup of exactly 5."),
]

emit("ELEC40003", T, 64)
