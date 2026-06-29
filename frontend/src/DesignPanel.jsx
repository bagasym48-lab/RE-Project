// DesignPanel.jsx — simpan & muat desain pondasi (foundation/soil/load_cases + hasil).
// Tabel foundation_designs di Supabase; RLS: user mengelola desain miliknya sendiri.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function DesignPanel({ userId, fd, soil, lcs, result, onLoad }) {
  const [nama, setNama] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  const [items, setItems] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const loadList = useCallback(async () => {
    const { data, error } = await supabase
      .from('foundation_designs')
      .select('id, nama, overall_ok, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    if (error) { setErr(error.message); return; }
    setDesigns(data || []);
  }, [userId]);

  useEffect(() => {
    loadList();
    supabase.from('work_items').select('id, nama').order('created_at')
      .then(({ data }) => setItems(data || []));
  }, [loadList]);

  async function save(e) {
    e.preventDefault();
    setErr(null);
    if (!nama.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('foundation_designs').insert({
      nama: nama.trim(),
      work_item_id: workItemId || null,
      foundation: fd,
      soil,
      load_cases: lcs,
      result: result || null,
      overall_ok: result ? result.overall_ok : null,
      created_by: userId,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setNama('');
    await loadList();
  }

  async function muat(id) {
    setErr(null);
    const { data, error } = await supabase.from('foundation_designs').select('*').eq('id', id).single();
    if (error) { setErr(error.message); return; }
    onLoad(data);
  }

  async function hapus(id) {
    setErr(null);
    const { error } = await supabase.from('foundation_designs').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    await loadList();
  }

  return (
    <div className="card">
      <h2>Simpan / muat desain</h2>
      <form className="form-col" onSubmit={save}>
        <label>Nama desain
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Pondasi P1 — area pompa" required />
        </label>
        <label>Tautkan ke work item (opsional)
          <select value={workItemId} onChange={(e) => setWorkItemId(e.target.value)}>
            <option value="">— tidak ditautkan —</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.nama}</option>)}
          </select>
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Menyimpan…' : result ? 'Simpan desain + hasil' : 'Simpan desain (input saja)'}
        </button>
      </form>

      {err && <p className="err" style={{ marginTop: 8 }}>Error: {err}</p>}

      <h3>Desain tersimpan</h3>
      {designs.length === 0 ? <p className="role-hint">Belum ada desain tersimpan.</p> : (
        <div className="design-list">
          {designs.map((d) => (
            <div key={d.id} className="design-row">
              <span className="dn" title={d.nama}>{d.nama}</span>
              {d.overall_ok != null && <span className={`st ${d.overall_ok ? 'ok' : 'ng'}`}>{d.overall_ok ? 'AMAN' : 'NG'}</span>}
              <button className="btn btn-sm" onClick={() => muat(d.id)}>Muat</button>
              <button className="del" onClick={() => hapus(d.id)} title="hapus">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
