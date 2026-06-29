// CalculatorForm.jsx — form lengkap kalkulator pondasi dangkal.
// Mengirim POST /calculate ke backend FastAPI dan menampilkan hasil + sketsa.

import { useState } from 'react';
import FoundationSketch from './FoundationSketch.jsx';
import DesignPanel from './DesignPanel.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const defaultFoundation = {
  n_pedestal: 1, alphas: 20, fc: 28, fy: 420,
  B: 1500, L: 1500, h: 300, Df: 500,
  c1: 400, c2: 400, Hp: 700, cover: 75,
  db: 13, srl: 150, gc: 24, mu_fric: 0.5, SF_bc: 3.0,
};
const defaultSoil = {
  phi: 30, c: 0, gs: 18, gw: 9.81,
  xi_c: 1.30, xi_q: 1.30, xi_g: 0.69,
  Es: 12000, mu: 0.30, e0: 0.50, Cc: 0.12, Cs: 0.0116,
  Po: 9314.6, dP: 466.1, h1: 1.5, h2: 3.0,
  I1: 0.363, I2: 0.048, If: 0.53,
};
const defaultLCs = [
  { nama: 'LC123', FY: 60.49, FX: -7.88, FZ: -5.32, MX: -14.23, MZ: 20.87 },
  { nama: 'LC121', FY: 56.64, FX: -6.78, FZ: -5.65, MX: -15.16, MZ: 18.31 },
  { nama: 'LC105', FY: 37.08, FX: 0, FZ: 0.85, MX: 2.20, MZ: 0 },
  { nama: 'LC114', FY: 22.25, FX: -0.12, FZ: 0, MX: 0, MZ: 0.22 },
];

const DIMENSI = [
  ['B', 'Bf — lebar footing'], ['L', 'Lf — panjang footing'],
  ['h', 'Hf — tebal footing'], ['Df', 'Df — kedalaman'],
  ['c1', 'Lp — panjang pedestal'], ['c2', 'Bp — lebar pedestal'],
  ['Hp', 'tinggi pedestal'], ['cover', 'selimut beton'],
  ['db', 'Ø tulangan'], ['srl', 'spasi tulangan'],
];
const MATERIAL = [
  ['fc', "f'c (MPa)"], ['fy', 'fy (MPa)'], ['gc', 'γ beton (kN/m³)'],
  ['n_pedestal', 'jumlah pedestal'], ['alphas', 'αs (20/30/40)'],
  ['mu_fric', 'koef. gesek dasar'], ['SF_bc', 'SF daya dukung'],
];
const SOIL = [
  ['phi', 'φ sudut geser (°)'], ['c', 'c kohesi (kPa)'],
  ['gs', 'γ tanah (kN/m³)'], ['gw', 'γ air (kN/m³)'],
  ['xi_c', 'ξc bentuk'], ['xi_q', 'ξq bentuk'], ['xi_g', 'ξγ bentuk'],
  ['Es', 'Es (kPa)'], ['mu', 'μ poisson'], ['e0', 'e0 angka pori'],
  ['Cc', 'Cc kompresi'], ['Cs', 'Cs swelling'],
  ['Po', 'Po (kg/m²)'], ['dP', 'Δσ (kg/m²)'],
  ['h1', 'h1 (m)'], ['h2', 'h2 (m)'],
  ['I1', 'I1 Steinbrenner'], ['I2', 'I2 Steinbrenner'], ['If', 'If kedalaman'],
];

const LABELS = {
  daya_dukung: 'Daya dukung tanah', geser_1arah: 'Geser satu arah',
  geser_2arah: 'Geser dua arah (pons)', lentur: 'Lentur',
  tulangan_min: 'Tulangan minimum', stab_geser: 'Stabilitas geser',
  guling: 'Guling', uplift: 'Gaya angkat',
};
const LC_COLS = ['nama', 'FY', 'FX', 'FZ', 'MX', 'MZ'];

function Field({ k, label, value, onChange, ...rest }) {
  return (
    <label className="field" title={label}>
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(k, e.target.value)} {...rest} />
    </label>
  );
}

export default function CalculatorForm({ userId }) {
  const [fd, setFd] = useState(defaultFoundation);
  const [soil, setSoil] = useState(defaultSoil);
  const [lcs, setLcs] = useState(defaultLCs);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const upd = (setter) => (k, v) => setter((s) => ({ ...s, [k]: v }));
  const updFd = upd(setFd);
  const updSoil = upd(setSoil);

  const updLc = (i, k, v) => setLcs((arr) => arr.map((lc, idx) => (idx === i ? { ...lc, [k]: v } : lc)));
  const addLc = () => setLcs((arr) => [...arr, { nama: `LC${arr.length + 1}`, FY: 0, FX: 0, FZ: 0, MX: 0, MZ: 0 }]);
  const delLc = (i) => setLcs((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const numObj = (o) =>
        Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? 0 : Number(v)]));
      const payload = {
        foundation: { ...numObj(fd), n_pedestal: parseInt(fd.n_pedestal, 10) || 1 },
        soil: numObj(soil),
        load_cases: lcs.map((lc) => ({
          nama: String(lc.nama || ''),
          FY: Number(lc.FY) || 0, FX: Number(lc.FX) || 0, FZ: Number(lc.FZ) || 0,
          MX: Number(lc.MX) || 0, MZ: Number(lc.MZ) || 0,
        })),
      };
      const res = await fetch(`${API}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j.detail) msg += ` — ${typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)}`;
        } catch { /* body bukan JSON */ }
        throw new Error(msg);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function loadDesign(d) {
    if (d.foundation) setFd(d.foundation);
    if (d.soil) setSoil(d.soil);
    if (d.load_cases) setLcs(d.load_cases);
    setResult(d.result || null);
    setError(null);
  }

  return (
    <div className="app">
      <header className="head">
        <h1>Kalkulasi Pondasi Dangkal</h1>
        <p className="sub">Telapak (footing) · SNI 2847:2019 · Terzaghi-Krizek · Steinbrenner</p>
        <p className="warn">⚠️ Diprakarsai oleh Bagas, Aldhico, Aji, Faizi - Dept. Civil.</p>
      </header>

      <div className="layout">
        <section className="inputs">
          <fieldset className="group">
            <legend>Dimensi pondasi (mm)</legend>
            <div className="fields">
              {DIMENSI.map(([k, l]) => (
                <Field key={k} k={k} label={l} value={fd[k]} onChange={updFd} type="number" step="any" />
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Material &amp; faktor</legend>
            <div className="fields">
              {MATERIAL.map(([k, l]) => (
                <Field
                  key={k} k={k} label={l} value={fd[k]} onChange={updFd} type="number"
                  step={k === 'n_pedestal' ? '1' : 'any'}
                  min={k === 'n_pedestal' ? 1 : undefined}
                  max={k === 'n_pedestal' ? 2 : undefined}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Parameter tanah</legend>
            <div className="fields">
              {SOIL.map(([k, l]) => (
                <Field key={k} k={k} label={l} value={soil[k]} onChange={updSoil} type="number" step="any" />
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Load case — reaksi tumpuan ASD (kN, kNm)</legend>
            <div className="lc-wrap">
              <table className="lc">
                <thead>
                  <tr><th>Nama</th><th>FY</th><th>FX</th><th>FZ</th><th>MX</th><th>MZ</th><th></th></tr>
                </thead>
                <tbody>
                  {lcs.map((lc, i) => (
                    <tr key={i}>
                      {LC_COLS.map((c) => (
                        <td key={c}>
                          <input
                            value={lc[c]}
                            onChange={(e) => updLc(i, c, e.target.value)}
                            type={c === 'nama' ? 'text' : 'number'}
                            step="any"
                          />
                        </td>
                      ))}
                      <td>
                        <button className="del" onClick={() => delLc(i)} disabled={lcs.length <= 1} title="hapus baris">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="add" onClick={addLc}>+ tambah load case</button>
          </fieldset>
        </section>

        <aside className="side">
          <div className="card">
            <FoundationSketch fd={fd} />
          </div>

          <button className="calc" onClick={compute} disabled={loading}>
            {loading ? 'Menghitung…' : 'Hitung & cek keamanan'}
          </button>

          {error && <p className="err">Error: {error}</p>}

          {result && (
            <div className="card result">
              <div className={`verdict ${result.overall_ok ? 'ok' : 'ng'}`}>
                {result.overall_ok ? 'AMAN' : 'TIDAK AMAN'}
              </div>
              <p className="terz">
                q<sub>all</sub> = {result.terzaghi.qall.toFixed(2)} kPa · q<sub>u</sub> = {result.terzaghi.qu.toFixed(2)} kPa
                · Nc/Nq/Nγ = {result.terzaghi.Nc.toFixed(1)}/{result.terzaghi.Nq.toFixed(1)}/{result.terzaghi.Ng.toFixed(1)}
              </p>
              <table className="res">
                <thead>
                  <tr><th>Pengecekan</th><th>Demand</th><th>Kapasitas</th><th>Rasio</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {Object.entries(result.checks).map(([k, v]) => (
                    <tr key={k}>
                      <td>{LABELS[k] || k}{v.lc ? <span className="lc-tag"> · {v.lc}</span> : null}</td>
                      <td className="num">{v.demand.toFixed(2)}</td>
                      <td className="num">{v.kapasitas.toFixed(2)}</td>
                      <td className="num">{v.rasio.toFixed(2)}</td>
                      <td className={`st ${v.ok ? 'ok' : 'ng'}`}>{v.ok ? 'OK' : 'NG'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="settle">
                Settlement: Si {result.settlement.Si.toFixed(2)} + Sc1 {result.settlement.Sc1.toFixed(2)} + Sc2 {result.settlement.Sc2.toFixed(2)} =
                <b> {result.settlement.Stot.toFixed(2)} mm</b>
                <span className={`st ${result.settlement.ok ? 'ok' : 'ng'}`}> {result.settlement.ok ? 'OK <25mm' : 'NG ≥25mm'}</span>
              </p>
            </div>
          )}
          <DesignPanel userId={userId} fd={fd} soil={soil} lcs={lcs} result={result} onLoad={loadDesign} />
        </aside>
      </div>
    </div>
  );
}
