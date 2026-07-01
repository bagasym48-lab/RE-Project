// PipeSupportSketch.jsx — sketsa elevasi pipe support bentuk "T":
// kolom pipe-steel vertikal + pipa horizontal (beam) di atasnya (kantilever L/2 ke kiri-kanan).
// Skala menyesuaikan input; ketebalan member dibatasi agar selalu terbaca rapi.
function num(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
const r = (v) => Math.round(num(v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function DimH({ x1, x2, y, label, below = false }) {
  return (
    <g className="dim">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
      <text x={(x1 + x2) / 2} y={below ? y + 14 : y - 5} textAnchor="middle">{label}</text>
    </g>
  );
}
function DimV({ y1, y2, x, label, side = 'right' }) {
  const tx = side === 'left' ? x - 5 : x + 5;
  const ym = (y1 + y2) / 2;
  return (
    <g className="dim">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} />
      <text x={tx} y={ym} textAnchor="middle" transform={`rotate(-90 ${tx} ${ym})`}>{label}</text>
    </g>
  );
}

export default function PipeSupportSketch({ s }) {
  const Habove = Math.max(num(s.H_above), 0.05);
  const depth = Math.max(num(s.depth), 0.05);
  const L = Math.max(num(s.L), 0.2);
  const Dpipe = num(s.Dpipe);                // in
  const Dcol_m = num(s.Do) / 1000;           // m (Ø luar kolom)

  const W = 470, H = 360, M = 58;
  const drawW = W - 2 * M, drawH = H - 2 * M;
  const sy = drawH / (Habove + depth);
  const sx = drawW / L;

  const cx = W / 2;
  const yTop = M;                             // atas beam
  const yGround = yTop + Habove * sy;         // muka tanah
  const yFix = yGround + depth * sy;          // titik fixity (dasar kolom)

  const beamLen = L * sx;
  const beamH = clamp((Dpipe * 0.0254) * sy, 12, 26);   // tinggi pipa horizontal (px)
  const colW = clamp(Dcol_m * sx, 12, 26);              // lebar kolom (px)
  const bx = cx - beamLen / 2;
  const yBeamBot = yTop + beamH;

  const loadXs = [cx];   // beban pipa terpusat di tengah beam (ref dokumen)

  return (
    <div className="sketch">
      <svg className="svg-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="psSteel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d2dbe5" /><stop offset="1" stopColor="#9fb0c1" />
          </linearGradient>
          <linearGradient id="psSoil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efe3c6" /><stop offset="1" stopColor="#ddcaa0" />
          </linearGradient>
        </defs>
      </svg>
      <figure>
        <figcaption>Elevasi pipe support (bentuk T)</figcaption>
        <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sketsa pipe support">
          {/* tanah */}
          <rect className="soil-band" fill="url(#psSoil)" x={M - 6} y={yGround} width={drawW + 12} height={Math.max(H - M - yGround, 0)} />
          <line className="grade-line" x1={M - 14} y1={yGround} x2={W - M + 14} y2={yGround} />
          <text className="note" x={M - 14} y={yGround - 5}>muka tanah</text>

          {/* kolom pipe-steel (vertikal) */}
          <rect className="pedestal" fill="url(#psSteel)" x={cx - colW / 2} y={yBeamBot} width={colW} height={yFix - yBeamBot} rx="2" />
          {/* pipa horizontal / beam (T) */}
          <rect className="concrete" fill="url(#psSteel)" x={bx} y={yTop} width={beamLen} height={beamH} rx={beamH / 2} />

          {/* fixity (jepit) */}
          <line className="center-line" x1={cx - 16} y1={yFix} x2={cx + 16} y2={yFix} />
          {[-12, -4, 4, 12].map((d) => (
            <line key={d} className="dim" x1={cx + d} y1={yFix} x2={cx + d - 6} y2={yFix + 7} />
          ))}
          <text className="note" x={cx + 18} y={yFix + 4}>fixity</text>

          {/* beban P pada pipa */}
          {loadXs.map((x, i) => (
            <g className="load" key={i}>
              <line x1={x} y1={yTop - 24} x2={x} y2={yTop - 3} />
              <path d={`M ${x - 4} ${yTop - 9} L ${x} ${yTop - 2} L ${x + 4} ${yTop - 9} z`} />
            </g>
          ))}
          <text className="load" x={cx + 8} y={yTop - 15}>P</text>

          {/* dimensi */}
          <DimH x1={bx} x2={bx + beamLen} y={yTop - 30} label={`L = ${L} m`} />
          <DimV y1={yTop} y2={yGround} x={cx + colW / 2 + 30} label={`H = ${Habove} m`} />
          <DimV y1={yGround} y2={yFix} x={cx + colW / 2 + 30} label={`Df = ${depth} m`} />
          <text className="note" x={cx} y={yBeamBot + 16} textAnchor="middle">pipa Ø{r(Dpipe)}″ · kolom Ø{r(num(s.Do))}mm</text>
        </svg>
      </figure>
    </div>
  );
}
