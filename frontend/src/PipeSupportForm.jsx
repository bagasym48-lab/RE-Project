// PipeSupportForm.jsx — kalkulasi Pipe Support (single-pile cantilever).
// Rumus & parameter mengacu dokumen FEED DURI-RDNL05GS40N-CIV-CAL-PHR-2001-00:
//  • Angin  : qh = 0.613·Kz·Kzt·Kd·Ke·V² ; P = qh·G·Cf (ASCE 7-16/22)
//  • Gempa  : Cs = SDS·Ie/R ; Cs,min = max(0.044·SDS·Ie ; 0.01) (SNI 1726:2019)
//  • Pile   : Qmax/Qall (tekan), Tmax/Tall (tarik), Hmax/Hall (lateral, Hmax=√(Hx²+Hz²))
//  • Penurunan pile (elastis, Braja M. Das): se = se1 + se2 + se3 < 25 mm
// CATATAN: hasil STAAD (rasio baja, defleksi, displacement) di dokumen berasal dari
// FEA. Di sini dipakai model kantilever single-pile tersederhana — ALAT BANTU EDUKASI,
// wajib diverifikasi insinyur sipil berlisensi / analisis STAAD.
import { useState } from 'react';
import PipeSupportSketch from './PipeSupportSketch.jsx';
import { Step, DerivGroup, TheoryIntro, Frac, FDDefs, ColumnForceDiagram, BeamForceDiagram, f, ProjectInfoForm, ReportCover, ReportTOC, RunningHeader, ReportPaged, defProject, ItemsTable } from './reportKit.jsx';

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const PI = Math.PI;
const G_ACC = 9.81;   // gravitasi (m/s²) untuk konversi berat kg → kN

// ---------------------------------------------------------------------------
// Skedul pipa baja (ref: "trial pipa.xlsx" — tabel BH6:BM23). Berat per meter
// untuk kondisi kosong & pipa+air (test/operasi). dia_mm = "Diameter pipe (mm)"
// pada tabel referensi. pw = empty + water (isi air penuh).
// ---------------------------------------------------------------------------
const PIPE_SCHED = [
  { nps: 0.5, od_in: 0.84, dia_mm: 15.8, empty: 1.27, water: 0.2, pw: 1.47 },
  { nps: 0.75, od_in: 1.05, dia_mm: 20.93, empty: 1.68, water: 0.34, pw: 2.02 },
  { nps: 1, od_in: 1.315, dia_mm: 26.64, empty: 2.5, water: 0.56, pw: 3.06 },
  { nps: 1.5, od_in: 1.9, dia_mm: 40.9, empty: 4.05, water: 1.31, pw: 5.36 },
  { nps: 2, od_in: 2.375, dia_mm: 52.51, empty: 5.44, water: 2.17, pw: 7.61 },
  { nps: 2.5, od_in: 2.875, dia_mm: 62.71, empty: 8.63, water: 3.09, pw: 11.72 },
  { nps: 3, od_in: 3.5, dia_mm: 77.92, empty: 11.29, water: 4.77, pw: 16.06 },
  { nps: 4, od_in: 4.5, dia_mm: 102.26, empty: 16.08, water: 8.21, pw: 24.29 },
  { nps: 5, od_in: 5.563, dia_mm: 128.2, empty: 21.77, water: 12.91, pw: 34.68 },
  { nps: 6, od_in: 6.625, dia_mm: 154.08, empty: 28.27, water: 18.64, pw: 46.91 },
  { nps: 8, od_in: 8.625, dia_mm: 202.74, empty: 42.55, water: 32.28, pw: 74.83 },
  { nps: 10, od_in: 10.75, dia_mm: 254.51, empty: 60.31, water: 50.87, pw: 111.18 },
  { nps: 12, od_in: 12.75, dia_mm: 304.79, empty: 73.86, water: 72.96, pw: 146.82 },
  { nps: 14, od_in: 14, dia_mm: 333.34, empty: 93.226, water: 87.27, pw: 180.496 },
  { nps: 16, od_in: 16, dia_mm: 387.35, empty: 94.55, water: 117.841, pw: 212.391 },
  { nps: 18, od_in: 18, dia_mm: 438.15, empty: 105.159, water: 150.777, pw: 255.936 },
  { nps: 20, od_in: 19.25, dia_mm: 488.95, empty: 117.092, water: 187.767, pw: 304.859 },
  { nps: 24, od_in: 23.25, dia_mm: 590.55, empty: 140.958, water: 273.907, pw: 414.865 },
];

// Baris skedul untuk diameter nominal (inch). Exact match; jika tak ada → terdekat.
export function pipeRow(nps) {
  const d = n(nps);
  let best = PIPE_SCHED[0];
  for (const r of PIPE_SCHED) {
    if (r.nps === d) return r;
    if (Math.abs(r.nps - d) < Math.abs(best.nps - d)) best = r;
  }
  return best;
}

// Beban support akibat berat pipa untuk satu span (mengikuti "trial pipa.xlsx"):
//   Fy = (kg/m) · span · 9.81 / 1000  [kN]  · test = operasi (pipa penuh air)
//   Thermal Fx = max(7.5%·test ; 30%·test) [tanpa data CAESAR] ; Fz = 0.25·Fx
export function pipeLoads(nps, span) {
  const r = pipeRow(nps);
  const L = n(span);
  const empty = (r.empty * L * G_ACC) / 1000;
  const oper = (r.pw * L * G_ACC) / 1000;
  const test = oper;                       // Z = Y (pipa penuh air)
  const Tx = Math.max(0.075 * test, 0.3 * test); // MAX(7.5% ; 30%) → 0.3·test
  const Tz = 0.25 * Tx;
  return { empty, oper, test, Tx, Tz, row: r };
}

export const def = {
  // Geometri
  H_above: 0.50,   // tinggi di atas tanah (m)
  depth: 2.51,     // kedalaman ke titik fixity di bawah tanah (m)
  L: 6.30,         // panjang beam / bentang pipa (m)
  Dpipe: 20,       // diameter pipa (in)
  // Sumber beban: 'manual' (dari divisi piping) | 'trial' (dihitung dari span)
  loadMode: 'manual',
  span: 4.25,      // panjang span pipa (m) — dipakai pada mode trial
  // Beban pipa vertikal (kN) di pile — dipakai pada mode manual
  P_empty: 24.45,  // kosong (pipa saja)
  P_oper: 63.67,   // operation
  P_test: 64.69,   // hydrotest / test
  // Beban termal (kN) horizontal
  Tx: 10.98, Tz: 10.22,
  // Angin
  V: 32, Kz: 0.85, Kzt: 1.0, Kd: 0.85, Ke: 1.0, G: 0.85, Cf: 0.51, Pmin: 0.77,
  // Gempa
  SDS: 0.521, SD1: 0.508, Ie: 1.25, R: 2.5, Cd: 2.5,
  // Penampang baja kolom/beam (pipa baja) — mm, MPa
  Do: 323.9, t: 10.0, E: 200000, fy: 240,
  // Pondasi pile
  Dpile: 0.324, Lpile: 8.0, Qall: 254.98, Tall: 215.66, Hall: 24.93,
  // Tanah / penurunan
  N: 6, mu: 0.30, Iwp: 0.85, xi: 0.65, Ep: 200000000,
};

function compute(s) {
  const g = (k) => n(s[k]);
  const Htot = g('H_above') + g('depth');            // panjang kantilever dari fixity (m)
  const Dm = g('Dpipe') * 0.0254;                     // diameter pipa (m)

  // --- Beban pipa: manual (dari piping) atau trial (dihitung dari span) ---
  const trial = s.loadMode === 'trial';
  const pl = pipeLoads(g('Dpipe'), g('span'));
  const P_empty = trial ? pl.empty : g('P_empty');    // kosong (Fy)
  const P_oper = trial ? pl.oper : g('P_oper');        // operasi (Fy)
  const P_test = trial ? pl.test : g('P_test');        // test/hydrotest (Fy)
  const Tx = trial ? pl.Tx : g('Tx');                  // termal arah X
  const Tz = trial ? pl.Tz : g('Tz');                  // termal arah Z
  const loads = { empty: P_empty, oper: P_oper, test: P_test, Tx, Tz };

  // --- Angin ---
  const qh = 0.613 * g('Kz') * g('Kzt') * g('Kd') * g('Ke') * g('V') ** 2; // N/m²
  const Pwind = (qh * g('G') * g('Cf')) / 1000;        // kN/m²
  const Puse = Math.max(Pwind, g('Pmin'));             // kN/m²
  const Fwind = Puse * Dm * g('L');                    // gaya angin pada pipa (kN)

  // --- Gempa ---
  const Cs = (g('SDS') * g('Ie')) / g('R');
  const CsMin = Math.max(0.044 * g('SDS') * g('Ie'), 0.01);
  const CsUse = Math.max(Cs, CsMin);
  const Fseis = CsUse * P_oper;                        // gaya gempa lateral (kN)

  // --- Penampang baja (pipa) ---
  const Do = g('Do'), t = g('t');
  const Di = Math.max(Do - 2 * t, 0);
  const A = (PI / 4) * (Do ** 2 - Di ** 2);            // mm²
  const I = (PI / 64) * (Do ** 4 - Di ** 4);           // mm⁴
  const Z = (Do ** 3 - Di ** 3) / 6;                   // mm³ (plastis pipa)
  const E = g('E');                                    // MPa = N/mm²
  const EI = E * I;                                    // N·mm²

  // --- Gaya dalam (model kantilever) ---
  const seisAmp = 1 + 0.14 * g('SDS');                 // amplifikasi seismik vertikal (doc)
  const Pr = Math.max(P_oper * seisAmp, P_test);       // aksial maks (kN) ≈ Qmax
  const Hlat = Math.sqrt((Math.abs(Tx) + Fwind) ** 2 + Math.abs(Tz) ** 2); // resultan lateral (kN)
  const Mr = Hlat * Htot;                             // momen dasar kolom (kNm)

  // --- Rasio struktur (AISC H1, disederhanakan) ---
  const Pc = 0.9 * g('fy') * A / 1000;                // kN (leleh, KL/r kecil)
  const Mc = 0.9 * g('fy') * Z / 1e6;                 // kNm
  const ratioPM = Pr / Pc >= 0.2
    ? Pr / Pc + (8 / 9) * (Mr / Mc)
    : Pr / (2 * Pc) + Mr / Mc;

  // --- Defleksi vertikal beam: beban pipa sebagai beban TERPUSAT di tengah beam ---
  // (mengacu dokumen: "input beban di tengah pipa, beban terpusat pada member")
  const Lmm = g('L') * 1000;
  const dv = (P_oper * 1000) * Lmm ** 3 / (48 * EI);      // mm (P di tengah, balok simple)
  const dvAll = Lmm / 240;                                // L/240 (serviceability beban terpusat)

  // --- Displacement horizontal kolom (kantilever, F·H³/3EI) ---
  const Hmm = Htot * 1000;
  const dhWind = (Fwind * 1000) * Hmm ** 3 / (3 * EI);   // mm
  const dhWindAll = Hmm / 200;                            // H/200 (PIP STC0105)
  const dhSeis = (Fseis * 1000) * Hmm ** 3 / (3 * EI) * (g('Cd') / g('Ie')); // mm (×Cd/Ie)
  const dhSeisAll = 0.015 * Hmm;                          // 0.015H (ASCE Risk III)

  // --- Pile: tekan, tarik, lateral ---
  const Qmax = Pr;
  // Kondisi vertikal teringan = pipa kosong (paling rawan uplift bila ada momen guling).
  const Tmax = Math.min(P_empty, P_oper, P_test);     // single pile → biasanya tekan (Tmax>0)
  const noTension = Tmax >= 0;
  const Hmax = Math.sqrt((Math.abs(Tx) + Fwind) ** 2 + Math.abs(Tz) ** 2);

  // --- Penurunan pile (elastis, Braja Das) ---
  const Dp = g('Dpile'), Lp = g('Lpile');
  const Ap = (PI / 4) * Dp ** 2;          // m²
  const p = PI * Dp;                       // keliling (m)
  const Es = 300 * (g('N') + 15);          // kPa (=kN/m²) untuk clayey sand
  const Qw = Qmax;                         // npile = 1
  const Qws = 0.9 * Qw, Qwp = Qw - Qws;
  const Iws = 2 + 0.35 * Math.sqrt(Lp / Dp);
  const mu2 = 1 - g('mu') ** 2;
  const se1 = ((Qwp + g('xi') * Qws) * Lp) / (Ap * g('Ep')) * 1000;                 // mm
  const se2 = (Qwp / Ap) * (Dp / Es) * mu2 * g('Iwp') * 1000;                       // mm
  const se3 = (Qws / (p * Lp)) * (Dp / Es) * mu2 * Iws * 1000;                      // mm
  const se = se1 + se2 + se3;

  const checks = {
    struktur: { demand: ratioPM, kapasitas: 1.0, rasio: ratioPM, ok: ratioPM <= 1.0 },
    defleksi_vertikal: { demand: dv, kapasitas: dvAll, rasio: dv / dvAll, ok: dv <= dvAll },
    displ_angin: { demand: dhWind, kapasitas: dhWindAll, rasio: dhWind / dhWindAll, ok: dhWind <= dhWindAll },
    displ_gempa: { demand: dhSeis, kapasitas: dhSeisAll, rasio: dhSeis / dhSeisAll, ok: dhSeis <= dhSeisAll },
    tekan_pile: { demand: Qmax, kapasitas: g('Qall'), rasio: Qmax / g('Qall'), ok: Qmax <= g('Qall') },
    tarik_pile: { demand: noTension ? 0 : -Tmax, kapasitas: g('Tall'), rasio: noTension ? 0 : -Tmax / g('Tall'), ok: noTension || -Tmax <= g('Tall'), noTension },
    lateral_pile: { demand: Hmax, kapasitas: g('Hall'), rasio: g('Hall') ? Hmax / g('Hall') : 0, ok: Hmax <= g('Hall') },
    penurunan_pile: { demand: se, kapasitas: 25, rasio: se / 25, ok: se < 25 },
  };
  const overall_ok = Object.values(checks).every((c) => c.ok);

  return {
    info: { Htot, Dm, qh, Pwind, Puse, Fwind, Cs, CsMin, CsUse, Fseis, A, I, Z, Di, EI,
            seisAmp, Pr, Hlat, Mr, Hmax, Pc, Mc, ratioPM, Tmax, noTension,
            dv, dvAll, dhWind, dhWindAll, dhSeis, dhSeisAll, Lmm, Hmm,
            se1, se2, se3, se, Es, Iws, Qws, Qwp, Ap, perim: p, mu2,
            trial, loads, pl },
    checks, overall_ok,
  };
}

const LABELS = {
  struktur: 'Rasio struktur (AISC)',
  defleksi_vertikal: 'Defleksi vertikal (mm)',
  displ_angin: 'Displacement horizontal — angin (mm)',
  displ_gempa: 'Displacement horizontal — gempa (mm)',
  tekan_pile: 'Kapasitas tekan pile (kN)',
  tarik_pile: 'Kapasitas tarik pile (kN)',
  lateral_pile: 'Kapasitas lateral pile (kN)',
  penurunan_pile: 'Penurunan pile (mm)',
};

function Field({ k, label, value, onChange, step = 'any' }) {
  return (
    <label className="field" title={label}>
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(k, e.target.value)} />
    </label>
  );
}

const LOAD_ROWS = [
  ['empty', 'P_empty', 'beban kosong (Fy)'],
  ['oper', 'P_oper', 'beban operation (Fy)'],
  ['test', 'P_test', 'beban hydrotest (Fy)'],
  ['Tx', 'Tx', 'thermal arah X (Fx)'],
  ['Tz', 'Tz', 'thermal arah Z (Fz)'],
];

// Fieldset beban pipa dengan 2 mode: manual (dari divisi piping) atau trial
// (dihitung dari span + diameter, mengacu "trial pipa.xlsx").
function BebanSection({ s, upd, loads, trial }) {
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  return (
    <fieldset className="group">
      <legend>Beban pipa &amp; termal (kN)</legend>
      <p className="loads-note">
        <b>Sumber beban:</b> normalnya beban operation, hydrotest &amp; termal (X, Z) diberikan
        <b> divisi piping</b> (mode Manual). Bila belum tersedia, pilih <b>Trial</b> — beban kosong,
        operation, hydrotest &amp; termal dihitung otomatis dari <b>span</b> &amp; <b>diameter pipa</b>
        (berat pipa penuh air, ref. <i>trial pipa</i>).
      </p>
      <div className="fields">
        <label className="field" title="Sumber beban pipa">
          <span>Sumber beban</span>
          <select value={s.loadMode || 'manual'} onChange={(e) => upd('loadMode', e.target.value)}>
            <option value="manual">Manual — dari divisi piping</option>
            <option value="trial">Trial — hitung dari span &amp; diameter</option>
          </select>
        </label>
        <label className="field" title="diameter nominal pipa (inch)">
          <span>Diameter pipa (in)</span>
          <select value={s.Dpipe} onChange={(e) => upd('Dpipe', e.target.value)}>
            {PIPE_SCHED.map((p) => <option key={p.nps} value={p.nps}>{p.nps}″ ({p.dia_mm} mm)</option>)}
          </select>
        </label>
        {trial && (
          <Field k="span" label="panjang span pipa (m)" value={s.span} onChange={upd} />
        )}
      </div>

      {trial ? (
        <>
          <div className="mto-link-note" style={{ marginTop: 8 }}>
            🔧 Beban dihitung dari span {f2(n(s.span))} m &amp; pipa {n(s.Dpipe)}″
            (berat {f2(pipeRow(s.Dpipe).empty)}/{f2(pipeRow(s.Dpipe).pw)} kg/m kosong/penuh air).
          </div>
          <div className="lc-wrap">
            <table className="lc loads-tbl">
              <thead><tr><th>Beban</th><th>Nilai (kN)</th></tr></thead>
              <tbody>
                {LOAD_ROWS.map(([lk, , lbl]) => (
                  <tr key={lk}>
                    <td className="ld-name">{lbl}</td>
                    <td className="num"><b>{f2(loads[lk])}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="fields" style={{ marginTop: 8 }}>
          {LOAD_ROWS.map(([, fk, lbl]) => (
            <Field key={fk} k={fk} label={lbl} value={s[fk]} onChange={upd} />
          ))}
        </div>
      )}
    </fieldset>
  );
}

const GROUPS = [
  ['Geometri', [
    ['H_above', 'tinggi di atas tanah (m)'], ['depth', 'kedalaman pipe di bawah tanah (m)'],
    ['L', 'panjang beam = pipa horiz. (m)'],
  ]],
  ['Angin & gempa', [
    ['V', 'kecepatan angin V (m/s)'], ['Cf', 'koef. gaya Cf'], ['G', 'gust factor G'], ['Pmin', 'angin min (kN/m²)'],
    ['SDS', 'SDS (g)'], ['Ie', 'faktor keutamaan Ie'], ['R', 'faktor reduksi R'], ['Cd', 'faktor lendutan Cd'],
  ]],
  ['Penampang baja (pipa)', [
    ['Do', 'Ø luar (mm)'], ['t', 'tebal (mm)'], ['E', 'E baja (MPa)'], ['fy', 'fy baja (MPa)'],
  ]],
  ['Pondasi pile', [
    ['Dpile', 'Ø pile (m)'], ['Lpile', 'panjang pile (m)'],
    ['Qall', 'kapasitas tekan izin (kN)'], ['Tall', 'kapasitas tarik izin (kN)'],
    ['Hall', 'kapasitas lateral izin (kN)'],
  ]],
  ['Tanah & penurunan', [
    ['N', 'N-SPT'], ['mu', 'poisson μ'], ['Iwp', 'faktor Iwp'], ['xi', 'magnitude ξ'],
  ]],
];

export default function PipeSupportForm({ s: sProp, setS: setSProp, project: projectProp, setProject: setProjectProp }) {
  // State bisa "diangkat" ke induk (CivilView) agar tersinkron dengan MTO Pipe
  // Support; fallback ke state lokal bila dipakai berdiri sendiri.
  const [sLocal, setSLocal] = useState(def);
  const s = sProp ?? sLocal;
  const setS = setSProp ?? setSLocal;
  const [projLocal, setProjLocal] = useState(defProject);
  const project = projectProp ?? projLocal;
  const setProject = setProjectProp ?? setProjLocal;
  const updProject = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const [engineerName, setEngineerName] = useState('');
  const [qcName, setQcName] = useState('');
  const upd = (k, v) => setS((o) => ({ ...o, [k]: v }));
  const r = compute(s);
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');

  return (
    <div className="app">
      <header className="head">
        <h1>Kalkulasi Pipe Support</h1>
        <p className="sub">Single-pile cantilever · ASCE 7-16/22 · SNI 1726:2019 · Braja M. Das</p>
        <p className="warn">⚠️ Model tersederhana (alat bantu). Hasil STAAD/FEA tetap acuan — wajib diverifikasi insinyur berlisensi.</p>
      </header>

      <div className="layout">
        <section className="inputs">
          <ProjectInfoForm project={project} onChange={updProject} />
          {GROUPS.map(([title, fields], gi) => (
            <div key={title} style={{ display: 'contents' }}>
              <fieldset className="group">
                <legend>{title}</legend>
                <div className="fields">
                  {fields.map(([k, l]) => <Field key={k} k={k} label={l} value={s[k]} onChange={upd} />)}
                </div>
              </fieldset>
              {gi === 0 && <BebanSection s={s} upd={upd} loads={r.info.loads} trial={r.info.trial} />}
            </div>
          ))}
        </section>

        <aside className="side">
          <div className="card">
            <PipeSupportSketch s={s} />
          </div>

          <div className="card result">
            <div className={`verdict ${r.overall_ok ? 'ok' : 'ng'}`}>{r.overall_ok ? 'AMAN' : 'TIDAK AMAN'}</div>
            <p className="terz">
              q<sub>h</sub> = {f2(r.info.qh)} N/m² · P<sub>use</sub> = {f2(r.info.Puse)} kN/m² · F<sub>angin</sub> = {f2(r.info.Fwind)} kN
            </p>
            <p className="terz">
              Cs = {f2(r.info.CsUse)} · F<sub>gempa</sub> = {f2(r.info.Fseis)} kN · Q<sub>max</sub> = {f2(r.info.Pr)} kN · M = {f2(r.info.Mr)} kNm
            </p>
            <table className="res">
              <thead><tr><th>Pengecekan</th><th>Demand</th><th>Kapasitas</th><th>Rasio</th><th>Status</th></tr></thead>
              <tbody>
                {Object.entries(r.checks).map(([k, v]) => (
                  <tr key={k}>
                    <td>{LABELS[k]}</td>
                    <td className="num">{k === 'tarik_pile' && v.noTension ? '0 (tanpa tarik)' : f2(v.demand)}</td>
                    <td className="num">{f2(v.kapasitas)}</td>
                    <td className="num">{f2(v.rasio)}</td>
                    <td className={`st ${v.ok ? 'ok' : 'ng'}`}>{v.ok ? 'OK' : 'NG'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="settle">
              Penurunan pile: se1 {f2(r.info.se1)} + se2 {f2(r.info.se2)} + se3 {f2(r.info.se3)} =
              <b> {f2(r.checks.penurunan_pile.demand)} mm</b>
              <span className={`st ${r.checks.penurunan_pile.ok ? 'ok' : 'ng'}`}> {r.checks.penurunan_pile.ok ? 'OK <25mm' : 'NG ≥25mm'}</span>
            </p>
          </div>

          <div className="card sign-input">
            <h3>Tanda tangan laporan</h3>
            <label className="field"><span>Dihitung oleh (engineer)</span><input value={engineerName} onChange={(e) => setEngineerName(e.target.value)} placeholder="Nama engineer" /></label>
            <label className="field"><span>Diperiksa oleh (QC)</span><input value={qcName} onChange={(e) => setQcName(e.target.value)} placeholder="Nama QC" /></label>
          </div>
          <button className="print-btn" onClick={() => window.print()}>🖨️ Cetak / Simpan PDF (A4)</button>
        </aside>
      </div>

      <PipeReportSheet s={s} r={r} project={project} engineerName={engineerName} qcName={qcName} />
    </div>
  );
}

// Laporan A4 — disembunyikan di layar (.report-sheet display:none), tampil saat cetak.
function PipeReportSheet({ s, r, project, engineerName, qcName }) {
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  const ld = r.info.loads;
  const Mbeam = (ld.oper * n(s.L)) / 4;
  const pmGE = r.info.Pc ? r.info.Pr / r.info.Pc >= 0.2 : false;
  return (
    <div className="report-sheet">
      <FDDefs />
      <ReportCover title="Kalkulasi Pipe Support" project={project} engineer={engineerName} qc={qcName} />
      <ReportTOC items={[
        ['1. Umum', ['1.1 Kode & Standar', '1.2 Material & Penampang', '1.3 Kondisi Tanah & Kapasitas Pile']],
        ['2. Data Input', []],
        ['3. Gambar Sketsa', []],
        ['4. Kombinasi Beban', []],
        ['5. Data Struktur & Analisis Beban', ['5.1 Data Penampang & Member', 'Beban angin & gempa', 'Gaya dalam']],
        ['6. Cek Kapasitas & Kelayanan Struktur', ['Rasio interaksi (AISC)', 'Defleksi & displacement']],
        ['7. Kapasitas & Penurunan Pile', ['Kapasitas pile (tekan, tarik, lateral)', 'Penurunan pile']],
        ['8. Rekapitulasi Pengecekan', []],
      ]} />
      <ReportPaged header={
        <RunningHeader project={project} title="Kalkulasi Pipe Support"
          right={<span className={`rpt-verdict ${r.overall_ok ? 'ok' : 'ng'}`}>{r.overall_ok ? 'AMAN' : 'TIDAK AMAN'}</span>} />
      }>

      <section className="rpt-section">
        <h2>1. Umum</h2>
        <h3>1.1 Kode &amp; Standar</h3>
        <ItemsTable head={['Item', 'Deskripsi']} rows={[
          ['Model', 'Kantilever single-pile tersederhana (STAAD/FEA tetap acuan)'],
          ['Beban angin', 'ASCE 7-16/22 · SNI 1727:2020'],
          ['Beban gempa', 'SNI 1726:2019'],
          ['Struktur baja', 'AISC 360-16 (interaksi P-M, Bab H1)'],
          ['Penurunan pile', 'Braja M. Das (1988) — elastis'],
        ]} />
        <h3>1.2 Material &amp; Penampang</h3>
        <ItemsTable rows={[
          [<>Tegangan leleh baja f<sub>y</sub></>, `${f(s.fy)} MPa`],
          [<>Modulus elastisitas baja E</>, `${f(s.E, 0)} MPa`],
          [<>Ø luar / tebal pipa D<sub>o</sub> / t</>, `${f(s.Do)} / ${f(s.t)} mm`],
          [<>Modulus pile E<sub>p</sub></>, `${f(s.Ep, 0)} kN/m²`],
        ]} />
        <h3>1.3 Kondisi Tanah &amp; Kapasitas Pile</h3>
        <ItemsTable rows={[
          ['N-SPT', `${f(s.N, 0)}`],
          [<>Poisson tanah μ</>, `${f(s.mu)}`],
          [<>Kapasitas izin pile — tekan Q<sub>all</sub></>, `${f(s.Qall)} kN`],
          [<>Kapasitas izin pile — tarik T<sub>all</sub></>, `${f(s.Tall)} kN`],
          [<>Kapasitas izin pile — lateral H<sub>all</sub></>, `${f(s.Hall)} kN`],
          ['Batas penurunan pile', '25 mm'],
        ]} />
      </section>

      <section className="rpt-section">
        <h2>2. Data Input</h2>
        <div>
          <h3>Beban pipa</h3>
          <div className="rpt-kv">
            <div className="rpt-kv-item"><span>sumber beban</span><b>{r.info.trial ? 'Trial (dihitung dari span)' : 'Manual (dari divisi piping)'}</b></div>
            <div className="rpt-kv-item"><span>diameter pipa (in)</span><b>{s.Dpipe}</b></div>
            {r.info.trial && <div className="rpt-kv-item"><span>panjang span (m)</span><b>{s.span}</b></div>}
          </div>
        </div>
        {GROUPS.map(([title, fields]) => (
          <div key={title}>
            <h3>{title}</h3>
            <div className="rpt-kv">
              {fields.map(([k, l]) => <div key={k} className="rpt-kv-item"><span>{l}</span><b>{s[k]}</b></div>)}
            </div>
          </div>
        ))}
      </section>

      <section className="rpt-section">
        <h2>3. Gambar Sketsa</h2>
        <div className="rpt-sketch"><PipeSupportSketch s={s} /></div>
      </section>

      <section className="rpt-section">
        <h2>4. Kombinasi Beban</h2>
        {r.info.trial && (
          <p className="rpt-note2">
            Beban pipa dihitung <b>otomatis dari span {f(s.span)} m &amp; diameter {s.Dpipe}″</b>
            (berat {f(r.info.pl.row.empty)} / {f(r.info.pl.row.pw)} kg/m untuk kondisi kosong / penuh air,
            ref. <i>trial pipa.xlsx</i>): F<sub>y</sub> = (kg/m)·span·9.81/1000. Test = operasi (pipa penuh air);
            termal F<sub>x</sub> = max(7.5% ; 30%)·test, F<sub>z</sub> = 0.25·F<sub>x</sub>.
          </p>
        )}
        <h3>4.1 Resume Beban Pipa (Fy vertikal, termal lateral)</h3>
        <table className="rpt-table">
          <thead><tr><th>Kondisi</th><th>Kosong</th><th>Operasi</th><th>Test/Hydro</th><th>Termal Fx</th><th>Termal Fz</th></tr></thead>
          <tbody>
            <tr>
              <td>Beban (kN)</td>
              <td className="num">{f(ld.empty)}</td>
              <td className="num">{f(ld.oper)}</td>
              <td className="num">{f(ld.test)}</td>
              <td className="num">{f(ld.Tx)}</td>
              <td className="num">{f(ld.Tz)}</td>
            </tr>
          </tbody>
        </table>
        <h3>4.2 Definisi Beban</h3>
        <ItemsTable head={['Notasi', 'Deskripsi beban']} rows={[
          ['P(e)', `Beban kosong (pipa saja) = ${f(ld.empty)} kN`],
          ['P(o) / P(t)', `Beban operasi / test = ${f(ld.oper)} / ${f(ld.test)} kN`],
          ['T(x), T(z)', `Beban termal arah X / Z = ${f(ld.Tx)} / ${f(ld.Tz)} kN`],
          ['W', `Beban angin (V = ${f(s.V)} m/s, min ${f(s.Pmin)} kN/m²)`],
          ['E', `Beban gempa (SDS = ${f(s.SDS)} g, Cs·P + 0.14·SDS vertikal)`],
        ]} />
      </section>

      <section className="rpt-section">
        <h2>5. Data Struktur &amp; Analisis Beban</h2>
        <h3>5.1 Data Penampang &amp; Member</h3>
        <ItemsTable rows={[
          [<>Ø luar / tebal D<sub>o</sub> / t</>, `${f(s.Do)} / ${f(s.t)} mm`],
          [<>Luas penampang A</>, `${f(r.info.A, 0)} mm²`],
          [<>Momen inersia I</>, `${f(r.info.I, 0)} mm⁴`],
          [<>Modulus penampang Z</>, `${f(r.info.Z, 0)} mm³`],
          [<>Panjang kolom (H atas + kedalaman) H<sub>tot</sub></>, `${f(r.info.Htot)} m`],
          [<>Panjang beam L</>, `${f(s.L)} m`],
          [<>Pile — Ø / panjang</>, `${f(s.Dpile)} m / ${f(s.Lpile)} m`],
        ]} />

        <TheoryIntro title="Pemodelan pipe support & beban lateral" refs="ASCE 7-16 · SNI 1726/1727 · Braja M. Das">
          <p>
            Pipe support dimodelkan secara sederhana sebagai kolom kantilever tunggal yang memikul beban
            pipa (kondisi kosong/operasi/test) di puncak, dengan beam sebagai balok sederhana berbeban
            terpusat. Gaya lateral berasal dari angin (SNI 1727:2020/ASCE 7-16) dan gempa (SNI 1726:2019,
            koefisien seismik C<sub>s</sub>). Gaya-gaya ini menimbulkan gaya aksial, momen di dasar kolom,
            dan gaya geser yang diteruskan ke pile.
          </p>
          <p>
            Kapasitas penampang pipa baja diperiksa terhadap interaksi aksial–momen (AISC 360-16 Bab H1),
            kelayanan ditinjau dari defleksi beam dan displacement lateral kolom, sedangkan pile ditinjau
            terhadap kapasitas dukung/tarik dan penurunan (Braja M. Das). Model ini bersifat edukatif —
            STAAD/FEA tetap menjadi acuan desain sebenarnya.
          </p>
        </TheoryIntro>

        <DerivGroup title="Beban angin" refs="SNI 1727:2020 · ASCE 7-16">
          <Step desc="Tekanan kecepatan angin" refs="SNI 1727:2020 Pers. 26.10-1"
            expr={<>q<sub>h</sub> = 0.613·K<sub>z</sub>·K<sub>zt</sub>·K<sub>d</sub>·K<sub>e</sub>·V²</>}
            sub={<>0.613·{f(s.Kz)}·{f(s.Kzt)}·{f(s.Kd)}·{f(s.Ke)}·{f(s.V)}²</>} val={f(r.info.qh)} unit="N/m²" />
          <Step desc="Tekanan angin desain" refs="ASCE 7-16 Ps. 29.4"
            expr={<>P = q<sub>h</sub>·G·C<sub>f</sub></>}
            sub={<>{f(r.info.qh)}·{f(s.G)}·{f(s.Cf)} / 1000</>} val={f(r.info.Pwind)} unit="kN/m²" />
          <Step desc="Tekanan dipakai (≥ minimum)"
            expr={<>P<sub>use</sub> = max(P ; P<sub>min</sub>)</>}
            sub={<>max({f(r.info.Pwind)} ; {f(s.Pmin)})</>} val={f(r.info.Puse)} unit="kN/m²" />
          <Step desc="Gaya angin pada pipa" refs="ASCE 7-16 Pers. 29.4-1"
            expr={<>F<sub>w</sub> = P<sub>use</sub>·D<sub>pipa</sub>·L</>}
            sub={<>{f(r.info.Puse)}·{f(r.info.Dm, 3)}·{f(s.L)}</>} val={f(r.info.Fwind)} unit="kN" />
        </DerivGroup>

        <DerivGroup title="Beban gempa" refs="SNI 1726:2019">
          <Step desc="Koefisien respons seismik" refs="SNI 1726:2019 Ps. 7.8.1.1"
            expr={<>C<sub>s</sub> = S<sub>DS</sub>·I<sub>e</sub> / R</>}
            sub={<>{f(s.SDS, 3)}·{f(s.Ie)} / {f(s.R)}</>} val={f(r.info.Cs, 3)} />
          <Step desc="Batas bawah Cs" refs="SNI 1726:2019 Ps. 7.8.1.1"
            expr={<>C<sub>s,min</sub> = max(0.044·S<sub>DS</sub>·I<sub>e</sub> ; 0.01)</>}
            sub={<>max(0.044·{f(s.SDS, 3)}·{f(s.Ie)} ; 0.01)</>} val={f(r.info.CsMin, 3)} />
          <Step desc="Gaya gempa lateral"
            expr={<>F<sub>E</sub> = C<sub>s</sub>·P<sub>oper</sub></>}
            sub={<>{f(r.info.CsUse, 3)}·{f(ld.oper)}</>} val={f(r.info.Fseis)} unit="kN" />
        </DerivGroup>

        <DerivGroup title="Properti penampang pipa baja">
          <Step desc="Luas penampang" expr={<>A = <Frac n="π" d="4" />·(D<sub>o</sub>²−D<sub>i</sub>²)</>}
            sub={<>D<sub>i</sub> = {f(r.info.Di)} mm</>} val={f(r.info.A, 0)} unit="mm²" />
          <Step desc="Momen inersia" expr={<>I = <Frac n="π" d="64" />·(D<sub>o</sub>⁴−D<sub>i</sub>⁴)</>} val={f(r.info.I, 0)} unit="mm⁴" />
          <Step desc="Modulus penampang plastis" expr={<>Z = (D<sub>o</sub>³−D<sub>i</sub>³)/6</>} val={f(r.info.Z, 0)} unit="mm³" />
        </DerivGroup>

        <DerivGroup title="Gaya dalam (model kantilever)">
          <Step desc="Aksial maks (amplifikasi vertikal 1+0.14·SDS)"
            expr={<>P<sub>r</sub> = max(P<sub>oper</sub>·(1+0.14·S<sub>DS</sub>) ; P<sub>test</sub>)</>}
            sub={<>max({f(ld.oper)}·{f(r.info.seisAmp, 3)} ; {f(ld.test)})</>} val={f(r.info.Pr)} unit="kN" />
          <Step desc="Resultan gaya lateral (termal + angin)"
            expr={<>H = √((|T<sub>x</sub>|+F<sub>w</sub>)² + T<sub>z</sub>²)</>}
            sub={<>√(({f(Math.abs(ld.Tx))}+{f(r.info.Fwind)})² + {f(Math.abs(ld.Tz))}²)</>} val={f(r.info.Hlat)} unit="kN" />
          <Step desc="Momen dasar kolom" refs="statika kantilever"
            expr={<>M = H·H<sub>tot</sub></>} sub={<>{f(r.info.Hlat)}·{f(r.info.Htot)}</>} val={f(r.info.Mr)} unit="kNm" />
        </DerivGroup>

        <div className="fd-row">
          <ColumnForceDiagram Htot={r.info.Htot} H={r.info.Hlat} Mbase={r.info.Mr} N={r.info.Pr} />
        </div>
        <p className="rpt-note2">Kolom diidealkan sebagai kantilever (jepit di titik fixity) di bawah gaya lateral H; diagram STAAD/FEA tetap acuan.</p>
      </section>

      <section className="rpt-section">
        <h2>6. Cek Kapasitas &amp; Kelayanan Struktur</h2>

        <DerivGroup title="Rasio interaksi struktur" refs="AISC 360-16 Bab H1">
          <Step desc="Kapasitas aksial leleh" expr={<>P<sub>c</sub> = 0.9·f<sub>y</sub>·A</>}
            sub={<>0.9·{f(s.fy)}·{f(r.info.A, 0)} / 1000</>} val={f(r.info.Pc)} unit="kN" />
          <Step desc="Kapasitas momen" expr={<>M<sub>c</sub> = 0.9·f<sub>y</sub>·Z</>} val={f(r.info.Mc)} unit="kNm" />
          <Step desc={pmGE ? 'Interaksi P-M (Pr/Pc ≥ 0.2)' : 'Interaksi P-M (Pr/Pc < 0.2)'} refs={pmGE ? 'AISC 360-16 Pers. H1-1a' : 'AISC 360-16 Pers. H1-1b'}
            expr={pmGE
              ? <><Frac n="Pᵣ" d="Pᴄ" /> + <Frac n="8" d="9" />·<Frac n="M" d="Mᴄ" /> ≤ 1</>
              : <><Frac n="Pᵣ" d="2Pᴄ" /> + <Frac n="M" d="Mᴄ" /> ≤ 1</>}
            val={f(r.info.ratioPM, 3)} ok={r.checks.struktur.ok} />
        </DerivGroup>

        <DerivGroup title="Defleksi & displacement (kelayanan)">
          <Step desc="Defleksi vertikal beam (P di tengah, balok sederhana)" refs="izin L/240"
            expr={<>δ<sub>v</sub> = <Frac n="P·L³" d="48·E·I" /></>} val={f(r.info.dv)} unit="mm"
            ok={r.checks.defleksi_vertikal.ok} note={`izin L/240 = ${f(r.info.dvAll)} mm`} />
          <Step desc="Displacement lateral — angin (kantilever)" refs="PIP STC0105 (H/200)"
            expr={<>δ<sub>w</sub> = <Frac n="F·H³" d="3·E·I" /></>} val={f(r.info.dhWind)} unit="mm"
            ok={r.checks.displ_angin.ok} note={`izin H/200 = ${f(r.info.dhWindAll)} mm`} />
          <Step desc="Displacement lateral — gempa (×Cd/Ie)" refs="ASCE 7 Risk III (0.015H)"
            expr={<>δ<sub>E</sub> = <Frac n="F·H³" d="3·E·I" />·<Frac n="Cᴅ" d="Iₑ" /></>} val={f(r.info.dhSeis)} unit="mm"
            ok={r.checks.displ_gempa.ok} note={`izin 0.015·H = ${f(r.info.dhSeisAll)} mm`} />
        </DerivGroup>

        <div className="fd-row">
          <BeamForceDiagram L={n(s.L)} P={ld.oper} Mmax={Mbeam} />
        </div>
        <p className="rpt-note2">Beam = balok sederhana dengan beban pipa terpusat di tengah (defleksi δ<sub>v</sub> = P·L³/48EI).</p>
      </section>

      <section className="rpt-section">
        <h2>7. Kapasitas &amp; Penurunan Pile</h2>

        <DerivGroup title="Kapasitas daya dukung pile (tekan, tarik, lateral)" refs="single-pile · kapasitas izin dari data pile">
          <Step desc="Tekan aksial — gaya aksial maksimum vs kapasitas izin"
            expr={<>Q<sub>max</sub> = P<sub>r</sub> ≤ Q<sub>all</sub></>}
            sub={<>{f(r.info.Pr)} / {f(s.Qall)} → rasio {f(r.checks.tekan_pile.rasio, 3)}</>}
            val={f(r.info.Pr)} unit="kN" ok={r.checks.tekan_pile.ok} />
          <Step desc="Tarik — vertikal teringan (pipa kosong); uplift bila negatif"
            expr={<>T<sub>max</sub> = min(P<sub>kosong</sub>, P<sub>oper</sub>, P<sub>test</sub>) ; |T| ≤ T<sub>all</sub></>}
            sub={r.info.noTension
              ? <>T<sub>max</sub> = {f(r.info.Tmax)} kN &gt; 0 → tanpa tarik (tekan)</>
              : <>{f(-r.info.Tmax)} / {f(s.Tall)} → rasio {f(r.checks.tarik_pile.rasio, 3)}</>}
            ok={r.checks.tarik_pile.ok} />
          <Step desc="Lateral — resultan gaya lateral (termal + angin) vs kapasitas izin" refs="H = √((|Tx|+Fw)² + Tz²)"
            expr={<>H<sub>max</sub> = √((|T<sub>x</sub>|+F<sub>w</sub>)² + T<sub>z</sub>²) ≤ H<sub>all</sub></>}
            sub={<>{f(r.info.Hmax)} / {f(s.Hall)} → rasio {f(r.checks.lateral_pile.rasio, 3)}</>}
            val={f(r.info.Hmax)} unit="kN" ok={r.checks.lateral_pile.ok} />
        </DerivGroup>

        <DerivGroup title="Penurunan pile (elastis)" refs="Braja M. Das (1988)">
          <Step desc="Penurunan batang pile" expr={<>s<sub>e1</sub> = (Q<sub>wp</sub>+ξ·Q<sub>ws</sub>)·L<sub>p</sub> / (A<sub>p</sub>·E<sub>p</sub>)</>} val={f(r.info.se1)} unit="mm" />
          <Step desc="Penurunan ujung pile" expr={<>s<sub>e2</sub> = (Q<sub>wp</sub>/A<sub>p</sub>)·(D/E<sub>s</sub>)·(1−μ²)·I<sub>wp</sub></>} val={f(r.info.se2)} unit="mm" />
          <Step desc="Penurunan selimut pile" expr={<>s<sub>e3</sub> = (Q<sub>ws</sub>/(p·L<sub>p</sub>))·(D/E<sub>s</sub>)·(1−μ²)·I<sub>ws</sub></>} val={f(r.info.se3)} unit="mm" />
          <Step desc="Penurunan total" expr={<>s<sub>e</sub> = s<sub>e1</sub>+s<sub>e2</sub>+s<sub>e3</sub></>}
            sub={<>{f(r.info.se1)}+{f(r.info.se2)}+{f(r.info.se3)}</>} val={f(r.info.se)} unit="mm" ok={r.checks.penurunan_pile.ok} note="batas 25 mm" />
        </DerivGroup>
      </section>

      <section className="rpt-section">
        <h2>8. Rekapitulasi Pengecekan</h2>
        <p className="rpt-terz">
          Beban angin: q<sub>h</sub> = {f2(r.info.qh)} N/m² · P<sub>use</sub> = {f2(r.info.Puse)} kN/m² · F<sub>angin</sub> = {f2(r.info.Fwind)} kN
        </p>
        <p className="rpt-terz">
          Beban gempa: Cs = {f2(r.info.CsUse)} · F<sub>gempa</sub> = {f2(r.info.Fseis)} kN · Q<sub>max</sub> = {f2(r.info.Pr)} kN · M<sub>kolom</sub> = {f2(r.info.Mr)} kNm
        </p>
        <table className="rpt-table rpt-checks">
          <thead><tr><th>Pengecekan</th><th>Demand</th><th>Kapasitas</th><th>Rasio</th><th>Status</th></tr></thead>
          <tbody>
            {Object.entries(r.checks).map(([k, v]) => (
              <tr key={k}>
                <td>{LABELS[k]}</td>
                <td className="num">{k === 'tarik_pile' && v.noTension ? '0 (tanpa tarik)' : f2(v.demand)}</td>
                <td className="num">{f2(v.kapasitas)}</td>
                <td className="num">{f2(v.rasio)}</td>
                <td className={`st ${v.ok ? 'ok' : 'ng'}`}>{v.ok ? 'OK' : 'NG'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rpt-settle">
          Penurunan pile (Braja Das): se1 {f2(r.info.se1)} + se2 {f2(r.info.se2)} + se3 {f2(r.info.se3)} =
          <b> {f2(r.checks.penurunan_pile.demand)} mm</b> —
          <span className={`st ${r.checks.penurunan_pile.ok ? 'ok' : 'ng'}`}> {r.checks.penurunan_pile.ok ? 'OK (< 25 mm)' : 'NG (≥ 25 mm)'}</span>
        </p>
        <p className="rpt-concl">
          Kesimpulan: <b>{r.overall_ok ? 'Pipe support dinyatakan AMAN' : 'Pipe support TIDAK AMAN'}</b> terhadap rasio struktur, defleksi, displacement, serta kapasitas &amp; penurunan pile (model tersederhana).
        </p>
      </section>

      <footer className="rpt-foot">
        <p className="rpt-disc">
          ⚠️ Model kantilever single-pile tersederhana — hasil STAAD/FEA tetap acuan dan <b>wajib diverifikasi insinyur sipil berlisensi</b> sebelum konstruksi.
        </p>
        <div className="rpt-sign">
          <div>
            <span>Dihitung oleh</span><div className="rpt-line" />
            <div className="rpt-name">{engineerName ? `( ${engineerName} )` : ' '}</div><div className="rpt-role">Engineer</div>
          </div>
          <div>
            <span>Diperiksa oleh</span><div className="rpt-line" />
            <div className="rpt-name">{qcName ? `( ${qcName} )` : ' '}</div><div className="rpt-role">QC</div>
          </div>
        </div>
      </footer>
      </ReportPaged>
    </div>
  );
}
