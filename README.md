Kingshot Bear Optimizer (#1079 LoL App)
A powerful browser‑based optimizer for Bear troop compositions, rally calls, and multi‑formation troop distribution — featuring closed‑form optimal composition math, heat‑map ternary diagrams, editable compositions with auto‑clamping, and a full multi‑march “Option‑A” formation builder.

✨ Features
1. Exact closed‑form optimal troop composition
The app computes mathematically accurate optimal Infantry / Cavalry / Archery fractions using:

Lagrange multiplier–derived optimum
Tier‑dependent archer coefficient
Attack × Lethality multipliers
Fractional normalization + bounds
Infantry constraint: 7.5% – 10%
Cavalry constraint: ≥ 10%
Archers get the remaining percentage

2. Interactive Ternary Plot (Plotly)
Visualizes damage output of every possible Inf/Cav/Arc combination:

Color‑coded Plasma heatmap
Normalized damage scale
Auto‑highlighted Best (bounded) point
Real‑time updates from stat inputs

3. Editable Rally Composition
The rally composition input supports:

Free‑form inputs like 4/10/86, 4 10 86, 4,10,86, 4/10
Automatic normalization to 100%
Automatic enforcement of constraints
Optional “Use Best” button to apply optimal bounded fractions

4. Rally Builder
Given:
Troop inventory
Rally size
User‑selected (or Best) troop fractions

Produces:
Integer‑bounded rally troop assignment
Min‑Inf, Max‑Inf, Min‑Cav respected
Stock‑aware filling with fallback priority (ARC → CAV → INF)

5. Multi‑Formation Optimizer (Option‑A)
Automatically builds multiple marches with per‑march cap:

Ensures every march obeys Inf/Cav/Arc constraints
Reserves minimum troops per march
Even round‑robin filling of Archers → Cavalry → Infantry
Shows leftover troops
Produces full formation table


📐 Mathematical Model
Attack–Lethality factor
A = (1 + atk/100) * (1 + leth/100)


Closed‑form optimal composition
The unconstrained optimal fractions are:
fin  = α² / (α² + β² + γ²)
fcav = β² / (α² + β² + γ²)
farc = γ² / (α² + β² + γ²)

Where:

α = Ainf / 1.12
β = Acav
γ = K_arc * Aarc

These are later clamped to constraints.
Composition Constraint Rules
INF ∈ [7.5%, 10%]
CAV ≥ 10%
ARC = remainder (must be ≥ 0)


🖥 User Interface Overview

Inputs:
Infantry / Cavalry / Archery ATK% and LET%
Troop Tier selection
Editable composition field
Troop inventory
Rally size
#of formations
March cap

Outputs:
Ternary heatmap plot
Best bounded composition
Rally troop assignment
Multi‑march formation list
Inventory usage breakdown


▶️ How to Use
1. Set troop stats
Input Infantry / Cavalry / Archery ATK & LET.
2. Choose troop tier
Tiers adjust archer effectiveness constants.
3. Click “Create plot chart!”
Generates:

Full ternary heatmap
Auto‑selected best composition point

4. Edit rally composition (optional)
Enter ratios like:
6/14/80
4 10 86
4,10,86

Or click Use Best.
Automatically normalized & constrained.

5. Enter troop inventory & formation settings
Input:

Total troops
Rally size
March size limit
Number of marches

6. Click “Optimize split”
Produces:

Rally troop split
Formation splits
Leftover inventory
Full troop usage report


🧠 Notable Logic Components
enforceCompositionBounds()
Clamps fractions to meet:

Infantry [7.5%, 10%]
Cavalry ≥ 10%
Archery ≥ 0

computeExactOptimalFractions()
Closed‑form optimal fractions using squared‑weight model.
evaluateForPlot()
Relative damage evaluation for heatmap coloring.
roundFractionsTo100()
Formats fractions cleanly as percentages.
buildRally()
Stock‑aware rally troop creation.
buildOptionAFormations()
Multi‑march allocator with constraint enforcement.

📜 License
This project is provided without a specific license — feel free to modify for personal use.
