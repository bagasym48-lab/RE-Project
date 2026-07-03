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
        <line className="fd-face" x1={x0} y1={yMem - 4} x2={x0} y2={yM + mBand} />
        <text className="fd-face-lbl" x={x0 + 3} y={yMem - 8} textAnchor="start">muka kolom</text>
        <text className="fd-face-lbl" x={x1} y={yMem - 8} textAnchor="end">tepi</text>
        <text className="fd-dim" x={W / 2} y={yMem + 40} textAnchor="middle">a = {f(a)} m</text>

        {/* SFD */}
        <text className="fd-lbl" x={x0} y={yS - sBand - 7} textAnchor="start">SFD (kN)</text>
        <line className="fd-axis" x1={x0} y1={yS} x2={x1} y2={yS} />
        <polygon className="fd-shear-fill" points={`${x0},${yS} ${poly(sfd)} ${x1},${yS}`} />
        <text className="fd-val" x={x0 + 6} y={yS - sBand + 14} textAnchor="start">Vmax {f(Vmax)}</text>

        {/* BMD */}
        <text className="fd-lbl" x={x0} y={yM - 8} textAnchor="start">BMD (kNm)</text>
        <line className="fd-axis" x1={x0} y1={yM} x2={x1} y2={yM} />
        <polygon className="fd-mom-fill" points={`${x0},${yM} ${poly(bmd)} ${x1},${yM}`} />
        <text className="fd-val" x={x0 + 6} y={yM + mBand - 6} textAnchor="start">Mmax {f(Mmax)}</text>
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

// --- Proyeksi isometrik: x = lebar (kanan-depan), z = kedalaman (belakang), y = tinggi ---
const ISO = { ax: 0.866, ay: 0.5 };
const isoPt = (x, y, z, o) => [o.x + (x - z) * ISO.ax, o.y + (x + z) * ISO.ay - y];

function IsoBox({ x = 0, y = 0, z = 0, w, h, d, o, cls = '' }) {
  const P = (X, Y, Z) => isoPt(x + X, y + Y, z + Z, o).join(',');
  return (
    <g className={`iso-box ${cls}`}>
      <polygon className="iso-front" points={`${P(0, 0, 0)} ${P(w, 0, 0)} ${P(w, h, 0)} ${P(0, h, 0)}`} />
      <polygon className="iso-right" points={`${P(w, 0, 0)} ${P(w, 0, d)} ${P(w, h, d)} ${P(w, h, 0)}`} />
      <polygon className="iso-top" points={`${P(0, h, 0)} ${P(w, h, 0)} ${P(w, h, d)} ${P(0, h, d)}`} />
    </g>
  );
}

// Sketsa 3D pondasi telapak: pelat footing + pedestal (opsional) di atasnya.
export function Iso3DFooting({ B, L, H, pedestal, title = 'Sketsa 3D isometrik' }) {
  const o = { x: 120, y: 170 }, fw = 140, fd = 96, fh = 20, pw = 46, pd = 46, ph = 52;
  const pt = (x, y, z) => isoPt(x, y, z, o);
  return (
    <figure className="fd">
      <figcaption>{title}</figcaption>
      <svg className="draw iso" viewBox="0 0 320 250" role="img" aria-label={title}>
        <IsoBox o={o} w={fw} h={fh} d={fd} cls="conc" />
        {pedestal && <IsoBox o={o} x={(fw - pw) / 2} y={fh} z={(fd - pd) / 2} w={pw} h={ph} d={pd} cls="ped" />}
        <text className="iso-lbl" x={pt(fw / 2, 0, 0)[0]} y={pt(fw / 2, 0, 0)[1] + 14} textAnchor="middle">B = {B} mm</text>
        <text className="iso-lbl" x={pt(fw, 0, fd / 2)[0] + 6} y={pt(fw, 0, fd / 2)[1] + 12} textAnchor="start">L = {L} mm</text>
        <text className="iso-lbl" x={pt(0, fh / 2, 0)[0] - 6} y={pt(0, fh / 2, 0)[1]} textAnchor="end">H = {H} mm</text>
        {pedestal && <text className="iso-lbl" x={pt(fw / 2, fh + ph, fd / 2)[0]} y={pt(fw / 2, fh + ph, fd / 2)[1] - 6} textAnchor="middle">pedestal</text>}
      </svg>
    </figure>
  );
}

// Sketsa 3D pondasi equipment: blok beton + kotak equipment di atasnya.
export function Iso3DEquipment({ Lf, Bf, Hf, title = 'Sketsa 3D isometrik' }) {
  const o = { x: 120, y: 170 }, fw = 150, fd = 88, fh = 30, ew = 84, ed = 46, eh = 40;
  const pt = (x, y, z) => isoPt(x, y, z, o);
  return (
    <figure className="fd">
      <figcaption>{title}</figcaption>
      <svg className="draw iso" viewBox="0 0 320 250" role="img" aria-label={title}>
        <IsoBox o={o} w={fw} h={fh} d={fd} cls="conc" />
        <IsoBox o={o} x={(fw - ew) / 2} y={fh} z={(fd - ed) / 2} w={ew} h={eh} d={ed} cls="steel" />
        <text className="iso-lbl" x={pt((fw + ew) / 2 - ew / 2, fh + eh, (fd) / 2)[0]} y={pt(fw / 2, fh + eh, fd / 2)[1] - 6} textAnchor="middle">EQUIPMENT</text>
        <text className="iso-lbl" x={pt(fw / 2, 0, 0)[0]} y={pt(fw / 2, 0, 0)[1] + 14} textAnchor="middle">Lf = {Lf} m</text>
        <text className="iso-lbl" x={pt(fw, 0, fd / 2)[0] + 6} y={pt(fw, 0, fd / 2)[1] + 12} textAnchor="start">Bf = {Bf} m</text>
        <text className="iso-lbl" x={pt(0, fh / 2, 0)[0] - 6} y={pt(0, fh / 2, 0)[1]} textAnchor="end">Hf = {Hf} m</text>
      </svg>
    </figure>
  );
}

// Sketsa 3D pipe support: kolom pipa vertikal + beam pipa horizontal (bentuk T).
export function Iso3DPipe({ Do, L, Htot, title = 'Sketsa 3D isometrik' }) {
  const o = { x: 120, y: 196 }, cw = 24, cd = 24, ch = 96, bw = 150, bd = 22, bh = 22;
  const pt = (x, y, z) => isoPt(x, y, z, o);
  const cx0 = bw / 2 - cw / 2;
  return (
    <figure className="fd">
      <figcaption>{title}</figcaption>
      <svg className="draw iso" viewBox="0 0 320 250" role="img" aria-label={title}>
        {/* garis tanah */}
        <line className="iso-grade" x1={pt(-20, 0, cd + 20)[0]} y1={pt(-20, 0, cd + 20)[1]} x2={pt(bw + 20, 0, cd + 20)[0]} y2={pt(bw + 20, 0, cd + 20)[1]} />
        <IsoBox o={o} x={cx0} y={0} z={cd / 2} w={cw} h={ch} d={cd} cls="steel" />
        <IsoBox o={o} x={0} y={ch} z={cd / 2 + cd / 2 - bd / 2} w={bw} h={bh} d={bd} cls="steel" />
        <text className="iso-lbl" x={pt(bw / 2, ch + bh, cd)[0]} y={pt(bw / 2, ch + bh, cd)[1] - 6} textAnchor="middle">beam L = {L} m</text>
        <text className="iso-lbl" x={pt(cx0, ch / 2, cd / 2)[0] - 8} y={pt(cx0, ch / 2, cd / 2)[1]} textAnchor="end">H = {Htot} m</text>
        <text className="iso-lbl" x={pt(cx0 + cw / 2, 0, cd)[0]} y={pt(cx0 + cw / 2, 0, cd)[1] + 14} textAnchor="middle">Ø{Do} mm</text>
      </svg>
    </figure>
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
