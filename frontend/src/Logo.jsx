// Logo.jsx — logo RE-Project (frontend/public/logo.png = versi latar transparan).
// File asli berlatar putih (logo apk.png) tetap disimpan sebagai cadangan.
const LOGO = '/logo.png';

// Dipakai di top-nav. `size` = tinggi gambar (px).
export function LogoMark({ size = 40 }) {
  return <img className="logo-mark-img" src={LOGO} alt="RE-Project" style={{ height: size }} />;
}

// Dipakai di halaman login (lockup penuh: gambar sudah memuat nama + tagline).
export function LogoLockup() {
  return <img className="logo-img" src={LOGO} alt="RE-Project — Kalkulasi & Monitoring Project" />;
}
