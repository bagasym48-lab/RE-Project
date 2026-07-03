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
const defMtoPondasi = {
  lapis: 2, pvN: 8, pvD: 16, tieD: 10, tieS: 150,
  hBeton: 1200000, hBesi: 15000,
};

function MtoPondasi({ fd }) {
  const [v, setV] = useState(defMtoPondasi);
  const upd = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const g = (k) => num(v[k]);
  const f = fd || {};
  const fg = (k) => num(f[k]);

  // Geometri dari kalkulasi (mm); Ø & spasi tul. footing ikut kalkulasi (db, srl)
  const B = fg('B'), L = fg('L'), h = fg('h'), c1 = fg('c1'), c2 = fg('c2'), Hp = fg('Hp');
  const cover = fg('cover'), fD = fg('db'), fS = Math.max(fg('srl'), 1);
  const np = Math.max(1, Math.round(fg('n_pedestal')));

  const volBeton = (B * L * h + np * c1 * c2 * Hp) / 1e9;

  // Tulangan footing — jaring dua arah
  const nx = Math.floor(L / fS) + 1;
  const ny = Math.floor(B / fS) + 1;
  const lenX = Math.max(B - 2 * cover, 0) / 1000;
  const lenY = Math.max(L - 2 * cover, 0) / 1000;
  const totLenFoot = (nx * lenX + ny * lenY) * Math.max(g('lapis'), 1);
  const beratFoot = totLenFoot * kgmRebar(fD);

  // Tulangan pedestal — vertikal + sengkang (parameter MTO)
  const beratVert = g('pvN') * (Hp / 1000) * kgmRebar(g('pvD')) * np;
  const nTies = Math.floor(Hp / Math.max(g('tieS'), 1)) + 1;
  const lenTie = Math.max(2 * (c1 + c2) - 8 * cover, 0) / 1000;
  const beratTie = nTies * lenTie * kgmRebar(g('tieD')) * np;

  const beratBesi = beratFoot + beratVert + beratTie;
  const hargaBeton = volBeton * g('hBeton');
  const hargaBesi = beratBesi * g('hBesi');
  const total = hargaBeton + hargaBesi;

  return (
    <div className="layout">
      <section className="inputs">
        <p className="mto-link-note">🔗 Dimensi tersinkron dengan <b>Kalkulasi Pondasi Dangkal</b>. Ubah dimensi di kalkulasi → MTO ikut berubah otomatis.</p>

        <fieldset className="group">
          <legend>Dimensi (dari kalkulasi · read-only)</legend>
          <div className="fields">
            <LinkedField label="B — lebar footing (mm)" value={B} />
            <LinkedField label="L — panjang footing (mm)" value={L} />
            <LinkedField label="h — tebal footing (mm)" value={h} />
            <LinkedField label="c1 — panjang pedestal (mm)" value={c1} />
            <LinkedField label="c2 — lebar pedestal (mm)" value={c2} />
            <LinkedField label="Hp — tinggi pedestal (mm)" value={Hp} />
            <LinkedField label="jumlah pedestal" value={np} />
            <LinkedField label="selimut beton (mm)" value={cover} />
            <LinkedField label="Ø tul. footing (mm)" value={fD} />
            <LinkedField label="spasi tul. footing (mm)" value={fS} />
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Tulangan pedestal &amp; lapis (parameter MTO)</legend>
          <div className="fields">
            <NumField label="lapis footing (1=bawah, 2=atas+bawah)" value={v.lapis} onChange={upd('lapis')} step="1" />
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
              <tr><td>Besi footing ({nx}+{ny} batang × {Math.max(g('lapis'), 1)} lapis)</td><td className="num">{beratFoot.toFixed(1)} kg</td></tr>
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

function MtoPipe({ pipe }) {
  const p = pipe || {};
  const pg = (k) => num(p[k]);
  // Section pipa baja dari kalkulasi (Do,t mm) → kg/m (baja karbon)
  const Do = pg('Do'), t = pg('t');
  const kgmLinked = Math.max((Do - t) * t * 0.0246615, 0);
  const colLen = pg('H_above') + pg('depth');   // panjang kolom = H atas + kedalaman (m)
  const beamLen = pg('L');                        // panjang beam (m)

  const [qty, setQty] = useState(1);
  const [rows, setRows] = useState([]);           // pipa tambahan (opsional)
  const [hBesi, setHBesi] = useState(18000);

  const updRow = (i, k, val) => setRows((arr) => arr.map((r, idx) => (idx === i ? { ...r, [k]: val } : r)));
  const addRow = () => setRows((arr) => [...arr, { t: 2, panjang: 6, jumlah: 1 }]);
  const delRow = (i) => setRows((arr) => arr.filter((_, idx) => idx !== i));

  const nSup = Math.max(0, num(qty));
  const lenLinked = (colLen + beamLen) * nSup;
  const beratLinked = kgmLinked * lenLinked;

  const calc = rows.map((r) => {
    const kgm = PIPE_TYPES[r.t]?.kgm || 0;
    const totLen = num(r.panjang) * num(r.jumlah);
    return { kgm, totLen, berat: kgm * totLen };
  });
  const lenManual = calc.reduce((s, c) => s + c.totLen, 0);
  const beratManual = calc.reduce((s, c) => s + c.berat, 0);
  const totLen = lenLinked + lenManual;
  const totBerat = beratLinked + beratManual;
  const totHarga = totBerat * num(hBesi);

  return (
    <div className="layout">
      <section className="inputs">
        <p className="mto-link-note">🔗 Penampang &amp; panjang member tersinkron dengan <b>Kalkulasi Pipe Support</b>. Ubah di kalkulasi → MTO ikut berubah otomatis.</p>

        <fieldset className="group">
          <legend>Baja dari kalkulasi (read-only)</legend>
          <div className="fields">
            <LinkedField label="Ø luar pipa Do (mm)" value={Do} />
            <LinkedField label="tebal t (mm)" value={t} />
            <LinkedField label="berat pipa (kg/m)" value={kgmLinked.toFixed(2)} />
            <LinkedField label="panjang kolom = H+kedalaman (m)" value={colLen.toFixed(2)} />
            <LinkedField label="panjang beam L (m)" value={beamLen.toFixed(2)} />
            <label className="field" title="jumlah support identik">
              <span>jumlah support identik</span>
              <input type="number" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Pipa tambahan (opsional)</legend>
          <div className="lc-wrap">
            <table className="lc mto-pipe">
              <thead><tr><th>Jenis</th><th>kg/m</th><th>Panjang (m)</th><th>Jumlah</th><th>Berat (kg)</th><th></th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="mto-empty">Belum ada pipa tambahan.</td></tr>}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <select value={r.t} onChange={(e) => updRow(i, 't', Number(e.target.value))}>
                        {PIPE_TYPES.map((p2, idx) => <option key={idx} value={idx}>{p2.nama}</option>)}
                      </select>
                    </td>
                    <td className="num">{(PIPE_TYPES[r.t]?.kgm || 0).toFixed(2)}</td>
                    <td><input type="number" step="any" value={r.panjang} onChange={(e) => updRow(i, 'panjang', e.target.value)} /></td>
                    <td><input type="number" step="1" value={r.jumlah} onChange={(e) => updRow(i, 'jumlah', e.target.value)} /></td>
                    <td className="num">{calc[i].berat.toFixed(1)}</td>
                    <td><button className="del" onClick={() => delRow(i)} title="hapus baris">✕</button></td>
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
              <tr><td>Baja terhubung — kolom + beam ({nSup}×)</td><td className="num">{beratLinked.toFixed(1)} kg</td></tr>
              {beratManual > 0 && <tr><td>Pipa tambahan</td><td className="num">{beratManual.toFixed(1)} kg</td></tr>}
              <tr><td>Total panjang pipa</td><td className="num">{totLen.toFixed(1)} m</td></tr>
              <tr className="sub"><td>Total berat</td><td className="num">{totBerat.toFixed(1)} kg</td></tr>
              <tr className="total"><td>TOTAL HARGA</td><td className="num">{rupiah(totHarga)}</td></tr>
            </tbody>
          </table>
          <p className="muted-note">Berat pipa baja = (Do−t)·t·0.0246615 kg/m. Belum termasuk fitting, base plate, coating, upah, dll. Wajib diverifikasi.</p>
        </div>
      </aside>
    </div>
  );
}

// ============================================================
// MTO Pondasi Equipment — dimensi tersinkron dari kalkulasi (prop `equip`)
// ============================================================
const defMtoEquip = {
  lapis: 2, tLc: 0.05, wasteBesi: 5, projBolt: 150,
  hBeton: 1200000, hBesi: 15000, hLc: 900000, hAngkur: 30000,
};

// Field read-only untuk nilai yang datang dari kalkulasi (tidak bisa diedit di MTO).
function LinkedField({ label, value }) {
  return (
    <label className="field linked" title={`${label} — otomatis dari kalkulasi`}>
      <span>{label}</span>
      <input type="text" value={value} readOnly tabIndex={-1} />
    </label>
  );
}

function MtoEquipment({ equip }) {
  const [v, setV] = useState(defMtoEquip);
  const upd = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const g = (k) => num(v[k]);
  const e = equip || {};
  const eg = (k) => num(e[k]);

  // Geometri dari kalkulasi — Lf/Bf/Hf dalam meter; cover/Drl/srl/d_bolt/h_anchor mm
  const Lf = eg('Lf'), Bf = eg('Bf'), Hf = eg('Hf');
  const cover = eg('cover'), Drl = eg('Drl'), srl = Math.max(eg('srl'), 1);
  const nBolt = Math.max(0, Math.round(eg('n_bolt'))), dBolt = eg('d_bolt'), hAnchor = eg('h_anchor');

  // Volume beton (blok tanpa pedestal) + lantai kerja
  const volBeton = Lf * Bf * Hf;               // m³
  const volLc = Lf * Bf * g('tLc');            // m³

  // Tulangan jaring 2 arah
  const LfMm = Lf * 1000, BfMm = Bf * 1000;
  const nX = Math.floor(BfMm / srl) + 1;       // batang arah Lf (tersebar sepanjang Bf)
  const nZ = Math.floor(LfMm / srl) + 1;       // batang arah Bf (tersebar sepanjang Lf)
  const lenX = Math.max(LfMm - 2 * cover, 0) / 1000;
  const lenZ = Math.max(BfMm - 2 * cover, 0) / 1000;
  const lapis = Math.max(g('lapis'), 1);
  const totLenRebar = (nX * lenX + nZ * lenZ) * lapis;                       // m
  const beratBesi = totLenRebar * kgmRebar(Drl) * (1 + g('wasteBesi') / 100); // kg

  // Anchor bolt (baja 7850 kg/m³)
  const lenBolt = hAnchor + g('projBolt');                                    // mm
  const beratBoltUnit = (Math.PI / 4) * dBolt * dBolt * lenBolt * 7.85e-6;    // kg/baut
  const beratAngkur = nBolt * beratBoltUnit;

  const hargaBeton = volBeton * g('hBeton');
  const hargaLc = volLc * g('hLc');
  const hargaBesi = beratBesi * g('hBesi');
  const hargaAngkur = beratAngkur * g('hAngkur');
  const total = hargaBeton + hargaLc + hargaBesi + hargaAngkur;

  return (
    <div className="layout">
      <section className="inputs">
        <p className="mto-link-note">🔗 Dimensi tersinkron dengan <b>Kalkulasi Pondasi Equipment</b>. Ubah dimensi di kalkulasi → MTO ikut berubah otomatis.</p>

        <fieldset className="group">
          <legend>Dimensi (dari kalkulasi · read-only)</legend>
          <div className="fields">
            <LinkedField label="Lf — panjang fondasi (m)" value={Lf} />
            <LinkedField label="Bf — lebar fondasi (m)" value={Bf} />
            <LinkedField label="Hf — tinggi fondasi (m)" value={Hf} />
            <LinkedField label="selimut beton (mm)" value={cover} />
            <LinkedField label="Ø tulangan (mm)" value={Drl} />
            <LinkedField label="spasi tulangan (mm)" value={srl} />
            <LinkedField label="jumlah anchor bolt" value={nBolt} />
            <LinkedField label="Ø anchor bolt (mm)" value={dBolt} />
            <LinkedField label="kedalaman anchor (mm)" value={hAnchor} />
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Parameter MTO</legend>
          <div className="fields">
            <NumField label="lapis tulangan (1=bawah, 2=atas+bawah)" value={v.lapis} onChange={upd('lapis')} step="1" />
            <NumField label="tebal lantai kerja (m)" value={v.tLc} onChange={upd('tLc')} />
            <NumField label="waste besi (%)" value={v.wasteBesi} onChange={upd('wasteBesi')} />
            <NumField label="proyeksi baut di atas beton (mm)" value={v.projBolt} onChange={upd('projBolt')} />
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Harga satuan</legend>
          <div className="fields">
            <NumField label="harga beton (Rp/m³)" value={v.hBeton} onChange={upd('hBeton')} />
            <NumField label="harga besi (Rp/kg)" value={v.hBesi} onChange={upd('hBesi')} />
            <NumField label="harga lantai kerja (Rp/m³)" value={v.hLc} onChange={upd('hLc')} />
            <NumField label="harga anchor bolt (Rp/kg)" value={v.hAngkur} onChange={upd('hAngkur')} />
          </div>
        </fieldset>
      </section>

      <aside className="side">
        <div className="card">
          <h2>Hasil MTO — Pondasi Equipment</h2>
          <table className="res mto-res">
            <tbody>
              <tr><td>Volume beton struktural ({Lf}×{Bf}×{Hf} m)</td><td className="num">{volBeton.toFixed(3)} m³</td></tr>
              <tr><td>Volume lantai kerja</td><td className="num">{volLc.toFixed(3)} m³</td></tr>
              <tr><td>Besi jaring ({nX}+{nZ} batang × {lapis} lapis)</td><td className="num">{beratBesi.toFixed(1)} kg</td></tr>
              <tr><td>Anchor bolt ({nBolt} × {beratBoltUnit.toFixed(2)} kg)</td><td className="num">{beratAngkur.toFixed(1)} kg</td></tr>
              <tr><td>Harga beton</td><td className="num">{rupiah(hargaBeton)}</td></tr>
              <tr><td>Harga lantai kerja</td><td className="num">{rupiah(hargaLc)}</td></tr>
              <tr><td>Harga besi</td><td className="num">{rupiah(hargaBesi)}</td></tr>
              <tr><td>Harga anchor bolt</td><td className="num">{rupiah(hargaAngkur)}</td></tr>
              <tr className="total"><td>TOTAL</td><td className="num">{rupiah(total)}</td></tr>
            </tbody>
          </table>
          <p className="muted-note">Estimasi beton + tulangan + anchor bolt. Belum termasuk bekisting, grouting, upah, dll. Wajib diverifikasi.</p>
        </div>
      </aside>
    </div>
  );
}

export default function MtoPage({ pondasi, equip, pipe }) {
  const [sub, setSub] = useState('pondasi');
  return (
    <div className="app">
      <header className="head">
        <h1>MTO — Material Take-Off</h1>
        <p className="sub">Estimasi volume/berat &amp; harga material pekerjaan · tersinkron dengan kalkulasi</p>
      </header>
      <div className="mto-subtabs">
        <button className={sub === 'pondasi' ? 'active' : ''} onClick={() => setSub('pondasi')}>MTO Pondasi Dangkal</button>
        <button className={sub === 'equipment' ? 'active' : ''} onClick={() => setSub('equipment')}>MTO Pondasi Equipment</button>
        <button className={sub === 'pipe' ? 'active' : ''} onClick={() => setSub('pipe')}>MTO Pipe Support</button>
      </div>
      {sub === 'pondasi' && <MtoPondasi fd={pondasi} />}
      {sub === 'equipment' && <MtoEquipment equip={equip} />}
      {sub === 'pipe' && <MtoPipe pipe={pipe} />}
    </div>
  );
}
