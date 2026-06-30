// FoundationSketch.jsx — sketsa otomatis pondasi telapak (tampak atas + potongan).
// Skala menyesuaikan dimensi input (mm). Teks dimensi diberi halo putih (via CSS)
// agar tidak bertabrakan dengan garis/bidang. Bidang beton/tanah memakai gradien.
//
//   B = Bf lebar footing (X)     L = Lf panjang footing (Z)
//   c2 = Bp lebar pedestal (X)   c1 = Lp panjang pedestal (Z)
//   h = Hf tebal footing   Df = kedalaman footing   Hp = tinggi pedestal
//
// Bila n_pedestal = 2: digambar 2 pedestal simetris terhadap sumbu, terpisah
// sejauh s_ped (jarak antar pusat, mm) di arah B/X.

function num(v, f = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
}
const r = (v) => Math.round(num(v));

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

function DimV({ y1, y2, x, label, side = 'left' }) {
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

function Load({ x, yTop }) {
  return (
    <g className="load">
      <line x1={x} y1={yTop - 28} x2={x} y2={yTop - 3} />
      <path d={`M ${x - 4} ${yTop - 9} L ${x} ${yTop - 2} L ${x + 4} ${yTop - 9} z`} />
      <text x={x + 8} y={yTop - 16}>P</text>
    </g>
  );
}

function PlanView({ B, L, c1, c2, n, sped }) {
  const W = 340, H = 300, M = 50;
  const dw = W - 2 * M, dh = H - 2 * M;
  const s = Math.min(dw / Math.max(B, 1), dh / Math.max(L, 1));
  const fw = B * s, fh = L * s;
  const ox = (W - fw) / 2, oy = (H - fh) / 2;
  const pw = c2 * s, ph = c1 * s;
  const two = n >= 2;
  const off = two ? (sped * s) / 2 : 0;
  const cxs = two ? [W / 2 - off, W / 2 + off] : [W / 2];
  const pyTop = (H - ph) / 2;
  return (
    <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tampak atas pondasi">
      <rect className="concrete" fill="url(#fdConcrete)" x={ox} y={oy} width={fw} height={fh} rx="2" />
      {cxs.map((cx, i) => (
        <rect key={i} className="pedestal" fill="url(#fdPedestal)" x={cx - pw / 2} y={pyTop} width={pw} height={ph} rx="2" />
      ))}
      <line className="center-line" x1={W / 2} y1={oy - 12} x2={W / 2} y2={oy + fh + 12} />
      <line className="center-line" x1={ox - 12} y1={H / 2} x2={ox + fw + 12} y2={H / 2} />
      <DimH x1={ox} x2={ox + fw} y={oy + fh + 26} label={`B = ${r(B)}`} below />
      <DimV y1={oy} y2={oy + fh} x={ox - 26} label={`L = ${r(L)}`} />
      {two && <DimH x1={W / 2 - off} x2={W / 2 + off} y={pyTop - 9} label={`s = ${r(sped)}`} />}
      <text className="note" x={W / 2} y={16} textAnchor="middle">
        {two ? '2 pedestal' : 'pedestal'} {r(c2)}×{r(c1)}
      </text>
    </svg>
  );
}

function SectionView({ B, h, Df, Hp, c2, n, sped }) {
  const W = 380, H = 320;
  const Ml = 58, Mr = 58, Mt = 40, Mb = 46;
  const dw = W - Ml - Mr, dh = H - Mt - Mb;
  const span = Math.max(h + Hp, 1);
  const s = Math.min(dw / Math.max(B, 1), dh / span);

  const dTop = (Df - h) - Hp;
  const cx = Ml + dw / 2;
  const yOf = (d) => Mt + (d - dTop) * s;
  const halfB = (B * s) / 2, halfP = (c2 * s) / 2;

  const yGrade = yOf(0);
  const yTopF = yOf(Df - h);
  const yBotF = yOf(Df);
  const yTopP = yOf(dTop);
  const fX = cx - halfB, fW = B * s;
  const soilTop = Math.max(yGrade, Mt);

  const two = n >= 2;
  const off = two ? (sped * s) / 2 : 0;
  const pcs = two ? [cx - off, cx + off] : [cx];

  return (
    <svg className="draw" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Potongan pondasi">
      <rect className="soil-band" fill="url(#fdSoil)" x={Ml} y={soilTop} width={dw} height={Math.max(H - Mb - soilTop, 0)} />
      <rect className="concrete" fill="url(#fdConcrete)" x={fX} y={yTopF} width={fW} height={h * s} />
      {pcs.map((pcx, i) => (
        <rect key={i} className="pedestal" fill="url(#fdPedestal)" x={pcx - halfP} y={yTopP} width={c2 * s} height={Hp * s} />
      ))}

      <line className="grade-line" x1={Ml - 8} y1={yGrade} x2={W - Mr + 8} y2={yGrade} />
      <text className="note" x={Ml - 8} y={yGrade - 5}>muka tanah</text>

      {pcs.map((pcx, i) => <Load key={i} x={pcx} yTop={yTopP} />)}

      <DimH x1={fX} x2={fX + fW} y={yBotF + 24} label={`B = ${r(B)}`} below />
      {two && <DimH x1={cx - off} x2={cx + off} y={yTopP - 9} label={`s = ${r(sped)}`} />}
      <DimV y1={yGrade} y2={yBotF} x={Ml - 28} label={`Df = ${r(Df)}`} />
      <DimV y1={yTopF} y2={yBotF} x={fX + fW + 20} label={`Hf = ${r(h)}`} side="right" />
      <DimV y1={yTopP} y2={yTopF} x={fX + fW + 20} label={`Hp = ${r(Hp)}`} side="right" />
    </svg>
  );
}

export default function FoundationSketch({ fd }) {
  const B = num(fd.B), L = num(fd.L), h = num(fd.h), Df = num(fd.Df),
        Hp = num(fd.Hp), c1 = num(fd.c1), c2 = num(fd.c2);
  const n = Math.max(1, Math.round(num(fd.n_pedestal, 1)));
  const sped = num(fd.s_ped, 0);
  return (
    <div className="sketch">
      <svg className="svg-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="fdConcrete" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8eef4" />
            <stop offset="1" stopColor="#c7d1dc" />
          </linearGradient>
          <linearGradient id="fdPedestal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d2dbe5" />
            <stop offset="1" stopColor="#aab9c8" />
          </linearGradient>
          <linearGradient id="fdSoil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efe3c6" />
            <stop offset="1" stopColor="#ddcaa0" />
          </linearGradient>
        </defs>
      </svg>
      <figure>
        <figcaption>Tampak atas (mm)</figcaption>
        <PlanView B={B} L={L} c1={c1} c2={c2} n={n} sped={sped} />
      </figure>
      <figure>
        <figcaption>Potongan (mm)</figcaption>
        <SectionView B={B} h={h} Df={Df} Hp={Hp} c2={c2} n={n} sped={sped} />
      </figure>
    </div>
  );
}
