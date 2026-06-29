// CalculatorForm.jsx — contoh komponen kalkulator (titik awal).
// Memanggil POST /calculate di backend FastAPI dan menampilkan tabel hasil.
// Pasang di proyek Vite + React. Sketsa SVG bisa ditambahkan kemudian.

import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const defaultFoundation = {
  n_pedestal: 1, alphas: 20, fc: 28, fy: 420,
  B: 1500, L: 1500, h: 300, Df: 500,
  c1: 400, c2: 400, Hp: 700, cover: 75,
  db: 13, srl: 150, gc: 24, mu_fric: 0.5, SF_bc: 3.0,
};
const defaultSoil = {
  phi: 30, c: 0, gs: 18, gw: 9.81,
  xi_c: 1.30, xi_q: 1.30, xi_g: 0.69,
  Es: 12000, mu: 0.30, e0: 0.50, Cc: 0.12, Cs: 0.0116,
  Po: 9314.6, dP: 466.1, h1: 1.5, h2: 3.0,
  I1: 0.363, I2: 0.048, If: 0.53,
};
const defaultLCs = [
  { nama: "LC123", FY: 60.49, FX: -7.88, FZ: -5.32, MX: -14.23, MZ: 20.87 },
];

const LABELS = {
  daya_dukung: "Daya dukung tanah",
  geser_1arah: "Geser satu arah",
  geser_2arah: "Geser dua arah (pons)",
  lentur: "Lentur",
  tulangan_min: "Tulangan minimum",
  stab_geser: "Stabilitas geser",
  guling: "Guling",
  uplift: "Gaya angkat",
};

export default function CalculatorForm() {
  const [fd, setFd] = useState(defaultFoundation);
  const [soil] = useState(defaultSoil);
  const [lcs] = useState(defaultLCs);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const num = (k, v) => setFd({ ...fd, [k]: parseFloat(v) });

  async function calculate() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundation: fd, soil, load_cases: lcs }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2>Kalkulator Pondasi Dangkal</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {["B", "L", "h", "c1", "c2", "Df", "db", "srl", "fc", "fy", "qa_dummy"].map((k) =>
          k === "qa_dummy" ? null : (
            <label key={k} style={{ fontSize: 13 }}>
              {k}
              <input type="number" value={fd[k]} onChange={(e) => num(k, e.target.value)}
                style={{ width: "100%" }} />
            </label>
          )
        )}
      </div>

      <button onClick={calculate} disabled={loading} style={{ marginTop: 12 }}>
        {loading ? "Menghitung..." : "Hitung & cek keamanan"}
      </button>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ color: result.overall_ok ? "green" : "crimson" }}>
            {result.overall_ok ? "AMAN" : "TIDAK AMAN"}
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr><th align="left">Pengecekan</th><th>Demand</th><th>Kapasitas</th><th>Rasio</th><th>Status</th></tr>
            </thead>
            <tbody>
              {Object.entries(result.checks).map(([k, v]) => (
                <tr key={k}>
                  <td>{LABELS[k] || k}</td>
                  <td align="right">{v.demand.toFixed(2)}</td>
                  <td align="right">{v.kapasitas.toFixed(2)}</td>
                  <td align="right">{v.rasio.toFixed(2)}</td>
                  <td align="center" style={{ color: v.ok ? "green" : "crimson" }}>
                    {v.ok ? "OK" : "NG"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "#666" }}>
            Settlement total: {result.settlement.Stot.toFixed(2)} mm
            ({result.settlement.ok ? "OK <25mm" : "NG"})
          </p>
        </div>
      )}
    </div>
  );
}
