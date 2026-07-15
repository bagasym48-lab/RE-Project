# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **starter package** (not a finished app) for a shallow-foundation (pondasi dangkal)
calculator with progress-tracking. Three loosely-coupled pieces at different maturity:

- `backend/` — **complete & validated** FastAPI calculation service. The heart of the repo.
- `supabase/schema.sql` — DB schema only; the progress-tracking feature it supports is **not built yet**.
- `frontend-snippet/CalculatorForm.jsx` — a **single example component**, not a real frontend project.

The README's "Rencana lanjutan" lists what's still to build (full calculator UI with SVG
sketches, Supabase auth pages, progress dashboards, column-level permission triggers,
a `foundation_designs` table, deploy). Treat the frontend and progress-tracking as greenfield.

The codebase is written in **Indonesian** — comments, variable names (`nama`,
`persen_progress`), enum values (`lolos`/`tidak`), and result keys (`daya_dukung`,
`geser_2arah`). Match this convention when adding code.

> Engineering disclaimer baked into the product: results are an educational aid and must be
> verified by a licensed engineer. Keep this framing in any user-facing text.

## Commands

All backend commands run **from inside `backend/`** (`main.py` does a flat `from foundation_calc import ...`, so uvicorn must start there):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # win: .venv\Scripts\activate
pip install -r requirements.txt

python foundation_calc.py        # smoke test — see below
uvicorn main:app --reload --port 8000   # API at http://localhost:8000/docs
```

There is **no test framework and no linter**. The validation harness is the `__main__` block
in `foundation_calc.py`. It asserts three things and **must print `overall_ok: True` (twice)
and end with `SEMUA COCOK DENGAN DOKUMEN`**: (1) the legacy manual-load-case path still passes
(old calibration untouched), (2) `generate_combinations` reproduces the reference document's
"Kombinasi Beban ASD/LRFD pada Footing" tables row-by-row (±0.006 kN/kNm, plus the max/min
recap with the exact governing LC numbers), and (3) the new basic-loads path is overall AMAN
for the document case. Run it after any change to the calculation logic, the combination
specs, or their constants. Reference doc: FEED Pipa GFW pondasi dangkal Type-1C
(DURI-RDNL05GS40N-CIV-CAL-PHR-2001-00, `pondasi dangkal 1.pdf` — first 14 pages).

The frontend does not exist yet; scaffold it with `npm create vite@latest frontend -- --template react`,
then `npm install @supabase/supabase-js` and copy in the snippet (see README).

## Architecture

### Calculation core (`backend/foundation_calc.py`)
Pure functions, no I/O, every result is a JSON-ready dict. Flow funnels through one
orchestrator, **`run_full_check(fd, soil, lcs=None, loads=None, Sds=0.0)`** — the single
entry point the API calls. Two input modes:

- **`loads` + `Sds` (the UI path)**: the user enters only **basic loads** (`KNOWN_LOADS`:
  DL, PE/PO/PT, QE/QO/QT, TE, TF, LL, LR, CDL, CLL, I, H, B, WX, WZ, VX, VZ — each a
  {FY, FX, FZ, MX, MZ} support-reaction dict). `generate_combinations` builds **61 ASD
  combos (LC101–161)** and **58 LRFD combos (LC501–558)** by linear superposition, with
  the doc's exact factor specs (`_asd_specs`/`_lrfd_specs`; SDS tokens `A14`/`A105`/`M14`/
  `B2`/`B2M`; seismic 100/30 sign patterns incl. the doc's odd LC149/150 order). The result
  gains a `combos` block (`asd`, `lrfd`, `maxmin_asd`, `maxmin_lrfd`, `Sds`) that the
  report renders verbatim (formula strings like `1.068DL+…+0.91VX+0.27VZ`).
- **`lcs` (legacy)**: manual ASD combos; behavior byte-identical to the old calculator
  (concrete checks fall back to `qu_f = 1.4·qall`). Old saved designs still work.

1. `terzaghi_qall` → allowable bearing capacity `qall` from soil params.
2. `cek` → the 8 structural/stability checks. **ASD combos** drive `daya_dukung` (max
   `sigma_max` scan), `stab_geser` (min-SF scan), `guling`, `uplift`; **LRFD combos** drive
   the concrete checks via `qu_f = σu,max` over LC501–558 (`info.lrfd_gov` = governing LC).
3. `settlement` → `Si + Sc1 + Sc2`, fed `q0` (= worst-case ASD `sigma_max`) from step 2's `info`.
4. `overall_ok` = all 8 checks ok **AND** settlement ok.

Known doc quirk (encoded in the harness, don't "fix"): the reference doc's ASD tables use
(1+0.14·SDS)=1.068 ⇒ SDS≈0.486, but its LRFD tables round to 1.3/0.8 ⇒ SDS=0.5. The engine
is self-consistent (exact formulas of the SDS input); the harness asserts ASD at SDS=0.4857
and LRFD at SDS=0.5.

Every check returns the **same contract**: `dict(demand, kapasitas, rasio, ok, [lc])`. The
frontend table and `overall_ok` both rely on this shape — preserve it when adding checks.
The 8 keys (`daya_dukung`, `stab_geser`, `guling`, `uplift`, `lentur`, `tulangan_min`,
`geser_2arah`, `geser_1arah`) are mirrored in the frontend's `LABELS` map.

Domain specifics worth knowing before editing the math:
- Bearing capacity is evaluated **per load case**; the worst (highest `sigma_max`) governs.
  Several checks similarly scan all load cases for the governing one.
- Two-way (punching) shear uses the **critical section at d/2** from the pedestal face.
- Some `Soil` coefficients are **auto-derived when left `None`, but still override-able** (an
  engineer can pass an explicit value to retune). Defaults are `None`:
  - `xi_c`, `xi_q` (Terzaghi shape factors) → `1 + 0.3·(min(B,L)/max(B,L))` in `terzaghi_qall`.
    For the square reference case this is exactly `1.30`, so the document calibration is
    **unchanged**. `terzaghi_qall` returns the resolved `xi_c`/`xi_q`/`xi_g` for the UI to show.
  - `Cs` (swelling index) → `Cc/10` in `settlement` (returns resolved `Cs`). Standard ratio;
    previously `Cc` was an unused input — now it feeds `Cs`.
- Still **explicit inputs** (no clean/safe auto-derivation): `xi_g` (≈0.69, the document
  calibration knob), `Cc` (lab-measured), and settlement graph factors `I1`/`I2`/`If`.
  Don't hardcode any of these back to literals.
- `n_pedestal` (1 or 2) affects: **uplift** self-weight (`Ap = c1·c2·n_pedestal`); the **sketch**
  (`FoundationSketch` draws 2 pedestals spaced by `s_ped`); and the **local checks** under a 50/50
  shared-load model — `geser_2arah` demand uses tributary `Af/n_pedestal`, while `lentur` &
  `geser_1arah` cantilevers start from the outer pedestal face (`x_off = s_ped/2`). `n_pedestal=1`
  ⇒ `x_off=0` and `Af/1`, so the document calibration is **byte-identical/unchanged**. Global checks
  (`daya_dukung`, `stab_geser`, `guling`, `tulangan_min`) are pedestal-count-independent by design.
  The combined-footing **hogging moment between columns (top steel) is intentionally NOT modelled** —
  flagged in the report note. A full 2-load-point combined footing remains out of scope.

### Units are mixed and load-bearing (common footgun)
- Foundation dimensions (`B`, `L`, `h`, `Df`, `c1`, `c2`, …): **millimeters**.
- Soil/loads: **kN, m, kPa** (e.g. `gs` in kN/m³, moments in kNm).
- Settlement `Po`/`dP`: **kg/m²**.

The code sprinkles `/1000` conversions accordingly. When adding terms, check which unit
system the surrounding variables are in.

### The schema is duplicated in three places (keep in sync)
The input parameters for `Foundation`, `Soil`, and the loads are defined **three times**:

1. `backend/foundation_calc.py` — `@dataclass` definitions + `KNOWN_LOADS` (source of truth).
2. `backend/main.py` — Pydantic `*In` models (`FoundationIn`, `SoilIn`, `BasicLoadIn`,
   legacy `LoadCaseIn`) with matching field names **and default values**.
3. `frontend/src/CalculatorForm.jsx` — `defaultFoundation` / `defaultSoil` / `defaultLoads`
   (+ `defaultSds`, `LOAD_LABELS`, `LOAD_GROUPS` for the input table). Changing SDS in the
   form **auto-scales the VX/VZ rows proportionally** (V = Cs·W, Cs ∝ SDS) via `onSdsChange`
   with a last-valid-SDS anchor (`sdsAnchor`) — loading a saved design resets the anchor so
   loaded loads are never rescaled.

Adding or renaming a parameter (or a basic-load type) means editing all three. The API layer
just unpacks Pydantic into the dataclasses (`Foundation(**req.foundation.model_dump())`), so
names must match exactly. `DesignPanel` stores the loads as `load_cases: { loads, Sds }`
(jsonb) — `loadDesign` in CalculatorForm accepts both this and the legacy array shape.

### API (`backend/main.py`)
Thin wrapper: `POST /calculate` validates the request, builds the dataclasses, calls
`run_full_check`, returns the dict. Dual-mode body: `{foundation, soil, Sds, loads}` (new —
unknown load keys → 400) or `{foundation, soil, load_cases}` (legacy). `GET /health` for liveness. CORS origins come from the
`CORS_ORIGINS` env var (comma-separated). `get_current_user` is a **stub** — it only checks
for a header's presence and `/calculate` is effectively public; real Supabase JWT verification
(against JWKS, via the already-listed `python-jose`) is a TODO.

### Data model (`supabase/schema.sql`)
Roles `engineer` / `qc` / `viewer` / `leader` (`profiles.role`), `work_items`, and `progress_logs`.
**Project CRUD is leader-only**: RLS gives only `leader` insert/update/delete on `projects` and
insert/delete on `project_documents` (docs are created/removed with their project). **Engineer**
can only update docs (submit laporan), write `progress_logs`, and add `project_comments`
(catatan kendala); `enforce_pdoc_columns` treats leader like engineer for doc updates. The
"Buat project baru" form + delete button in `ProjectsPage.jsx` are gated by `isLeader` to match.
(Policy names changed to `"... (leader)"` — the drop-old/create-new block in §5 of `schema.sql`
is idempotent; re-run it in the SQL editor on the live DB.)
A trigger auto-creates a `profiles` row (defaulting to `viewer`) on signup; **new users' roles
are set manually** via SQL. RLS is enabled but is **per-row only**; column-level rules are
enforced by a `BEFORE UPDATE` trigger **`enforce_progress_columns`** on `progress_logs`
(engineer can't change `qc_status`/`qc_catatan`/`qc_by`; QC can't change `persen_progress`/
`tanggal`/`actual_date`/`work_item_id`/`created_by`). Role comes from `my_role()`; `service_role`
(null `auth.uid()`) is unrestricted.

A second progress workflow lives in **`projects`** + **`project_documents`** (frontend
`ProjectsPage.jsx`, a sub-tab of `ProgressPage`): a project owns N documents (5 by default),
created by the **leader**. Engineer sets a doc `status` `todo`→`submitted` (+`submit_catatan`/`design_id`); QC sets
`submitted`→`acc`/`revisi` (+`qc_catatan`). Same trigger pattern — **`enforce_pdoc_columns`**
blocks engineers from ACC-ing and QC from editing submissions. Project progress = `acc`
docs / total × 100%. The two new tables and the trigger must be run in the Supabase SQL editor
(they are appended to `schema.sql`).

Two further tables (schema **§6**) back the Progress UI. **`project_document_events`** is an
append-only audit log auto-written by an AFTER-UPDATE trigger **`log_pdoc_event`** (security-definer)
on every doc status change, so each doc shows a *Direvisi N×* badge + a collapsible timeline
(revision count = number of `revisi` events). **`project_comments`** holds per-project blocker
notes (with a `kategori`: `tunggu_disiplin`/`data_vendor`/…) written by engineer/leader and read by
all, shown under the Kurva-S so a leader can see *why* progress is flat — a "progress belum bergerak
N hari" prompt appears when the S-curve stalls ≥3 days with <100%. The **S-curve follows the calendar**
(`SCurve` in `Charts.jsx`): the actual line is a **step function** (cumulative % held flat, jumping
only at each input date) that is **extended flat to today**, so a period with no input reads as a
horizontal line rather than stopping at the last input; a dashed **"hari ini"** marker + `today`/
`todayMs` in the x-domain keep the chart advancing day-by-day. Both tables are RLS read-all; events
insert **only** via the trigger (tamper-proof), comments insert engineer/leader + delete-own. Like
the project tables, **§6 must be run in the Supabase SQL editor**.

### App shell / dashboard (`frontend/src/Shell.jsx`)
After login, `App` renders **`Shell`** — an EPC dashboard with a dark **discipline sidebar**
(Dashboard + disiplin + Project/Tools sections, with badges). `Dashboard.jsx` is the landing:
top-bar (greeting/search), stat cards, Quick Actions, interactive discipline cards, and
**Recent Project / Recent Calculation read live from Supabase** (`projects` / `foundation_designs`).
SVG icons come from `Icons.jsx` (`<Ic name=… />`). Only Civil's tools work; other disciplines and
the Template/Favorites/Recycle-Bin items render a "segera hadir" placeholder. **Only `Civil` is built**: `CivilView.jsx` hosts the three tools
(`KalkulatorView`, `MtoPage`, `ProgressPage`) under pill sub-tabs. `KalkulatorView.jsx` itself
holds **three** sub-tabs — `CalculatorForm` (pondasi dangkal, backend `/calculate`),
`EquipmentFoundationForm` (pondasi equipment, **pure-frontend**), and
`PipeSupportForm` (pipe support, **pure-frontend** simplified single-pile cantilever model from
the FEED doc — ASCE 7 wind, SNI 1726 seismic Cs, pile Qmax/Qall & Tmax/Tall, Braja-Das pile
settlement; STAAD/FEA remains the real reference, flagged as educational). The other disciplines render
a "segera hadir" placeholder.

**Pondasi Equipment** (`EquipmentFoundationForm.jsx` + `equipmentFoundationCalc.js` +
`EquipmentFoundationSketch.jsx`) is a block foundation for machinery — **no pedestal**, the
equipment sits on the block and anchor bolts take its tension/shear. Calibrated against FEED doc
DURI-TEST05NW000-CIV-CAL-PHR-2001-00 (fluid sump pump 5NW): Meyerhof bearing (doc uses depth
factors Fqd=Fγd=1; `qall_manual` input overrides — the doc itself governs with the Soil-Data
qall 27.48 kN/m², which is the shipped default), 13 service load combos (301–313: D/EE/EO/ET,
wind SNI 1727 with 770 N/m² floor, seismic Cs + 0.14·SDS vertical, impact IL=1.2·EO), and 12
checks incl. weight ratio Wf/EO ≥ 5 (RTS PHR, waives dynamic analysis), σmin ≥ 0, buoyancy,
Braja-Das settlement (OC/NC via Pc′, Cc=0.009(LL−13)), footing flexure X/Z, and ACI 318-14
Ch.17 anchor tension/shear/interaction (4-corner-bolt pattern). The calc engine is a **pure JS
module** (no JSX) so node runs it directly — the validation harness is
`frontend/smoke-equipment.mjs` (`node smoke-equipment.mjs` from `frontend/`; **must print
"SEMUA COCOK DENGAN DOKUMEN"** after any calc change): doc-matching asserts on σmax 18.41,
Mc 230.63, ϕNn 62.24, ϕVn 78.01 etc. Two knowing deviations from the doc's arithmetic (kept intentionally,
verdicts unchanged): Si uses the full Steinbrenner Is = I1+(1−2μ)/(1−μ)·I2 (doc printed it but
numerically used I1+I2), and wind moment arm = exposed-area centroid to base (doc printed Hg+Hf
but used centroid-above-grade). Tool components keep their own `.app`/`.projects` containers; CSS
neutralises their max-width/padding inside `.civil-body`. Print CSS hides `.ds-side`/`.civil-head`
so the A4 report still prints clean.

**Every calculation report opens with a cover page** (`ReportCover` in `reportKit.jsx`, styled
`.rpt-cover`/`.cov-*` in `index.css`). It mimics the AFES foundation-calc cover: a top banner with
the **calculation name** (passed per calc as `title`, e.g. "Kalkulasi Pondasi Equipment"), the
tagline **"Smarter Engineering Starts Here"**, the RE-Project `LogoMark`, a TITLE/DESCRIPTION table
of project info (Project/Job No. → Load Combination Group), and a REV/DATE/DESCRIPTION/PREP'D/CHK'D/
APPR'D revision table (first row auto-filled from `rev`/`revDesc`/today + engineer→PREP'D, qc→CHK'D).
The cover has `break-after: page` so the report body starts on page 2. Project info is entered via
`ProjectInfoForm` (a fieldset shown at the top of **all three** calculator input panels) and is a
**shared, persisted state** — lifted to `CivilView` as `project`/`setProject`
(`usePersistedState('projectInfo', defProject)`) and threaded through `KalkulatorView` to each form
(controlled with a local fallback). Fill it once; it appears on whichever report you print.
`defProject` + `ProjectInfoForm` + `ReportCover` are exported from `reportKit.jsx`.

**Every printed page of the report body carries a running header** (`RunningHeader` + `ReportPaged`
in `reportKit.jsx`). `ReportPaged` wraps the numbered body in a `<table class="rpt-paged">` whose
`<thead>` (`display: table-header-group`) the browser **repeats on every printed page** — the reliable
Chrome technique (a `position:fixed` header would overlap on page 2+). Cover + TOC sit **outside** the
wrapper (their own pages, no running header). The header title is the **project info joined**
(`jobNo – site – docNo – refNo – structureName`), so it differs per project; if all are empty it falls
back to the calc `title`. It replaced the old one-shot `.rpt-head` masthead (removed from all four
reports); `right` carries the verdict badge (`AMAN`/`TIDAK AMAN`, or `ESTIMASI` for MTO). Styles:
`.rpt-paged`/`.rpt-runhead`/`.rh-*` in `index.css`.

**Reports follow a structured AFES-style document layout** (modelled on `DUMY AFES.pdf`). The
sequence is **Cover** (`ReportCover`, `break-after: page`) → **Daftar Isi** (`ReportTOC`, its own
page; `items` = `[[main, [subs…]], …]`) → the numbered body (wrapped in `ReportPaged`): **1. Umum** (Kode & Standar, Material &
Berat Satuan, Kondisi Tanah & Faktor Keamanan — `ItemsTable` "Item | Nilai" tables), **2. Data Input**
(the raw input listing as `rpt-kv`), **3. Gambar Sketsa** (2D detail sketch only — no 3D; plus
**§3.2 Detail Penulangan** via `RebarSketch` in `reportKit.jsx`: cross-section [dots = bars normal
to the cut, line = parallel bars, cover/h/B dims] + plan view of the mesh, labelled
`Ø{db}-{s}` with bar counts `floor((side−2·cover)/s)+1`; all inputs in **mm** — equipment passes
`Bf·1000` etc. `lapis` prop (1|2): 2 draws BOTH top+bottom mats in the cross-section (labels switch
to "atas & bawah … (2 lapis)"). Sources: pondasi dangkal = local `lapis` state in CalculatorForm
(sketch-only, NOT sent to the API); equipment = `def.lapis` in `equipmentFoundationCalc.js`;
MTO pondasi passes its own `lapis` param. `nPed=0` = block/no pedestal; `pedBarsLabel` [only MTO
knows pedestal rebar] draws indicative pedestal bars+ties. Styles `.rb-*` in `index.css`.
Pipe support has no rebar → no §3.2), **4.
Kombinasi Beban** (load definitions + load-case/combination table), **5. Data Fondasi/Struktur**
(dimension `ItemsTable`s), **6. Cek Stabilitas/Kapasitas**, **7. Desain & Penurunan**, and **8.
Rekapitulasi**. Only main sections carry numbers; the derivation `DerivGroup`s inside §6/§7 use
**descriptive titles** (no `x.y` prefix) so sections can be renumbered without touching them (a `sed`
stripped the old numbers). Shared building blocks in `reportKit.jsx`: `ItemsTable` (navy-header
two-column table), `ReportTOC`. Styles: `.items-tbl`, `.rpt-toc`/`.toc-*` in `index.css`. (An earlier
isometric-3D-sketch experiment — `Iso3D*` + `svg.iso` CSS — was removed at the user's request.) Keep
the SFD/BMD force diagrams inside §6/§7 near the checks they illustrate.

**Print reports show full derivations** (`frontend/src/reportKit.jsx`, shared by all three
calculators). Every `report-sheet` has a **"Rincian perhitungan"** section built from `<Step>`
rows (symbolic formula → number substitution → result → a blue `<Ref>` badge citing the standard,
e.g. *SNI 2847:2019 Tabel 8.6.1.1*, *SNI 1727:2020 Pers. 26.10-1*, *ACI 318-14 17.6.3*) plus
`<Frac>` for stacked fractions, and a **"Diagram gaya dalam"** section (SFD/BMD SVGs:
`SoilPressureDiagram` + `FootingFullForceDiagram` for footings, `ColumnForceDiagram` +
`BeamForceDiagram` for pipe support). `FootingFullForceDiagram` draws the **critical internal forces
across the full footing cross-section (edge to edge)** — uniform upward soil reaction with the
pedestal/block at center → antisymmetric SFD (±Vmax at the column sides) + symmetric parabolic BMD
(Mmax at center); it takes `B`/`a`/`cCol`/`sPed` as unit-free geometry ratios (`aFrac = a/B`, exact
for 1 pedestal, illustrative for 2) plus a `BLabel` string. It uses a **landscape viewBox (760×300)
and renders full page width** — wrap it in `.fd-full` (not the `.fd-row` grid) so it spans edge to
edge on the printed A4. `CantileverForceDiagram` (half-span) remains exported but is no longer wired
into the reports. The kit is presentational only — callers
pass already-computed numbers. The pure-frontend calcs (equipment, pipe) expose all intermediates via their `compute().info`;
**pondasi dangkal reconstructs substitutions in `ReportSheet` from the backend response + inputs +
trivial geometry (no math duplicated)** — the physics results (Nc/Nq/Nγ, qu, qall, per-check
demand/kapasitas, settlement, `info.*`) all come from `/calculate`. Diagram/derivation numbers must
stay display-only; never let them drive verdicts. `reportKit` styles + print rules live in `index.css`
(`.calc-step`, `.rpt-ref`, `.frac`, `.fd-*`).

**Reports open each calculation section with a theoretical preamble** (`TheoryIntro` in
`reportKit.jsx`, styled `.rpt-theory` — a light left-accent box holding just the intro paragraphs,
no badge/title). It is placed **before** the derivation groups so the reader gets the theory before
the numbers: in the three calculators before §6/§7 (or equivalent), and in the MTO reports before
the take-off results. Presentational only — pass paragraphs as children. (It still accepts `title`/
`refs` props for caller compatibility but ignores them.)

### MTO (`frontend/src/MtoPage.jsx`)
A third top-nav tab (after Kalkulator/Progress) for **Material Take-Off** — pure-frontend
calculators (no backend/DB). Three sub-tabs: **Pondasi Dangkal** (concrete volume + rebar weight
from dims/reinforcement → cost), **Pondasi Equipment** (`MtoEquipment` — block concrete +
lean-concrete + two-way mesh rebar + anchor-bolt steel weight → cost), and **Pipe Support**
(steel-pipe table by type/length/qty → weight → cost). Rebar weight `0.006165·d²` kg/m; pipe
weights are a Sch-40 `kg/m` catalog. Educational estimate — excludes formwork/labour/fittings.

**Each MTO sub-tab is printable** (`MtoReportSheet`, a generic hidden `.report-sheet`): cover →
§1 Umum (metode/lingkup) → §2 Data Input → §3 (`TheoryIntro` + results table). `MtoPage` takes a
`project` prop (threaded from `CivilView`, same `projectInfo` state as the calculators) for the
cover; each sub-tab has its own `SignPrint` (engineer/QC names + 🖨️ print button) via the `useSign`
hook. `@media print` hides `.mto-subtabs` alongside the other chrome; the neutral cover badge uses
`.rpt-verdict.mto`.

**All three MTOs are linked to their calculators.** Each calculator's input state is **lifted to
`CivilView`** via a `usePersistedState(key, default)` helper (each persisted to its own
`localStorage` key: `pondasiInput`, `equipFoundationInput`, `pipeInput`) and passed to **both**
the calculator and the matching MTO sub-tab:
- **Pondasi Dangkal**: `CalculatorForm` (controlled via `fd`/`setFd`, only the `fd` foundation
  dataclass is lifted — `soil`/`lcs` stay local) ↔ `MtoPondasi` (`fd` prop). Linked geometry
  includes `db`→Ø footing rebar and `srl`→spacing; pedestal rebar + layers + prices are MTO-only.
- **Pondasi Equipment**: `EquipmentFoundationForm` (`s`/`setS`) ↔ `MtoEquipment` (`equip` prop).
- **Pipe Support**: `PipeSupportForm` (`s`/`setS`) ↔ `MtoPipe` (`pipe` prop). The MTO derives the
  column+beam steel from the calc's section (`kg/m = (Do−t)·t·0.0246615`) and member lengths
  (column = `H_above+depth`, beam = `L`); it also keeps an optional manual pipe table for extras.

Every calculator form is now **controlled with a local-state fallback** (`sProp ?? sLocal`) so it
still runs standalone. Each MTO shows linked values as read-only `LinkedField`s (blue-tinted) with
a `.mto-link-note` banner; only MTO-specific params (rebar detail, prices, waste, qty) are editable.
CivilView stays mounted across tool switches so the shared state persists. `defaultFoundation`
(CalculatorForm) and `def` (PipeSupportForm, equipmentFoundationCalc) are **exported** for the
CivilView initial state — keep them exported. To add another linked calc↔MTO pair, follow the same
lift-to-CivilView pattern rather than duplicating inputs.

## Environment
Backend `.env` (in `backend/`): `CORS_ORIGINS`. Frontend `.env` (in the Vite project root):
`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. See `.env.example`.
