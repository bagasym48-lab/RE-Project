// Smoke test kalkulasi pondasi equipment vs angka dokumen FEED DURI-TEST05NW000.
// Jalankan dari folder frontend:  node smoke-equipment.mjs
// Harus print "SEMUA COCOK DENGAN DOKUMEN" setelah tiap perubahan logika kalkulasi.
import { compute, def } from './src/equipmentFoundationCalc.js';

const r = compute(def);
const i = r.info;
const near = (v, ref, tol = 0.02) => Math.abs(v - ref) <= Math.abs(ref) * tol;
let fail = 0;
const chk = (name, v, ref, tol) => {
  const ok = near(v, ref, tol);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'NG!'} ${name}: ${Number(v).toFixed(4)} (doc ${ref})`);
};

console.log('=== vs dokumen ===');
chk('Wf (23.48 kN)', i.Wf, 23.48);
chk('rasio Wf/EO (8.22)', i.ratioW, 8.22);
chk('qh0 (506.85 N/m2)', i.qh0, 506.85);
chk('Hwx (0.82 kN)', i.Hwx, 0.8147, 0.01);
chk('Cs (0.255)', i.Cs, 0.255);
chk('Vx EE (0.56)', i.Vh.EE, 0.561, 0.01);
chk('Vy EE (2.62)', i.Vy.EE, 2.619, 0.01);
chk('Mv EE (0.45)', i.Mv.EE, 0.446, 0.01);
chk('Sx (0.68 m3)', i.Sx, 0.6846, 0.01);
chk('Sz (0.23 m3)', i.Sz, 0.2282, 0.01);
chk('sigma_max (18.41)', r.checks.daya_dukung.demand, 18.41, 0.01);
console.log('  lc gov:', r.checks.daya_dukung.lc, '| smin:', i && r.checks.daya_dukung.smin.toFixed(2), '(doc 13.32)');
chk('SF geser worst (20.40)', r.checks.stab_geser.SF, 20.40, 0.02);
chk('SF buoyancy (6.7)', r.checks.buoyancy.SF, 23.48 / (0.2 * 1.7787 * 9.81), 0.02);
// Doc menulis Is = I1+(1-2mu)/(1-mu)*I2 tapi angkanya pakai I1+I2 (0.292);
// kita pakai rumus lengkap (Is=0.239) -> Si 1.44 (doc 1.744), verdict sama.
chk('Si (rumus penuh 1.44 mm)', i.Si, 1.440, 0.02);
chk('Po (7520 kg/m2)', i.Po, 7520.6, 0.01);
chk('dP (239 kg/m2)', i.dP, 239.13, 0.02);
chk('Sc1 (0.349 mm)', i.Sc1, 0.349, 0.06);
chk('Sc2 (0.654 mm)', i.Sc2, 0.654, 0.06);
chk('Stot (2.42 mm; doc 2.747 dgn Is=I1+I2)', i.Stot, 2.425, 0.02);
chk('d eff (467 mm)', i.d_eff, 467);
chk('As (1340.41 mm2)', i.As, 1340.41, 0.001);
chk('As_min (990)', i.As_min, 990, 0.001);
chk('Mc (230.63 kNm)', i.Mc, 230.63, 0.01);
chk('Mux (2.85)', i.Mux, 2.852, 0.01);
chk('Muz (6.42)', i.Muz, 6.417, 0.01);
chk('Ase (269.18 mm2)', i.Ase, 269.18, 0.005);
chk('Nu tarik (0.51 kN)', i.Nu, 0.505, 0.03);
chk('heff (410.17)', i.heff, 410.17, 0.005);
chk('Ncb (130.71)', i.Ncb, 130.71, 0.01);
chk('Npn (88.92)', i.Npn, 88.92, 0.005);
chk('Nsb (269.42)', i.Nsb, 269.42, 0.005);
chk('phiNn (62.24)', i.phiNn, 62.24, 0.005);
chk('Vb (320.11)', i.Vb ?? 0, 320.11, 0.01);
chk('Vcb (347.86)', i.Vcb, 347.86, 0.01);
chk('Vcp (261.42)', i.Vcp, 261.42, 0.01);
chk('phiVn (78.01)', i.phiVn, 78.01, 0.005);
console.log('interaksi:', i.inter.toFixed(4), '(doc 0.0086, beda krn Vu friksi=0)');
console.log('\n=== checks ===');
for (const [k, v] of Object.entries(r.checks))
  console.log(`  ${k.padEnd(18)} rasio=${v.rasio.toFixed(3)} ${v.ok ? 'OK' : 'NG'}`);
console.log('overall_ok:', r.overall_ok);
console.log(fail ? `\n${fail} CHECK GAGAL` : '\nSEMUA COCOK DENGAN DOKUMEN');
process.exit(fail ? 1 : 0);
