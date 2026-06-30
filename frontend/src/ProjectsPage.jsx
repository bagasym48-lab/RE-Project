// ProjectsPage.jsx — Project → 5 dokumen. Alur: engineer "kirim" dokumen,
// QC "ACC"/"revisi", progress project = dokumen ACC / total × 100%.
// Izin per-role ditegakkan di Supabase (RLS + trigger enforce_pdoc_columns).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const DEFAULT_DOCS = [
  'Kalkulasi Pondasi Dangkal',
  'Kalkulasi Pipe Support',
  'Dokumen Gambar (DED)',
  'Laporan Perhitungan Struktur',
  'Spesifikasi Teknis',
];

const STATUS_LABEL = { todo: 'Belum dikirim', submitted: 'Menunggu QC', acc: 'ACC', revisi: 'Revisi' };

const nowIso = () => new Date().toISOString();

function DocRow({ doc, role, designs, onSubmit, onQc }) {
  const isEngineer = role === 'engineer';
  const isQc = role === 'qc';
  const [open, setOpen] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [designId, setDesignId] = useState('');
  const [qcCatatan, setQcCatatan] = useState(doc.qc_catatan || '');
  const [busy, setBusy] = useState(false);

  const canSubmit = isEngineer && (doc.status === 'todo' || doc.status === 'revisi');
  const canQc = isQc && doc.status === 'submitted';

  async function doSubmit() {
    setBusy(true);
    await onSubmit(doc.id, { submit_catatan: catatan || null, design_id: designId || null });
    setBusy(false); setOpen(false); setCatatan(''); setDesignId('');
  }
  async function doQc(decision) {
    setBusy(true);
    await onQc(doc.id, decision, qcCatatan || null);
    setBusy(false);
  }

  return (
    <div className={`doc-row st-${doc.status}`}>
      <div className="doc-head">
        <span className="doc-nama">{doc.nama}</span>
        <span className={`doc-badge st-${doc.status}`}>{STATUS_LABEL[doc.status] || doc.status}</span>
      </div>

      {(doc.submit_catatan || doc.qc_catatan) && (
        <div className="doc-meta">
          {doc.submit_catatan && <p>📄 {doc.submit_catatan}</p>}
          {doc.qc_catatan && <p>🔎 QC: {doc.qc_catatan}</p>}
        </div>
      )}

      {canSubmit && (open ? (
        <div className="doc-form">
          <input placeholder="Catatan / link dokumen" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          {designs.length > 0 && (
            <select value={designId} onChange={(e) => setDesignId(e.target.value)}>
              <option value="">— tautkan desain tersimpan (opsional) —</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>{d.nama}{d.overall_ok == null ? '' : d.overall_ok ? ' ✓' : ' ✗'}</option>
              ))}
            </select>
          )}
          <div className="doc-actions">
            <button className="btn" onClick={doSubmit} disabled={busy}>{busy ? '…' : 'Kirim'}</button>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
          </div>
        </div>
      ) : (
        <button className="btn-sm" onClick={() => setOpen(true)}>{doc.status === 'revisi' ? 'Kirim ulang' : 'Kirim dokumen'}</button>
      ))}

      {canQc && (
        <div className="doc-form">
          <input placeholder="Catatan QC (wajib bila revisi)" value={qcCatatan} onChange={(e) => setQcCatatan(e.target.value)} />
          <div className="doc-actions">
            <button className="btn ok" onClick={() => doQc('acc')} disabled={busy}>ACC</button>
            <button className="btn ng" onClick={() => doQc('revisi')} disabled={busy || !qcCatatan.trim()}>Revisi</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage({ userId, role }) {
  const isEngineer = role === 'engineer';
  const [projects, setProjects] = useState([]);
  const [selId, setSelId] = useState(null);
  const [docs, setDocs] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) { setErr(error.message); return []; }
    setErr(null);
    setProjects(data || []);
    return data || [];
  }, []);

  const loadDocs = useCallback(async (pid) => {
    if (!pid) { setDocs([]); return; }
    const { data, error } = await supabase.from('project_documents').select('*').eq('project_id', pid).order('urutan');
    if (error) { setErr(error.message); return; }
    setDocs(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ps = await loadProjects();
      if (ps.length) setSelId((c) => c ?? ps[0].id);
      const { data } = await supabase.from('foundation_designs').select('id, nama, overall_ok').eq('created_by', userId).order('created_at', { ascending: false });
      setDesigns(data || []);
      setLoading(false);
    })();
  }, [loadProjects, userId]);

  useEffect(() => { loadDocs(selId); }, [selId, loadDocs]);

  const sel = projects.find((p) => p.id === selId) || null;
  const total = docs.length;
  const accCount = docs.filter((d) => d.status === 'acc').length;
  const submittedCount = docs.filter((d) => d.status === 'submitted').length;
  const pct = total ? Math.round((accCount / total) * 100) : 0;

  const [pNama, setPNama] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [docNames, setDocNames] = useState(DEFAULT_DOCS);
  const [creating, setCreating] = useState(false);

  async function createProject(e) {
    e.preventDefault();
    setErr(null);
    if (!pNama.trim()) return;
    setCreating(true);
    const { data: proj, error } = await supabase.from('projects')
      .insert({ nama: pNama.trim(), deskripsi: pDesc || null, created_by: userId }).select().single();
    if (error) { setErr(error.message); setCreating(false); return; }
    const rows = docNames.map((nm, i) => ({ project_id: proj.id, nama: (nm || '').trim() || `Dokumen ${i + 1}`, urutan: i }));
    const { error: e2 } = await supabase.from('project_documents').insert(rows);
    if (e2) { setErr(e2.message); setCreating(false); return; }
    setPNama(''); setPDesc(''); setDocNames(DEFAULT_DOCS); setCreating(false);
    await loadProjects();
    setSelId(proj.id);
  }

  async function submitDoc(docId, fields) {
    setErr(null);
    const { error } = await supabase.from('project_documents')
      .update({ status: 'submitted', submitted_by: userId, submitted_at: nowIso(), updated_at: nowIso(), ...fields })
      .eq('id', docId);
    if (error) { setErr(error.message); return; }
    await loadDocs(selId);
  }

  async function qcDoc(docId, decision, qc_catatan) {
    setErr(null);
    const { error } = await supabase.from('project_documents')
      .update({ status: decision, qc_catatan, qc_by: userId, qc_at: nowIso(), updated_at: nowIso() })
      .eq('id', docId);
    if (error) { setErr(error.message); return; }
    await loadDocs(selId);
  }

  const setDocName = (i, v) => setDocNames((arr) => arr.map((x, idx) => (idx === i ? v : x)));

  return (
    <div className="projects">
      <header className="head">
        <h1>Project &amp; Dokumen</h1>
        <p className="sub">Tiap project punya 5 dokumen · engineer kirim → QC ACC → progress otomatis</p>
      </header>

      {err && <p className="err">Error: {err}</p>}

      <div className="prog-grid">
        <div>
          <div className="panel">
            <h2>Daftar project</h2>
            {loading ? <p className="role-hint">Memuat…</p>
              : projects.length === 0 ? <p className="role-hint">Belum ada project.</p>
                : projects.map((p) => (
                  <button key={p.id} className={`wi-item ${p.id === selId ? 'active' : ''}`} onClick={() => setSelId(p.id)}>
                    <span className="nm">{p.nama}</span>
                    <span className="meta">{p.deskripsi || '—'}</span>
                  </button>
                ))}

            {isEngineer ? (
              <>
                <h3>Buat project baru</h3>
                <form className="form-col" onSubmit={createProject}>
                  <label>Judul project<input value={pNama} onChange={(e) => setPNama(e.target.value)} required /></label>
                  <label>Deskripsi<textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={2} /></label>
                  <p className="muted-note">5 dokumen (boleh diubah namanya):</p>
                  {docNames.map((nm, i) => (
                    <input key={i} value={nm} onChange={(e) => setDocName(i, e.target.value)} placeholder={`Dokumen ${i + 1}`} />
                  ))}
                  <button className="btn" type="submit" disabled={creating}>{creating ? 'Menyimpan…' : 'Buat project + 5 dokumen'}</button>
                </form>
              </>
            ) : <p className="muted-note">Hanya engineer yang bisa membuat project.</p>}
          </div>
        </div>

        <div>
          {!sel ? (
            <div className="panel"><p className="role-hint">Pilih atau buat project untuk melihat dokumen.</p></div>
          ) : (
            <>
              <div className="panel">
                <h2>{sel.nama}</h2>
                {sel.deskripsi && <p className="muted-note">{sel.deskripsi}</p>}
                <div className="prog-bar"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
                <p className="prog-stat">
                  Progress: <b>{pct}%</b> · {accCount}/{total} dokumen ACC
                  {submittedCount > 0 && <> · {submittedCount} menunggu QC</>}
                </p>
              </div>

              <div className="panel">
                <h2>Dokumen ({total})</h2>
                {docs.length === 0 ? <p className="role-hint">Belum ada dokumen.</p>
                  : docs.map((d) => <DocRow key={d.id} doc={d} role={role} designs={designs} onSubmit={submitDoc} onQc={qcDoc} />)}
                {role !== 'engineer' && role !== 'qc' && <p className="muted-note">Mode lihat (viewer): hanya membaca.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
