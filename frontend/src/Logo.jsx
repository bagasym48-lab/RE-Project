// Logo.jsx — logo RE-Project dari file gambar (frontend/public/logo apk.png).
// Nama file mengandung spasi → di-encode jadi %20.
const LOGO = '/logo%20apk.png';

// Dipakai di top-nav. `size` = tinggi gambar (px).
export function LogoMark({ size = 40 }) {
  return <img className="logo-mark-img" src={LOGO} alt="RE-Project" style={{ height: size }} />;
}

// Dipakai di halaman login (lockup penuh: gambar sudah memuat nama + tagline).
export function LogoLockup() {
  return <img className="logo-img" src={LOGO} alt="RE-Project — Kalkulasi & Monitoring Project" />;
}
