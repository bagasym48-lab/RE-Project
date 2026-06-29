// App.jsx — gerbang auth: aplikasi hanya tampil setelah login.
import { useAuth } from './useAuth';
import { supabase } from './supabaseClient';
import Auth from './Auth.jsx';
import Shell from './Shell.jsx';

export default function App() {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="splash">Memuat…</div>;
  if (!session) return <Auth />;

  return <Shell session={session} profile={profile} onLogout={() => supabase.auth.signOut()} />;
}
