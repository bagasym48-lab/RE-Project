// CalculatorForm.jsx — form lengkap kalkulator pondasi dangkal.
// User hanya memasukkan BEBAN DASAR (reaksi tumpuan per beban primer) + SDS;
// backend membangkitkan kombinasi ASD LC101–161 & LRFD LC501–558 otomatis
// (dokumen FEED GFW, ASCE 7-16 Ps. 2.4.5 & 2.3.6) lalu mengecek semuanya.
// Hasil dihitung otomatis (debounce) seperti kalkulator lain — tanpa tombol.

import { useEffect, useRef, useState } from 'react';
import FoundationSketch from './FoundationSketch.jsx';
import DesignPanel from './DesignPanel.jsx';
import { Step, DerivGroup, TheoryIntro, Frac, FDDefs, SoilPressureDiagram, FootingFullForceDiagram, RebarSketch, f, ProjectInfoForm, ReportCover, ReportTOC, RunningHeader, ReportPaged, defProject, ItemsTable } from './reportKit.jsx';

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

// ---- Beban dasar (notasi dokumen) --------------------------------------
// Reaksi tumpuan STAAD per beban primer (kN, kNm). Kombinasi dibangkitkan
// otomatis oleh backend — user TIDAK memasukkan load combination lagi.
const zeroLoad = { FY: 0, FX: 0, FZ: 0, MX: 0, MZ: 0 };
export const defaultLoads = {
  DL: { ...zeroLoad, FY: 29.611 },
  PE: { ...zeroLoad, FY: 7.47 },
  PO: { ...zeroLoad, FY: 27.03 },
  PT: { ...zeroLoad, FY: 28.93 },
  QE: { ...zeroLoad }, QO: { ...zeroLoad }, QT: { ...zeroLoad },
  TE: { ...zeroLoad, FZ: -4.80, MX: -12.96 },
  TF: { ...zeroLoad, FX: -6.78, MZ: 18.306 },
  LL: { ...zeroLoad }, LR: { ...zeroLoad },
  CDL: { ...zeroLoad }, CLL: { ...zeroLoad },
  I: { ...zeroLoad }, H: { ...zeroLoad }, B: { ...zeroLoad },
  WX: { ...zeroLoad, FX: -0.1917, MZ: 0.3733 },
  WZ: { ...zeroLoad, FZ: -1.4117, MX: -3.6667 },
  VX: { ...zeroLoad, FX: -0.7054, MZ: 1.4462 },
  VZ: { ...zeroLoad, FZ: -0.7054, MX: -1.4462 },
};
export const defaultSds = 0.486; // (1+0.14·SDS) = 1.068 — kalibrasi tabel dokumen

const LOAD_LABELS = {
  DL: 'Beban mati struktur', PE: 'Pipa — empty', PO: 'Pipa — operasi', PT: 'Pipa — test',
  QE: 'Beban tambahan — empty', QO: 'Beban tambahan — operasi', QT: 'Beban tambahan — test',
  TE: 'Termal ekspansi', TF: 'Termal friksi',
  LL: 'Beban hidup', LR: 'Beban hidup atap',
  CDL: 'Cable tray — mati', CLL: 'Cable tray — hidup',
  I: 'Impact', H: 'Tekanan tanah lateral', B: 'Buoyancy (apung)',
  WX: 'Angin arah X', WZ: 'Angin arah Z', VX: 'Gempa arah X', VZ: 'Gempa arah Z',
};
const LOAD_GROUPS = [
  ['Gravitasi / vertikal', ['DL', 'PE', 'PO', 'PT', 'QE', 'QO', 'QT']],
  ['Termal pipa', ['TE', 'TF']],
  ['Hidup & lainnya', ['LL', 'LR', 'CDL', 'CLL', 'I', 'H', 'B']],
  ['Angin & gempa (lateral)', ['WX', 'WZ', 'VX', 'VZ']],
];
const COMP_COLS = ['FY', 'FX', 'FZ', 'MX', 'MZ'];
const COMP6 = ['FX', 'FY', 'FZ', 'MX', 'MY', 'MZ'];

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
  const [loads, setLoads] = useState(defaultLoads);
  const [Sds, setSds] = useState(defaultSds);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
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
  const updLoad = (name, c, v) =>
    setLoads((o) => ({ ...o, [name]: { ...o[name], [c]: v } }));

  // Beban gempa proporsional SDS: V = Cs·W dengan Cs = SDS/(R/Ie) ∝ SDS,
  // sehingga mengubah SDS otomatis menskalakan seluruh komponen VX & VZ
  // (gaya DAN momen ikut, karena M = gaya × lengan). Anchor = SDS valid
  // terakhir, supaya mengetik bertahap/menghapus field tidak merusak skala.
  const sdsAnchor = useRef(Number(defaultSds));
  const scaleRow = (row, r) => Object.fromEntries(
    COMP_COLS.map((c) => [c, +(((Number(row[c]) || 0) * r).toFixed(4))])
  );
  const onSdsChange = (v) => {
    setSds(v);
    const nv = Number(v);
    if (!Number.isFinite(nv) || nv <= 0) return;   // tunggu angka valid
    const ov = sdsAnchor.current;
    if (Number.isFinite(ov) && ov > 0 && nv !== ov) {
      const r = nv / ov;
      setLoads((o) => ({ ...o, VX: scaleRow(o.VX, r), VZ: scaleRow(o.VZ, r) }));
    }
    sdsAnchor.current = nv;
  };

  async function compute() {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    try {
      const numObj = (o) =>
        Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? 0 : Number(v)]));
      const payload = {
        foundation: { ...numObj(fd), n_pedestal: parseInt(fd.n_pedestal, 10) || 1 },
        soil: numObj(soil),
        Sds: Number(Sds) || 0,
        loads: Object.fromEntries(
          Object.entries(loads).map(([name, o]) => [name, numObj(o)])
        ),
      };
      const res = await fetch(`${API}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl.signal,
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
      if (e.name === 'AbortError') return; // diganti permintaan yang lebih baru
      setError(e.message);
      setResult(null);
    } finally {
      if (abortRef.current === ctl) setLoading(false);
    }
  }

  // Auto-hitung (debounce) — seperti kalkulator lain, tanpa tombol "Hitung".
  useEffect(() => {
    const t = setTimeout(compute, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fd, soil, loads, Sds]);

  function loadDesign(d) {
    if (d.foundation) setFd(d.foundation);
    if (d.soil) setSoil(d.soil);
    const lc = d.load_cases;
    if (lc && !Array.isArray(lc) && lc.loads) {
      // Format baru: { loads, Sds }
      setLoads({ ...defaultLoads, ...Object.fromEntries(
        Object.entries(lc.loads).map(([k, o]) => [k, { ...zeroLoad, ...o }])
      ) });
      if (lc.Sds != null) {
        setSds(lc.Sds);
        // Anchor ikut SDS desain — beban VX/VZ yang dimuat sudah pada SDS ini,
        // jadi TIDAK boleh terskala saat load.
        const sv = Number(lc.Sds);
        if (Number.isFinite(sv) && sv > 0) sdsAnchor.current = sv;
      }
      setError(null);
    } else if (Array.isArray(lc)) {
      // Desain lama (load case manual) — beban dasar tidak tersedia.
      setError('Desain lama memakai load case manual; beban dasar memakai nilai saat ini dan hasil dihitung ulang otomatis.');
    }
    setResult(d.result || null);
  }

  return (
    <div className="app">
      <header className="head">
        <h1>Kalkulasi Pondasi Dangkal</h1>
        <p className="sub">Telapak (footing) · SNI 2847:2019 · Terzaghi-Krizek · Steinbrenner · Kombinasi ASD/LRFD otomatis (ASCE 7-16)</p>
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
            <legend>Beban dasar — reaksi tumpuan per beban primer (kN, kNm)</legend>
            <p className="loads-note">
              Kombinasi beban <b>tidak perlu diinput</b> — 61 kombinasi ASD (LC101–161) dan
              58 LRFD (LC501–558) dibangkitkan otomatis sesuai dokumen (ASCE 7-16).
              Isi hanya beban yang ada; baris lain biarkan 0. Mengubah S<sub>DS</sub> otomatis
              <b> menskalakan beban gempa VX &amp; VZ</b> secara proporsional (V = Cs·W, Cs ∝ S<sub>DS</sub>).
            </p>
            <div className="fields" style={{ marginBottom: 8 }}>
              <Field k="Sds" label="SDS gempa (g) — faktor vertikal & skala VX/VZ" value={Sds}
                onChange={(k, v) => onSdsChange(v)} type="number" step="any" />
            </div>
            <div className="lc-wrap">
              <table className="lc loads-tbl">
                <thead>
                  <tr><th>Beban</th><th>FY</th><th>FX</th><th>FZ</th><th>MX</th><th>MZ</th></tr>
                </thead>
                <tbody>
                  {LOAD_GROUPS.map(([gTitle, names]) => (
                    [
                      <tr key={gTitle} className="ld-group"><td colSpan={6}>{gTitle}</td></tr>,
                      ...names.map((name) => (
                        <tr key={name}>
                          <td className="ld-name" title={LOAD_LABELS[name]}>
                            <b>{name}</b> <small>{LOAD_LABELS[name]}</small>
                          </td>
                          {COMP_COLS.map((c) => (
                            <td key={c}>
                              <input
                                value={loads[name][c]}
                                onChange={(e) => updLoad(name, c, e.target.value)}
                                type="number" step="any"
                              />
                            </td>
                          ))}
                        </tr>
                      )),
                    ]
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
        </section>

        <aside className="side">
          <div className="card">
            <FoundationSketch fd={fd} />
          </div>

          {loading && <p className="calc-status">Menghitung…</p>}
          {error && (
            <div className="err">
              <p>Error: {error}</p>
              <button className="add" onClick={compute}>Coba hitung ulang</button>
            </div>
          )}

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
              {result.combos && (
                <p className="terz">
                  Kombinasi otomatis: {result.combos.asd.length} ASD (LC101–161) + {result.combos.lrfd.length} LRFD (LC501–558)
                  <span className="lc-tag"> · SDS = {Number(result.combos.Sds).toFixed(3)}</span>
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
          <DesignPanel userId={userId} fd={fd} soil={soil} lcs={{ loads, Sds }} result={result} onLoad={loadDesign} />
        </aside>
      </div>

      {result && <ReportSheet fd={fd} soil={soil} loads={loads} Sds={Sds} result={result} project={project} engineerName={engineerName} qcName={qcName} />}
    </div>
  );
}

// Tabel kombinasi utk laporan: LC | formula | FX FY FZ MX MY MZ (+ maks/min).
function ComboTable({ rows, mm }) {
  const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '—');
  return (
    <table className="rpt-table rpt-combo">
      <thead>
        <tr>
          <th>LC</th><th>Kombinasi Beban</th>
          <th>F<sub>X</sub> (kN)</th><th>F<sub>Y</sub> (kN)</th><th>F<sub>Z</sub> (kN)</th>
          <th>M<sub>X</sub> (kNm)</th><th>M<sub>Y</sub> (kNm)</th><th>M<sub>Z</sub> (kNm)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.lc}>
            <td>{r.lc}</td>
            <td className="frm">{r.formula}</td>
            {COMP6.map((c) => <td key={c} className="num">{f3(r[c])}</td>)}
          </tr>
        ))}
        {mm && ([
          <tr key="mx" className="mm"><td /><td>NILAI MAKSIMUM</td>{COMP6.map((c) => <td key={c} className="num">{f3(mm[c].max)}</td>)}</tr>,
          <tr key="mxl" className="mm"><td /><td>LC MAKSIMUM</td>{COMP6.map((c) => <td key={c} className="num">{mm[c].lc_max}</td>)}</tr>,
          <tr key="mn" className="mm"><td /><td>NILAI MINIMUM</td>{COMP6.map((c) => <td key={c} className="num">{f3(mm[c].min)}</td>)}</tr>,
          <tr key="mnl" className="mm"><td /><td>LC MINIMUM</td>{COMP6.map((c) => <td key={c} className="num">{mm[c].lc_min}</td>)}</tr>,
        ])}
      </tbody>
    </table>
  );
}

// ReportSheet — laporan A4 untuk dicetak/disimpan PDF. Disembunyikan di layar
// (display:none), hanya tampil di @media print. Lihat .report-sheet di index.css.
function ReportSheet({ fd, soil, loads, Sds, result, project, engineerName, qcName }) {
  // Nilai turunan untuk substitusi rumus (geometri saja; hasil fisika dari backend).
  const nz = (v) => (Number.isFinite(+v) ? +v : 0);
  const B = nz(fd.B), L = nz(fd.L), h = nz(fd.h), Df = nz(fd.Df);
  const tz = result.terzaghi, ck = result.checks, inf = result.info, se = result.settlement;
  const cmb = result.combos || null;
  const asdRows = cmb ? cmb.asd : [];
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
  const findLC = (nama) => asdRows.find((r) => `LC${r.lc}` === String(nama)) || {};
  const govBC = findLC(ck.daya_dukung.lc);
  const sMax = ck.daya_dukung.demand;
  const sMin = nz(govBC.FY) / Af - Math.abs(nz(govBC.MX)) / Sx - Math.abs(nz(govBC.MZ)) / Sz;
  const govSh = findLC(ck.stab_geser.lc);
  // Baris beban dasar yang terisi (≠0) untuk tabel §4.1.
  const loadRows = Object.entries(loads)
    .filter(([, o]) => COMP_COLS.some((c) => nz(o[c]) !== 0));
  return (
    <div className="report-sheet">
      <FDDefs />
      <ReportCover title="Kalkulasi Pondasi Dangkal" project={project} engineer={engineerName} qc={qcName} />
      <ReportTOC items={[
        ['1. Umum', ['1.1 Kode & Standar', '1.2 Material & Berat Satuan', '1.3 Kondisi Tanah & Faktor Keamanan']],
        ['2. Data Input', ['2.1 Dimensi Pondasi', '2.2 Material & Faktor', '2.3 Parameter Tanah']],
        ['3. Gambar Sketsa', ['3.1 Sketsa Fondasi', '3.2 Detail Penulangan Footing']],
        ['4. Kombinasi Beban', ['4.1 Beban Dasar', '4.2 Kombinasi ASD pada Footing (LC101–161)', '4.3 Kombinasi LRFD pada Footing (LC501–558)']],
        ['5. Data Fondasi', ['5.1 Data Footing & Penampang', '5.2 Data Pedestal']],
        ['6. Cek Stabilitas', ['Daya dukung Terzaghi', 'Tegangan kontak', 'Geser, guling, uplift']],
        ['7. Desain Fondasi & Penurunan', ['Struktur beton', 'Penurunan']],
        ['8. Rekapitulasi & Kesimpulan', []],
      ]} />
      <ReportPaged header={
        <RunningHeader project={project} title="Kalkulasi Pondasi Dangkal"
          right={<span className={`rpt-verdict ${result.overall_ok ? 'ok' : 'ng'}`}>{result.overall_ok ? 'AMAN' : 'TIDAK AMAN'}</span>} />
      }>

      <section className="rpt-section">
        <h2>1. Umum</h2>
        <h3>1.1 Kode &amp; Standar</h3>
        <ItemsTable head={['Item', 'Deskripsi']} rows={[
          ['Metode desain', 'ASD (stabilitas & daya dukung) + LRFD (penulangan)'],
          ['Kombinasi beban', 'ASCE 7-16 Ps. 2.4.5 & 2.3.6 — ASD LC101–161 · LRFD LC501–558 (otomatis dari beban dasar)'],
          ['Daya dukung tanah', 'Terzaghi (1943) · faktor bentuk Krizek (1965)'],
          ['Beton bertulang', 'SNI 2847:2019 (ACI 318-14)'],
          ['Stabilitas', 'SNI 8460:2017 (geoteknik)'],
          ['Penurunan', 'Steinbrenner (1934) · Braja M. Das'],
        ]} />
        <h3>1.2 Material &amp; Berat Satuan</h3>
        <ItemsTable rows={[
          [<>Kuat tekan beton f&#39;<sub>c</sub></>, `${f(fd.fc)} MPa`],
          [<>Tegangan leleh tulangan f<sub>y</sub></>, `${f(fd.fy)} MPa`],
          [<>Berat jenis beton γ<sub>c</sub></>, `${f(fd.gc)} kN/m³`],
          [<>Berat jenis tanah γ<sub>s</sub></>, `${f(soil.gs)} kN/m³`],
          [<>Berat jenis air γ<sub>w</sub></>, `${f(soil.gw)} kN/m³`],
          [<>Modulus tanah E<sub>s</sub></>, `${f(soil.Es, 0)} kPa`],
        ]} />
        <h3>1.3 Kondisi Tanah &amp; Faktor Keamanan</h3>
        <ItemsTable rows={[
          [<>Sudut geser dalam ϕ</>, `${f(soil.phi)}°`],
          [<>Kohesi c</>, `${f(soil.c)} kPa`],
          [<>Daya dukung izin q<sub>all</sub></>, `${f(tz.qall)} kPa`],
          ['SF daya dukung', `${f(fd.SF_bc, 1)}`],
          ['SF geser / guling / uplift', '1.5 / 2.0 / 1.5'],
          [<>Koef. gesek dasar μ</>, `${f(fd.mu_fric)}`],
          [<>Faktor bentuk ξ<sub>c</sub> / ξ<sub>q</sub> / ξ<sub>γ</sub></>, `${f(tz.xi_c)} / ${f(tz.xi_q)} / ${f(tz.xi_g)}`],
          [<>Parameter gempa S<sub>DS</sub></>, `${f(Sds, 3)} g`],
        ]} />
      </section>

      <section className="rpt-section">
        <h2>2. Data Input</h2>
        <h3>2.1 Dimensi Pondasi (mm)</h3>
        <div className="rpt-kv">
          {DIMENSI.map(([k, l]) => <div key={k} className="rpt-kv-item"><span>{l}</span><b>{fd[k]}</b></div>)}
        </div>
        <h3>2.2 Material &amp; Faktor</h3>
        <div className="rpt-kv">
          {MATERIAL.map(([k, l]) => <div key={k} className="rpt-kv-item"><span>{l}</span><b>{fd[k]}</b></div>)}
        </div>
        <h3>2.3 Parameter Tanah</h3>
        <div className="rpt-kv">
          {SOIL.map(([k, l]) => <div key={k} className="rpt-kv-item"><span>{l}</span><b>{soil[k]}</b></div>)}
        </div>
      </section>

      <section className="rpt-section">
        <h2>3. Gambar Sketsa</h2>
        <h3>3.1 Sketsa Fondasi</h3>
        <div className="rpt-sketch"><FoundationSketch fd={fd} /></div>
        {Number(fd.n_pedestal) >= 2 && (
          <p className="rpt-note2">
            Catatan 2 pedestal (jarak antar pusat {fd.s_ped} mm): beban diasumsikan terbagi rata 50/50.
            Cek geser pons, geser 1-arah, lentur, dan uplift dihitung per pedestal/posisinya; daya dukung,
            sliding, guling, dan tulangan minimum tetap berbasis beban total. Momen hogging combined footing
            di antara pedestal (tulangan atas) belum dicakup — wajib dicek terpisah oleh engineer.
          </p>
        )}
        <h3>3.2 Detail Penulangan Footing</h3>
        <RebarSketch B={B} L={L} h={h} cover={nz(fd.cover)} db={nz(fd.db)} s={nz(fd.srl)}
          nPed={nped} cPed={nz(fd.c2)} sPed={nz(fd.s_ped)} />
        <p className="rpt-note2">
          Tulangan bawah footing dua arah Ø{f(fd.db, 0)}-{f(fd.srl, 0)} mm
          (±{Math.max(Math.floor((L - 2 * nz(fd.cover)) / Math.max(nz(fd.srl), 1)) + 1, 2)} batang arah X
          + {Math.max(Math.floor((B - 2 * nz(fd.cover)) / Math.max(nz(fd.srl), 1)) + 1, 2)} batang arah Y),
          selimut beton {f(fd.cover, 0)} mm — sesuai input kalkulasi (dipakai pada cek lentur &amp; tulangan
          minimum §7). Detail tulangan pedestal (vertikal + sengkang) dirinci pada laporan MTO.
        </p>
      </section>

      <section className="rpt-section">
        <h2>4. Kombinasi Beban</h2>
        <p className="rpt-note2">
          Kombinasi pembebanan dibangkitkan <b>otomatis</b> dari beban dasar sesuai dokumen referensi
          (ASCE 7-16 Ps. 2.4.5 &amp; 2.3.6; S<sub>DS</sub> = {f(cmb ? cmb.Sds : Sds, 3)} g).
          Kombinasi tanpa faktor (ASD, LC101–161) dipakai untuk pemeriksaan stabilitas fondasi,
          kapasitas daya dukung tanah, dan penurunan; kombinasi terfaktor (LRFD, LC501–558) untuk
          desain tulangan beton. Faktor gempa vertikal: ASD (1+0.14S<sub>DS</sub>) · LRFD (1.2+0.2S<sub>DS</sub>);
          arah ortogonal 100/30.
        </p>
        <h3>4.1 Beban Dasar — reaksi tumpuan per beban primer (kN, kNm)</h3>
        <table className="rpt-table">
          <thead>
            <tr><th>Beban</th><th>Deskripsi</th><th>FY</th><th>FX</th><th>FZ</th><th>MX</th><th>MZ</th></tr>
          </thead>
          <tbody>
            {loadRows.map(([name, o]) => (
              <tr key={name}>
                <td><b>{name}</b></td>
                <td>{LOAD_LABELS[name]}</td>
                {COMP_COLS.map((c) => <td key={c} className="num">{f(nz(o[c]), 3)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rpt-note2">Beban dasar bernilai nol tidak ditampilkan. Momen otomatis terbawa
          superposisi linear pada setiap kombinasi (M = gaya lateral × lengan ke dasar footing).</p>
        {cmb && (
          <>
            <h3>4.2 Kombinasi Beban ASD pada Footing (LC101–161)</h3>
            <ComboTable rows={cmb.asd} mm={cmb.maxmin_asd} />
            <h3>4.3 Kombinasi Beban LRFD pada Footing (LC501–558)</h3>
            <ComboTable rows={cmb.lrfd} mm={cmb.maxmin_lrfd} />
          </>
        )}
      </section>

      <section className="rpt-section">
        <h2>5. Data Fondasi</h2>
        <h3>5.1 Data Footing &amp; Penampang</h3>
        <ItemsTable rows={[
          [<>Lebar B<sub>f</sub> / Panjang L<sub>f</sub></>, `${fd.B} / ${fd.L} mm`],
          [<>Tebal H<sub>f</sub> / Kedalaman D<sub>f</sub></>, `${fd.h} / ${fd.Df} mm`],
          [<>Luas dasar A<sub>f</sub></>, `${f(Af, 3)} m²`],
          [<>Modulus penampang S<sub>x</sub> / S<sub>z</sub></>, `${f(Sx, 3)} / ${f(Sz, 3)} m³`],
          ['Selimut beton', `${fd.cover} mm`],
        ]} />
        <h3>5.2 Data Pedestal (Pier)</h3>
        <ItemsTable rows={[
          [<>Panjang L<sub>p</sub> (c1) / Lebar B<sub>p</sub> (c2)</>, `${fd.c1} / ${fd.c2} mm`],
          [<>Tinggi pedestal H<sub>p</sub></>, `${fd.Hp} mm`],
          ['Jumlah pedestal', `${fd.n_pedestal}`],
          ['Jarak antar pedestal (bila 2)', `${fd.s_ped} mm`],
          [<>Ø tulangan / spasi</>, `${fd.db} / ${fd.srl} mm`],
        ]} />
      </section>

      <section className="rpt-section">
        <h2>6. Cek Stabilitas</h2>

        <TheoryIntro title="Kapasitas dukung tanah & stabilitas fondasi dangkal" refs="Terzaghi (1943) · SNI 8460:2017">
          <p>
            Fondasi telapak meneruskan beban struktur ke tanah melalui tegangan kontak pada dasar
            telapak. Kapasitas dukung batas (q<sub>u</sub>) diprediksi dengan persamaan Terzaghi yang
            menjumlahkan kontribusi kohesi, beban surcharge di atas dasar fondasi, dan berat isi tanah,
            masing-masing dikalikan faktor daya dukung (N<sub>c</sub>, N<sub>q</sub>, N<sub>γ</sub>)
            yang merupakan fungsi sudut geser dalam (ϕ) serta faktor bentuk (ξ). Kapasitas izin
            (q<sub>all</sub>) diperoleh dengan membagi q<sub>u</sub> oleh faktor keamanan.
          </p>
          <p>
            Karena beban aksial disertai momen, distribusi tegangan di bawah telapak berbentuk trapesium;
            tegangan maksimum (σ<sub>max</sub>) tiap kombinasi ASD tidak boleh melampaui q<sub>all</sub>.
            Stabilitas fondasi ditinjau terhadap tiga moda keruntuhan: geser (gaya lateral ditahan gesekan
            dasar), guling (momen guling ditahan momen berat sendiri), dan gaya angkat/uplift (gaya apung
            ditahan berat fondasi + tanah di atasnya) — masing-masing terhadap angka keamanan minimum.
          </p>
        </TheoryIntro>

        <DerivGroup title="Daya dukung Terzaghi" refs="Terzaghi (1943) · faktor Krizek (1965)">
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

        <DerivGroup title="Daya dukung tanah — tegangan kontak" refs={`governing ${ck.daya_dukung.lc} dari ${asdRows.length || '—'} kombinasi ASD`}>
          <Step desc="Luas & modulus penampang dasar footing"
            expr={<>A<sub>f</sub> = B·L ; S<sub>x</sub> = B·L²/6 ; S<sub>z</sub> = L·B²/6</>}
            sub={<>A<sub>f</sub>={f(Af, 3)} m² ; S<sub>x</sub>={f(Sx, 3)} ; S<sub>z</sub>={f(Sz, 3)} m³</>} />
          <Step desc="Tegangan maksimum vs daya dukung izin (dievaluasi utk SEMUA kombinasi ASD)"
            expr={<>σ<sub>max</sub> = <Frac n={<>F<sub>y</sub></>} d={<>A<sub>f</sub></>} /> + <Frac n={<>|M<sub>x</sub>|</>} d={<>S<sub>x</sub></>} /> + <Frac n={<>|M<sub>z</sub>|</>} d={<>S<sub>z</sub></>} /> ≤ q<sub>all</sub></>}
            sub={<><Frac n={f(govBC.FY)} d={f(Af, 3)} /> + <Frac n={f(Math.abs(nz(govBC.MX)))} d={f(Sx, 3)} /> + <Frac n={f(Math.abs(nz(govBC.MZ)))} d={f(Sz, 3)} /></>}
            val={f(sMax)} unit="kPa" ok={ck.daya_dukung.ok} />
        </DerivGroup>

        <DerivGroup title="Stabilitas geser, guling & uplift" refs="ASD — SNI 8460:2017">
          <Step desc="Geser: gaya penahan gesek (SF ≥ 1.5, minimum di seluruh LC)" note={`governing ${ck.stab_geser.lc}`}
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

        <div className="fd-row">
          <SoilPressureDiagram sMax={sMax} sMin={sMin} />
        </div>
        <p className="rpt-note2">Distribusi tekanan tanah trapesium (σmax–σmin, governing {ck.daya_dukung.lc}) untuk cek daya dukung tanah.</p>
      </section>

      <section className="rpt-section">
        <h2>7. Desain Fondasi &amp; Penurunan</h2>

        <TheoryIntro title="Desain struktur beton & penurunan fondasi" refs="SNI 2847:2019 · Steinbrenner (1934)">
          <p>
            Tekanan tanah reaktif menimbulkan momen dan gaya geser pada pelat telapak yang berperilaku
            sebagai kantilever dari muka pedestal. Penulangan lentur direncanakan agar kapasitas momen
            terreduksi (ϕM<sub>n</sub>) melampaui momen ultimit (M<sub>u</sub>) dari kombinasi LRFD, dengan
            luas tulangan tidak kurang dari tulangan minimum susut/suhu. Ketahanan geser diperiksa pada dua
            moda: geser satu arah (aksi balok, penampang kritis sejauh d dari muka) dan geser dua arah/pons
            (penampang kritis d/2 dari muka pedestal).
          </p>
          <p>
            Penurunan total merupakan penjumlahan penurunan segera/elastis (Steinbrenner) dan penurunan
            konsolidasi primer serta sekunder lapisan tanah kohesif. Nilai total dibatasi terhadap penurunan
            izin (25 mm) untuk menjamin kelayanan struktur.
          </p>
        </TheoryIntro>

        <DerivGroup title="Struktur beton (lentur, geser, tulangan)" refs="SNI 2847:2019">
          <Step desc={inf.lrfd_gov
              ? `Tinggi efektif & tekanan ultimit dari kombinasi LRFD (governing ${inf.lrfd_gov})`
              : 'Tinggi efektif & beban garis ultimit'}
            expr={inf.lrfd_gov
              ? <>d = H<sub>f</sub>−c−0.5·d<sub>b</sub> ; q<sub>u,f</sub> = σ<sub>u,max</sub> = <Frac n={<>F<sub>y</sub></>} d={<>A<sub>f</sub></>} /> + <Frac n={<>|M<sub>x</sub>|</>} d={<>S<sub>x</sub></>} /> + <Frac n={<>|M<sub>z</sub>|</>} d={<>S<sub>z</sub></>} /></>
              : <>d = H<sub>f</sub>−c−0.5·d<sub>b</sub> ; q<sub>u,f</sub> = 1.4·q<sub>all</sub></>}
            sub={<>d = {f(inf.d)} mm ; q<sub>u,f</sub> = {f(inf.qu_f)} kN/m²</>} />
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

        <DerivGroup title="Penurunan (settlement)" refs="Steinbrenner (1934) · Braja M. Das">
          <Step desc="Penurunan segera (elastis)" expr={<>S<sub>i</sub> = q<sub>0</sub>·B·<Frac n="(1−μ²)" d={<>E<sub>s</sub></>} />·I<sub>s</sub>·I<sub>f</sub>·4</>}
            sub={<>q<sub>0</sub> = {f(inf.q0)} kPa (σmax governing ASD)</>} val={f(se.Si)} unit="mm" />
          <Step desc="Konsolidasi primer + sekunder" refs={`Cs = ${f(se.Cs, 4)} (auto Cc/10)`}
            expr={<>S<sub>c</sub> = <Frac n={<>C<sub>s</sub>·H</>} d="1+e₀" />·log<Frac n="P₀+ΔP" d="P₀" /></>}
            sub={<>S<sub>c1</sub> = {f(se.Sc1)} + S<sub>c2</sub> = {f(se.Sc2)}</>} unit="mm" />
          <Step desc="Penurunan total (batas 25 mm)" expr={<>S = S<sub>i</sub>+S<sub>c1</sub>+S<sub>c2</sub></>}
            sub={<>{f(se.Si)}+{f(se.Sc1)}+{f(se.Sc2)}</>} val={f(se.Stot)} unit="mm" ok={se.ok} />
        </DerivGroup>

        <div className="fd-full">
          <FootingFullForceDiagram
            B={B} a={Lll} cCol={nz(fd.c2)} sPed={nz(fd.s_ped)} nPed={nped}
            w={inf.qu_f} Vmax={inf.qu_f * aCant} Mmax={ck.lentur.demand}
            BLabel={`${f(B / 1000, 2)} m`} topLabel="pedestal" />
        </div>
        <p className="rpt-note2">
          Diagram gaya dalam <b>kritis pada penampang penuh footing</b> (tepi ke tepi, B = {f(B / 1000, 2)} m):
          reaksi tanah ultimit q<sub>u,f</sub> = {f(inf.qu_f)} kN/m²
          {inf.lrfd_gov ? <> (σ<sub>u,max</sub> LRFD, governing {inf.lrfd_gov})</> : <> = 1.4·q<sub>all</sub></>} menimbulkan
          geser maksimum V<sub>max</sub> = {f(inf.qu_f * aCant)} kN di sisi pedestal dan momen maksimum
          M<sub>max</sub> = {f(ck.lentur.demand)} kNm di tengah. Kantilever L<sub>kant</sub> = {f(aCant, 3)} m tiap sisi.
        </p>
      </section>

      <section className="rpt-section">
        <h2>8. Rekapitulasi &amp; Kesimpulan</h2>
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
        {cmb && (
          <p className="rpt-terz">
            Kombinasi dievaluasi: <b>{cmb.asd.length} ASD (LC101–161)</b> untuk stabilitas/daya dukung/penurunan
            + <b>{cmb.lrfd.length} LRFD (LC501–558)</b> untuk desain beton · S<sub>DS</sub> = {f(cmb.Sds, 3)} g.
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
            <div className="rpt-name">{engineerName ? `( ${engineerName} )` : ' '}</div>
            <div className="rpt-role">Engineer</div>
          </div>
          <div>
            <span>Diperiksa oleh</span>
            <div className="rpt-line" />
            <div className="rpt-name">{qcName ? `( ${qcName} )` : ' '}</div>
            <div className="rpt-role">QC</div>
          </div>
        </div>
      </footer>
      </ReportPaged>
    </div>
  );
}
