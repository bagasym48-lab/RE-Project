// MtoPage.jsx — Material Take-Off: estimasi volume/berat & harga.
// Dua sub-tab: Pondasi Dangkal (beton + tulangan) & Pipe Support (steel pipe).
// Murni di frontend (aritmetika), tidak memanggil backend/DB.
import { useState } from 'react';

const rupiah = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// Berat tulangan (kg/m) = 0.006165 · d²  (d dalam mm; ≈ d²/162)
const kgmRebar = (d) => 0.006165 * d * d;

function NumField({ label, value, onChange, step = 'any' }) {
  return (
    <label className="field" title={label}>
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ============================================================
// MTO Pondasi Dangkal
// ============================================================
const defPondasi = {
  B: 1500, L: 1500, h: 300, c1: 400, c2: 400, Hp: 700, n_pedestal: 1, cover: 75,
  fD: 16, fS: 150, lapis: 2,
  pvN: 8, pvD: 16, tieD: 10, tieS: 150,
  hBeton: 1200000, hBesi: 15000,
};

function MtoPondasi() {
  const [v, setV] = useState(defPondasi);
  const upd = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const g = (k) => num(v[k]);

  const np = Math.max(1, Math.round(g('n_pedestal')));
  const volBeton = (g('B') * g('L') * g('h') + np * g('c1') * g('c2') * g('Hp')) / 1e9;

  // Tulangan footing — jaring dua arah
  const nx = Math.floor(g('L') / Math.max(g('fS'), 1)) + 1;
  const ny = Math.floor(g('B') / Math.max(g('fS'), 1)) + 1;
  const lenX = Math.max(g('B') - 2 * g('cover'), 0) / 1000;
  const lenY = Math.max(g('L') - 2 * g('cover'), 0) / 1000;
  const totLenFoot = (nx * lenX + ny * lenY) * Math.max(g('lapis'), 1);
  const beratFoot = totLenFoot * kgmRebar(g('fD'));

  // Tulangan pedestal — vertikal + sengkang
  const beratVert = g('pvN') * (g('Hp') / 1000) * kgmRebar(g('pvD')) * np;
  const nTies = Math.floor(g('Hp') / Math.max(g('tieS'), 1)) + 1;
  const lenTie = Math.max(2 * (g('c1') + g('c2')) - 8 * g('cover'), 0) / 1000;
  const beratTie = nTies * lenTie * kgmRebar(g('tieD')) * np;

  const beratBesi = beratFoot + beratVert + beratTie;
  const hargaBeton = volBeton * g('hBeton');
  const hargaBesi = beratBesi * g('hBesi');
  const total = hargaBeton + hargaBesi;

  return (
    <div className="layout">
      <section className="inputs">
        <fieldset className="group">
          <legend>Dimensi pondasi (mm)</legend>
          <div className="fields">
            <NumField label="B — lebar footing" value={v.B} onChange={upd('B')} />
            <NumField label="L — panjang footing" value={v.L} onChange={upd('L')} />
            <NumField label="h — tebal footing" value={v.h} onChange={upd('h')} />
            <NumField label="c1 — panjang pedestal" value={v.c1} onChange={upd('c1')} />
            <NumField label="c2 — lebar pedestal" value={v.c2} onChange={upd('c2')} />
            <NumField label="Hp — tinggi pedestal" value={v.Hp} onChange={upd('Hp')} />
            <NumField label="jumlah pedestal" value={v.n_pedestal} onChange={upd('n_pedestal')} step="1" />
            <NumField label="selimut beton" value={v.cover} onChange={upd('cover')} />
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Tulangan footing</legend>
          <div className="fields">
            <NumField label="Ø tul. footing (mm)" value={v.fD} onChange={upd('fD')} />
            <NumField label="spasi (mm)" value={v.fS} onChange={upd('fS')} />
            <NumField label="lapis (1=bawah, 2=atas+bawah)" value={v.lapis} onChange={upd('lapis')} step="1" />
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Tulangan pedestal</legend>
          <div className="fields">
            <NumField label="jumlah tul. vertikal" value={v.pvN} onChange={upd('pvN')} step="1" />
            <NumField label="Ø vertikal (mm)" value={v.pvD} onChange={upd('pvD')} />
            <NumField label="Ø sengkang (mm)" value={v.tieD} onChange={upd('tieD')} />
            <NumField label="spasi sengkang (mm)" value={v.tieS} onChange={upd('tieS')} />
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Harga satuan</legend>
          <div className="fields">
            <NumField label="harga beton (Rp/m³)" value={v.hBeton} onChange={upd('hBeton')} />
            <NumField label="harga besi (Rp/kg)" value={v.hBesi} onChange={upd('hBesi')} />
          </div>
        </fieldset>
      </section>

      <aside className="side">
        <div className="card">
          <h2>Hasil MTO — Pondasi Dangkal</h2>
          <table className="res mto-res">
            <tbody>
              <tr><td>Volume beton</td><td className="num">{volBeton.toFixed(3)} m³</td></tr>
              <tr><td>Besi footing ({nx}+{ny} batang × {Math.max(num(v.lapis), 1)} lapis)</td><td className="num">{beratFoot.toFixed(1)} kg</td></tr>
              <tr><td>Besi vertikal pedestal</td><td className="num">{beratVert.toFixed(1)} kg</td></tr>
              <tr><td>Besi sengkang ({nTies}×)</td><td className="num">{beratTie.toFixed(1)} kg</td></tr>
              <tr className="sub"><td>Total besi</td><td className="num">{beratBesi.toFixed(1)} kg</td></tr>
              <tr><td>Harga beton</td><td className="num">{rupiah(hargaBeton)}</td></tr>
              <tr><td>Harga besi</td><td className="num">{rupiah(hargaBesi)}</td></tr>
              <tr className="total"><td>TOTAL</td><td className="num">{rupiah(total)}</td></tr>
            </tbody>
          </table>
          <p className="muted-note">Estimasi material beton + tulangan. Belum termasuk bekisting, lantai kerja, upah, dll. Wajib diverifikasi.</p>
        </div>
      </aside>
    </div>
  );
}

// ============================================================
// MTO Pipe Support
// ============================================================
// Berat pipa baja karbon Sch 40 (kg/m) = (OD − t)·t·0.0246615
const PIPE_TYPES = [
  { nama: 'CS Pipe 2" Sch40', kgm: 5.44 },
  { nama: 'CS Pipe 3" Sch40', kgm: 11.29 },
  { nama: 'CS Pipe 4" Sch40', kgm: 16.08 },
  { nama: 'CS Pipe 6" Sch40', kgm: 28.26 },
  { nama: 'CS Pipe 8" Sch40', kgm: 42.55 },
  { nama: 'CS Pipe 10" Sch40', kgm: 60.31 },
];

function MtoPipe() {
  const [rows, setRows] = useState([{ t: 2, panjang: 6, jumlah: 4 }]);
  const [hBesi, setHBesi] = useState(18000);

  const updRow = (i, k, val) => setRows((arr) => arr.map((r, idx) => (idx === i ? { ...r, [k]: val } : r)));
  const addRow = () => setRows((arr) => [...arr, { t: 2, panjang: 6, jumlah: 1 }]);
  const delRow = (i) => setRows((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const calc = rows.map((r) => {
    const kgm = PIPE_TYPES[r.t]?.kgm || 0;
    const totLen = num(r.panjang) * num(r.jumlah);
    const berat = kgm * totLen;
    return { kgm, totLen, berat, harga: berat * num(hBesi) };
  });
  const totLen = calc.reduce((s, c) => s + c.totLen, 0);
  const totBerat = calc.reduce((s, c) => s + c.berat, 0);
  const totHarga = calc.reduce((s, c) => s + c.harga, 0);

  return (
    <div className="layout">
      <section className="inputs">
        <fieldset className="group">
          <legend>Daftar steel pipe</legend>
          <div className="lc-wrap">
            <table className="lc mto-pipe">
              <thead><tr><th>Jenis</th><th>kg/m</th><th>Panjang (m)</th><th>Jumlah</th><th>Berat (kg)</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <select value={r.t} onChange={(e) => updRow(i, 't', Number(e.target.value))}>
                        {PIPE_TYPES.map((p, idx) => <option key={idx} value={idx}>{p.nama}</option>)}
                      </select>
                    </td>
                    <td className="num">{(PIPE_TYPES[r.t]?.kgm || 0).toFixed(2)}</td>
                    <td><input type="number" step="any" value={r.panjang} onChange={(e) => updRow(i, 'panjang', e.target.value)} /></td>
                    <td><input type="number" step="1" value={r.jumlah} onChange={(e) => updRow(i, 'jumlah', e.target.value)} /></td>
                    <td className="num">{calc[i].berat.toFixed(1)}</td>
                    <td><button className="del" onClick={() => delRow(i)} disabled={rows.length <= 1} title="hapus baris">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="add" onClick={addRow}>+ tambah pipa</button>
        </fieldset>

        <fieldset className="group">
          <legend>Harga satuan</legend>
          <div className="fields">
            <NumField label="harga steel pipe (Rp/kg)" value={hBesi} onChange={setHBesi} />
          </div>
        </fieldset>
      </section>

      <aside className="side">
        <div className="card">
          <h2>Hasil MTO — Pipe Support</h2>
          <table className="res mto-res">
            <tbody>
              <tr><td>Total panjang pipa</td><td className="num">{totLen.toFixed(1)} m</td></tr>
              <tr className="sub"><td>Total berat</td><td className="num">{totBerat.toFixed(1)} kg</td></tr>
              <tr className="total"><td>TOTAL HARGA</td><td className="num">{rupiah(totHarga)}</td></tr>
            </tbody>
          </table>
          <p className="muted-note">Berat dari tabel pipa baja karbon (Sch 40); harga berbasis berat. Belum termasuk fitting, coating, upah, dll. Wajib diverifikasi.</p>
        </div>
      </aside>
    </div>
  );
}

export default function MtoPage() {
  const [sub, setSub] = useState('pondasi');
  return (
    <div className="app">
      <header className="head">
        <h1>MTO — Material Take-Off</h1>
        <p className="sub">Estimasi volume/berat &amp; harga material pekerjaan</p>
      </header>
      <div className="mto-subtabs">
        <button className={sub === 'pondasi' ? 'active' : ''} onClick={() => setSub('pondasi')}>MTO Pondasi Dangkal</button>
        <button className={sub === 'pipe' ? 'active' : ''} onClick={() => setSub('pipe')}>MTO Pipe Support</button>
      </div>
      {sub === 'pondasi' ? <MtoPondasi /> : <MtoPipe />}
    </div>
  );
}
