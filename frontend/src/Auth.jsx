// Auth.jsx — halaman login / register memakai Supabase Auth (email + password).
// Nama dikirim sebagai user metadata; trigger handle_new_user mengisinya ke
// tabel profiles (role default 'viewer'). Lihat supabase/schema.sql.
import { useState } from 'react';
import { supabase } from './supabaseClient';
import { LogoLockup } from './Logo.jsx';

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const isRegister = mode === 'register';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nama: nama || email } },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('Registrasi berhasil. Cek email Anda untuk verifikasi, lalu masuk.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
    setInfo(null);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <LogoLockup />
        <p className="sub">{isRegister ? 'Buat akun baru' : 'Masuk untuk mengakses aplikasi'}</p>

        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              Nama
              <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </label>
          <button className="submit" type="submit" disabled={busy}>
            {busy ? 'Memproses…' : isRegister ? 'Daftar' : 'Masuk'}
          </button>
        </form>

        {error && <p className="auth-msg err">{error}</p>}
        {info && <p className="auth-msg ok">{info}</p>}

        <p className="auth-toggle">
          {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <button type="button" onClick={toggle}>{isRegister ? 'Masuk' : 'Daftar'}</button>
        </p>
      </div>
    </div>
  );
}
