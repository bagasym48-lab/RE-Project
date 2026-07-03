// EquipmentFoundationForm.jsx — form kalkulasi Pondasi Equipment (blok, tanpa pedestal).
// Mesin duduk langsung di blok beton; cek lengkap per dokumen FEED
// DURI-TEST05NW000-CIV-CAL-PHR-2001-00 (lihat equipmentFoundationCalc.js).
// ALAT BANTU EDUKASI — wajib diverifikasi insinyur sipil berlisensi.
import { useState } from 'react';
import { LogoMark } from './Logo.jsx';
import EquipmentFoundationSketch from './EquipmentFoundationSketch.jsx';
import { compute, def } from './equipmentFoundationCalc.js';

const LABELS = {
  rasio_berat: 'Rasio berat fondasi ≥ 5× mesin (kN)',
  daya_dukung: 'Daya dukung tanah σmax (kN/m²)',
  stab_geser: 'Stabilitas geser (kN)',
  guling: 'Stabilitas guling (kNm)',
  buoyancy: 'Buoyancy / gaya angkat air (kN)',
  penurunan: 'Penurunan total (mm)',
  lentur_x: 'Lentur footing arah X (kNm)',
  lentur_z: 'Lentur footing arah Z (kNm)',
  tulangan_min: 'Tulangan minimum (mm²)',
  angkur_tarik: 'Anchor bolt — tarik (kN)',
  angkur_geser: 'Anchor bolt — geser (kN)',
  angkur_interaksi: 'Anchor bolt — interaksi T+V (≤1.2)',
};

const GROUPS = [
  ['Equipment (mesin)', [
    ['Leq', 'panjang equipment Leq (m)'], ['Beq', 'lebar equipment Beq (m)'], ['Heq', 'tinggi equipment Heq (m)'],
    ['EE', 'berat kosong EE (kN)'], ['EO', 'berat operasi EO (kN)'], ['ET', 'berat hydrotest ET (kN)'],
  ]],
  ['Fondasi blok (tanpa pedestal)', [
    ['Lf', 'panjang fondasi Lf (m)'], ['Bf', 'lebar fondasi Bf (m)'],
    ['Hf', 'tinggi fondasi Hf (m)'], ['Hfa', 'tinggi di atas tanah Hfa (m)'],
    ['gc', 'berat jenis beton (kN/m³)'],
  ]],
  ['Beton & tulangan footing', [
    ['fc', "f'c beton (MPa)"], ['fy', 'fy tulangan (MPa)'],
    ['cover', 'selimut beton (mm)'], ['Drl', 'Ø tulangan (mm)'], ['srl', 'spasi tulangan (mm)'],
  ]],
  ['Tanah & daya dukung (Meyerhof)', [
    ['phi', 'sudut geser ϕ (°)'], ['c', 'kohesi c (kPa)'], ['gs', 'γ tanah jenuh (kN/m³)'],
    ['Df', 'kedalaman tinjau Df (m)'], ['SF_bc', 'SF daya dukung'],
    ['qall_manual', 'qall Soil Data (kN/m²; kosongkan → auto)'], ['mu_fric', 'koef. gesek dasar μ'],
  ]],
  ['Angin (SNI 1727)', [
    ['V', 'kecepatan angin V (m/s)'], ['Kz', 'Kz'], ['Kd', 'Kd'], ['G', 'gust G'],
    ['Cf', 'koef. gaya Cf'], ['qh_min', 'qh minimum (N/m²)'],
  ]],
  ['Gempa (SNI 1726)', [
    ['SDS', 'SDS (g)'], ['Ie', 'faktor keutamaan Ie'], ['R', 'faktor reduksi R'],
  ]],
  ['Penurunan (Braja M. Das)', [
    ['N_spt', 'N-SPT'], ['mu', 'poisson μ'], ['e0', 'void ratio e0'], ['LL', 'batas cair LL (%)'],
    ['Pc', "tekanan prakonsolidasi Pc' (kg/m²)"], ['h1', 'tebal lapisan h1 (m)'], ['h2', 'tebal lapisan h2 (m)'],
    ['I1', 'faktor I1 (Steinbrenner)'], ['I2', 'faktor I2'], ['If', 'faktor kedalaman If'], ['I_fadum', 'faktor I (Fadum)'],
  ]],
  ['Anchor bolt (ACI 318-14, 4 baut)', [
    ['futa', 'kuat tarik futa (MPa)'], ['d_bolt', 'Ø baut (mm)'], ['nt', 'ulir per mm'],
    ['h_anchor', 'kedalaman tanam h (mm)'], ['d1', 'jarak baut d1 // Lf (mm)'], ['d2', 'jarak baut d2 // Bf (mm)'],
    ['mu_anchor', 'koef. gesek baseplate μ'],
  ]],
];

function Field({ k, label, value, onChange }) {
  return (
    <label className="field" title={label}>
      <span>{label}</span>
      <input type="number" step="any" value={value} onChange={(e) => onChange(k, e.target.value)} />
    </label>
  );
}

export default function EquipmentFoundationForm() {
  const [s, setS] = useState(def);
  const [engineerName, setEngineerName] = useState('');
  const [qcName, setQcName] = useState('');
  const upd = (k, v) => setS((o) => ({ ...o, [k]: v }));
  const r = compute(s);
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');

  return (
    <div className="app">
      <header className="head">
        <h1>Kalkulasi Pondasi Equipment</h1>
        <p className="sub">Blok tanpa pedestal · Meyerhof · SNI 1726/1727/2847 · ACI 318-14 (anchor) · Braja M. Das</p>
        <p className="warn">⚠️ Alat bantu edukasi — hasil wajib diverifikasi insinyur sipil berlisensi. Analisis dinamik tidak dilakukan (syarat rasio berat ≥ 5× terpenuhi, RTS PHR).</p>
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
          <div className="card">
            <EquipmentFoundationSketch s={s} />
          </div>

          <div className="card result">
            <div className={`verdict ${r.overall_ok ? 'ok' : 'ng'}`}>{r.overall_ok ? 'AMAN' : 'TIDAK AMAN'}</div>
            <p className="terz">
              q<sub>all</sub> = {f2(r.info.qall)} kN/m² {r.info.tz.manual ? '(Soil Data)' : '(auto Meyerhof)'} ·
              auto: {f2(r.info.tz.qall_auto)} · W<sub>f</sub> = {f2(r.info.Wf)} kN ({f2(r.info.ratioW)}× mesin)
            </p>
            <p className="terz">
              F<sub>angin</sub> x/z = {f2(r.info.Hwx)}/{f2(r.info.Hwz)} kN · Cs = {f2(r.info.Cs)} ·
              σ<sub>max</sub> = {f2(r.checks.daya_dukung.demand)} · σ<sub>min</sub> = {f2(r.checks.daya_dukung.smin)} kN/m²
            </p>
            <table className="res">
              <thead><tr><th>Pengecekan</th><th>Demand</th><th>Kapasitas</th><th>Rasio</th><th>Status</th></tr></thead>
              <tbody>
                {Object.entries(r.checks).map(([k, v]) => (
                  <tr key={k}>
                    <td>{LABELS[k]}{v.lc ? <small className="lc-tag"> {v.lc}</small> : null}</td>
                    <td className="num">{(k === 'angkur_tarik' && v.noTension) ? '0 (tanpa tarik)' : (k === 'angkur_geser' && v.noShear) ? '0 (ditahan friksi)' : f2(v.demand)}</td>
                    <td className="num">{f2(v.kapasitas)}</td>
                    <td className="num">{f2(v.rasio)}</td>
                    <td className={`st ${v.ok ? 'ok' : 'ng'}`}>{v.ok ? 'OK' : 'NG'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="settle">
              Penurunan: Si {f2(r.info.Si)} + Sc1 {f2(r.info.Sc1)} + Sc2 {f2(r.info.Sc2)} =
              <b> {f2(r.info.Stot)} mm</b>
              <span className={`st ${r.checks.penurunan.ok ? 'ok' : 'ng'}`}> {r.checks.penurunan.ok ? 'OK <25mm' : 'NG ≥25mm'}</span>
              {' '}· {r.info.isOC ? 'OC (pakai Cs)' : 'NC (pakai Cc)'}
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

      <EquipmentReportSheet s={s} r={r} engineerName={engineerName} qcName={qcName} />
    </div>
  );
}

// Laporan A4 — tersembunyi di layar (.report-sheet display:none), tampil saat cetak.
function EquipmentReportSheet({ s, r, engineerName, qcName }) {
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  const i = r.info;
  return (
    <div className="report-sheet">
      <header className="rpt-head">
        <div className="rpt-brand">
          <LogoMark size={48} />
          <div>
            <h1>Laporan Kalkulasi Pondasi Equipment</h1>
            <p>Blok tanpa pedestal · Meyerhof · SNI 1726/1727/2847 · ACI 318-14 · Braja M. Das</p>
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
              {fields.map(([k, l]) => <div key={k} className="rpt-kv-item"><span>{l}</span><b>{s[k] === '' ? '—' : s[k]}</b></div>)}
            </div>
          </div>
        ))}
      </section>

      <section className="rpt-section">
        <h2>2. Sketsa pondasi equipment</h2>
        <div className="rpt-sketch"><EquipmentFoundationSketch s={s} /></div>
      </section>

      <section className="rpt-section">
        <h2>3. Ringkasan beban &amp; daya dukung</h2>
        <p className="rpt-terz">
          Berat fondasi W<sub>f</sub> = {f2(i.Wf)} kN · rasio W<sub>f</sub>/EO = {f2(i.ratioW)} (syarat ≥ 5) ·
          IL = {f2(i.IL)} kN · q<sub>all</sub> = {f2(i.qall)} kN/m² {i.tz.manual ? '(Soil Data)' : '(Meyerhof)'}
          {' '}· Meyerhof auto: qu = {f2(i.tz.qu)} → qall = {f2(i.tz.qall_auto)} kN/m²
          (Nc {f2(i.tz.Nc)}, Nq {f2(i.tz.Nq)}, Nγ {f2(i.tz.Ng)})
        </p>
        <p className="rpt-terz">
          Angin: qh = {f2(i.qh)} N/m² → H<sub>wx</sub> = {f2(i.Hwx)} kN, H<sub>wz</sub> = {f2(i.Hwz)} kN ·
          Gempa: Cs = {f2(i.Cs)} → V<sub>EO</sub> = {f2(i.Vh.EO)} kN, V<sub>y,EO</sub> = {f2(i.Vy.EO)} kN
        </p>
        <table className="rpt-table rpt-checks">
          <thead><tr><th>LC</th><th>Kombinasi</th><th>Fx</th><th>Fy</th><th>Fz</th><th>Mx</th><th>Mz</th><th>σmax</th><th>σmin</th></tr></thead>
          <tbody>
            {r.lcs.map((lc) => (
              <tr key={lc.no}>
                <td>{lc.no}</td><td>{lc.nama}</td>
                <td className="num">{f2(lc.Fx)}</td><td className="num">{f2(lc.Fy)}</td><td className="num">{f2(lc.Fz)}</td>
                <td className="num">{f2(lc.Mx)}</td><td className="num">{f2(lc.Mz)}</td>
                <td className="num">{f2(lc.smax)}</td><td className="num">{f2(lc.smin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rpt-section">
        <h2>4. Hasil pengecekan</h2>
        <table className="rpt-table rpt-checks">
          <thead><tr><th>Pengecekan</th><th>Demand</th><th>Kapasitas</th><th>Rasio</th><th>Status</th></tr></thead>
          <tbody>
            {Object.entries(r.checks).map(([k, v]) => (
              <tr key={k}>
                <td>{LABELS[k]}{v.lc ? ` (${v.lc})` : ''}</td>
                <td className="num">{(k === 'angkur_tarik' && v.noTension) ? '0 (tanpa tarik)' : (k === 'angkur_geser' && v.noShear) ? '0 (friksi)' : f2(v.demand)}</td>
                <td className="num">{f2(v.kapasitas)}</td>
                <td className="num">{f2(v.rasio)}</td>
                <td className={`st ${v.ok ? 'ok' : 'ng'}`}>{v.ok ? 'OK' : 'NG'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rpt-settle">
          Penurunan (Braja Das): Si {f2(i.Si)} + Sc1 {f2(i.Sc1)} + Sc2 {f2(i.Sc2)} = <b>{f2(i.Stot)} mm</b> —
          <span className={`st ${r.checks.penurunan.ok ? 'ok' : 'ng'}`}> {r.checks.penurunan.ok ? 'OK (< 25 mm)' : 'NG (≥ 25 mm)'}</span>
          {' '}· Po&#39; = {f2(i.Po)} kg/m², ΔP = {f2(i.dP)} kg/m², {i.isOC ? 'overconsolidated → Cs' : 'normally consolidated → Cc'}
        </p>
        <p className="rpt-settle">
          Anchor bolt: N<sub>u</sub> = {f2(i.Nu)} kN vs ϕN<sub>n</sub> = {f2(i.phiNn)} kN · V<sub>u</sub> = {f2(i.Vu)} kN vs ϕV<sub>n</sub> = {f2(i.phiVn)} kN ·
          interaksi = {f2(i.inter)} ≤ 1.2 · h<sub>eff</sub> = {f2(i.heff)} mm
        </p>
        <p className="rpt-concl">
          Kesimpulan: <b>{r.overall_ok ? 'Pondasi equipment dinyatakan AMAN' : 'Pondasi equipment TIDAK AMAN'}</b> terhadap
          rasio berat, daya dukung, geser, guling, buoyancy, penurunan, lentur footing, serta kapasitas anchor bolt.
        </p>
      </section>

      <footer className="rpt-foot">
        <p className="rpt-disc">
          ⚠️ Kalkulasi tersederhana mengikuti dokumen FEED (tanpa analisis dinamik) — <b>wajib diverifikasi insinyur sipil berlisensi</b> sebelum konstruksi.
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
