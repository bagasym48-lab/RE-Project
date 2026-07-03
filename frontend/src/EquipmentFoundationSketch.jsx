// EquipmentFoundationSketch.jsx — sketsa pondasi equipment (blok TANPA pedestal):
// elevasi (mesin di atas blok beton setengah tertanam + anchor bolt) dan denah
// (jejak mesin + pola 4 anchor bolt). Skala mengikuti input; tebal minimum dijaga
// agar tetap terbaca.
function num(v, f = 0) { const x = Number(v); return Number.isFinite(x) ? x : f; }
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

export default function EquipmentFoundationSketch({ s }) {
  const Lf = Math.max(num(s.Lf), 0.3), Bf = Math.max(num(s.Bf), 0.2);
  const Hf = Math.max(num(s.Hf), 0.15);
  const Hfa = clamp(num(s.Hfa), 0, Hf);
  const Hfb = Hf - Hfa;
  const Leq = Math.max(num(s.Leq), 0.1), Beq = Math.max(num(s.Beq), 0.1);
  const Heq = Math.max(num(s.Heq), 0.1);
  const d1 = num(s.d1) / 1000, d2 = num(s.d2) / 1000;   // m

  // ===== Elevasi =====
  const W = 470, H = 300, M = 56;
  const totH = Heq + Hf;
  const sx = (W - 2 * M) / Lf;
  const sy = (H - 2 * M) / totH;
  const cx = W / 2;
  const yEqTop = M;
  const yFTop = yEqTop + Heq * sy;      // muka atas fondasi
  const yGround = yFTop + Hfa * sy;     // muka tanah
  const yBase = yFTop + Hf * sy;        // dasar fondasi
  const fW = Lf * sx, eW = clamp(Leq * sx, 20, fW - 8);
  const eH = yFTop - yEqTop;

  // ===== Denah =====
  const W2 = 470, H2 = 260, M2 = 60;
  const sp = Math.min((W2 - 2 * M2) / Lf, (H2 - 2 * M2) / Bf);
  const pW = Lf * sp, pH = Bf * sp;
  const px = (W2 - pW) / 2, py = (H2 - pH) / 2;
  const pcx = px + pW / 2, pcy = py + pH / 2;
  const eqW = clamp(Leq * sp, 14, pW), eqH = clamp(Beq * sp, 10, pH);
  const bolts = [
    [pcx - (d1 / 2) * sp, pcy - (d2 / 2) * sp], [pcx + (d1 / 2) * sp, pcy - (d2 / 2) * sp],
    [pcx - (d1 / 2) * sp, pcy + (d2 / 2) * sp], [pcx + (d1 / 2) * sp, pcy + (d2 / 2) * sp],
  ];

  return (
    <div className="sketch">
      <svg className="svg-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="eqSteel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d2dbe5" /><stop offset="1" stopColor="#9fb0c1" />
          </linearGradient>
          <linearGradient id="eqConc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e7e2d8" /><stop offset="1" stopColor="#cfc7b8" />
          </linearGradient>
          <linearGradient id="eqSoil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efe3c6" /><stop offset="1" stopColor="#ddcaa0" />
          </linearGradient>
        </defs>
      </svg>

      <figure>
        <figcaption>Elevasi pondasi equipment (blok, tanpa pedestal)</figcaption>
        <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Elevasi pondasi equipment">
          {/* tanah */}
          <rect className="soil-band" fill="url(#eqSoil)" x={M - 10} y={yGround} width={W - 2 * M + 20} height={Math.max(H - M / 2 - yGround, 0)} />
          <line className="grade-line" x1={M - 16} y1={yGround} x2={W - M + 16} y2={yGround} />
          <text className="note" x={M - 14} y={yGround - 5}>muka tanah</text>

          {/* blok fondasi */}
          <rect className="concrete" fill="url(#eqConc)" x={cx - fW / 2} y={yFTop} width={fW} height={yBase - yFTop} />
          {/* equipment (mesin) */}
          <rect className="pedestal" fill="url(#eqSteel)" x={cx - eW / 2} y={yEqTop} width={eW} height={eH} rx="3" />
          <text className="note" x={cx} y={yEqTop + eH / 2 + 4} textAnchor="middle">EQUIPMENT</text>
          {/* anchor bolt (2 tampak) */}
          {[cx - eW / 2 + 8, cx + eW / 2 - 8].map((x, i) => (
            <line key={i} className="center-line" x1={x} y1={yFTop - 4} x2={x} y2={yFTop + Math.min(28, (yBase - yFTop) * 0.6)} />
          ))}
          {/* beban berat mesin di C.O.G. */}
          <g className="load">
            <line x1={cx} y1={yEqTop - 26} x2={cx} y2={yEqTop - 4} />
            <path d={`M ${cx - 4} ${yEqTop - 11} L ${cx} ${yEqTop - 3} L ${cx + 4} ${yEqTop - 11} z`} />
            <text x={cx + 7} y={yEqTop - 14}>E</text>
          </g>

          {/* dimensi */}
          <DimH x1={cx - eW / 2} x2={cx + eW / 2} y={yEqTop - 12} label={`Leq = ${Leq} m`} />
          <DimH x1={cx - fW / 2} x2={cx + fW / 2} y={yBase + 16} label={`Lf = ${Lf} m`} below />
          <DimV y1={yEqTop} y2={yFTop} x={cx + fW / 2 + 18} label={`Heq = ${Heq}`} />
          <DimV y1={yFTop} y2={yGround} x={cx + fW / 2 + 18} label={`Hfa = ${Hfa}`} />
          {Hfb > 0.001 && <DimV y1={yGround} y2={yBase} x={cx + fW / 2 + 18} label={`Hfb = ${Hfb.toFixed(2)}`} />}
          <DimV y1={yFTop} y2={yBase} x={cx - fW / 2 - 18} label={`Hf = ${Hf} m`} side="left" />
        </svg>
      </figure>

      <figure>
        <figcaption>Denah fondasi &amp; pola anchor bolt</figcaption>
        <svg className="draw" viewBox={`0 0 ${W2} ${H2}`} role="img" aria-label="Denah pondasi equipment">
          <rect className="concrete" fill="url(#eqConc)" x={px} y={py} width={pW} height={pH} />
          <rect className="pedestal" fill="url(#eqSteel)" x={pcx - eqW / 2} y={pcy - eqH / 2} width={eqW} height={eqH} rx="2" opacity="0.85" />
          {/* garis sumbu */}
          <line className="center-line" x1={px - 10} y1={pcy} x2={px + pW + 10} y2={pcy} />
          <line className="center-line" x1={pcx} y1={py - 10} x2={pcx} y2={py + pH + 10} />
          {/* anchor bolt */}
          {bolts.map(([bx, by], i) => (
            <g key={i}>
              <circle cx={bx} cy={by} r="4" fill="#fff" stroke="#37474f" strokeWidth="1.4" />
              <circle cx={bx} cy={by} r="1.4" fill="#37474f" />
            </g>
          ))}
          {/* dimensi */}
          <DimH x1={px} x2={px + pW} y={py - 12} label={`Lf = ${Lf} m`} />
          <DimV y1={py} y2={py + pH} x={px - 14} label={`Bf = ${Bf} m`} side="left" />
          <DimH x1={pcx - (d1 / 2) * sp} x2={pcx + (d1 / 2) * sp} y={py + pH + 18} label={`d1 = ${num(s.d1)} mm`} below />
          <DimV y1={pcy - (d2 / 2) * sp} y2={pcy + (d2 / 2) * sp} x={px + pW + 16} label={`d2 = ${num(s.d2)}`} />
          <text className="note" x={pcx} y={pcy - eqH / 2 - 5} textAnchor="middle">equipment {Leq}×{Beq} m</text>
        </svg>
      </figure>
    </div>
  );
}
