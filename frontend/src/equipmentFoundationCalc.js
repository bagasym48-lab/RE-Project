// equipmentFoundationCalc.js — kalkulasi Pondasi Equipment (block foundation, TANPA pedestal).
// Mesin diletakkan langsung di atas blok beton; angkur menahan tarik/geser mesin.
// Rumus & alur mengacu dokumen FEED DURI-TEST05NW000-CIV-CAL-PHR-2001-00 (Sump Pump 5NW):
//  • Daya dukung : Meyerhof (Nq, Nc, Nγ + faktor bentuk/kedalaman/inklinasi), FS=3;
//                  qall dari Soil Data dapat di-override manual (doc pakai 2802 kg/m²).
//  • Beban       : D (berat blok), EE/EO/ET, IL=1.2·EO (impact 20%),
//                  angin SNI 1727 qh=0.613·Kz·Kzt·Kd·Ke·V² (min 770 N/m²), F=qh·G·Cf·Aw,
//                  gempa SNI 1726 Cs=SDS·Ie/R, V=Cs·E, Vy=0.2·SDS·(D+E).
//  • Kombinasi   : 13 LC servis (301–313) sesuai dokumen.
//  • Cek         : rasio berat Wf/EO ≥ 5 (RTS PHR — pompa <10.000 lb & <500 HP, tanpa
//                  analisis dinamik), daya dukung (σmax ≤ qall & σmin ≥ 0), geser (SF 1.5),
//                  guling (SF 2), buoyancy (SF 1.5), settlement Braja Das (< 25 mm),
//                  lentur footing X/Z + tulangan minimum (SNI 2847),
//                  anchor bolt ACI 318-14 Ch.17 (tarik, geser, interaksi ≤ 1.2).
// ALAT BANTU EDUKASI — wajib diverifikasi insinyur sipil berlisensi.

const PI = Math.PI;
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const rad = (d) => (d * PI) / 180;

// Default = angka dokumen FEED (Fluid Sump Pump 8056-P0902A/B, area 5NW).
export const def = {
  // Equipment (m, kN)
  Leq: 1.14, Beq: 0.38, Heq: 0.49,
  EE: 2.20, EO: 2.86, ET: 2.86,
  // Fondasi blok (m) — Hfb (tertanam) = Hf - Hfa otomatis
  Lf: 2.31, Bf: 0.77, Hf: 0.55, Hfa: 0.35,
  gc: 24,                       // kN/m³
  // Beton & tulangan footing (mm, MPa)
  fc: 28, fy: 420, cover: 75, Drl: 16, srl: 150,
  // Tanah / daya dukung (kPa, kN/m³, m)
  phi: 8.886, c: 3.92, gs: 17.96, gw: 9.81, Df: 0.55, SF_bc: 3,
  beta_i: 0,                    // sudut inklinasi beban (°)
  qall_manual: 27.48,           // kN/m² dari Soil Data (kosongkan '' → auto Meyerhof)
  mu_fric: 0.5,                 // gesekan beton-tanah (SNI 1726 7.13.8)
  // Angin (SNI 1727 / ASCE 7-16)
  V: 32, Kz: 0.85, Kzt: 1.0, Kd: 0.95, Ke: 1.0, G: 0.85, Cf: 1.3, qh_min: 770,
  // Gempa (SNI 1726)
  SDS: 0.51, Ie: 1.25, R: 2.5,
  // Settlement (Braja M. Das)
  N_spt: 3, mu: 0.30, e0: 0.92, LL: 33, Pc: 10000,   // Pc' kg/m²
  h1: 2.465, h2: 2.335,                              // tebal lapisan (m)
  I1: 0.169, I2: 0.123, If: 0.63, I_fadum: 0.032,    // faktor grafik (input engineer)
  // Anchor bolt (ACI 318-14) — pola 4 baut di sudut
  futa: 414, d_bolt: 19, nt: 2, n_bolt: 4, h_anchor: 420,
  d1: 1079.5, d2: 304.8,        // jarak antar baut (mm): d1 sepanjang Lf, d2 sepanjang Bf
  mu_anchor: 0.55,              // gesekan baseplate (PIP STE05121)
};

// --- Daya dukung Meyerhof (faktor sesuai dokumen: Fqd = Fγd = 1) ---
export function meyerhofQall(s) {
  const g = (k) => n(s[k]);
  const phi = g('phi'), p = rad(phi);
  let Nq, Nc, Ng;
  if (phi < 0.1) { Nq = 1; Nc = 5.14; Ng = 0; }
  else {
    Nq = Math.tan(rad(45 + phi / 2)) ** 2 * Math.exp(PI * Math.tan(p));
    Nc = (Nq - 1) / Math.tan(p);
    Ng = 2 * (Nq + 1) * Math.tan(p);
  }
  const B = Math.min(g('Bf'), g('Lf')), L = Math.max(g('Bf'), g('Lf')) || 1;
  const BL = B / L;
  const Fcs = 1 + BL * (Nq / Nc), Fqs = 1 + BL * Math.tan(p), Fgs = 1 - 0.4 * BL;
  const Fcd = 1 + 0.4 * (g('Df') / (B || 1)), Fqd = 1, Fgd = 1;
  const bi = g('beta_i');
  const Fci = (1 - bi / 90) ** 2, Fqi = Fci;
  const Fgi = phi > 0 ? (1 - bi / phi) ** 2 : 1;
  const g_eff = g('gs') - g('gw');            // GWL di muka tanah (kondisi dokumen)
  const q = g_eff * g('Df');
  const qu = g('c') * Nc * Fcs * Fcd * Fci + q * Nq * Fqs * Fqd * Fqi
    + 0.5 * g_eff * B * Ng * Fgs * Fgd * Fgi;
  const qall_auto = qu / (g('SF_bc') || 3);
  const manual = s.qall_manual === '' || s.qall_manual == null ? null : n(s.qall_manual);
  return { Nq, Nc, Ng, Fcs, Fqs, Fgs, Fcd, qu, qall_auto, qall: manual ?? qall_auto, manual: manual != null };
}

export function compute(s) {
  const g = (k) => n(s[k]);
  const Hfb = Math.max(g('Hf') - g('Hfa'), 0);
  const Af = g('Lf') * g('Bf');
  const Sx = (1 / 6) * g('Bf') * g('Lf') ** 2;   // Mx ↔ Sx (konvensi dokumen)
  const Sz = (1 / 6) * g('Bf') ** 2 * g('Lf');
  const Hg = 0.5 * g('Heq');                     // C.O.G. equipment di atas muka fondasi
  const arm = Hg + g('Hf');                      // lengan momen ke dasar fondasi

  const tz = meyerhofQall(s);
  const qall = tz.qall;

  // --- Beban mati & equipment ---
  const Wf = g('gc') * Af * g('Hf');             // berat blok fondasi (kN)
  const D = Wf;
  const EE = g('EE'), EO = g('EO'), ET = g('ET');
  const IL = 1.2 * EO;                           // impact 20% → 1.2·EO (RTS PHR)

  // --- Angin (SNI 1727) ---
  const qh0 = 0.613 * g('Kz') * g('Kzt') * g('Kd') * g('Ke') * g('V') ** 2; // N/m²
  const qh = Math.max(qh0, g('qh_min'));
  const Awx = g('Leq') * (g('Heq') + g('Hfa'));
  const Awz = g('Beq') * (g('Heq') + g('Hfa'));
  const Hwx = (qh * g('G') * g('Cf') * Awx) / 1000;   // kN
  const Hwz = (qh * g('G') * g('Cf') * Awz) / 1000;
  // Resultan angin bekerja di sentroid area terpapar; lengan diukur ke dasar fondasi.
  const arm_w = (g('Heq') + g('Hfa')) / 2 + Hfb;
  const Mwz = Hwx * arm_w, Mwx = Hwz * arm_w;         // Hwx→Mz, Hwz→Mx

  // --- Gempa (SNI 1726) ---
  const Cs0 = (g('SDS') * g('Ie')) / (g('R') || 1);
  const CsMin = Math.max(0.044 * g('SDS') * g('Ie'), 0.01);
  const Cs = Math.max(Cs0, CsMin);
  const Vh = { EE: Cs * EE, EO: Cs * EO };            // Vx = Vz = Cs·E
  const Mv = { EE: Vh.EE * arm, EO: Vh.EO * arm };
  const Vy = { EE: 0.2 * g('SDS') * (D + EE), EO: 0.2 * g('SDS') * (D + EO) };

  // --- 13 kombinasi servis (301–313, sesuai dokumen) ---
  const seis = (E, dom) => {  // dom: 'x' → 0.91Vx+0.27Vz ; 'z' → 0.91Vz+0.27Vx
    const V = Vh[E], M = Mv[E];
    const Fy = (D + (E === 'EE' ? EE : EO)) * (1 + 0.14 * g('SDS'));  // + (0.14SDS)·(D+E) ≈ 0.7Vy
    return dom === 'x'
      ? { Fx: 0.91 * V, Fz: 0.27 * V, Fy, Mx: 0.27 * M, Mz: 0.91 * M }
      : { Fx: 0.27 * V, Fz: 0.91 * V, Fy, Mx: 0.91 * M, Mz: 0.27 * M };
  };
  const lcs = [
    { no: 301, nama: '1D+1EE', Fx: 0, Fy: D + EE, Fz: 0, Mx: 0, Mz: 0 },
    { no: 302, nama: '1D+1EE+0.6Wx', Fx: 0.6 * Hwx, Fy: D + EE, Fz: 0, Mx: 0, Mz: 0.6 * Mwz },
    { no: 303, nama: '1D+1EE+0.6Wz', Fx: 0, Fy: D + EE, Fz: 0.6 * Hwz, Mx: 0.6 * Mwx, Mz: 0 },
    { no: 304, nama: '1D+1EE+0.14SdsVy+0.91Vx+0.27Vz', ...seis('EE', 'x') },
    { no: 305, nama: '1D+1EE+0.14SdsVy+0.91Vz+0.27Vx', ...seis('EE', 'z') },
    { no: 306, nama: '1D+1EO', Fx: 0, Fy: D + EO, Fz: 0, Mx: 0, Mz: 0 },
    { no: 307, nama: '1D+1EO+0.6Wx', Fx: 0.6 * Hwx, Fy: D + EO, Fz: 0, Mx: 0, Mz: 0.6 * Mwz },
    { no: 308, nama: '1D+1EO+0.6Wz', Fx: 0, Fy: D + EO, Fz: 0.6 * Hwz, Mx: 0.6 * Mwx, Mz: 0 },
    { no: 309, nama: '1D+1EO+0.14SdsVy+0.91Vx+0.27Vz', ...seis('EO', 'x') },
    { no: 310, nama: '1D+1EO+0.14SdsVy+0.91Vz+0.27Vx', ...seis('EO', 'z') },
    { no: 311, nama: '1D+1ET', Fx: 0, Fy: D + ET, Fz: 0, Mx: 0, Mz: 0 },
    { no: 312, nama: '1D+1ET+0.45Wx+1IL', Fx: 0.45 * Hwx, Fy: D + ET + IL, Fz: 0, Mx: 0, Mz: 0.45 * Mwz },
    { no: 313, nama: '1D+1ET+0.45Wz+1IL', Fx: 0, Fy: D + ET + IL, Fz: 0.45 * Hwz, Mx: 0.45 * Mwx, Mz: 0 },
  ];

  const H = {};

  // --- 1. Rasio berat fondasi / mesin (≥ 5, RTS PHR utk pompa; Arya ≥ 3) ---
  const W_req = 5 * EO;
  H.rasio_berat = { demand: W_req, kapasitas: Wf, rasio: Wf ? W_req / Wf : 99, ok: Wf >= W_req, ratioW: EO ? Wf / EO : 99 };

  // --- 2. Daya dukung per LC: σmax ≤ qall dan σmin ≥ 0 ---
  let worst = null, worstMin = null;
  const lcTable = lcs.map((lc) => {
    const smax = lc.Fy / Af + Math.abs(lc.Mx) / Sx + Math.abs(lc.Mz) / Sz;
    const smin = lc.Fy / Af - Math.abs(lc.Mx) / Sx - Math.abs(lc.Mz) / Sz;
    if (!worst || smax > worst.smax) worst = { lc, smax };
    if (!worstMin || smin < worstMin.smin) worstMin = { lc, smin };
    return { ...lc, smax, smin };
  });
  H.daya_dukung = {
    demand: worst.smax, kapasitas: qall, rasio: qall ? worst.smax / qall : 99,
    ok: worst.smax <= qall && worstMin.smin >= 0, lc: worst.lc.nama,
    smin: worstMin.smin, lcMin: worstMin.lc.nama,
  };

  // --- 3. Stabilitas geser (SF ≥ 1.5) ---
  let sh = null;
  for (const lc of lcs) {
    const Hs = Math.hypot(lc.Fx, lc.Fz);
    if (Hs <= 0) continue;
    const Fr = lc.Fy * g('mu_fric');
    const SF = Fr / Hs;
    if (!sh || SF < sh.SF) sh = { lc, Hs, Fr, SF };
  }
  H.stab_geser = sh
    ? { demand: sh.Hs, kapasitas: sh.Fr, rasio: sh.Fr ? (1.5 * sh.Hs) / sh.Fr : 99, ok: sh.SF >= 1.5, lc: sh.lc.nama, SF: sh.SF }
    : { demand: 0, kapasitas: D * g('mu_fric'), rasio: 0, ok: true, SF: 99 };

  // --- 4. Stabilitas guling (SF ≥ 2) ---
  let ov = null;
  for (const lc of lcs) {
    const MrX = lc.Fy * 0.5 * g('Lf');   // menahan Mx (konvensi dokumen: Mx ↔ 0.5·Lf)
    const MrZ = lc.Fy * 0.5 * g('Bf');
    const cand = [];
    if (Math.abs(lc.Mx) > 1e-9) cand.push({ SF: MrX / Math.abs(lc.Mx), Mr: MrX, M: Math.abs(lc.Mx) });
    if (Math.abs(lc.Mz) > 1e-9) cand.push({ SF: MrZ / Math.abs(lc.Mz), Mr: MrZ, M: Math.abs(lc.Mz) });
    for (const c0 of cand) if (!ov || c0.SF < ov.SF) ov = { ...c0, lc };
  }
  H.guling = ov
    ? { demand: ov.M, kapasitas: ov.Mr, rasio: ov.Mr ? (2 * ov.M) / ov.Mr : 99, ok: ov.SF >= 2, lc: ov.lc.nama, SF: ov.SF }
    : { demand: 0, kapasitas: (D + EO) * 0.5 * g('Lf'), rasio: 0, ok: true, SF: 99 };

  // --- 5. Buoyancy (Wf ≥ 1.5 × gaya angkat air, GWL di muka tanah) ---
  const Fdb = Hfb * Af * g('gw');
  const SFup = Fdb ? Wf / Fdb : 99;
  H.buoyancy = { demand: Fdb, kapasitas: Wf, rasio: Wf ? (1.5 * Fdb) / Wf : 99, ok: SFup >= 1.5, SF: SFup };

  // --- 6. Settlement (Si + Sc1 + Sc2 < 25 mm, Braja Das) ---
  const q0 = worst.smax;                                  // kN/m²
  const q0_kg = (q0 * 1000) / 9.81;                       // kg/m²
  const Es = 300 * (g('N_spt') + 15);                     // kPa (clayey sand, Bowles)
  const mu = g('mu');
  const Is = g('I1') + ((1 - 2 * mu) / (1 - mu)) * g('I2');
  const B_set = Math.min(g('Bf'), g('Lf'));
  const Si_m = ((q0 * B_set * (1 - mu ** 2)) / Es) * Is * g('If') * 4;
  const Si = Si_m * 1000;                                 // mm
  const gs_kg = (g('gs') * 1000) / 9.81;                  // kg/m³
  const gw_kg = 1000;
  const g_eff_kg = Math.max(gs_kg - gw_kg, 0);
  const Po = g_eff_kg * g('h1') + gs_kg * g('h2') + gw_kg * 0.5 * g('h2');  // kg/m² (per dokumen)
  const dP = 4 * g('I_fadum') * q0_kg;                    // kg/m² (Fadum)
  const Cc = 0.009 * (g('LL') - 13);
  const Cs_idx = Cc / 10;
  const isOC = Po + dP <= g('Pc');                        // overconsolidated → pakai Cs
  const Cuse = isOC ? Cs_idx : Cc;
  const Z = Hfb + g('h1') + g('h2');
  const logTerm = Po > 0 ? Math.log10((Po + dP) / Po) : 0;
  const Sc1 = ((Cuse * (Hfb + g('h1'))) / (1 + g('e0'))) * logTerm * 1000;  // mm
  const Sc2 = ((Cuse * Z) / (1 + g('e0'))) * logTerm * 1000;               // mm
  const Stot = Si + Sc1 + Sc2;
  H.penurunan = { demand: Stot, kapasitas: 25, rasio: Stot / 25, ok: Stot < 25 };

  // --- 7. Lentur footing X/Z + tulangan minimum (SNI 2847, strip 1 m) ---
  const qu_f = 1.4 * qall;                                // kN/m per meter lebar
  const beta1 = g('fc') <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (g('fc') - 28)) / 7);
  const d_eff = g('Hf') * 1000 - g('cover') - 0.5 * g('Drl');   // mm
  const nrl = 1000 / (g('srl') || 150);
  const As = nrl * 0.25 * PI * g('Drl') ** 2;
  const Ag = 1000 * g('Hf') * 1000;
  const As_min = Math.max(((0.0018 * 420) / g('fy')) * Ag, 0.0014 * Ag);
  const a = (As * g('fy')) / (0.85 * g('fc') * 1000);
  const cna = a / beta1;
  const et = ((d_eff - cna) / cna) * 0.003;
  const eyt = g('fy') / 200000;
  const phiM = Math.min(0.9, Math.max(0.65, 0.65 + ((et - eyt) * 0.25) / (0.005 - eyt)));
  const Mc = (phiM * As * g('fy') * (d_eff - 0.5 * a)) / 1e6;   // kNm
  const Mux = 0.5 * qu_f * (0.5 * g('Bf')) ** 2;                // kantilever ½·Bf
  const Muz = (1 / 8) * qu_f * (0.5 * g('Lf')) ** 2;            // per dokumen
  H.lentur_x = { demand: Mux, kapasitas: Mc, rasio: Mc ? Mux / Mc : 99, ok: Mux <= Mc };
  H.lentur_z = { demand: Muz, kapasitas: Mc, rasio: Mc ? Muz / Mc : 99, ok: Muz <= Mc };
  H.tulangan_min = { demand: As_min, kapasitas: As, rasio: As ? As_min / As : 99, ok: As >= As_min };

  // --- 8. Anchor bolt (ACI 318-14 Ch.17; pola 4 baut sudut, cast-in) ---
  const fc = g('fc'), futa = g('futa'), do_ = g('d_bolt'), nb = Math.max(1, g('n_bolt'));
  const Ase = 0.25 * PI * (do_ - 0.9743 / (g('nt') || 2)) ** 2;   // mm²
  const Fy_eq = EO, Hx = Vh.EO, Hz = Vh.EO, Mxa = Mv.EO, Mza = Mv.EO;
  const x_b = g('d2') / 2000, z_b = g('d1') / 2000;               // m
  const Sx2 = nb * x_b ** 2, Sz2 = nb * z_b ** 2;
  const NuRaw = Fy_eq / nb - (Sx2 ? (Math.abs(Mxa) * x_b) / Sx2 : 0) - (Sz2 ? (Math.abs(Mza) * z_b) / Sz2 : 0);
  const Nu = Math.max(-NuRaw, 0);                                 // kN tarik per baut
  const Vf = g('mu_anchor') * Fy_eq;
  const Lat = Math.hypot(Hx, Hz);
  const Vu = Math.max(Lat - Vf, 0) / nb;                          // kN geser per baut
  // Jarak tepi (mm): d1 sepanjang B(=Lf·1000), d2 sepanjang N(=Bf·1000)
  const Bmm = g('Lf') * 1000, Nmm = g('Bf') * 1000, h = g('h_anchor');
  const ca1 = 0.5 * (Bmm - g('d1')), ca2 = Bmm - ca1;
  const ca3 = 0.5 * (Nmm - g('d2')), ca4 = Nmm - ca3;
  const cas = [ca1, ca2, ca3, ca4];
  const near = cas.filter((c0) => c0 < 1.5 * h);
  const heff = near.length >= 3 ? Math.min(h, Math.max(...near) / 1.5) : h;
  const camin = Math.min(...cas);
  // Tarik
  const Nsa = (Ase * futa) / 1000;                                // kN
  const ANc = (Bmm * Nmm) / nb, ANco = 9 * heff ** 2;
  const Nb = (10 * Math.sqrt(fc) * heff ** 1.5) / 1000;           // kN (kc=10 cast-in)
  const psi_edN = Math.min(1, 0.7 + (0.3 * camin) / (1.5 * heff));
  const Ncb = Math.min(ANc / ANco, 1) * psi_edN * 1.25 * Nb;      // ψcN=1.25, ψcpN=1
  const Abrg = 0.25 * PI * do_ ** 2;
  const Npn = (1.4 * 8 * Abrg * fc) / 1000;                       // ψcP=1.4
  const Nsb = (13 * camin * Math.sqrt(Abrg * fc)) / 1000;
  const phiNn = 0.7 * Math.min(Nsa, Ncb, Npn, Nsb);
  // Geser
  const le = Math.min(heff, 8 * do_);
  const Vsa = (Ase * futa) / 1000;
  const Vb = (0.6 * (le / do_) ** 0.2 * Math.sqrt(do_) * Math.sqrt(fc) * ca1 ** 1.5) / 1000;
  const AVc = 1.5 * ca1 * (ca2 + Math.min(0.5 * g('d2'), 1.5 * ca1));
  const AVco = 4.5 * ca1 ** 2;
  const psi_edV = ca3 < 1.5 * ca1 ? Math.min(1, 0.7 + (0.3 * ca3) / (1.5 * ca1)) : 1;
  const Vcb = Math.min(AVc / AVco, 1) * psi_edV * 1.4 * Vb;       // ψcV=1.4 (tak retak)
  const kcp = heff >= 65 ? 2 : 1;
  const Vcp = kcp * Ncb;
  const phiVn = 0.7 * Math.min(Vsa, Vcb, Vcp);
  const inter = (phiNn ? Nu / phiNn : 0) + (phiVn ? Vu / phiVn : 0);
  H.angkur_tarik = { demand: Nu, kapasitas: phiNn, rasio: phiNn ? Nu / phiNn : 99, ok: Nu <= phiNn, noTension: Nu <= 0 };
  H.angkur_geser = { demand: Vu, kapasitas: phiVn, rasio: phiVn ? Vu / phiVn : 99, ok: Vu <= phiVn, noShear: Vu <= 0 };
  H.angkur_interaksi = { demand: inter, kapasitas: 1.2, rasio: inter / 1.2, ok: inter <= 1.2 };

  const overall_ok = Object.values(H).every((c0) => c0.ok);
  return {
    info: {
      Hfb, Af, Sx, Sz, Hg, arm, arm_w, Wf, D, IL, tz, qall,
      qh0, qh, Awx, Awz, Hwx, Hwz, Mwx, Mwz,
      Cs, CsMin, Vh, Vy, Mv,
      q0, q0_kg, Es, Is, Si, Po, dP, Cc, Cs_idx, isOC, Sc1, Sc2, Stot,
      qu_f, d_eff, As, As_min, a, phiM, Mc, Mux, Muz,
      Ase, Nu, Vu, Vf, Lat, ca1, ca2, ca3, ca4, heff, camin,
      Nsa, Ncb, Npn, Nsb, phiNn, Vsa, Vb, Vcb, Vcp, phiVn, inter,
      ratioW: H.rasio_berat.ratioW,
    },
    lcs: lcTable, checks: H, overall_ok,
  };
}
