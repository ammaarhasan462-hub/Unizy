"""Top-up for Imperial ELEC40004 Programming for Engineers: 3 recall + 1 exam per topic.
Run: python3 tools/packs/elec40004.py > /tmp/elec40004.sql"""
from common import R, E, emit

T = {}
T[0] = [  # C Fundamentals: Types, Operators, Control Flow
    R("What does sizeof return, and what are the usual sizes of char, int and double on a 64-bit Linux system?",
      "sizeof gives the size of a type or object in bytes, as a size_t. char is always 1; int is usually 4; double is usually 8. Only char is fixed by the standard, so portable code uses sizeof or <stdint.h> types."),
    R("What is the difference between i++ and ++i in C?",
      "Both add 1 to i. i++ (post-increment) evaluates to the old value; ++i (pre-increment) evaluates to the new value. So with i = 3, a = i++ gives a = 3, while a = ++i gives a = 4."),
    R("What is short-circuit evaluation, and why does it make p != NULL && *p > 0 safe?",
      "&& stops as soon as the left side is false, and || stops as soon as the left side is true. If p is NULL the left side is false, so *p is never evaluated and no null dereference happens."),
    E("(a) State exactly what this prints, explaining each step. [5]\n"
      "  int i, s = 0;\n  for (i = 1; i <= 10; i++) {\n    if (i % 3 == 0) continue;\n    if (i > 8) break;\n    s += i;\n  }\n  printf(\"%d %d\\n\", s, i);\n"
      "(b) What would it print if the two if statements were swapped? [2]\n"
      "(c) double x = 5 / 2; gives x = 2.0. Explain why and give a fix. [3]\n[10 marks]",
      ["Multiples of 3 are skipped by continue; i = 10 hits break.",
       "s = 1 + 2 + 4 + 5 + 7 + 8 = 27; the loop breaks with i = 10. Output: 27 10.",
       "Swapped: at i = 9 the break test runs first (9 > 8), so the loop stops with i = 9. s is still 27. Output: 27 9.",
       "5 / 2 is integer division of two ints, giving 2; only then is it converted to double.",
       "Fix: make one operand floating point, e.g. 5.0 / 2 or (double)5 / 2, giving 2.5."],
      ["i = 1, 2 added (s = 3); i = 3 skipped; i = 4, 5 added (s = 12); i = 6 skipped.",
       "i = 7, 8 added (s = 27); i = 9 skipped by continue; i = 10: not a multiple of 3, 10 > 8 so break.",
       "Prints 27 10.",
       "Swapped order: i = 9 now breaks before the continue test, so it prints 27 9.",
       "5/2 is int/int = 2, then converted to 2.0. Use 5.0/2 for 2.5."],
      "Traces every iteration, correctly gives i's final value in both versions, and explains integer division as a type rule.",
      "Correct sum but wrong final i, or a fix without explanation.",
      "Assumes continue ends the loop, or that s includes multiples of 3."),
]
T[1] = [  # Functions, Scope and Program Structure
    R("What is a function prototype in C and why is it needed?",
      "A declaration of a function's return type and parameter types, e.g. int max(int a, int b);, placed before the function is used (often in a header). It lets the compiler check calls and convert arguments when the definition is later or in another file."),
    R("What does the keyword static mean when applied to a function or global variable at file scope?",
      "It gives internal linkage: the name is visible only inside that source file (translation unit). This hides helper functions and avoids name clashes when linking several files."),
    R("What is extern used for in C?",
      "To declare a global variable (or function) that is defined in another file, e.g. extern int count; in a header, with int count = 0; in exactly one .c file. It declares without allocating storage."),
    E("(a) Explain why void swap(int a, int b) { int t = a; a = b; b = t; } does not swap the caller's variables, and write a correct version with an example call. [4]\n"
      "(b) What does this print? int next(void) { static int n = 0; return ++n; } … int a = next(); int b = next(); printf(\"%d %d %d\\n\", a, b, next()); [2]\n"
      "(c) For int f(int n) { return n <= 1 ? 1 : f(n - 1) + f(n - 2); } find f(5) and the total number of calls made to f when evaluating f(5). Comment on efficiency. [4]\n[10 marks]",
      ["C passes arguments by value: swap receives copies, so changing a and b inside does not affect the caller.",
       "Correct: void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; } called as swap(&x, &y).",
       "n is static, so it keeps its value between calls: a = 1, b = 2 and the third call gives 3. Prints 1 2 3.",
       "f(0) = f(1) = 1, f(2) = 2, f(3) = 3, f(4) = 5, f(5) = 8.",
       "Calls: C(n) = 1 + C(n - 1) + C(n - 2) with C(0) = C(1) = 1, so C(2) = 3, C(3) = 5, C(4) = 9, C(5) = 15.",
       "The call count grows exponentially because subproblems are recomputed; a loop or memoisation makes it O(n)."],
      ["Pass-by-value means the function works on copies of x and y.",
       "Pass addresses instead: swap(int *a, int *b) and dereference to exchange; call swap(&x, &y).",
       "static int n persists: next() returns 1, then 2, then 3. Output 1 2 3.",
       "Build up f: 1, 1, 2, 3, 5, 8, so f(5) = 8.",
       "Count calls with C(n) = 1 + C(n-1) + C(n-2): 1, 1, 3, 5, 9, 15. Exponential growth; iterate instead."],
      "Explains pass-by-value precisely, gives working pointer code and call, gets 1 2 3 with the static reason, and derives the call count with a recurrence.",
      "Correct swap and output; call count estimated or f(5) slightly off.",
      "Claims a static local is reset each call, or writes swap with pointers but forgets to dereference."),
]
T[2] = [  # Pointers and Memory Management
    R("What are a null pointer and a dangling pointer?",
      "A null pointer (NULL) deliberately points to nothing and can be tested before use. A dangling pointer still holds an address whose object no longer exists, e.g. after free() or after a function returns the address of a local; using it is undefined behaviour."),
    R("If int *p points to an array element, what does p + 1 point to?",
      "The next int element. Pointer arithmetic moves in units of the pointed-to type, so the address increases by sizeof(int) bytes (usually 4), not by 1 byte."),
    R("What is the difference between stack and heap memory in C?",
      "Local (automatic) variables live on the stack and vanish when their function returns; allocation is automatic and fast. Heap memory comes from malloc/calloc/realloc, lasts until free() is called, and its size can be chosen at run time."),
    E("(a) Write a function int *make_array(int n) that allocates an array of n ints holding 0, 1, …, n - 1, returning NULL if allocation fails. Show how the caller uses and releases it. [4]\n"
      "(b) Identify and fix the bug: char *s = malloc(strlen(t)); strcpy(s, t); [3]\n"
      "(c) Explain the problem with p = realloc(p, new_size); and give a safe pattern. [3]\n[10 marks]",
      ["int *make_array(int n) { int *a = malloc(n * sizeof *a); if (a == NULL) return NULL; for (int i = 0; i < n; i++) a[i] = i; return a; }",
       "Caller: int *a = make_array(10); if (!a) { handle error } … use a … free(a); a = NULL;",
       "Bug: strlen does not count the terminating '\\0', so strcpy writes one byte past the block (heap overflow).",
       "Fix: char *s = malloc(strlen(t) + 1); check for NULL before strcpy(s, t).",
       "If realloc fails it returns NULL but the old block is still allocated; assigning to p loses the only pointer, causing a leak.",
       "Safe: int *tmp = realloc(p, new_size); if (tmp == NULL) { handle error, p still valid } else p = tmp;"],
      ["Allocate with malloc(n * sizeof *a) and check for NULL.",
       "Fill a[i] = i in a loop and return a; the caller must free it once done.",
       "strlen(t) excludes the '\\0' terminator, so the buffer is one byte short: allocate strlen(t) + 1.",
       "realloc can fail and return NULL while leaving the old block allocated.",
       "Assign the result to a temporary and only overwrite p on success."],
      "Correct, checked allocation with clear ownership and free, spots the off-by-one terminator, and gives the temporary-pointer realloc pattern with the leak explained.",
      "Working code but missing a NULL check, or the realloc problem described vaguely.",
      "Uses sizeof(a) on a pointer to size the array, or frees memory before returning it."),
]
T[3] = [  # Arrays, Strings and Structured Data
    R("Why can't you compare two C strings with ==, and what should you use?",
      "== compares the pointers (addresses), not the characters. Use strcmp(a, b) from <string.h>, which returns 0 if the strings are equal, negative if a sorts before b, positive otherwise."),
    R("How is a 2D array int a[3][4] stored in memory?",
      "In row-major order: the 4 elements of row 0, then row 1, then row 2, contiguously. a[i][j] is at offset i × 4 + j ints from the start."),
    R("What is the difference between char s[] = \"hi\"; and char *s = \"hi\";?",
      "The first creates a modifiable 3-byte array (h, i, '\\0') initialised from the literal. The second makes a pointer to a string literal, which is read-only; writing through it is undefined behaviour."),
    E("(a) Write int my_strlen(const char *s) without using library functions. [2]\n"
      "(b) Write void reverse(char *s) that reverses a string in place. [4]\n"
      "(c) Given char s[] = \"hello\"; char *p = s; on a 64-bit system, state sizeof s, sizeof p and strlen(s). [2]\n"
      "(d) Typically sizeof(struct { char c; int i; char d; }) is 12. Explain why and show a member order that reduces it. [2]\n[10 marks]",
      ["int my_strlen(const char *s) { int n = 0; while (s[n] != '\\0') n++; return n; }",
       "void reverse(char *s) { int i = 0, j = my_strlen(s) - 1; while (i < j) { char t = s[i]; s[i] = s[j]; s[j] = t; i++; j--; } }",
       "sizeof s = 6 (five letters plus '\\0'); sizeof p = 8 (a pointer); strlen(s) = 5.",
       "int needs 4-byte alignment: c at 0, 3 padding bytes, i at 4–7, d at 8, then 3 bytes of tail padding so arrays stay aligned: 12.",
       "Reorder as { int i; char c; char d; }: 4 + 1 + 1 + 2 padding = 8 bytes."],
      ["Count characters until the '\\0' terminator.",
       "Reverse with two indices from each end, swapping until they meet; the '\\0' stays in place.",
       "sizeof on the array counts the whole array including '\\0' (6); on the pointer gives pointer size (8); strlen excludes '\\0' (5).",
       "Padding aligns i to a multiple of 4 and pads the struct end to a multiple of 4: 1 + 3 + 4 + 1 + 3 = 12.",
       "Put the int first and group the chars: 8 bytes."],
      "Correct code that handles empty strings and keeps the terminator, distinguishes array and pointer sizeof, and explains both inner and tail padding.",
      "Working functions with minor edge-case gaps; padding explained without tail padding.",
      "Reverses including the '\\0' (giving an empty string), or says sizeof p is 6."),
]
T[4] = [  # Algorithms and Data Structures
    R("Give the best-case and worst-case time complexity of insertion sort.",
      "Worst (and average) case O(n²), e.g. reverse-sorted input. Best case O(n) on already-sorted input, because each element needs only one comparison. It sorts in place and is stable."),
    R("What is the difference between a stack and a queue?",
      "A stack is last-in, first-out (push and pop at the same end), used for function calls and undo. A queue is first-in, first-out (enqueue at the back, dequeue at the front), used for buffers and scheduling."),
    R("State the time and space complexity of merge sort.",
      "O(n log n) time in best, average and worst cases. It needs O(n) extra memory for merging (for arrays). It is stable."),
    E("(a) Write an iterative C function int bsearch_int(const int *a, int n, int key) that returns the index of key in sorted array a, or -1. [4]\n"
      "(b) Trace it on {2, 5, 8, 12, 16, 23, 38, 56, 72, 91} searching for 23, listing lo, hi and mid at each step. [3]\n"
      "(c) What is the maximum number of loop iterations for n = 1,000,000? Explain why mid = lo + (hi - lo) / 2 is preferred to (lo + hi) / 2. [3]\n[10 marks]",
      ["int lo = 0, hi = n - 1; while (lo <= hi) { int mid = lo + (hi - lo) / 2; if (a[mid] == key) return mid; if (a[mid] < key) lo = mid + 1; else hi = mid - 1; } return -1;",
       "lo = 0, hi = 9, mid = 4 (16 < 23) → lo = 5.",
       "lo = 5, hi = 9, mid = 7 (56 > 23) → hi = 6.",
       "lo = 5, hi = 6, mid = 5 (23) → found, return 5. Three iterations.",
       "Each iteration halves the range: at most ⌈log₂(1,000,001)⌉ = 20 iterations.",
       "lo + hi can overflow int for large arrays; lo + (hi - lo)/2 gives the same value without overflow."],
      ["Keep lo and hi as the inclusive search range; loop while lo <= hi.",
       "Compare a[mid] with key and discard the half that cannot contain it.",
       "Trace: (0, 9, 4) → (5, 9, 7) → (5, 6, 5) found at index 5.",
       "Range halves each time: 2²⁰ ≈ 1.05 million, so 20 iterations at most.",
       "Use lo + (hi - lo)/2 to avoid integer overflow of lo + hi."],
      "Correct loop bounds and updates, a precise trace, the log₂ bound with a number, and the overflow reason.",
      "Correct function with a slip in the trace, or the bound given without justification.",
      "Infinite loop from lo = mid or hi = mid updates, or a linear-time scan."),
]
T[5] = [  # File I/O, Libraries and the Build Process
    R("What does the C preprocessor do?",
      "Before compilation it handles directives: #include pastes in header text, #define creates macros by text substitution, and #if/#ifdef select code for conditional compilation. It works on text and knows nothing about C types."),
    R("What is the difference between static and dynamic linking?",
      "Static linking copies the needed library code into the executable, which is larger but self-contained. Dynamic linking records a dependency on a shared library (.so/.dll) that is loaded at run time, so it is smaller and libraries can be updated, but the library must be present."),
    R("What are include guards and why are they needed?",
      "#ifndef UTIL_H / #define UTIL_H / … / #endif around a header's contents. If the header is included twice in one file (often indirectly), the second copy is skipped, avoiding redefinition errors for types and macros."),
    E("(a) Given #define SQ(x) x * x, evaluate SQ(2 + 3) and explain the result. Give a corrected macro and one problem it still has with SQ(i++). [4]\n"
      "(b) Write a C program that copies the text file named in argv[1] to the file named in argv[2] line by line, with error checking. [4]\n"
      "(c) Explain what gcc -c main.c and gcc main.o util.o -o prog each do. [2]\n[10 marks]",
      ["SQ(2 + 3) expands to 2 + 3 * 2 + 3 = 11, not 25, because macros substitute text and * binds tighter than +.",
       "Fix: #define SQ(x) ((x) * (x)). SQ(i++) still evaluates i++ twice (undefined behaviour); use an inline function instead.",
       "Check argc == 3; FILE *in = fopen(argv[1], \"r\"), *out = fopen(argv[2], \"w\"); if either is NULL, perror and exit(1).",
       "char buf[256]; while (fgets(buf, sizeof buf, in)) fputs(buf, out); then fclose both and return 0.",
       "gcc -c main.c compiles to the object file main.o without linking.",
       "gcc main.o util.o -o prog links the objects (and the C library) into the executable prog, resolving references between them."],
      ["Expand the macro literally: 2 + 3 * 2 + 3 = 2 + 6 + 3 = 11.",
       "Parenthesise the parameter and the whole body: ((x) * (x)).",
       "Side effects in arguments are repeated by the macro: SQ(i++) increments twice.",
       "Program: check argc, open both files, check for NULL, loop fgets/fputs, close files.",
       "-c stops after compiling to an object file; the second command links objects into an executable."],
      "Expands the macro correctly, fixes it and names the double-evaluation problem, and writes a robust copy program with all checks.",
      "Correct macro analysis; copy program works but misses one error check.",
      "Gets 25 for SQ(2 + 3), or omits checking fopen's return value."),
]
T[6] = [  # Python for Engineering Computation
    R("What is vectorisation in NumPy and why is it faster than a Python loop?",
      "Writing an operation on whole arrays (e.g. y = 3 * x**2 + 1) instead of looping over elements. NumPy runs the loop in compiled C over contiguous typed data, avoiding the interpreter's per-element overhead, often 10 to 100 times faster."),
    R("Which common Python types are mutable and which are immutable?",
      "Mutable: list, dict, set, NumPy arrays. Immutable: int, float, str, tuple, frozenset. Assigning a mutable object to a second name shares the same object rather than copying it."),
    R("What does [x**2 for x in range(10) if x % 2 == 0] evaluate to?",
      "[0, 4, 16, 36, 64]: the squares of the even numbers 0, 2, 4, 6, 8."),
    E("(a) State what this prints and explain why. [3]\n  a = [1, 2, 3]\n  b = a\n  b.append(4)\n  c = a[:]\n  c.append(5)\n  print(a, b, c)\n"
      "(b) def add(x, lst=[]): lst.append(x); return lst. Calling add(1) then add(2) returns [1, 2] the second time. Explain and fix. [3]\n"
      "(c) Using NumPy, write code to sample v(t) = 5 sin(2π · 50t) at 10 kHz for 0 ≤ t < 0.1 s and compute its RMS value. State the expected result. [4]\n[10 marks]",
      ["b = a makes b another name for the same list; a[:] makes a new copy.",
       "Prints [1, 2, 3, 4] [1, 2, 3, 4] [1, 2, 3, 4, 5].",
       "The default list is created once, when the function is defined, so every call without lst shares it.",
       "Fix: def add(x, lst=None): if lst is None: lst = []; lst.append(x); return lst.",
       "t = np.arange(0, 0.1, 1e-4); v = 5 * np.sin(2 * np.pi * 50 * t); rms = np.sqrt(np.mean(v**2)).",
       "1000 samples cover exactly 5 periods, so rms = 5/√2 ≈ 3.536."],
      ["Aliasing: b and a are the same object, so appending 4 changes both.",
       "Slicing a[:] creates a shallow copy, so appending 5 changes only c.",
       "Default arguments are evaluated once at definition time; use None as the default and create the list inside.",
       "Build t with np.arange at step 1e-4, compute v, then sqrt(mean(v²)).",
       "For a whole number of periods the RMS of a sine is peak/√2 = 3.536."],
      "Explains aliasing versus copying, the definition-time default, and writes correct vectorised NumPy code with the 5/√2 check and the whole-periods point.",
      "Correct outputs and fix; NumPy code works but the expected value is not justified.",
      "Thinks b = a copies the list, or computes RMS as the mean of |v|."),
]
T[7] = [  # Software Engineering Practice: Testing, Debugging and Version Control
    R("In Git, what do commit, branch and merge mean?",
      "A commit is a saved snapshot of the tracked files with a message and parent. A branch is a movable pointer to a line of commits, used to develop features separately. A merge combines the history of one branch into another, creating a merge commit if both changed."),
    R("Name four gdb commands and what they do.",
      "break (set a breakpoint at a line or function), run (start the program), next (execute the next line, stepping over calls), step (step into calls), print (show a variable), backtrace (show the call stack after a crash)."),
    R("What is boundary-value testing?",
      "Choosing test inputs at and just around the edges of valid ranges (minimum, maximum, just outside, empty input), because off-by-one and limit errors cluster there."),
    E("int sum_to(int *a, int n) { int s; for (int i = 0; i <= n; i++) s += a[i]; return s; }\n"
      "(a) Identify two bugs and fix them. [3]\n"
      "(b) Explain which tools would reveal each bug. [3]\n"
      "(c) Write three unit tests (as assert statements) for the fixed function, including a boundary case. [2]\n"
      "(d) Outline a Git workflow for making and sharing this fix. [2]\n[10 marks]",
      ["Bug 1: s is never initialised, so the sum starts from garbage. Fix: int s = 0;",
       "Bug 2: i <= n reads a[n], one past the end. Fix: i < n.",
       "gcc -Wall -Wextra (with optimisation) warns that s may be used uninitialised; Valgrind memcheck also reports it.",
       "AddressSanitizer (-fsanitize=address) or Valgrind reports the out-of-bounds read of a[n].",
       "Tests: int e[1]; assert(sum_to(e, 0) == 0); int one[] = {5}; assert(sum_to(one, 1) == 5); int m[] = {1, -2, 3}; assert(sum_to(m, 3) == 2);",
       "Git: create a branch, fix and add tests, commit with a clear message, push and open a pull request for review, then merge."],
      ["Read the loop: s has no starting value and the bound i <= n runs n + 1 times.",
       "Fix: int s = 0; and for (i = 0; i < n; i++).",
       "Compiler warnings catch the uninitialised variable; sanitizers or Valgrind catch the out-of-bounds read.",
       "Test empty (n = 0), single element, and mixed signs.",
       "Branch, commit, push, review, merge."],
      "Finds both bugs with correct fixes, matches each bug to a suitable tool, writes meaningful tests including n = 0, and gives a reviewed-branch workflow.",
      "Both bugs fixed but tool choice vague, or tests miss the boundary case.",
      "Finds only one bug, or changes the loop to start at i = 1 instead of fixing the bound."),
]

emit("ELEC40004", T, 64)
