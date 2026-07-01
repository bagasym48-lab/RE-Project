// PipeSupportForm.jsx — kalkulasi Pipe Support (single-pile cantilever).
// Rumus & parameter mengacu dokumen FEED DURI-RDNL05GS40N-CIV-CAL-PHR-2001-00:
//  • Angin  : qh = 0.613·Kz·Kzt·Kd·Ke·V² ; P = qh·G·Cf (ASCE 7-16/22)
//  • Gempa  : Cs = SDS·Ie/R ; Cs,min = max(0.044·SDS·Ie ; 0.01) (SNI 1726:2019)
//  • Pile   : Qmax/Qall (tekan), Tmax/Tall (tarik), Hmax=√(Hx²+Hz²)
//  • Penurunan pile (elastis, Braja M. Das): se = se1 + se2 + se3 < 25 mm
// CATATAN: hasil STAAD (rasio baja, defleksi, displacement) di dokumen berasal dari
// FEA. Di sini dipakai model kantilever single-pile tersederhana — ALAT BANTU EDUKASI,
// wajib diverifikasi insinyur sipil berlisensi / analisis STAAD.
import { useState } from 'react';
import { LogoMark } from './Logo.jsx';

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const PI = Math.PI;

const def = {
  // Geometri
  H_above: 0.50,   // tinggi di atas tanah (m)
  depth: 2.51,     // kedalaman ke titik fixity di bawah tanah (m)
  L: 6.30,         // panjang beam / bentang pipa (m)
  Dpipe: 20,       // diameter pipa (in)
  // Beban pipa vertikal (kN) di pile
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

  // --- Angin ---
  const qh = 0.613 * g('Kz') * g('Kzt') * g('Kd') * g('Ke') * g('V') ** 2; // N/m²
  const Pwind = (qh * g('G') * g('Cf')) / 1000;        // kN/m²
  const Puse = Math.max(Pwind, g('Pmin'));             // kN/m²
  const Fwind = Puse * Dm * g('L');                    // gaya angin pada pipa (kN)

  // --- Gempa ---
  const Cs = (g('SDS') * g('Ie')) / g('R');
  const CsMin = Math.max(0.044 * g('SDS') * g('Ie'), 0.01);
  const CsUse = Math.max(Cs, CsMin);
  const Fseis = CsUse * g('P_oper');                   // gaya gempa lateral (kN)

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
  const Pr = Math.max(g('P_oper') * seisAmp, g('P_test')); // aksial maks (kN) ≈ Qmax
  const Hlat = Math.sqrt((Math.abs(g('Tx')) + Fwind) ** 2 + Math.abs(g('Tz')) ** 2); // resultan lateral (kN)
  const Mr = Hlat * Htot;                             // momen dasar kolom (kNm)

  // --- Rasio struktur (AISC H1, disederhanakan) ---
  const Pc = 0.9 * g('fy') * A / 1000;                // kN (leleh, KL/r kecil)
  const Mc = 0.9 * g('fy') * Z / 1e6;                 // kNm
  const ratioPM = Pr / Pc >= 0.2
    ? Pr / Pc + (8 / 9) * (Mr / Mc)
    : Pr / (2 * Pc) + Mr / Mc;

  // --- Defleksi vertikal beam (beban pipa terpusat di tengah) ---
  const Lmm = g('L') * 1000;
  const dv = (g('P_oper') * 1000) * Lmm ** 3 / (48 * EI); // mm
  const dvAll = Lmm / 200;                                // L/200 (mm)

  // --- Displacement horizontal kolom (kantilever, F·H³/3EI) ---
  const Hmm = Htot * 1000;
  const dhWind = (Fwind * 1000) * Hmm ** 3 / (3 * EI);   // mm
  const dhWindAll = Hmm / 200;                            // H/200 (PIP STC0105)
  const dhSeis = (Fseis * 1000) * Hmm ** 3 / (3 * EI) * (g('Cd') / g('Ie')); // mm (×Cd/Ie)
  const dhSeisAll = 0.015 * Hmm;                          // 0.015H (ASCE Risk III)

  // --- Pile: tekan, tarik, lateral ---
  const Qmax = Pr;
  const Tmax = Math.min(g('P_oper'), g('P_test'), g('P_oper') * 0.5); // single pile → biasanya tekan
  const noTension = Tmax >= 0;
  const Hmax = Math.sqrt((Math.abs(g('Tx')) + Fwind) ** 2 + Math.abs(g('Tz')) ** 2);

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
    penurunan_pile: { demand: se, kapasitas: 25, rasio: se / 25, ok: se < 25 },
  };
  const overall_ok = Object.values(checks).every((c) => c.ok);

  return {
    info: { Htot, qh, Pwind, Puse, Fwind, Cs, CsUse, Fseis, A, I, Z, Pr, Mr, Hmax,
            se1, se2, se3, Es, Iws, Qws, Qwp },
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

const GROUPS = [
  ['Geometri', [
    ['H_above', 'tinggi di atas tanah (m)'], ['depth', 'kedalaman pipe di bawah tanah (m)'],
    ['L', 'panjang beam (m)'], ['Dpipe', 'diameter pipe (in)'],
  ]],
  ['Beban pipa & termal (kN)', [
    ['P_oper', 'beban operation (Fy)'], ['P_test', 'beban hydrotest (Fy)'],
    ['Tx', 'thermal arah X'], ['Tz', 'thermal arah Z'],
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
  ]],
  ['Tanah & penurunan', [
    ['N', 'N-SPT'], ['mu', 'poisson μ'], ['Iwp', 'faktor Iwp'], ['xi', 'magnitude ξ'],
  ]],
];

export default function PipeSupportForm() {
  const [s, setS] = useState(def);
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
          {GROUPS.map(([title, fields]) => (
            <fieldset className="group" key={title}>
              <legend>{title}</legend>
              <div className="fields">
                {fields.map(([k, l]) => <Field key={k} k={k} label={l} value={s[k]} onChange={upd} />)}
              </div>
            </fieldset>
          ))}
        </section>

        <aside className="side">
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

      <PipeReportSheet s={s} r={r} engineerName={engineerName} qcName={qcName} />
    </div>
  );
}

// Laporan A4 — disembunyikan di layar (.report-sheet display:none), tampil saat cetak.
function PipeReportSheet({ s, r, engineerName, qcName }) {
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  return (
    <div className="report-sheet">
      <header className="rpt-head">
        <div className="rpt-brand">
          <LogoMark size={48} />
          <div>
            <h1>Laporan Kalkulasi Pipe Support</h1>
            <p>Single-pile cantilever · ASCE 7-16/22 · SNI 1726:2019 · Braja M. Das</p>
            <p className="rpt-date">Tanggal cetak: {today}</p>
          </div>
        </div>
        <div className={`rpt-verdict ${r.overall_ok ? 'ok' : 'ng'}`}>{r.overall_ok ? 'AMAN' : 'TIDAK AMAN'}</div>
      </header>

      <section className="rpt-section">
        <h2>1. Data input</h2>
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
        <h2>2. Hasil analisis</h2>
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
    </div>
  );
}
