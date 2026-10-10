# Flux84 vs. TI-84 Plus CE and TI-84 Evo

**Checked:** 9 October 2026  
**Result:** Flux84 has broad TI-84-style calculator support, plus an Evo-style mode. It is not a complete TI-84 emulator. Do not describe it as supporting every CE/Evo capability or as an exam-approved replacement.

This audit compares the shipped Flux84 code with TI's published Plus CE and Evo feature lists and Evo key changes. “Present” means the capability has an implementation in Flux84; it does not mean every command, edge case, answer format, or key sequence has been proven bit-for-bit identical to TI firmware.

## Present in Flux84

- Selectable Plus CE and Evo-style layouts; selection persists in calculator state.
- MathPrint-style entry, common arithmetic and scientific functions, fractions, complex numbers, lists, matrices, variables, tables, and graph windows.
- Function, parametric, polar, and recursive sequence entry; sequence calculations and time-series plotting are implemented.
- Statistics, distribution functions, hypothesis tests, confidence intervals, one-way ANOVA, TVM, numeric solving, polynomial/system solving, and a TI-BASIC-like program editor/runtime. These are Flux implementations, not TI firmware.
- Evo display-area coordinate scaling, icon-style Apps launcher, several changed key shortcuts, separate STAT intervals, grouped distribution menus, always-on wizard setting, and a clear/undo action.
- Evo-style trace point-of-interest markers (computed numerically), normal probability plot, and eight style choices in the function editor.

## Partial or approximate

- **Keypad and menus:** the revised Evo layout/shortcuts cover the documented changes, but the entire Evo interaction model, soft keys, syntax help, key hints, editing cursor behavior, and menu actions have not been matched or exhaustively checked. The Apps screen is a small Flux launcher, not TI's full app library.
- **Sequences:** recursive values, tables, and time-series plots are present. TI's cobweb/stair-step and phase plot modes are not.
- **Trace points of interest:** Flux scans sampled points and refines candidates. It can miss narrow or repeated features and is not TI's implementation.
- **Graph styles:** all eight style labels are offered, but `animate` is currently a static endpoint marker and several graph-style details are approximate.
- **Zoom:** common zooms, previous/store/recall are present, but not all 17 Evo zoom tools or Evo's `+`/`−` quick zoom and fractional zoom choices.
- **TI-BASIC:** Flux runs a useful subset; it is not a complete TI-BASIC implementation and cannot run arbitrary downloaded TI programs.
- **Statistics and numeric behavior:** the principal calculations are implemented and tested selectively. This has not been compared against TI for every input domain, rounding case, error, or displayed answer.

## Missing from Flux84

- TI's **Lines & Conics** app: implicit line/conic templates, multiple conic graphs, conic analysis, and their trace behavior.
- **Inequality Graphing** (the published Evo specification lists 16 inequality graphs) and **Transformation Graphing**.
- The full set of 17 interactive zoom tools, including fractional zooms and quick zoom.
- Cobweb and phase sequence plots; graph/table horizontal and vertical split-screen modes.
- Graph background images.
- A Python interpreter and the TI app/runtime ecosystem, including Help, EasyData, SmartPad, and compatible TI apps. Flux labels Python and Lines & Conics unavailable in the Evo Apps screen.
- Physical TI properties and integrations: TI OS/ROM behavior and updates, CPU/memory/battery, USB-C data transfer, TI-Innovator/Rover, and Vernier sensor connections.
- TI's exam approvals and guarantees about permitted calculator use.

## Verification performed

- `npm run test:unit`: 270 passing tests on the current working tree.
- `npm run test:e2e -- e2e/calculator.spec.ts`: 10 passing browser checks, including the Evo mode, calculator graph, app integration, phone sizing, landscape tablet sizing, and clear/undo refinement.
- New focused tests cover scientific notation display, recursive sequences, selected Evo menus, launcher availability labels, and the one-clear undo interaction. This is meaningful regression coverage, not a test of every calculator command.

## TI references

- [TI's Plus CE vs. Evo change list and keypad differences](https://education.ti.com/en/customer-support/knowledge-base/ti-83-84-plus-family/general-information/40502)
- [TI-84 Evo specifications and built-in feature list](https://education.ti.com/en-au/products/calculators/graphing-calculators/ti-84-evo)
- [TI-84 Evo OS 7.1 updates](https://education.ti.com/en/products/calculators/graphing-calculators/ti-84-evo/update)

The missing and approximate capabilities above are why Flux84 cannot currently be called “exactly like” either TI calculator. This list is a practical gap register for future parity work.
