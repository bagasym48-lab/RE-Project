// reportKit.jsx — komponen bersama untuk LAPORAN CETAK (PDF A4):
//  • ReportCover : halaman sampul (banner judul + tagline + logo + info proyek + revisi)
//  • ProjectInfoForm : input informasi proyek (dipakai di semua kalkulator)
//  • Step  : satu baris rincian rumus  →  simbolik = substitusi angka = hasil (+ referensi)
//  • Frac  : pecahan bertingkat, Ref : label referensi standar
//  • Diagram gaya dalam (SFD/BMD): tekanan tanah, kantilever footing, kolom & beam
// Semua murni presentasional (tanpa perhitungan) — angka dikirim dari pemanggil.
import { LogoMark } from './Logo.jsx';

export const f = (x, d = 2) => (Number.isFinite(Number(x)) ? Number(x).toFixed(d) : '—');

// ============================================================
// Informasi proyek (dipakai di form + cover laporan)
// ============================================================
export const defProject = {
  jobNo: '', jobName: '', client: '', site: '',
  docNo: '', refNo: '', structureName: '', loadCombo: '', rev: '', revDesc: '',
};

const PROJECT_FIELDS = [
  ['jobNo', 'Project / Job No.'], ['jobName', 'Project / Job Name'],
  ['client', 'Client Name'], ['site', 'Site Name'],
  ['docNo', 'Document No.'], ['refNo', 'Reference No.'],
  ['structureName', 'Structure Name'], ['loadCombo', 'Load Combination Group'],
  ['rev', 'Rev No.'], ['revDesc', 'Rev — Description'],
];

// Fieldset input informasi proyek untuk panel kalkulator (bukan print).
export function ProjectInfoForm({ project, onChange }) {
  const p = project || {};
  return (
    <fieldset className="group">
      <legend>Informasi proyek (untuk cover laporan PDF)</legend>
      <div className="fields">
        {PROJECT_FIELDS.map(([k, label]) => (
          <label className="field" key={k} title={label}>
            <span>{label}</span>
            <input type="text" value={p[k] ?? ''} onChange={(e) => onChange(k, e.target.value)} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Halaman sampul laporan — hanya tampil saat cetak (di dalam .report-sheet).
export function ReportCover({ title, project, engineer, qc }) {
  const p = project || {};
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const rows = [
    ['PROJECT / JOB NO.', p.jobNo], ['PROJECT / JOB NAME', p.jobName],
    ['CLIENT NAME', p.client], ['SITE NAME', p.site],
    ['DOCUMENT NO.', p.docNo], ['REFERENCE NO.', p.refNo],
    ['STRUCTURE NAME', p.structureName], ['LOAD COMBINATION GROUP', p.loadCombo],
  ];
  const nb = ' ';
  return (
    <section className="rpt-cover">
      <div className="cov-banner">{title}</div>
      <div className="cov-tagline">Smarter Engineering Starts Here</div>

      <div className="cov-logo"><LogoMark size={120} /></div>

      <table className="cov-info">
        <thead><tr><th>TITLE</th><th>DESCRIPTION</th></tr></thead>
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><td className="cov-k">{k}</td><td className="cov-v">{v || nb}</td></tr>)}
        </tbody>
      </table>

      <table className="cov-rev">
        <thead>
          <tr><th>REV</th><th>DATE</th><th>DESCRIPTION</th><th>PREP&apos;D</th><th>CHK&apos;D</th><th>APPR&apos;D</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>{p.rev || nb}</td><td>{p.rev ? today : nb}</td><td>{p.revDesc || nb}</td>
            <td>{engineer || nb}</td><td>{qc || nb}</td><td>{nb}</td>
          </tr>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}><td>{nb}</td><td>{nb}</td><td>{nb}</td><td>{nb}</td><td>{nb}</td><td>{nb}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="cov-foot">© 2026 RE-Project Engineering Suite · All Rights Reserved</div>
    </section>
  );
}

// Daftar isi laporan — items = [[judul utama, [sub, sub, ...]], ...]. Hanya tampil saat cetak.
export function ReportTOC({ items }) {
  return (
    <section className="rpt-toc">
      <div className="cov-banner">DAFTAR ISI</div>
      <ol className="toc-list">
        {items.map(([main, subs], i) => (
          <li key={i}>
            <span className="toc-main">{main}</span>
            {subs && subs.length > 0 && (
              <ul className="toc-sub">{subs.map((sub, j) => <li key={j}>{sub}</li>)}</ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

// Header berjalan di SETIAP halaman cetak. Judul = info proyek digabung
// (No. Proyek – Site – No. Dokumen – No. Referensi – Nama Struktur) sehingga
// berbeda tiap proyek; bila semua kosong, memakai `title` kalkulasi sebagai
// fallback. `right` opsional (mis. badge verdict / label ESTIMASI).
export function RunningHeader({ project, title, right }) {
  const p = project || {};
  const parts = [p.jobNo, p.site, p.docNo, p.refNo, p.structureName]
    .map((x) => String(x ?? '').trim()).filter(Boolean);
  const heading = parts.length ? parts.join('  –  ') : (title || 'Laporan Kalkulasi');
  return (
    <div className="rpt-runhead">
      <LogoMark size={26} />
      <div className="rh-mid">
        <div className="rh-title">{heading}</div>
        {title && <div className="rh-sub">{title}</div>}
      </div>
      {right != null && <div className="rh-right">{right}</div>}
    </div>
  );
}

// Pembungkus badan laporan agar `header` diulang di setiap halaman cetak.
// Memakai <thead> tabel (diulang browser tiap halaman — andal di Chrome).
// Cover & Daftar Isi diletakkan DI LUAR pembungkus ini (tanpa header berjalan).
export function ReportPaged({ header, children }) {
  return (
    <table className="rpt-paged">
      <thead><tr><td>{header}</td></tr></thead>
      <tbody><tr><td>{children}</td></tr></tbody>
    </table>
  );
}

export function Frac({ n, d }) {
  return (
    <span className="frac"><span className="fr-n">{n}</span><span className="fr-d">{d}</span></span>
  );
}

export function Ref({ children }) {
  return <span className="rpt-ref">{children}</span>;
}

// Baris rincian perhitungan. desc = keterangan; expr = rumus simbolik (JSX);
// sub = substitusi angka (JSX/str, opsional); val = hasil; refs = referensi standar.
export function Step({ desc, expr, sub, val, unit, refs, ok, note }) {
  return (
    <div className="calc-step">
      {(desc || refs) && (
        <div className="cs-head">
          {desc && <span className="cs-desc">{desc}</span>}
          {refs && <Ref>{refs}</Ref>}
        </div>
      )}
      <div className="cs-math">
        {expr != null && <span className="cs-expr">{expr}</span>}
        {sub != null && <><span className="cs-op">=</span><span className="cs-sub">{sub}</span></>}
        {val != null && <><span className="cs-op">=</span><b className="cs-val">{val}{unit ? <span className="cs-unit"> {unit}</span> : null}</b></>}
        {ok != null && <span className={`cs-chip ${ok ? 'ok' : 'ng'}`}>{ok ? 'OK' : 'NG'}</span>}
      </div>
      {note && <div className="cs-note">{note}</div>}
    </div>
  );
}

export function DerivGroup({ title, refs, children }) {
  return (
    <div className="deriv-group">
      <h4 className="dg-title">{title}{refs && <Ref>{refs}</Ref>}</h4>
      {children}
    </div>
  );
}

// Pengantar teoritis — ditempatkan SEBELUM rincian/hasil perhitungan pada
// laporan cetak, agar pembaca memahami dasar teori sebelum melihat angka.
// Tanpa label/judul: langsung ke kalimat pengantarnya. (title/refs tetap
// diterima demi kompatibilitas pemanggil, namun tidak dirender.)
export function TheoryIntro({ children }) {
  return (
    <div className="rpt-theory">
      <div className="rt-body">{children}</div>
    </div>
  );
}

// ============================================================
// Diagram gaya dalam
// ============================================================
const num = (v, f0 = 0) => { const x = Number(v); return Number.isFinite(x) ? x : f0; };

// Distribusi tekanan tanah di bawah footing (trapesium σmax → σmin).
export function SoilPressureDiagram({ Bf, sMax, sMin, unit = 'kN/m²' }) {
  const W = 300, H = 170, M = 26;
  const bw = W - 2 * M, x0 = M, x1 = W - M;
  const yTop = 40, foot = 14;
  const yFoot = yTop + foot;
  const rawMax = num(sMax), rawMin = num(sMin);
  const smax = Math.max(rawMax, 0.0001), smin = Math.max(rawMin, 0);   // geometri (tanah tak menarik)
  const peak = Math.max(smax, smin) || 1;
  const hMax = 70;
  const hL = (smax / peak) * hMax, hR = (smin / peak) * hMax;
  const yBaseL = yFoot + hL, yBaseR = yFoot + hR;
  const arrows = 6;
  return (
    <figure className="fd">
      <figcaption>Distribusi tekanan tanah</figcaption>
      <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Distribusi tekanan tanah">
        {/* footing */}
        <rect className="fd-mem" x={x0} y={yTop} width={bw} height={foot} />
        {/* trapesium tekanan */}
        <path className="fd-load-fill" d={`M ${x0} ${yFoot} L ${x1} ${yFoot} L ${x1} ${yBaseR} L ${x0} ${yBaseL} Z`} />
        <line className="fd-axis" x1={x0} y1={yFoot} x2={x1} y2={yFoot} />
        {/* panah tekanan ke atas */}
        {Array.from({ length: arrows }).map((_, k) => {
          const t = k / (arrows - 1);
          const x = x0 + t * bw;
          const yb = yBaseL + t * (yBaseR - yBaseL);
          return <line key={k} className="fd-arrow" x1={x} y1={yb} x2={x} y2={yFoot} markerEnd="url(#fdArrow)" />;
        })}
        <text className="fd-val" x={x0} y={yBaseL + 14} textAnchor="start">σmax {f(rawMax)}</text>
        <text className="fd-val" x={x1} y={yBaseR + 14} textAnchor="end">σmin {f(rawMin)}{rawMin < 0 ? ' (uplift)' : ''}</text>
        <text className="fd-unit" x={W / 2} y={H - 5} textAnchor="middle">{unit}</text>
      </svg>
    </figure>
  );
}

// Kantilever footing: beban merata qu ke atas → SFD (segitiga) & BMD (parabola).
// Muka kolom di KIRI (gaya maks), tepi bebas di KANAN.
export function CantileverForceDiagram({ a, w, Vmax, Mmax, title = 'Gaya dalam footing (kantilever)' }) {
  const W = 320, H = 292, M = 30;
  const x0 = M, x1 = W - M, span = x1 - x0;
  const yMem = 44, yS = 152, sBand = 38, yM = 228, mBand = 42;
  const npts = 24;
  // SFD: V(x)=w·(a−x), maks di muka (kiri) → 0 di tepi (kanan)
  const sfd = Array.from({ length: npts + 1 }, (_, k) => { const t = k / npts; return [x0 + t * span, yS - (1 - t) * sBand]; });
  // BMD: M(x)=w·(a−x)²/2, maks di muka (kiri), digambar ke bawah (hogging)
  const bmd = Array.from({ length: npts + 1 }, (_, k) => { const t = k / npts; return [x0 + t * span, yM + (1 - t) ** 2 * mBand]; });
  const poly = (pts) => pts.map((p) => p.join(',')).join(' ');
  return (
    <figure className="fd">
      <figcaption>{title}</figcaption>
      <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {/* beban merata */}
        <text className="fd-lbl" x={W / 2} y={14} textAnchor="middle">qu = {f(w)} kN/m ↑</text>
        <rect className="fd-mem" x={x0} y={yMem} width={span} height={8} />
        {Array.from({ length: 7 }).map((_, k) => { const x = x0 + (k / 6) * span; return <line key={k} className="fd-arrow" x1={x} y1={yMem + 26} x2={x} y2={yMem + 8} markerEnd="url(#fdArrow)" />; })}
        <line className="fd-face" x1={x0} y1={yMem - 4} x2={x0} y2={yM - 12} />
        <text className="fd-face-lbl" x={x0 + 3} y={yMem - 8} textAnchor="start">muka kolom</text>
        <text className="fd-face-lbl" x={x1} y={yMem - 8} textAnchor="end">tepi</text>
        <text className="fd-dim" x={W / 2} y={yMem + 40} textAnchor="middle">a = {f(a)} m</text>

        {/* SFD */}
        <text className="fd-lbl" x={x0 + 4} y={yS - sBand - 7} textAnchor="start">SFD (kN)</text>
        <line className="fd-axis" x1={x0} y1={yS} x2={x1} y2={yS} />
        <polygon className="fd-shear-fill" points={`${x0},${yS} ${poly(sfd)} ${x1},${yS}`} />
        <text className="fd-val" x={x0 + 6} y={yS - sBand + 14} textAnchor="start">Vmax {f(Vmax)}</text>

        {/* BMD */}
        <text className="fd-lbl" x={x0 + 4} y={yM - 10} textAnchor="start">BMD (kNm)</text>
        <line className="fd-axis" x1={x0} y1={yM} x2={x1} y2={yM} />
        <polygon className="fd-mom-fill" points={`${x0},${yM} ${poly(bmd)} ${x1},${yM}`} />
        <text className="fd-val" x={x0 + 10} y={yM + mBand + 14} textAnchor="start">Mmax {f(Mmax)}</text>
      </svg>
    </figure>
  );
}

// Footing penampang PENUH (tepi ke tepi): reaksi tanah merata ke atas dengan
// kolom/pedestal di tengah → SFD antisimetris (±Vmax di sisi kolom) & BMD
// simetris (parabola, Mmax di tengah). Menampilkan gaya dalam KRITIS di seluruh
// lebar pondasi. B, a, cCol, sPed dipakai untuk rasio geometri (satuan bebas asal
// konsisten); BLabel = teks dimensi. Model simetris — eksak utk 1 pedestal,
// ilustratif utk 2 pedestal (lihat catatan laporan).
// Footing PENUH tepi-ke-tepi, layout LANDSCAPE selebar halaman (dibungkus
// .fd-full). Reaksi tanah merata ke atas + pedestal/blok di tengah →
// SFD antisimetris (±Vmax di sisi pedestal) & BMD simetris (Mmax di tengah).
// aFrac = a/B (posisi puncak; 0.5 = tepat di tengah utk 1 pedestal). Display-only.
export function FootingFullForceDiagram({ B, a, cCol = 0, sPed = 0, nPed = 1, w, Vmax, Mmax,
  BLabel, topLabel = 'kolom', title = 'Gaya dalam kritis footing (penampang penuh, tepi ke tepi)' }) {
  const W = 760, H = 300, M = 40;
  const x0 = M, x1 = W - M, span = x1 - x0, cx = (x0 + x1) / 2;
  const yLbl = 15, yPedTop = 30, yMem = 58, memH = 10;
  const yArrB = yMem + memH + 20;                 // 88
  const yS = 168, sBand = 30, yM = 250, mBand = 28;
  const Bn = num(B, 1) || 1;
  const aFrac = Math.min(Math.max(num(a) / Bn, 0), 0.5);
  const pedW = Math.min(Math.max(num(cCol) / Bn, 0), 0.9) * span;
  const xLa = x0 + aFrac * span, xRa = x1 - aFrac * span;
  const sFrac = Math.min(num(sPed) / Bn, 0.8);
  const centers = nPed >= 2 ? [cx - sFrac * span / 2, cx + sFrac * span / 2] : [cx];
  const nArr = 15;
  const npts = 40;
  const bmd = Array.from({ length: npts + 1 }, (_, k) => {
    const t = k / npts; return [x0 + t * span, yM + (1 - (2 * t - 1) ** 2) * mBand];
  });
  const poly = (pts) => pts.map((p) => p.join(',')).join(' ');
  return (
    <figure className="fd fd-wide">
      <figcaption>{title}</figcaption>
      <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {/* beban kolom/pedestal ke bawah */}
        {centers.map((c, i) => (
          <line key={`p${i}`} className="fd-arrow" x1={c} y1={yLbl + 4} x2={c} y2={yPedTop - 2} markerEnd="url(#fdArrow)" />
        ))}
        <text className="fd-lbl" x={cx} y={yLbl} textAnchor="middle">P (beban {topLabel})</text>
        {/* pedestal / blok di atas footing */}
        {pedW > 1 && centers.map((c, i) => (
          <rect key={i} className="fd-support" x={c - pedW / 2} y={yPedTop} width={pedW} height={yMem - yPedTop} />
        ))}
        {/* footing penuh (tepi ke tepi) */}
        <rect className="fd-mem" x={x0} y={yMem} width={span} height={memH} fill="none" />
        {/* panah reaksi tanah merata ke atas */}
        {Array.from({ length: nArr }).map((_, k) => { const x = x0 + (k / (nArr - 1)) * span; return <line key={k} className="fd-arrow" x1={x} y1={yArrB} x2={x} y2={yMem + memH} markerEnd="url(#fdArrow)" />; })}
        <text className="fd-face-lbl" x={x0} y={yMem - 4} textAnchor="start">tepi</text>
        <text className="fd-face-lbl" x={x1} y={yMem - 4} textAnchor="end">tepi</text>
        <text className="fd-dim" x={cx} y={yArrB + 13} textAnchor="middle">qu = {f(w)} kN/m² · B = {BLabel} (tepi ke tepi)</text>

        {/* SFD antisimetris */}
        <text className="fd-lbl" x={x0} y={yS - sBand - 7} textAnchor="start">SFD (kN)</text>
        <line className="fd-axis" x1={x0} y1={yS} x2={x1} y2={yS} />
        <polygon className="fd-shear-fill" points={`${x0},${yS} ${xLa},${yS - sBand} ${cx},${yS}`} />
        <polygon className="fd-shear-fill neg" points={`${cx},${yS} ${xRa},${yS + sBand} ${x1},${yS}`} />
        <polyline className="fd-shear-line" points={`${x0},${yS} ${xLa},${yS - sBand} ${xRa},${yS + sBand} ${x1},${yS}`} />
        <text className="fd-val" x={xLa} y={yS - sBand - 2} textAnchor="middle">+Vmax {f(Vmax)}</text>
        <text className="fd-val" x={xRa} y={yS + sBand + 10} textAnchor="middle">−Vmax</text>

        {/* BMD simetris (parabola, hogging ke bawah) */}
        <text className="fd-lbl" x={x0} y={yM - 8} textAnchor="start">BMD (kNm)</text>
        <line className="fd-axis" x1={x0} y1={yM} x2={x1} y2={yM} />
        <polygon className="fd-mom-fill" points={`${x0},${yM} ${poly(bmd)} ${x1},${yM}`} />
        <text className="fd-val" x={cx} y={yM + mBand + 12} textAnchor="middle">Mmax {f(Mmax)}</text>
      </svg>
    </figure>
  );
}

// Kolom kantilever (pipe support): beban lateral H di puncak → N, V, M.
export function ColumnForceDiagram({ Htot, H: Hlat, Mbase, N, title = 'Gaya dalam kolom (kantilever)' }) {
  const W = 300, H = 250, colX = 122, yTop = 50, yBase = 208, mW = 44;
  const mid = (yTop + yBase) / 2;
  const bmd = [[colX, yTop], [colX + mW, yBase], [colX, yBase]];
  return (
    <figure className="fd">
      <figcaption>{title}</figcaption>
      <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {/* kolom + jepit */}
        <line className="fd-mem" x1={colX} y1={yTop} x2={colX} y2={yBase} />
        <line className="fd-axis" x1={colX - 16} y1={yBase} x2={colX + 16} y2={yBase} />
        {[-12, -4, 4, 12].map((d) => <line key={d} className="fd-hatch" x1={colX + d} y1={yBase} x2={colX + d - 6} y2={yBase + 7} />)}
        {/* aksial N di atas kolom */}
        <text className="fd-lbl" x={colX} y={15} textAnchor="middle">N = {f(N)} kN</text>
        <line className="fd-arrow" x1={colX} y1={30} x2={colX} y2={yTop - 3} markerEnd="url(#fdArrow)" />
        {/* beban lateral H di puncak (dari kiri) */}
        <line className="fd-arrow" x1={colX - 54} y1={yTop} x2={colX - 5} y2={yTop} markerEnd="url(#fdArrow)" />
        <text className="fd-lbl" x={colX - 56} y={yTop - 6} textAnchor="start">H = {f(Hlat)} kN</text>
        {/* tinggi kolom */}
        <text className="fd-dim" x={colX - 8} y={mid} textAnchor="middle" transform={`rotate(-90 ${colX - 8} ${mid})`}>H = {f(Htot)} m</text>
        {/* BMD di sisi kanan (0 di puncak, maks di dasar) */}
        <polygon className="fd-mom-fill" points={bmd.map((p) => p.join(',')).join(' ')} />
        <text className="fd-lbl" x={W - 6} y={yTop + 2} textAnchor="end">BMD (kNm)</text>
        <text className="fd-val" x={colX + 5} y={yTop + 12} textAnchor="start">0</text>
        <text className="fd-val" x={colX + mW + 3} y={yBase - 1} textAnchor="start">Mmax {f(Mbase)}</text>
      </svg>
    </figure>
  );
}

// Beam simple-support dengan beban terpusat P di tengah → SFD (±P/2) & BMD (P·L/4).
export function BeamForceDiagram({ L, P, Mmax, title = 'Gaya dalam beam (beban terpusat)' }) {
  const W = 320, H = 250, M = 30;
  const x0 = M, x1 = W - M, span = x1 - x0, cx = (x0 + x1) / 2;
  const yBeam = 46, yS = 122, sBand = 30, yM = 196, mBand = 32;
  void span;
  return (
    <figure className="fd">
      <figcaption>{title}</figcaption>
      <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {/* beban P di tengah */}
        <line className="fd-arrow" x1={cx} y1={24} x2={cx} y2={yBeam - 3} markerEnd="url(#fdArrow)" />
        <text className="fd-lbl" x={cx + 6} y={22} textAnchor="start">P = {f(P)} kN</text>
        {/* beam + tumpuan */}
        <line className="fd-mem" x1={x0} y1={yBeam} x2={x1} y2={yBeam} />
        {[x0, x1].map((x, i) => <path key={i} className="fd-support" d={`M ${x} ${yBeam} l -6 12 l 12 0 Z`} />)}
        <text className="fd-dim" x={cx} y={yBeam + 26} textAnchor="middle">L = {f(L)} m</text>

        {/* SFD: +P/2 kiri, −P/2 kanan */}
        <text className="fd-lbl" x={x0} y={yS - sBand - 7} textAnchor="start">SFD (kN)</text>
        <line className="fd-axis" x1={x0} y1={yS} x2={x1} y2={yS} />
        <polygon className="fd-shear-fill" points={`${x0},${yS} ${x0},${yS - sBand} ${cx},${yS - sBand} ${cx},${yS}`} />
        <polygon className="fd-shear-fill neg" points={`${cx},${yS} ${cx},${yS + sBand} ${x1},${yS + sBand} ${x1},${yS}`} />
        <text className="fd-val" x={(x0 + cx) / 2} y={yS - sBand / 2 + 3} textAnchor="middle">+P/2 = {f(P / 2)}</text>
        <text className="fd-val" x={(cx + x1) / 2} y={yS + sBand / 2 + 3} textAnchor="middle">−P/2</text>

        {/* BMD: segitiga puncak di tengah */}
        <text className="fd-lbl" x={x0} y={yM - 8} textAnchor="start">BMD (kNm)</text>
        <line className="fd-axis" x1={x0} y1={yM} x2={x1} y2={yM} />
        <polygon className="fd-mom-fill" points={`${x0},${yM} ${cx},${yM + mBand} ${x1},${yM}`} />
        <text className="fd-val" x={cx} y={yM + mBand + 12} textAnchor="middle">Mmax {f(Mmax)}</text>
      </svg>
    </figure>
  );
}

// ============================================================
// Sketsa detail penulangan (potongan + denah)
// ============================================================
const _clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// Detail penulangan footing utk laporan: potongan melintang (dot = batang
// tegak lurus bidang potong, garis = batang sejajar) + denah jaring.
// Semua dimensi mm. nPed=0 → tanpa pedestal (blok equipment).
// lapis: 1 = jaring bawah saja; 2 = jaring atas + bawah (keduanya digambar).
// pedBarsLabel opsional (mis. "8Ø16 · sengkang Ø10-150") — bila diisi,
// tulangan pedestal digambar indikatif + diberi label.
export function RebarSketch({ B, L, h, cover, db, s, lapis = 1, nPed = 1, cPed = 0, sPed = 0,
  pedBarsLabel, topLabel = 'pedestal' }) {
  const Bn = Math.max(num(B), 1), Ln = Math.max(num(L), 1), hn = Math.max(num(h), 1);
  const cv = Math.max(num(cover), 0), dia = Math.max(num(db), 1), sp = Math.max(num(s), 1);
  const nLap = Math.round(num(lapis, 1)) >= 2 ? 2 : 1;
  const nAcrossB = Math.max(Math.floor((Bn - 2 * cv) / sp) + 1, 2); // tersebar sepanjang B
  const nAcrossL = Math.max(Math.floor((Ln - 2 * cv) / sp) + 1, 2); // tersebar sepanjang L
  const barTxt = `Ø${f(dia, 0)}-${f(sp, 0)}`;

  // ---------- Potongan melintang ----------
  const W1 = 380, H1 = 216, mx = 46;
  const bw = W1 - 2 * mx, x0 = mx, x1 = W1 - mx;
  const hpx = _clamp((hn / Bn) * bw, nLap >= 2 ? 46 : 36, 82);
  const yBot = 158, yTop = yBot - hpx;
  const cpx = _clamp((cv / Bn) * bw, 4, 16);
  const nDots = Math.min(nAcrossB, 41);
  const dotY = yBot - cpx - 3.5;              // lapis bawah
  const topDotY = yTop + cpx + 3.5;           // lapis atas (bila 2 lapis)
  const dxL = x0 + cpx + 3, dxR = x1 - cpx - 3;
  const dots = Array.from({ length: nDots }, (_, k) => dxL + (k / (nDots - 1)) * (dxR - dxL));
  const pedH = 30;
  const wp = _clamp((num(cPed) / Bn) * bw, 14, bw * 0.5);
  const centers = nPed >= 2
    ? [W1 / 2 - (num(sPed) / Bn) * bw / 2, W1 / 2 + (num(sPed) / Bn) * bw / 2]
    : nPed === 1 ? [W1 / 2] : [];

  // ---------- Denah ----------
  const W2 = 320, H2 = 216;
  const k = Math.min(210 / Bn, 138 / Ln);
  const pw = Bn * k, ph = Ln * k;
  const px0 = (W2 - pw) / 2, py0 = 34;
  const inr = _clamp(cv * k, 3, 12);
  const nv = Math.min(nAcrossB, 23), nh = Math.min(nAcrossL, 23);
  const vX = Array.from({ length: nv }, (_, i) => px0 + inr + (i / (nv - 1)) * (pw - 2 * inr));
  const hY = Array.from({ length: nh }, (_, i) => py0 + inr + (i / (nh - 1)) * (ph - 2 * inr));
  const wpp = _clamp(num(cPed) * k, 6, pw * 0.5);
  const pCenters = nPed >= 2
    ? [W2 / 2 - num(sPed) * k / 2, W2 / 2 + num(sPed) * k / 2]
    : nPed === 1 ? [W2 / 2] : [];

  return (
    <div className="fd-row">
      <figure className="fd">
        <figcaption>Potongan — detail penulangan footing</figcaption>
        <svg className="draw" viewBox={`0 0 ${W1} ${H1}`} role="img" aria-label="Potongan penulangan footing">
          {/* pedestal / stub di atas footing */}
          {centers.map((c, i) => (
            <g key={i}>
              <rect className="rb-conc" x={c - wp / 2} y={yTop - pedH} width={wp} height={pedH} />
              {pedBarsLabel && (
                <g>
                  <line className="rb-bar" x1={c - wp / 2 + 6} y1={yTop - pedH + 4} x2={c - wp / 2 + 6} y2={dotY - 2} />
                  <line className="rb-bar" x1={c + wp / 2 - 6} y1={yTop - pedH + 4} x2={c + wp / 2 - 6} y2={dotY - 2} />
                  {[0.25, 0.55, 0.85].map((t) => (
                    <line key={t} className="rb-tie" x1={c - wp / 2 + 4} y1={yTop - pedH + t * pedH} x2={c + wp / 2 - 4} y2={yTop - pedH + t * pedH} />
                  ))}
                </g>
              )}
            </g>
          ))}
          {centers.length > 0 && <text className="fd-face-lbl" x={W1 / 2} y={yTop - pedH - 4} textAnchor="middle">{topLabel}{pedBarsLabel ? ` — ${pedBarsLabel}` : ''}</text>}
          {/* footing */}
          <rect className="rb-conc" x={x0} y={yTop} width={bw} height={hpx} />
          {/* lapis BAWAH: garis (batang sejajar potongan) + titik (tegak lurus) */}
          <line className="rb-bar" x1={dxL} y1={dotY - 5.5} x2={dxR} y2={dotY - 5.5} />
          {dots.map((x, i) => <circle key={i} className="rb-dot" cx={x} cy={dotY} r={2.4} />)}
          {/* lapis ATAS (bila 2 lapis) */}
          {nLap >= 2 && (
            <g>
              <line className="rb-bar" x1={dxL} y1={topDotY + 5.5} x2={dxR} y2={topDotY + 5.5} />
              {dots.map((x, i) => <circle key={i} className="rb-dot" cx={x} cy={topDotY} r={2.4} />)}
            </g>
          )}
          {nLap >= 2 ? (
            <text className="rb-lbl" x={x0 + 8} y={(topDotY + dotY) / 2 + 3} textAnchor="start">
              Tul. atas &amp; bawah 2 arah {barTxt} (2 lapis)
            </text>
          ) : (
            <text className="rb-lbl" x={x0 + 8} y={dotY - 14} textAnchor="start">Tul. bawah 2 arah {barTxt}</text>
          )}
          {/* dimensi B */}
          <line className="fd-axis" x1={x0} y1={yBot + 10} x2={x1} y2={yBot + 10} />
          <text className="fd-dim" x={W1 / 2} y={yBot + 22} textAnchor="middle">B = {f(Bn, 0)} mm</text>
          {/* dimensi h + selimut */}
          <line className="fd-axis" x1={x1 + 9} y1={yTop} x2={x1 + 9} y2={yBot} />
          <text className="fd-dim" x={x1 + 14} y={(yTop + yBot) / 2} textAnchor="middle" transform={`rotate(-90 ${x1 + 14} ${(yTop + yBot) / 2})`}>h = {f(hn, 0)}</text>
          <line className="fd-axis" x1={x0 - 9} y1={dotY} x2={x0 - 9} y2={yBot} />
          <text className="fd-dim" x={x0 - 13} y={(dotY + yBot) / 2 + 2} textAnchor="middle" transform={`rotate(-90 ${x0 - 13} ${(dotY + yBot) / 2})`}>c={f(cv, 0)}</text>
        </svg>
      </figure>

      <figure className="fd">
        <figcaption>{nLap >= 2 ? 'Denah — jaring tulangan 2 arah (atas & bawah identik)' : 'Denah — jaring tulangan bawah 2 arah'}</figcaption>
        <svg className="draw" viewBox={`0 0 ${W2} ${H2}`} role="img" aria-label="Denah tulangan footing">
          <rect className="rb-conc" x={px0} y={py0} width={pw} height={ph} />
          {vX.map((x, i) => <line key={`v${i}`} className="rb-grid" x1={x} y1={py0 + inr} x2={x} y2={py0 + ph - inr} />)}
          {hY.map((y, i) => <line key={`h${i}`} className="rb-grid" x1={px0 + inr} y1={y} x2={px0 + pw - inr} y2={y} />)}
          {pCenters.map((c, i) => (
            <rect key={i} className="rb-ped-dash" x={c - wpp / 2} y={py0 + ph / 2 - wpp / 2} width={wpp} height={wpp} />
          ))}
          <text className="rb-lbl" x={W2 / 2} y={py0 - 8} textAnchor="middle">{barTxt} (arah X &amp; Y{nLap >= 2 ? ' · 2 lapis' : ''})</text>
          <text className="fd-dim" x={W2 / 2} y={py0 + ph + 14} textAnchor="middle">B = {f(Bn, 0)} mm · {nAcrossB} btg</text>
          <text className="fd-dim" x={px0 - 8} y={py0 + ph / 2} textAnchor="middle" transform={`rotate(-90 ${px0 - 8} ${py0 + ph / 2})`}>L = {f(Ln, 0)} mm · {nAcrossL} btg</text>
        </svg>
      </figure>
    </div>
  );
}

// ============================================================
// Struktur dokumen: tabel "Item | Nilai" + sketsa 3D isometrik
// ============================================================

// Tabel dua kolom bergaya dokumen kalkulasi (Item | Nilai / Deskripsi).
export function ItemsTable({ head = ['Item', 'Nilai'], rows }) {
  return (
    <table className="items-tbl">
      <thead><tr><th>{head[0]}</th><th>{head[1]}</th></tr></thead>
      <tbody>
        {rows.filter(Boolean).map(([k, v], i) => (
          <tr key={i}><td className="it-k">{k}</td><td className="it-v">{v}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// Marker panah bersama (dipasang sekali per laporan).
export function FDDefs() {
  return (
    <svg className="svg-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <marker id="fdArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#1f6fb2" />
        </marker>
      </defs>
    </svg>
  );
}
