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
in `foundation_calc.py`: it runs the reference document's load cases through `run_full_check`
and prints each check's ratio. **It must print `overall_ok: True`** — that asserts the calc
still matches the document (FEED Pipa GFW, SNI 2847:2019) it was calibrated against. Run it
after any change to the calculation logic or its constants.

The frontend does not exist yet; scaffold it with `npm create vite@latest frontend -- --template react`,
then `npm install @supabase/supabase-js` and copy in the snippet (see README).

## Architecture

### Calculation core (`backend/foundation_calc.py`)
Pure functions, no I/O, every result is a JSON-ready dict. Flow funnels through one
orchestrator, **`run_full_check(fd, soil, lcs)`** — the single entry point the API calls:

1. `terzaghi_qall` → allowable bearing capacity `qall` from soil params.
2. `cek` → the 8 structural/stability checks, evaluated against `qall`.
3. `settlement` → `Si + Sc1 + Sc2`, fed `q0` (= worst-case `sigma_max`) from step 2's `info`.
4. `overall_ok` = all 8 checks ok **AND** settlement ok.

Every check returns the **same contract**: `dict(demand, kapasitas, rasio, ok, [lc])`. The
frontend table and `overall_ok` both rely on this shape — preserve it when adding checks.
The 8 keys (`daya_dukung`, `stab_geser`, `guling`, `uplift`, `lentur`, `tulangan_min`,
`geser_2arah`, `geser_1arah`) are mirrored in the frontend's `LABELS` map.

Domain specifics worth knowing before editing the math:
- Bearing capacity is evaluated **per load case**; the worst (highest `sigma_max`) governs.
  Several checks similarly scan all load cases for the governing one.
- Two-way (punching) shear uses the **critical section at d/2** from the pedestal face.
- Calibration constants are **intentionally inputs, not hardcoded**, so engineers can retune:
  Terzaghi shape factor `xi_g` (≈0.69 calibrated to the document) and the settlement graph
  factors `I1`/`I2`/`If` live in `Soil` with defaults. Don't hardcode them back.

### Units are mixed and load-bearing (common footgun)
- Foundation dimensions (`B`, `L`, `h`, `Df`, `c1`, `c2`, …): **millimeters**.
- Soil/loads: **kN, m, kPa** (e.g. `gs` in kN/m³, moments in kNm).
- Settlement `Po`/`dP`: **kg/m²**.

The code sprinkles `/1000` conversions accordingly. When adding terms, check which unit
system the surrounding variables are in.

### The schema is duplicated in three places (keep in sync)
The input parameters for `Foundation`, `Soil`, and `LoadCase` are defined **three times**:

1. `backend/foundation_calc.py` — `@dataclass` definitions (source of truth for the math).
2. `backend/main.py` — Pydantic `*In` models (`FoundationIn`, `SoilIn`, `LoadCaseIn`) with
   matching field names **and default values**.
3. `frontend-snippet/CalculatorForm.jsx` — `defaultFoundation` / `defaultSoil` / `defaultLCs`.

Adding or renaming a parameter means editing all three. The API layer just unpacks Pydantic
into the dataclasses (`Foundation(**req.foundation.model_dump())`), so names must match exactly.

### API (`backend/main.py`)
Thin wrapper: `POST /calculate` validates the request, builds the dataclasses, calls
`run_full_check`, returns the dict. `GET /health` for liveness. CORS origins come from the
`CORS_ORIGINS` env var (comma-separated). `get_current_user` is a **stub** — it only checks
for a header's presence and `/calculate` is effectively public; real Supabase JWT verification
(against JWKS, via the already-listed `python-jose`) is a TODO.

### Data model (`supabase/schema.sql`)
Roles `engineer` / `qc` / `viewer` (`profiles.role`), `work_items`, and `progress_logs`.
A trigger auto-creates a `profiles` row (defaulting to `viewer`) on signup; **new users' roles
are set manually** via SQL. RLS is enabled but is **per-row only**; column-level rules are
enforced by a `BEFORE UPDATE` trigger **`enforce_progress_columns`** on `progress_logs`
(engineer can't change `qc_status`/`qc_catatan`/`qc_by`; QC can't change `persen_progress`/
`tanggal`/`actual_date`/`work_item_id`/`created_by`). Role comes from `my_role()`; `service_role`
(null `auth.uid()`) is unrestricted.

## Environment
Backend `.env` (in `backend/`): `CORS_ORIGINS`. Frontend `.env` (in the Vite project root):
`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. See `.env.example`.
