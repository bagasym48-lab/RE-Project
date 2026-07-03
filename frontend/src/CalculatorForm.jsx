// CalculatorForm.jsx — form lengkap kalkulator pondasi dangkal.
// Mengirim POST /calculate ke backend FastAPI dan menampilkan hasil + sketsa.

import { useState, useEffect } from 'react';
import FoundationSketch from './FoundationSketch.jsx';
import DesignPanel from './DesignPanel.jsx';
import { LogoMark } from './Logo.jsx';
import { Step, DerivGroup, Frac, FDDefs, SoilPressureDiagram, CantileverForceDiagram, f, ProjectInfoForm, ReportCover, defProject } from './reportKit.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const defaultFoundation = {
  n_pedestal: 1, alphas: 20, fc: 28, fy: 420,
  B: 1500, L: 1500, h: 300, Df: 500,
  c1: 400, c2: 400, Hp: 700, s_ped: 700, cover: 75,
  db: 13, srl: 150, gc: 24, mu_fric: 0.5, SF_bc: 3.0,
};
const defaultSoil = {
  phi: 30, c: 0, gs: 18, gw: 9.81,
  xi_g: 0.69,
  Es: 12000, mu: 0.30, e0: 0.50, Cc: 0.12,
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
  ['Hp', 'tinggi pedestal'], ['s_ped', 'jarak antar pedestal (jika 2)'],
  ['cover', 'selimut beton'],
  ['db', 'Ø tulangan'], ['srl', 'spasi tulangan'],
];
const MATERIAL = [
  ['fc', "f'c (MPa)"], ['fy', 'fy (MPa)'], ['gc', 'γ beton (kN/m³)'],
  ['n_pedestal', 'jumlah pedestal'], ['alphas', 'αs (20/30/40)'],
  ['mu_fric', 'koef. gesek dasar'], ['SF_bc', 'SF daya dukung'],
];
// Catatan: ξc, ξq, dan Cs TIDAK diinput — dihitung otomatis di backend
// (ξc/ξq = 1 + 0.3·B/L; Cs = Cc/10). Mengurangi input & kesalahan teori.
const SOIL = [
  ['phi', 'φ sudut geser (°)'], ['c', 'c kohesi (kPa)'],
  ['gs', 'γ tanah (kN/m³)'], ['gw', 'γ air (kN/m³)'],
  ['xi_g', 'ξγ bentuk'],
  ['Es', 'Es (kPa)'], ['mu', 'μ poisson'], ['e0', 'e0 angka pori'],
  ['Cc', 'Cc kompresi'],
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

export default function CalculatorForm({ userId, profile, userEmail, fd: fdProp, setFd: setFdProp, project: projectProp, setProject: setProjectProp }) {
  // Dimensi bisa "diangkat" ke induk (CivilView) agar tersinkron dengan MTO Pondasi
  // Dangkal; fallback ke state lokal bila dipakai berdiri sendiri.
  const [fdLocal, setFdLocal] = useState(defaultFoundation);
  const fd = fdProp ?? fdLocal;
  const setFd = setFdProp ?? setFdLocal;
  const [projLocal, setProjLocal] = useState(defProject);
  const project = projectProp ?? projLocal;
  const setProject = setProjectProp ?? setProjLocal;
  const updProject = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const [soil, setSoil] = useState(defaultSoil);
  const [lcs, setLcs] = useState(defaultLCs);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Nama untuk kolom tanda tangan laporan. "Dihitung oleh" otomatis terisi nama
  // user yang login (boleh diubah); "Diperiksa oleh" (QC) diisi manual.
  const [engineerName, setEngineerName] = useState('');
  const [qcName, setQcName] = useState('');
  useEffect(() => {
    const nm = profile?.nama || userEmail;
    if (nm) setEngineerName((cur) => cur || nm);
  }, [profile, userEmail]);

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
          <ProjectInfoForm project={project} onChange={updProject} />
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
              {result.terzaghi.xi_c != null && (
                <p className="terz">
                  ξc/ξq/ξγ = {result.terzaghi.xi_c.toFixed(2)}/{result.terzaghi.xi_q.toFixed(2)}/{result.terzaghi.xi_g.toFixed(2)}
                  <span className="lc-tag"> · ξc, ξq otomatis dari B/L</span>
                </p>
              )}
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
          {result && (
            <div className="card sign-input">
              <h3>Tanda tangan laporan</h3>
              <label className="field">
                <span>Dihitung oleh (engineer)</span>
                <input value={engineerName} onChange={(e) => setEngineerName(e.target.value)} placeholder="Nama engineer" />
              </label>
              <label className="field">
                <span>Diperiksa oleh (QC)</span>
                <input value={qcName} onChange={(e) => setQcName(e.target.value)} placeholder="Nama QC" />
              </label>
            </div>
          )}
          {result && (
            <button className="print-btn" onClick={() => window.print()}>
              🖨️ Cetak / Simpan PDF (A4)
            </button>
          )}
          <DesignPanel userId={userId} fd={fd} soil={soil} lcs={lcs} result={result} onLoad={loadDesign} />
        </aside>
      </div>

      {result && <ReportSheet fd={fd} soil={soil} lcs={lcs} result={result} project={project} engineerName={engineerName} qcName={qcName} />}
    </div>
  );
}

// ReportSheet — laporan A4 untuk dicetak/disimpan PDF. Disembunyikan di layar
// (display:none), hanya tampil di @media print. Lihat .report-sheet di index.css.
function ReportSheet({ fd, soil, lcs, result, project, engineerName, qcName }) {
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  // Nilai turunan untuk substitusi rumus (geometri saja; hasil fisika dari backend).
  const nz = (v) => (Number.isFinite(+v) ? +v : 0);
  const B = nz(fd.B), L = nz(fd.L), h = nz(fd.h), Df = nz(fd.Df);
  const tz = result.terzaghi, ck = result.checks, inf = result.info, se = result.settlement;
  const Af = (B / 1000) * (L / 1000);
  const Sx = (B / 1000) * (L / 1000) ** 2 / 6;
  const Sz = (L / 1000) * (B / 1000) ** 2 / 6;
  const qSur = (nz(soil.gs) - nz(soil.gw)) * (Df / 1000);
  const Ag = 1000 * h;
  const AsMin = Math.max((0.0018 * 420) / nz(fd.fy), 0.0014) * Ag;
  const nped = Math.max(1, parseInt(fd.n_pedestal, 10) || 1);
  const xOff = nped >= 2 ? nz(fd.s_ped) / 2 : 0;
  const Lll = Math.max(0.5 * B - xOff, 0);         // kantilever lentur (mm)
  const aCant = Lll / 1000;                          // m
  const govBC = lcs.find((l) => String(l.nama) === String(ck.daya_dukung.lc)) || {};
  const sMax = ck.daya_dukung.demand;
  const sMin = nz(govBC.FY) / Af - Math.abs(nz(govBC.MX)) / Sx - Math.abs(nz(govBC.MZ)) / Sz;
  const govSh = lcs.find((l) => String(l.nama) === String(ck.stab_geser.lc)) || {};
  const govOv = lcs.find((l) => String(l.nama) === String(ck.guling.lc)) || {};
  const kv = (rows, src) => (
    <div className="rpt-kv">
      {rows.map(([k, l]) => (
        <div key={k} className="rpt-kv-item"><span>{l}</span><b>{src[k]}</b></div>
      ))}
    </div>
  );
  return (
    <div className="report-sheet">
      <FDDefs />
      <ReportCover title="Kalkulasi Pondasi Dangkal" project={project} engineer={engineerName} qc={qcName} />
      <header className="rpt-head">
        <div className="rpt-brand">
          <LogoMark size={48} />
          <div>
            <h1>Laporan Kalkulasi Pondasi Dangkal</h1>
            <p>Telapak (footing) · SNI 2847:2019 · Terzaghi–Krizek · Steinbrenner</p>
            <p className="rpt-date">Tanggal cetak: {today}</p>
          </div>
        </div>
        <div className={`rpt-verdict ${result.overall_ok ? 'ok' : 'ng'}`}>
          {result.overall_ok ? 'AMAN' : 'TIDAK AMAN'}
        </div>
      </header>

      <section className="rpt-section">
        <h2>1. Data input</h2>
        <h3>1.1 Dimensi pondasi (mm)</h3>
        {kv(DIMENSI, fd)}
        <h3>1.2 Material &amp; faktor</h3>
        {kv(MATERIAL, fd)}
        <h3>1.3 Parameter tanah</h3>
        {kv(SOIL, soil)}
        <h3>1.4 Load case — reaksi tumpuan ASD (kN, kNm)</h3>
        <table className="rpt-table">
          <thead>
            <tr><th>Nama</th><th>FY</th><th>FX</th><th>FZ</th><th>MX</th><th>MZ</th></tr>
          </thead>
          <tbody>
            {lcs.map((lc, i) => (
              <tr key={i}>
                <td>{lc.nama}</td>
                <td className="num">{lc.FY}</td><td className="num">{lc.FX}</td><td className="num">{lc.FZ}</td>
                <td className="num">{lc.MX}</td><td className="num">{lc.MZ}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rpt-section">
        <h2>2. Sketsa pondasi</h2>
        <div className="rpt-sketch"><FoundationSketch fd={fd} /></div>
        {Number(fd.n_pedestal) >= 2 && (
          <p className="rpt-note2">
            Catatan 2 pedestal (jarak antar pusat {fd.s_ped} mm): beban diasumsikan terbagi rata 50/50.
            Cek geser pons, geser 1-arah, lentur, dan uplift dihitung per pedestal/posisinya; daya dukung,
            sliding, guling, dan tulangan minimum tetap berbasis beban total. Momen hogging combined footing
            di antara pedestal (tulangan atas) belum dicakup — wajib dicek terpisah oleh engineer.
          </p>
        )}
      </section>

      <section className="rpt-section">
        <h2>3. Rincian perhitungan</h2>

        <DerivGroup title="A. Daya dukung Terzaghi" refs="Terzaghi (1943) · faktor Krizek (1965)">
          <Step desc="Faktor kapasitas dukung (fungsi ϕ)" refs="Krizek (1965)"
            expr={<>N<sub>c</sub> / N<sub>q</sub> / N<sub>γ</sub></>}
            sub={<>{f(tz.Nc)} / {f(tz.Nq)} / {f(tz.Ng)}</>} />
          <Step desc="Faktor bentuk (ξc, ξq otomatis = 1 + 0.3·B/L)"
            expr={<>ξ<sub>c</sub> / ξ<sub>q</sub> / ξ<sub>γ</sub></>}
            sub={<>{f(tz.xi_c)} / {f(tz.xi_q)} / {f(tz.xi_g)}</>} />
          <Step desc="Surcharge efektif di dasar footing" expr={<>q = (γ<sub>s</sub>−γ<sub>w</sub>)·D<sub>f</sub></>}
            sub={<>({f(soil.gs)}−{f(soil.gw)})·{f(Df / 1000, 2)}</>} val={f(qSur)} unit="kPa" />
          <Step desc="Kapasitas dukung ultimit"
            expr={<>q<sub>u</sub> = c·N<sub>c</sub>·ξ<sub>c</sub> + q·N<sub>q</sub>·ξ<sub>q</sub> + 0.5·γ<sub>s</sub>·B·N<sub>γ</sub>·ξ<sub>γ</sub></>}
            val={f(tz.qu)} unit="kPa" />
          <Step desc="Daya dukung izin" refs={`FS = ${f(fd.SF_bc, 1)}`} expr={<>q<sub>all</sub> = q<sub>u</sub> / FS</>}
            sub={<>{f(tz.qu)} / {f(fd.SF_bc, 1)}</>} val={f(tz.qall)} unit="kPa" />
        </DerivGroup>

        <DerivGroup title="B. Daya dukung tanah — tegangan kontak" refs={`governing ${ck.daya_dukung.lc}`}>
          <Step desc="Luas & modulus penampang dasar footing"
            expr={<>A<sub>f</sub> = B·L ; S<sub>x</sub> = B·L²/6 ; S<sub>z</sub> = L·B²/6</>}
            sub={<>A<sub>f</sub>={f(Af, 3)} m² ; S<sub>x</sub>={f(Sx, 3)} ; S<sub>z</sub>={f(Sz, 3)} m³</>} />
          <Step desc="Tegangan maksimum vs daya dukung izin"
            expr={<>σ<sub>max</sub> = <Frac n={<>F<sub>y</sub></>} d={<>A<sub>f</sub></>} /> + <Frac n={<>|M<sub>x</sub>|</>} d={<>S<sub>x</sub></>} /> + <Frac n={<>|M<sub>z</sub>|</>} d={<>S<sub>z</sub></>} /> ≤ q<sub>all</sub></>}
            sub={<><Frac n={f(govBC.FY)} d={f(Af, 3)} /> + <Frac n={f(Math.abs(nz(govBC.MX)))} d={f(Sx, 3)} /> + <Frac n={f(Math.abs(nz(govBC.MZ)))} d={f(Sz, 3)} /></>}
            val={f(sMax)} unit="kPa" ok={ck.daya_dukung.ok} />
        </DerivGroup>

        <DerivGroup title="C. Stabilitas" refs="ASD — SNI 8460:2017">
          <Step desc="Geser: gaya penahan gesek (SF ≥ 1.5)" note={`governing ${ck.stab_geser.lc}`}
            expr={<>F<sub>r</sub> = F<sub>y</sub>·μ ; SF = F<sub>r</sub>/H<sub>lat</sub></>}
            sub={<>F<sub>r</sub> = {f(nz(govSh.FY))}·{f(fd.mu_fric)} = {f(ck.stab_geser.kapasitas)} kN ; H={f(ck.stab_geser.demand)}</>}
            val={f(inf.SFsl)} ok={ck.stab_geser.ok} />
          <Step desc="Guling: momen penahan (SF ≥ 2)" note={`governing ${ck.guling.lc}`}
            expr={<>M<sub>r</sub> = F<sub>y</sub>·0.5·L ; SF = M<sub>r</sub>/M</>}
            sub={<>M<sub>r</sub> = {f(ck.guling.kapasitas)} ; M = {f(ck.guling.demand)} kNm</>}
            val={f(ck.guling.kapasitas / (ck.guling.demand || 1))} ok={ck.guling.ok} />
          <Step desc="Gaya angkat (uplift): berat penahan vs gaya apung (SF ≥ 1.5)"
            expr={<>SF = (W<sub>f</sub>+W<sub>p</sub>+W<sub>sb</sub>) / F<sub>db</sub></>}
            sub={<>{f(inf.Frbp)} / {f(inf.Fdb)}</>} val={f(inf.SFup)} ok={ck.uplift.ok} />
        </DerivGroup>

        <DerivGroup title="D. Struktur beton" refs="SNI 2847:2019">
          <Step desc="Tinggi efektif & beban garis ultimit"
            expr={<>d = H<sub>f</sub>−c−0.5·d<sub>b</sub> ; q<sub>u,f</sub> = 1.4·q<sub>all</sub></>}
            sub={<>d = {f(inf.d)} mm ; q<sub>u,f</sub> = {f(inf.qu_f)} kN/m</>} />
          <Step desc="Lentur: momen kantilever vs kapasitas" refs="SNI 2847:2019 Ps. 9 · Tabel 21.2.2"
            expr={<>M<sub>u</sub> = 0.5·q<sub>u,f</sub>·L<sub>kant</sub>² ; ϕM<sub>n</sub> = ϕ·A<sub>s</sub>·f<sub>y</sub>·(d−0.5a)</>}
            sub={<>L<sub>kant</sub> = {f(aCant, 3)} m ; M<sub>u</sub> = {f(ck.lentur.demand)} ; ϕM<sub>n</sub> = {f(ck.lentur.kapasitas)} kNm</>}
            ok={ck.lentur.ok} />
          <Step desc="Tulangan minimum" refs="SNI 2847:2019 Tabel 8.6.1.1"
            expr={<>A<sub>s,min</sub> = max(0.0018·420/f<sub>y</sub> ; 0.0014)·A<sub>g</sub></>}
            sub={<>{f(AsMin, 0)} vs A<sub>s</sub> {f(inf.As, 0)} mm²</>} ok={ck.tulangan_min.ok} />
          <Step desc="Geser dua arah (pons) — penampang kritis d/2" refs="SNI 2847:2019 Ps. 22.6"
            expr={<>ϕV<sub>c</sub> = ϕ·v<sub>c</sub>·b<sub>o</sub>·d</>}
            sub={<>b<sub>o</sub> = {f(inf.bo)} mm ; V<sub>u</sub> = {f(ck.geser_2arah.demand)} ; ϕV<sub>c</sub> = {f(ck.geser_2arah.kapasitas)} kN</>}
            ok={ck.geser_2arah.ok} />
          <Step desc="Geser satu arah — penampang d dari muka" refs="SNI 2847:2019 Ps. 22.5"
            expr={<>ϕV<sub>c</sub> = ϕ·0.33·√f'<sub>c</sub>·L·d</>}
            sub={<>V<sub>u</sub> = {f(ck.geser_1arah.demand)} ; ϕV<sub>c</sub> = {f(ck.geser_1arah.kapasitas)} kN</>}
            ok={ck.geser_1arah.ok} />
        </DerivGroup>

        <DerivGroup title="E. Penurunan (settlement)" refs="Steinbrenner (1934) · Braja M. Das">
          <Step desc="Penurunan segera (elastis)" expr={<>S<sub>i</sub> = q<sub>0</sub>·B·<Frac n="(1−μ²)" d={<>E<sub>s</sub></>} />·I<sub>s</sub>·I<sub>f</sub>·4</>}
            sub={<>q<sub>0</sub> = {f(inf.q0)} kPa</>} val={f(se.Si)} unit="mm" />
          <Step desc="Konsolidasi primer + sekunder" refs={`Cs = ${f(se.Cs, 4)} (auto Cc/10)`}
            expr={<>S<sub>c</sub> = <Frac n={<>C<sub>s</sub>·H</>} d="1+e₀" />·log<Frac n="P₀+ΔP" d="P₀" /></>}
            sub={<>S<sub>c1</sub> = {f(se.Sc1)} + S<sub>c2</sub> = {f(se.Sc2)}</>} unit="mm" />
          <Step desc="Penurunan total (batas 25 mm)" expr={<>S = S<sub>i</sub>+S<sub>c1</sub>+S<sub>c2</sub></>}
            sub={<>{f(se.Si)}+{f(se.Sc1)}+{f(se.Sc2)}</>} val={f(se.Stot)} unit="mm" ok={se.ok} />
        </DerivGroup>
      </section>

      <section className="rpt-section">
        <h2>4. Diagram gaya dalam</h2>
        <div className="fd-row">
          <SoilPressureDiagram sMax={sMax} sMin={sMin} />
          <CantileverForceDiagram a={aCant} w={inf.qu_f} Vmax={inf.qu_f * aCant} Mmax={ck.lentur.demand} />
        </div>
        <p className="rpt-note2">
          Tekanan tanah trapesium (σmax–σmin, governing {ck.daya_dukung.lc}) untuk cek daya dukung; footing
          ditinjau sebagai kantilever dari muka pedestal (L<sub>kant</sub> = {f(aCant, 3)} m) dengan beban garis
          ultimit q<sub>u,f</sub> = 1.4·q<sub>all</sub> = {f(inf.qu_f)} kN/m.
        </p>
      </section>

      <section className="rpt-section">
        <h2>5. Hasil analisis</h2>
        <p className="rpt-terz">
          Daya dukung Terzaghi: q<sub>all</sub> = <b>{result.terzaghi.qall.toFixed(2)} kPa</b> ·
          q<sub>u</sub> = {result.terzaghi.qu.toFixed(2)} kPa ·
          N<sub>c</sub>/N<sub>q</sub>/N<sub>γ</sub> = {result.terzaghi.Nc.toFixed(1)}/{result.terzaghi.Nq.toFixed(1)}/{result.terzaghi.Ng.toFixed(1)}
        </p>
        {result.terzaghi.xi_c != null && (
          <p className="rpt-terz">
            Faktor bentuk (ξ<sub>c</sub>, ξ<sub>q</sub> otomatis = 1 + 0,3·B/L):
            ξ<sub>c</sub> = {result.terzaghi.xi_c.toFixed(2)} · ξ<sub>q</sub> = {result.terzaghi.xi_q.toFixed(2)} · ξ<sub>γ</sub> = {result.terzaghi.xi_g.toFixed(2)}
          </p>
        )}
        <table className="rpt-table rpt-checks">
          <thead>
            <tr><th>Pengecekan</th><th>Demand</th><th>Kapasitas</th><th>Rasio</th><th>Status</th></tr>
          </thead>
          <tbody>
            {Object.entries(result.checks).map(([k, v]) => (
              <tr key={k}>
                <td>{LABELS[k] || k}{v.lc ? ` · ${v.lc}` : ''}</td>
                <td className="num">{v.demand.toFixed(2)}</td>
                <td className="num">{v.kapasitas.toFixed(2)}</td>
                <td className="num">{v.rasio.toFixed(2)}</td>
                <td className={`st ${v.ok ? 'ok' : 'ng'}`}>{v.ok ? 'OK' : 'NG'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rpt-settle">
          Penurunan (settlement): Si {result.settlement.Si.toFixed(2)} + Sc1 {result.settlement.Sc1.toFixed(2)} + Sc2 {result.settlement.Sc2.toFixed(2)} =
          <b> {result.settlement.Stot.toFixed(2)} mm</b> —
          <span className={`st ${result.settlement.ok ? 'ok' : 'ng'}`}> {result.settlement.ok ? 'OK (< 25 mm)' : 'NG (≥ 25 mm)'}</span>
          {result.settlement.Cs != null && <span className="lc-tag"> · Cs = {result.settlement.Cs.toFixed(4)} (otomatis = Cc/10)</span>}
        </p>
        <p className="rpt-concl">
          Kesimpulan: <b>{result.overall_ok ? 'Pondasi dinyatakan AMAN' : 'Pondasi TIDAK AMAN'}</b> terhadap seluruh pengecekan struktur, stabilitas, dan penurunan.
        </p>
      </section>

      <footer className="rpt-foot">
        <p className="rpt-disc">
          ⚠️ Hasil perhitungan <b>wajib diverifikasi oleh insinyur sipil berlisensi</b> sebelum digunakan untuk konstruksi.
        </p>
        <div className="rpt-sign">
          <div>
            <span>Dihitung oleh</span>
            <div className="rpt-line" />
            <div className="rpt-name">{engineerName ? `( ${engineerName} )` : ' '}</div>
            <div className="rpt-role">Engineer</div>
          </div>
          <div>
            <span>Diperiksa oleh</span>
            <div className="rpt-line" />
            <div className="rpt-name">{qcName ? `( ${qcName} )` : ' '}</div>
            <div className="rpt-role">QC</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
