// supabaseClient.js — instance tunggal Supabase.
// Sesi disimpan otomatis di localStorage (persistSession default = true).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset di frontend/.env');
}

export const supabase = createClient(url, anonKey);
