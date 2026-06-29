// ProgressPage.jsx — work items + log progress, dashboard kurva-S/harian/tabel.
// Role: engineer (buat work item + input progress), qc (isi status/catatan),
// semua (lihat dashboard). RLS di Supabase menegakkan izin per-baris.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { SCurve, DailyBars } from './Charts.jsx';

const todayStr = () => new Date().toISOString().slice(0, 10);

function LogRow({ log, isQc, onSaveQc }) {
  const [status, setStatus] = useState(log.qc_status || 'pending');
  const [catatan, setCatatan] = useState(log.qc_catatan || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(log.qc_status || 'pending');
    setCatatan(log.qc_catatan || '');
  }, [log.id, log.qc_status, log.qc_catatan]);

  async function save() {
    setSaving(true);
    await onSaveQc(log.id, status, catatan);
    setSaving(false);
  }

  return (
    <tr>
      <td>{log.tanggal}</td>
      <td className="num">{log.persen_progress != null ? Number(log.persen_progress).toFixed(0) : '—'}</td>
      <td>{log.actual_date || '—'}</td>
      {isQc ? (
        <>
          <td>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">pending</option>
              <option value="lolos">lolos</option>
              <option value="tidak">tidak</option>
            </select>
          </td>
          <td><input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="catatan QC" /></td>
          <td><button className="btn" onClick={save} disabled={saving}>{saving ? '…' : 'Simpan'}</button></td>
        </>
      ) : (
        <>
          <td><span className={`qc qc-${log.qc_status || 'pending'}`}>{log.qc_status || 'pending'}</span></td>
          <td>{log.qc_catatan || '—'}</td>
        </>
      )}
    </tr>
  );
}

export default function ProgressPage({ userId, role }) {
  const [items, setItems] = useState([]);
  const [selId, setSelId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const isEngineer = role === 'engineer';
  const isQc = role === 'qc';

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase.from('work_items').select('*').order('created_at');
    if (error) { setErr(error.message); return []; }
    setItems(data || []);
    return data || [];
  }, []);

  const loadLogs = useCallback(async (wid) => {
    if (!wid) { setLogs([]); return; }
    const { data, error } = await supabase
      .from('progress_logs').select('*').eq('work_item_id', wid).order('tanggal');
    if (error) { setErr(error.message); return; }
    setLogs(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await loadItems();
      if (data.length) setSelId((cur) => cur ?? data[0].id);
      setLoading(false);
    })();
  }, [loadItems]);

  useEffect(() => { loadLogs(selId); }, [selId, loadLogs]);

  const selItem = items.find((i) => i.id === selId) || null;
  const latest = logs.filter((l) => l.persen_progress != null).slice(-1)[0];

  // --- form work item (engineer) ---
  const [wiNama, setWiNama] = useState('');
  const [wiDesc, setWiDesc] = useState('');
  const [wiTarget, setWiTarget] = useState('');

  async function addItem(e) {
    e.preventDefault();
    setErr(null);
    if (!wiNama.trim()) return;
    const { data, error } = await supabase.from('work_items')
      .insert({ nama: wiNama.trim(), deskripsi: wiDesc || null, target_date: wiTarget || null, created_by: userId })
      .select().single();
    if (error) { setErr(error.message); return; }
    setWiNama(''); setWiDesc(''); setWiTarget('');
    await loadItems();
    if (data) setSelId(data.id);
  }

  // --- form log progress (engineer) ---
  const [pgPersen, setPgPersen] = useState('');
  const [pgTanggal, setPgTanggal] = useState(todayStr());
  const [pgActual, setPgActual] = useState('');

  async function addLog(e) {
    e.preventDefault();
    setErr(null);
    if (!selId) return;
    const { error } = await supabase.from('progress_logs').insert({
      work_item_id: selId,
      tanggal: pgTanggal || todayStr(),
      persen_progress: pgPersen === '' ? null : Number(pgPersen),
      actual_date: pgActual || null,
      created_by: userId,
    });
    if (error) { setErr(error.message); return; }
    setPgPersen(''); setPgActual('');
    await loadLogs(selId);
  }

  async function saveQc(logId, qc_status, qc_catatan) {
    setErr(null);
    const { error } = await supabase.from('progress_logs')
      .update({ qc_status, qc_catatan: qc_catatan || null, qc_by: userId, updated_at: new Date().toISOString() })
      .eq('id', logId);
    if (error) { setErr(error.message); return; }
    await loadLogs(selId);
  }

  return (
    <div className="prog">
      <header className="head">
        <h1>Progress Tracking</h1>
        <p className="sub">Work items &amp; log progress harian · kurva-S rencana vs aktual</p>
      </header>

      {err && <p className="err">Error: {err}</p>}

      <div className="prog-grid">
        <div>
          <div className="panel">
            <h2>Work items</h2>
            {loading ? <p className="role-hint">Memuat…</p>
              : items.length === 0 ? <p className="role-hint">Belum ada work item.</p>
                : items.map((it) => (
                  <button key={it.id} className={`wi-item ${it.id === selId ? 'active' : ''}`} onClick={() => setSelId(it.id)}>
                    <span className="nm">{it.nama}</span>
                    <span className="meta">target: {it.target_date || '—'}</span>
                  </button>
                ))}

            {isEngineer ? (
              <>
                <h3>Tambah work item</h3>
                <form className="form-col" onSubmit={addItem}>
                  <label>Nama<input value={wiNama} onChange={(e) => setWiNama(e.target.value)} required /></label>
                  <label>Deskripsi<textarea value={wiDesc} onChange={(e) => setWiDesc(e.target.value)} rows={2} /></label>
                  <label>Tanggal target<input type="date" value={wiTarget} onChange={(e) => setWiTarget(e.target.value)} /></label>
                  <button className="btn" type="submit">Simpan work item</button>
                </form>
              </>
            ) : (
              <p className="muted-note">Hanya engineer yang bisa membuat work item.</p>
            )}
          </div>
        </div>

        <div>
          {!selItem ? (
            <div className="panel"><p className="role-hint">Pilih atau buat work item untuk melihat progress.</p></div>
          ) : (
            <>
              <div className="panel">
                <h2>{selItem.nama}</h2>
                {selItem.deskripsi && <p className="muted-note">{selItem.deskripsi}</p>}
                <p className="muted-note">
                  Target: <b>{selItem.target_date || '—'}</b>
                  {latest && <> · Progress terakhir: <b>{Number(latest.persen_progress).toFixed(0)}%</b> ({latest.tanggal})</>}
                </p>
              </div>

              <div className="panel">
                <h2>Kurva-S (rencana vs aktual)</h2>
                <SCurve
                  logs={logs}
                  startDate={selItem.created_at ? selItem.created_at.slice(0, 10) : null}
                  targetDate={selItem.target_date}
                />
                <h3>Progress harian</h3>
                <DailyBars logs={logs} />
              </div>

              {isEngineer && (
                <div className="panel">
                  <h2>Input progress</h2>
                  <form className="form-row" onSubmit={addLog}>
                    <label>Tanggal<input type="date" value={pgTanggal} onChange={(e) => setPgTanggal(e.target.value)} /></label>
                    <label>% progress<input type="number" min="0" max="100" step="any" value={pgPersen} onChange={(e) => setPgPersen(e.target.value)} required /></label>
                    <label>Tanggal aktual<input type="date" value={pgActual} onChange={(e) => setPgActual(e.target.value)} /></label>
                    <button className="btn" type="submit">Tambah log</button>
                  </form>
                </div>
              )}

              <div className="panel">
                <h2>Log progress</h2>
                {logs.length === 0 ? <p className="role-hint">Belum ada log.</p> : (
                  <table className="logs">
                    <thead>
                      <tr>
                        <th>Tanggal</th><th>% progress</th><th>Tanggal aktual</th>
                        <th>QC status</th><th>Catatan</th>{isQc && <th>Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => <LogRow key={log.id} log={log} isQc={isQc} onSaveQc={saveQc} />)}
                    </tbody>
                  </table>
                )}
                {isQc && <p className="muted-note">QC: ubah status &amp; catatan lalu klik Simpan.</p>}
                {!isEngineer && !isQc && <p className="muted-note">Mode lihat (viewer): hanya membaca.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
