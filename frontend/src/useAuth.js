// useAuth.js — kelola sesi Supabase + profil (nama, role) dari tabel `profiles`.
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sesi: pulihkan sesi tersimpan, lalu dengarkan perubahan (login/logout).
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Profil: ambil nama & role tiap kali sesi berubah.
  useEffect(() => {
    let active = true;
    if (!session?.user) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('nama, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.warn('Gagal ambil profil:', error.message);
        setProfile(data ?? null);
      });
    return () => {
      active = false;
    };
  }, [session]);

  return { session, profile, loading };
}
