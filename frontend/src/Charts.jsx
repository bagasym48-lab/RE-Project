// Charts.jsx — kurva-S (rencana vs aktual) & grafik harian, SVG murni.
// Label diberi halo (via CSS .chart text) dan legend dipindah keluar plot
// agar tidak bertabrakan dengan garis/angka. Asumsi: persen_progress = % kumulatif.

const DAY = 86400000;
const toMs = (d) => new Date(`${d}T00:00:00`).getTime();
const fmt = (ms) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function SCurve({ logs, startDate, targetDate }) {
  const pts = logs
    .filter((l) => l.persen_progress != null)
    .map((l) => ({ x: toMs(l.tanggal), y: Number(l.persen_progress) }))
    .sort((a, b) => a.x - b.x);

  if (!pts.length && !targetDate) return <p className="empty">Belum ada data untuk kurva-S.</p>;

  const W = 540, H = 250, ML = 40, MR = 16, MT = 22, MB = 38;
  const plotW = W - ML - MR, plotH = H - MT - MB;

  // Hari ini (tengah malam lokal) — kurva aktual mengikuti kalender: nilai
  // kumulatif ditahan datar sejak input terakhir sampai hari ini, sehingga
  // grafik tetap "berjalan" walau tidak ada input harian.
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayMs = toMs(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);

  const startMs = startDate ? toMs(startDate) : (pts.length ? pts[0].x : toMs(targetDate));
  const xs = [startMs, todayMs, ...pts.map((p) => p.x)];
  if (targetDate) xs.push(toMs(targetDate));
  let t0 = Math.min(...xs), t1 = Math.max(...xs);
  if (t1 <= t0) t1 = t0 + DAY;

  const sx = (ms) => ML + ((ms - t0) / (t1 - t0)) * plotW;
  const sy = (v) => MT + (1 - v / 100) * plotH;
  const yTicks = [0, 25, 50, 75, 100];

  const planPath = targetDate ? `M ${sx(startMs)} ${sy(0)} L ${sx(toMs(targetDate))} ${sy(100)}` : null;

  // Kurva aktual = fungsi tangga: nilai ditahan di level sebelumnya sampai
  // tanggal input berikutnya (lonjakan vertikal), lalu diperpanjang datar
  // hingga hari ini. Titik lingkaran hanya di tanggal input yang sebenarnya.
  let actPath = null, areaPath = null;
  if (pts.length) {
    const last = pts[pts.length - 1];
    const endX = Math.max(last.x, todayMs);
    const edge = [`${sx(pts[0].x)},${sy(pts[0].y)}`];
    for (let i = 1; i < pts.length; i++) {
      edge.push(`${sx(pts[i].x)},${sy(pts[i - 1].y)}`); // datar di level lama
      edge.push(`${sx(pts[i].x)},${sy(pts[i].y)}`);      // lonjakan saat input
    }
    if (endX > last.x) edge.push(`${sx(endX)},${sy(last.y)}`); // datar sampai hari ini
    actPath = 'M ' + edge.join(' L ');
    areaPath = `M ${sx(pts[0].x)} ${sy(0)} L ` + edge.join(' L ') + ` L ${sx(endX)} ${sy(0)} Z`;
  }

  const showToday = todayMs > t0;

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kurva-S">
        <defs>
          <linearGradient id="scArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f9e44" stopOpacity="0.28" />
            <stop offset="1" stopColor="#2f9e44" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="scLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1f6fb2" />
            <stop offset="1" stopColor="#2f9e44" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={ML} y1={sy(v)} x2={W - MR} y2={sy(v)} />
            <text className="ax" x={ML - 6} y={sy(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}
        <line className="axis" x1={ML} y1={sy(0)} x2={W - MR} y2={sy(0)} />
        <text className="ax" x={ML} y={H - MB + 16} textAnchor="start">{fmt(t0)}</text>
        <text className="ax" x={W - MR} y={H - MB + 16} textAnchor="end">{fmt(t1)}</text>

        {areaPath && <path d={areaPath} fill="url(#scArea)" />}
        {planPath && <path className="plan" d={planPath} />}
        {actPath && <path d={actPath} fill="none" stroke="url(#scLine)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
        {showToday && (
          <g>
            <line className="today" x1={sx(todayMs)} y1={MT - 6} x2={sx(todayMs)} y2={sy(0)} />
            <text className="ax today-lbl" x={sx(todayMs)} y={MT - 9}
              textAnchor={sx(todayMs) > W - MR - 40 ? 'end' : 'middle'}>hari ini</text>
          </g>
        )}
        {pts.map((p, i) => <circle key={i} className="pt" cx={sx(p.x)} cy={sy(p.y)} r="3.2" />)}
      </svg>
      <div className="chart-legend">
        <span><i className="plan" />rencana</span>
        <span><i className="actual" />aktual</span>
        <span><i className="today" />hari ini</span>
      </div>
    </div>
  );
}

export function DailyBars({ logs }) {
  const rows = logs
    .filter((l) => l.persen_progress != null)
    .map((l) => ({ d: l.tanggal, y: Number(l.persen_progress) }))
    .sort((a, b) => toMs(a.d) - toMs(b.d));

  if (!rows.length) return <p className="empty">Belum ada progress harian.</p>;

  // Progress harian = selisih kumulatif antar log berurutan.
  const inc = rows.map((r, i) => ({ d: r.d, v: i === 0 ? r.y : r.y - rows[i - 1].y }));

  const W = 540, H = 230, ML = 32, MR = 12, MT = 16, MB = 50;
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const maxV = Math.max(1, ...inc.map((b) => Math.abs(b.v)));
  const bw = plotW / inc.length;
  const y0 = MT + plotH;
  const sy = (v) => MT + (1 - v / maxV) * plotH;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Progress harian">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34a0c4" />
          <stop offset="1" stopColor="#2f9e44" />
        </linearGradient>
      </defs>
      <line className="axis" x1={ML} y1={y0} x2={W - MR} y2={y0} />
      <text className="ax" x={ML - 5} y={MT + 4} textAnchor="end">{maxV.toFixed(0)}</text>
      <text className="ax" x={ML - 5} y={y0 + 3} textAnchor="end">0</text>
      {inc.map((b, i) => {
        const x = ML + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const h = Math.abs((b.v / maxV) * plotH);
        const y = b.v >= 0 ? sy(b.v) : y0;
        const cx = x + w / 2;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={Math.max(h, 0)} rx="2" fill="url(#barGrad)" />
            <text className="val" x={cx} y={(b.v >= 0 ? y : y + h) - 4} textAnchor="middle">{b.v.toFixed(0)}</text>
            <text className="ax tick" x={cx} y={y0 + 14} textAnchor="end" transform={`rotate(-38 ${cx} ${y0 + 14})`}>{fmt(toMs(b.d))}</text>
          </g>
        );
      })}
    </svg>
  );
}
