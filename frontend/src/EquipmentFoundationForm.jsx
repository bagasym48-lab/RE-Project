// EquipmentFoundationForm.jsx — form kalkulasi Pondasi Equipment (blok, tanpa pedestal).
// Mesin duduk langsung di blok beton; cek lengkap per dokumen FEED
// DURI-TEST05NW000-CIV-CAL-PHR-2001-00 (lihat equipmentFoundationCalc.js).
// ALAT BANTU EDUKASI — wajib diverifikasi insinyur sipil berlisensi.
import { useState } from 'react';
import EquipmentFoundationSketch from './EquipmentFoundationSketch.jsx';
import { compute, def } from './equipmentFoundationCalc.js';
import { Step, DerivGroup, TheoryIntro, Frac, FDDefs, SoilPressureDiagram, FootingFullForceDiagram, RebarSketch, f, ProjectInfoForm, ReportCover, ReportTOC, RunningHeader, ReportPaged, defProject, ItemsTable } from './reportKit.jsx';

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

export default function EquipmentFoundationForm({ s: sProp, setS: setSProp, project: projectProp, setProject: setProjectProp }) {
  // State bisa "diangkat" ke induk (CivilView) agar tersinkron dengan MTO; fallback
  // ke state lokal bila dipakai berdiri sendiri.
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
        <h1>Kalkulasi Pondasi Equipment</h1>
        <p className="sub">Blok tanpa pedestal · Meyerhof · SNI 1726/1727/2847 · ACI 318-14 (anchor) · Braja M. Das</p>
        <p className="warn">⚠️ Alat bantu edukasi — hasil wajib diverifikasi insinyur sipil berlisensi. Analisis dinamik tidak dilakukan (syarat rasio berat ≥ 5× terpenuhi, RTS PHR).</p>
      </header>

      <div className="layout">
        <section className="inputs">
          <ProjectInfoForm project={project} onChange={updProject} />
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

      <EquipmentReportSheet s={s} r={r} project={project} engineerName={engineerName} qcName={qcName} />
    </div>
  );
}

// Laporan A4 — tersembunyi di layar (.report-sheet display:none), tampil saat cetak.
function EquipmentReportSheet({ s, r, project, engineerName, qcName }) {
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
  const i = r.info;
  const nz = (v) => (Number.isFinite(+v) ? +v : 0);
  const govBC = r.lcs.find((l) => l.nama === r.checks.daya_dukung.lc) || {};
  const aX = 0.5 * nz(s.Bf);
  const VmaxX = i.qu_f * aX;
  return (
    <div className="report-sheet">
      <FDDefs />
      <ReportCover title="Kalkulasi Pondasi Equipment" project={project} engineer={engineerName} qc={qcName} />
      <ReportTOC items={[
        ['1. Umum', ['1.1 Kode & Standar', '1.2 Material & Berat Satuan', '1.3 Kondisi Tanah & Faktor Keamanan']],
        ['2. Data Input', []],
        ['3. Gambar Sketsa', ['3.1 Sketsa Fondasi', '3.2 Detail Penulangan']],
        ['4. Kombinasi Beban', ['4.1 Definisi Beban', '4.2 Kombinasi Beban Servis (LC 301–313)']],
        ['5. Data Fondasi', ['5.1 Data Footing & Penampang', '5.2 Data Equipment']],
        ['6. Analisis Beban & Cek Stabilitas', ['Beban angin & gempa', 'Daya dukung, geser, guling, buoyancy']],
        ['7. Desain Fondasi & Penurunan', ['Lentur & tulangan', 'Penurunan', 'Anchor bolt']],
        ['8. Rekapitulasi Pengecekan', []],
      ]} />
      <ReportPaged header={
        <RunningHeader project={project} title="Kalkulasi Pondasi Equipment"
          right={<span className={`rpt-verdict ${r.overall_ok ? 'ok' : 'ng'}`}>{r.overall_ok ? 'AMAN' : 'TIDAK AMAN'}</span>} />
      }>

      <section className="rpt-section">
        <h2>1. Umum</h2>
        <h3>1.1 Kode &amp; Standar</h3>
        <ItemsTable head={['Item', 'Deskripsi']} rows={[
          ['Metode desain', 'ASD (stabilitas) + LRFD (penulangan)'],
          ['Daya dukung tanah', 'Meyerhof (1963) — general bearing capacity'],
          ['Beton bertulang', 'SNI 2847:2019 (ACI 318-14)'],
          ['Beban angin', 'SNI 1727:2020 · ASCE 7-16'],
          ['Beban gempa', 'SNI 1726:2019'],
          ['Anchor bolt', 'ACI 318-14 Bab 17'],
          ['Penurunan', 'Braja M. Das (1988) · Steinbrenner'],
          ['Analisis dinamik', 'Diabaikan (rasio berat ≥ 5 — RTS PHR-SP-CI-GG-002)'],
        ]} />
        <h3>1.2 Material &amp; Berat Satuan</h3>
        <ItemsTable rows={[
          [<>Kuat tekan beton f&#39;<sub>c</sub></>, `${f(s.fc)} MPa`],
          [<>Tegangan leleh tulangan f<sub>y</sub></>, `${f(s.fy)} MPa`],
          [<>Kuat tarik anchor bolt f<sub>uta</sub></>, `${f(s.futa)} MPa`],
          [<>Berat jenis beton γ<sub>c</sub></>, `${f(s.gc)} kN/m³`],
          [<>Berat jenis tanah γ<sub>s</sub></>, `${f(s.gs)} kN/m³`],
          [<>Berat jenis air γ<sub>w</sub></>, `${f(s.gw)} kN/m³`],
        ]} />
        <h3>1.3 Kondisi Tanah &amp; Faktor Keamanan</h3>
        <ItemsTable rows={[
          [<>Sudut geser dalam ϕ</>, `${f(s.phi)}°`],
          [<>Kohesi c</>, `${f(s.c)} kPa`],
          ['N-SPT', `${f(s.N_spt, 0)}`],
          [<>Daya dukung izin q<sub>all</sub></>, `${f(i.qall)} kN/m² ${i.tz.manual ? '(Soil Data)' : '(Meyerhof)'}`],
          ['SF daya dukung', `${f(s.SF_bc, 1)}`],
          ['SF geser / guling / buoyancy', '1.5 / 2.0 / 1.5'],
          [<>Koef. gesek dasar μ</>, `${f(s.mu_fric)}`],
        ]} />
      </section>

      <section className="rpt-section">
        <h2>2. Data Input</h2>
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
        <h2>3. Gambar Sketsa</h2>
        <h3>3.1 Sketsa Fondasi</h3>
        <div className="rpt-sketch"><EquipmentFoundationSketch s={s} /></div>
        <h3>3.2 Detail Penulangan</h3>
        <RebarSketch B={nz(s.Bf) * 1000} L={nz(s.Lf) * 1000} h={nz(s.Hf) * 1000}
          cover={nz(s.cover)} db={nz(s.Drl)} s={nz(s.srl)} nPed={0} />
        <p className="rpt-note2">
          Jaring tulangan bawah dua arah Ø{f(s.Drl, 0)}-{f(s.srl, 0)} mm, selimut beton {f(s.cover, 0)} mm —
          sesuai input kalkulasi (dipakai pada cek lentur &amp; tulangan minimum §7). Anchor bolt
          {` ${f(s.n_bolt, 0)} × Ø${f(s.d_bolt, 0)}`} mm tertanam {f(s.h_anchor, 0)} mm (detail pada §7).
        </p>
      </section>

      <section className="rpt-section">
        <h2>4. Kombinasi Beban</h2>
        <h3>4.1 Definisi Beban</h3>
        <ItemsTable head={['Notasi', 'Deskripsi beban']} rows={[
          ['D', 'Beban mati — berat blok fondasi'],
          ['EE / EO / ET', `Berat equipment kosong / operasi / test = ${f(s.EE)} / ${f(s.EO)} / ${f(s.ET)} kN`],
          ['W', 'Beban angin (SNI 1727:2020, min 770 N/m²)'],
          ['V', 'Beban gempa (SNI 1726:2019, Cs + 0.14·SDS vertikal)'],
          ['IL', `Impact load = 1.2·EO = ${f(i.IL)} kN`],
        ]} />
        <h3>4.2 Kombinasi Beban Servis (LC 301–313) &amp; Tegangan Kontak</h3>
        <p className="rpt-note2">13 kombinasi: D/EE/EO/ET dikombinasi angin 0.6W/0.45W &amp; gempa 0.91Vx+0.27Vz + 0.14·SDS vertikal. σmax/σmin dihitung per LC.</p>
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
        <h2>5. Data Fondasi</h2>
        <h3>5.1 Data Footing &amp; Penampang</h3>
        <ItemsTable rows={[
          [<>Panjang fondasi L<sub>f</sub></>, `${f(s.Lf)} m`],
          [<>Lebar fondasi B<sub>f</sub></>, `${f(s.Bf)} m`],
          [<>Tinggi fondasi H<sub>f</sub></>, `${f(s.Hf)} m`],
          [<>Tinggi di atas / tertanam H<sub>fa</sub> / H<sub>fb</sub></>, `${f(s.Hfa)} / ${f(i.Hfb)} m`],
          [<>Luas dasar A<sub>f</sub></>, `${f(i.Af, 3)} m²`],
          [<>Modulus penampang S<sub>x</sub> / S<sub>z</sub></>, `${f(i.Sx, 3)} / ${f(i.Sz, 3)} m³`],
          [<>Berat fondasi W<sub>f</sub></>, `${f(i.Wf)} kN`],
        ]} />
        <h3>5.2 Data Equipment (tanpa pedestal)</h3>
        <ItemsTable rows={[
          [<>Dimensi L<sub>eq</sub> / B<sub>eq</sub> / H<sub>eq</sub></>, `${f(s.Leq)} / ${f(s.Beq)} / ${f(s.Heq)} m`],
          ['Berat EE / EO / ET', `${f(s.EE)} / ${f(s.EO)} / ${f(s.ET)} kN`],
          [<>Rasio berat W<sub>f</sub>/EO (syarat ≥ 5)</>, `${f(i.ratioW)}`],
          ['Anchor bolt', `${f(s.n_bolt, 0)} baut Ø${f(s.d_bolt, 0)} mm, tanam ${f(s.h_anchor, 0)} mm`],
        ]} />
      </section>

      <section className="rpt-section">
        <h2>6. Analisis Beban &amp; Cek Stabilitas</h2>

        <TheoryIntro title="Fondasi blok equipment & beban dinamik" refs="Meyerhof (1963) · SNI 1726/1727 · Arya (1979)">
          <p>
            Fondasi mesin berupa blok masif tanpa pedestal; equipment duduk langsung di atas blok dan
            gaya tarik/gesernya dipikul oleh anchor bolt. Bila rasio berat fondasi terhadap berat mesin
            (W<sub>f</sub>/EO) memenuhi syarat minimum (≥ 5, RTS PHR), massa fondasi cukup meredam getaran
            sehingga analisis dinamik terperinci tidak diperlukan dan cukup ditinjau secara pseudo-statik.
          </p>
          <p>
            Kapasitas dukung tanah dihitung dengan metode Meyerhof (faktor daya dukung disertai faktor
            bentuk dan kedalaman). Beban lingkungan mencakup angin (SNI 1727:2020/ASCE 7-16, dengan tekanan
            minimum 770 N/m²) dan gempa (SNI 1726:2019, koefisien C<sub>s</sub> plus komponen vertikal
            0.2·S<sub>DS</sub>). Seluruh kombinasi servis (LC 301–313) diperiksa terhadap tegangan kontak
            (σ<sub>max</sub> ≤ q<sub>all</sub>, σ<sub>min</sub> ≥ 0) serta stabilitas geser, guling, dan buoyancy.
          </p>
        </TheoryIntro>

        <DerivGroup title="Berat fondasi & rasio (analisis dinamik diabaikan)" refs="RTS PHR-SP-CI-GG-002 · Arya (1979)">
          <Step desc="Berat blok fondasi" expr={<>W<sub>f</sub> = γ<sub>c</sub>·A<sub>f</sub>·H<sub>f</sub></>}
            sub={<>{f(s.gc)}·{f(i.Af, 3)}·{f(s.Hf)}</>} val={f(i.Wf)} unit="kN" />
          <Step desc="Rasio berat fondasi terhadap mesin (syarat ≥ 5)"
            expr={<>W<sub>f</sub> / EO</>} sub={<>{f(i.Wf)} / {f(s.EO)}</>} val={f(i.ratioW)} ok={r.checks.rasio_berat.ok} />
        </DerivGroup>

        <DerivGroup title="Daya dukung tanah (Meyerhof)" refs="Meyerhof (1963)">
          <Step desc="Faktor kapasitas dukung" expr={<>N<sub>q</sub> = tan²(45+ϕ/2)·e^(π·tanϕ)</>} val={f(i.tz.Nq)} />
          <Step expr={<>N<sub>c</sub> = (N<sub>q</sub>−1)·cotϕ · ; · N<sub>γ</sub> = 2(N<sub>q</sub>+1)·tanϕ</>}
            sub={<>N<sub>c</sub> = {f(i.tz.Nc)} ; N<sub>γ</sub> = {f(i.tz.Ng)}</>} />
          <Step desc="Kapasitas dukung ultimit" expr={<>q<sub>u</sub> = c·N<sub>c</sub>·F<sub>cs</sub>F<sub>cd</sub> + q·N<sub>q</sub>·F<sub>qs</sub> + 0.5·γ·B·N<sub>γ</sub>·F<sub>γs</sub></>}
            val={f(i.tz.qu)} unit="kN/m²" />
          <Step desc={i.tz.manual ? 'Daya dukung izin (Soil Data — governing)' : 'Daya dukung izin'}
            refs="FS = 3" expr={<>q<sub>all</sub> = q<sub>u</sub> / FS</>}
            sub={i.tz.manual ? <>{f(i.tz.qall_auto)} (auto) → dipakai q<sub>all</sub> Soil Data</> : <>{f(i.tz.qu)} / {f(s.SF_bc)}</>}
            val={f(i.qall)} unit="kN/m²" />
        </DerivGroup>

        <DerivGroup title="Beban angin" refs="SNI 1727:2020 · ASCE 7-16">
          <Step desc="Tekanan kecepatan (≥ 770 N/m²)" refs="SNI 1727:2020 Pers. 26.10-1"
            expr={<>q<sub>h</sub> = 0.613·K<sub>z</sub>·K<sub>zt</sub>·K<sub>d</sub>·K<sub>e</sub>·V²</>}
            sub={<>{f(i.qh0)} → max({f(i.qh0)} ; {f(s.qh_min)})</>} val={f(i.qh)} unit="N/m²" />
          <Step desc="Gaya angin (arah X / Z)" refs="ASCE 7-16 Ps. 29.4"
            expr={<>H<sub>w</sub> = q<sub>h</sub>·G·C<sub>f</sub>·A<sub>w</sub></>}
            sub={<>A<sub>wx</sub>={f(i.Awx, 3)} ; A<sub>wz</sub>={f(i.Awz, 3)} m²</>} val={`${f(i.Hwx)} / ${f(i.Hwz)}`} unit="kN" />
        </DerivGroup>

        <DerivGroup title="Beban gempa" refs="SNI 1726:2019">
          <Step desc="Koefisien seismik" refs="SNI 1726:2019 Ps. 7.8.1.1"
            expr={<>C<sub>s</sub> = S<sub>DS</sub>·I<sub>e</sub>/R ≥ C<sub>s,min</sub></>}
            sub={<>{f(s.SDS)}·{f(s.Ie)}/{f(s.R)} = {f(i.Cs, 3)} ; min {f(i.CsMin, 3)}</>} val={f(i.Cs, 3)} />
          <Step desc="Gaya gempa horizontal & vertikal (EO)"
            expr={<>V = C<sub>s</sub>·EO · ; · V<sub>y</sub> = 0.2·S<sub>DS</sub>·(D+EO)</>}
            sub={<>V = {f(i.Vh.EO)} ; V<sub>y</sub> = {f(i.Vy.EO)}</>} unit="kN" />
        </DerivGroup>

        <DerivGroup title="Tegangan kontak tanah" refs={`governing ${r.checks.daya_dukung.lc}`}>
          <Step desc="Tegangan maksimum di dasar fondasi"
            expr={<>σ<sub>max</sub> = <Frac n={<>F<sub>y</sub></>} d={<>A<sub>f</sub></>} /> + <Frac n={<>|M<sub>x</sub>|</>} d={<>S<sub>x</sub></>} /> + <Frac n={<>|M<sub>z</sub>|</>} d={<>S<sub>z</sub></>} /></>}
            sub={<><Frac n={f(govBC.Fy)} d={f(i.Af, 3)} /> + <Frac n={f(Math.abs(nz(govBC.Mx)))} d={f(i.Sx, 3)} /> + <Frac n={f(Math.abs(nz(govBC.Mz)))} d={f(i.Sz, 3)} /></>}
            val={f(r.checks.daya_dukung.demand)} unit="kN/m²" ok={r.checks.daya_dukung.demand <= i.qall} />
          <Step desc="Tegangan minimum (harus ≥ 0, tanpa uplift)" expr={<>σ<sub>min</sub> = F<sub>y</sub>/A<sub>f</sub> − |M<sub>x</sub>|/S<sub>x</sub> − |M<sub>z</sub>|/S<sub>z</sub></>}
            val={f(r.checks.daya_dukung.smin)} unit="kN/m²" ok={r.checks.daya_dukung.smin >= 0} />
        </DerivGroup>

        <DerivGroup title="Stabilitas geser, guling & buoyancy">
          <Step desc="Geser (SF ≥ 1.5)" refs="μ=0.5 SNI 1726:2019 Ps. 7.13.8"
            expr={<>SF = F<sub>y</sub>·μ / H</>} val={f(r.checks.stab_geser.SF)} ok={r.checks.stab_geser.ok} />
          <Step desc="Guling (SF ≥ 2)" expr={<>SF = M<sub>r</sub> / M<sub>guling</sub> = F<sub>y</sub>·0.5·L / M</>}
            val={f(r.checks.guling.SF)} ok={r.checks.guling.ok} />
          <Step desc="Buoyancy (W_f ≥ 1.5·gaya angkat)" expr={<>W<sub>f</sub> ≥ 1.5·(H<sub>fb</sub>·A<sub>f</sub>·γ<sub>w</sub>)</>}
            sub={<>SF = {f(r.checks.buoyancy.SF)}</>} ok={r.checks.buoyancy.ok} />
        </DerivGroup>

        <div className="fd-row">
          <SoilPressureDiagram sMax={r.checks.daya_dukung.demand} sMin={r.checks.daya_dukung.smin} />
        </div>
      </section>

      <section className="rpt-section">
        <h2>7. Desain Fondasi &amp; Penurunan</h2>

        <TheoryIntro title="Penurunan, penulangan & anchor bolt" refs="SNI 2847:2019 · ACI 318-14 Bab 17 · Braja M. Das">
          <p>
            Penurunan total blok fondasi dihitung sebagai jumlah penurunan segera (elastis) dan konsolidasi
            (primer + sekunder), dengan lapisan tanah kohesif ditinjau kondisi terkonsolidasi normal (NC) atau
            lebih (OC) berdasarkan tegangan prakonsolidasi. Pelat blok ditinjau sebagai kantilever akibat
            tekanan tanah reaktif; tulangan lentur arah X dan Z direncanakan melampaui momen ultimit dengan
            luas ≥ tulangan minimum.
          </p>
          <p>
            Anchor bolt menyalurkan gaya tarik dan geser dari equipment ke beton. Kapasitasnya dievaluasi
            menurut ACI 318-14 Bab 17 sebagai nilai minimum dari moda keruntuhan baja, jebol beton (breakout),
            cabut (pullout), dan pecah tepi (blow-out), lalu diperiksa terhadap interaksi tarik–geser.
          </p>
        </TheoryIntro>

        <DerivGroup title="Penurunan (Braja Das)" refs="Steinbrenner · Braja M. Das (1988)">
          <Step desc="Penurunan segera" expr={<>S<sub>i</sub> = q<sub>0</sub>·B·<Frac n="(1−μ²)" d={<>E<sub>s</sub></>} />·I<sub>s</sub>·I<sub>f</sub>·4</>}
            sub={<>I<sub>s</sub> = I₁+<Frac n="(1−2μ)" d="(1−μ)" />·I₂ = {f(i.Is, 3)}</>} val={f(i.Si)} unit="mm" />
          <Step desc={`Konsolidasi (${i.isOC ? 'OC → Cs' : 'NC → Cc'})`} expr={<>S<sub>c</sub> = <Frac n="C·H" d="1+e₀" />·log<Frac n="P₀'+ΔP" d="P₀'" /></>}
            sub={<>P₀'={f(i.Po, 0)} ; ΔP={f(i.dP, 0)} kg/m² → Sc1 {f(i.Sc1)}+Sc2 {f(i.Sc2)}</>} />
          <Step desc="Penurunan total (batas 25 mm)" expr={<>S = S<sub>i</sub>+S<sub>c1</sub>+S<sub>c2</sub></>}
            sub={<>{f(i.Si)}+{f(i.Sc1)}+{f(i.Sc2)}</>} val={f(i.Stot)} unit="mm" ok={r.checks.penurunan.ok} />
        </DerivGroup>

        <DerivGroup title="Lentur footing & tulangan" refs="SNI 2847:2019">
          <Step desc="Beban garis ultimit & tinggi efektif"
            expr={<>q<sub>u,f</sub> = 1.4·q<sub>all</sub> ; d = H<sub>f</sub>−c−0.5·D<sub>rl</sub></>}
            sub={<>q<sub>u,f</sub>={f(i.qu_f)} kN/m ; d={f(i.d_eff)} mm</>} />
          <Step desc="Kapasitas momen footing" refs="SNI 2847:2019 Tabel 21.2.2"
            expr={<>ϕM<sub>n</sub> = ϕ·A<sub>s</sub>·f<sub>y</sub>·(d−0.5a)</>} val={f(i.Mc)} unit="kNm" />
          <Step desc="Momen ultimit (arah X kantilever ½B / arah Z)"
            expr={<>M<sub>ux</sub> = 0.5·q<sub>u,f</sub>·(0.5B)² ; M<sub>uz</sub> = ⅛·q<sub>u,f</sub>·(0.5L)²</>}
            sub={<>M<sub>ux</sub>={f(i.Mux)} ; M<sub>uz</sub>={f(i.Muz)} kNm</>} ok={r.checks.lentur_x.ok && r.checks.lentur_z.ok} />
          <Step desc="Tulangan minimum" refs="SNI 2847:2019 Tabel 8.6.1.1"
            expr={<>A<sub>s,min</sub> = max(0.0018·420/f<sub>y</sub> ; 0.0014)·A<sub>g</sub></>}
            sub={<>{f(i.As_min, 0)} vs A<sub>s</sub> {f(i.As, 0)} mm²</>} ok={r.checks.tulangan_min.ok} />
        </DerivGroup>

        <DerivGroup title="Anchor bolt (4 baut sudut)" refs="ACI 318-14 Bab 17">
          <Step desc="Luas efektif baut" expr={<>A<sub>se</sub> = π/4·(d<sub>o</sub>−0.9743/n<sub>t</sub>)²</>} val={f(i.Ase)} unit="mm²" />
          <Step desc="Kapasitas tarik (min baja/breakout/pullout/blow-out)" refs="ACI 318-14 17.4"
            expr={<>ϕN<sub>n</sub> = 0.7·min(N<sub>sa</sub>,N<sub>cb</sub>,N<sub>pn</sub>,N<sub>sb</sub>)</>}
            sub={<>min({f(i.Nsa)},{f(i.Ncb)},{f(i.Npn)},{f(i.Nsb)}) · N<sub>u</sub>={f(i.Nu)}</>} val={f(i.phiNn)} unit="kN" ok={r.checks.angkur_tarik.ok} />
          <Step desc="Kapasitas geser (min baja/breakout/pryout)" refs="ACI 318-14 17.5"
            expr={<>ϕV<sub>n</sub> = 0.7·min(V<sub>sa</sub>,V<sub>cb</sub>,V<sub>cp</sub>)</>}
            sub={<>V<sub>u</sub>={f(i.Vu)} kN</>} val={f(i.phiVn)} unit="kN" ok={r.checks.angkur_geser.ok} />
          <Step desc="Interaksi tarik–geser" refs="ACI 318-14 17.6.3"
            expr={<>N<sub>u</sub>/ϕN<sub>n</sub> + V<sub>u</sub>/ϕV<sub>n</sub> ≤ 1.2</>}
            sub={<>{f(i.Nu)}/{f(i.phiNn)} + {f(i.Vu)}/{f(i.phiVn)}</>} val={f(i.inter, 3)} ok={r.checks.angkur_interaksi.ok} />
        </DerivGroup>

        <div className="fd-row">
          <FootingFullForceDiagram
            B={nz(s.Bf)} a={aX} cCol={nz(s.Beq)} nPed={1}
            w={i.qu_f} Vmax={VmaxX} Mmax={i.Mux}
            BLabel={`${f(s.Bf, 2)} m`} topLabel="equipment" />
        </div>
        <p className="rpt-note2">
          Diagram gaya dalam <b>kritis pada penampang penuh fondasi</b> (tepi ke tepi, B<sub>f</sub> = {f(s.Bf, 2)} m, arah X):
          reaksi tanah ultimit q<sub>u,f</sub> = 1.4·q<sub>all</sub> menimbulkan geser maksimum
          V<sub>max</sub> = {f(VmaxX)} kN di sisi blok dan momen maksimum M<sub>max</sub> = {f(i.Mux)} kNm di tengah;
          distribusi tekanan tanah trapesium (σmax–σmin) pada §4.
        </p>
      </section>

      <section className="rpt-section">
        <h2>8. Rekapitulasi Pengecekan</h2>
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
      </ReportPaged>
    </div>
  );
}
