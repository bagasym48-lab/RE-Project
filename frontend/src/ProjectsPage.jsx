// ProjectsPage.jsx — Project → 5 dokumen. Alur: engineer "kirim" dokumen,
// QC "ACC"/"revisi", progress project = dokumen ACC / total × 100%.
// Izin per-role ditegakkan di Supabase (RLS + trigger enforce_pdoc_columns).
//
// Tambahan (langkah 8):
//  • Riwayat dokumen: setiap transisi status dicatat di project_document_events
//    (via trigger) → tiap dokumen menampilkan badge "Direvisi N×" + timeline.
//  • Komentar/kendala kurva-S: engineer/leader menulis kendala di project_comments
//    (mis. menunggu disiplin lain / perubahan data vendor) agar leader tahu sebab
//    progress datar. Butuh migrasi SQL bagian 6 di schema.sql.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { SCurve } from './Charts.jsx';

const DEFAULT_DOCS = [
  'Kalkulasi Pondasi Dangkal',
  'Kalkulasi Pipe Support',
  'Dokumen Gambar (DED)',
  'Laporan Perhitungan Struktur',
  'Spesifikasi Teknis',
];

const STATUS_LABEL = { todo: 'Belum dikirim', submitted: 'Menunggu QC', acc: 'ACC', revisi: 'Revisi' };
const KAT_LABEL = {
  umum: 'Umum',
  tunggu_disiplin: 'Menunggu disiplin lain',
  data_vendor: 'Perubahan data vendor',
  kendala_teknis: 'Kendala teknis',
  lainnya: 'Lainnya',
};
const DAY = 86400000;

const nowIso = () => new Date().toISOString();
const fmtDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

function DocRow({ doc, role, designs, profilesMap, events = [], onSubmit, onQc }) {
  const isEngineer = role === 'engineer' || role === 'leader';
  const isQc = role === 'qc';
  const nameOf = (id) => (id ? (profilesMap?.[id] || '—') : null);
  const [open, setOpen] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [designId, setDesignId] = useState('');
  const [qcCatatan, setQcCatatan] = useState(doc.qc_catatan || '');
  const [busy, setBusy] = useState(false);
  const [showHist, setShowHist] = useState(false);

  const canSubmit = isEngineer && (doc.status === 'todo' || doc.status === 'revisi');
  const canQc = isQc && doc.status === 'submitted';
  const revisiCount = events.filter((e) => e.status === 'revisi').length;

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
        <span className="doc-badges">
          {revisiCount > 0 && (
            <span className="doc-rev" title={`Dokumen ini sudah direvisi ${revisiCount} kali`}>↩ {revisiCount}× revisi</span>
          )}
          <span className={`doc-badge st-${doc.status}`}>{STATUS_LABEL[doc.status] || doc.status}</span>
        </span>
      </div>

      {(doc.submitted_by || doc.submit_catatan || doc.qc_by || doc.qc_catatan) && (
        <div className="doc-meta">
          {doc.submitted_by && <p>✍️ Dikirim oleh <b>{nameOf(doc.submitted_by)}</b>{doc.submitted_at ? ` · ${doc.submitted_at.slice(0, 10)}` : ''}</p>}
          {doc.submit_catatan && <p>📄 {doc.submit_catatan}</p>}
          {doc.qc_by && <p>✔️ Diperiksa <b>{nameOf(doc.qc_by)}</b>{doc.qc_at ? ` · ${doc.qc_at.slice(0, 10)}` : ''}</p>}
          {doc.qc_catatan && <p>🔎 Catatan QC: {doc.qc_catatan}</p>}
        </div>
      )}

      {events.length > 0 && (
        <div className="doc-hist">
          <button className="hist-toggle" onClick={() => setShowHist((s) => !s)}>
            {showHist ? '▾' : '▸'} Riwayat dokumen ({events.length})
            {revisiCount > 0 && <span className="hist-revtag"> · {revisiCount}× direvisi</span>}
          </button>
          {showHist && (
            <ul className="hist-list">
              {events.map((e, i) => {
                const revNo = events.slice(0, i + 1).filter((x) => x.status === 'revisi').length;
                const title = e.status === 'acc' ? 'ACC' : e.status === 'revisi' ? `Revisi #${revNo}` : 'Dikirim';
                const ico = e.status === 'acc' ? '✅' : e.status === 'revisi' ? '↩️' : '✍️';
                return (
                  <li key={e.id} className={`hist-item h-${e.status}`}>
                    <span className="hist-ico">{ico}</span>
                    <div className="hist-body">
                      <span className="hist-title"><b>{title}</b> — {nameOf(e.actor) || '—'} <span className="hist-date">· {fmtDateTime(e.created_at)}</span></span>
                      {e.catatan && <p className="hist-note">{e.status === 'revisi' ? 'Alasan revisi: ' : ''}{e.catatan}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
  const isLeader = role === 'leader';
  // Engineer: submit laporan dokumen + catatan kendala saja.
  // Add/hapus project = hak lead (ditegakkan juga oleh RLS di Supabase).
  const isEngineer = role === 'engineer' || isLeader;
  const [projects, setProjects] = useState([]);
  const [selId, setSelId] = useState(null);
  const [docs, setDocs] = useState([]);
  const [events, setEvents] = useState([]);
  const [comments, setComments] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
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

  // Riwayat & komentar: tabel baru (migrasi bagian 6). Error di-swallow supaya
  // halaman tetap jalan bila migrasi belum dijalankan.
  const loadEvents = useCallback(async (pid) => {
    if (!pid) { setEvents([]); return; }
    const { data, error } = await supabase.from('project_document_events')
      .select('*').eq('project_id', pid).order('created_at', { ascending: true });
    setEvents(error ? [] : (data || []));
  }, []);

  const loadComments = useCallback(async (pid) => {
    if (!pid) { setComments([]); return; }
    const { data, error } = await supabase.from('project_comments')
      .select('*').eq('project_id', pid).order('created_at', { ascending: false });
    setComments(error ? [] : (data || []));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ps = await loadProjects();
      if (ps.length) setSelId((c) => c ?? ps[0].id);
      const { data } = await supabase.from('foundation_designs').select('id, nama, overall_ok').eq('created_by', userId).order('created_at', { ascending: false });
      setDesigns(data || []);
      const { data: profs } = await supabase.from('profiles').select('id, nama');
      setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p.nama])));
      setLoading(false);
    })();
  }, [loadProjects, userId]);

  useEffect(() => {
    loadDocs(selId); loadEvents(selId); loadComments(selId);
  }, [selId, loadDocs, loadEvents, loadComments]);

  const sel = projects.find((p) => p.id === selId) || null;
  const total = docs.length;
  const accCount = docs.filter((d) => d.status === 'acc').length;
  const submittedCount = docs.filter((d) => d.status === 'submitted').length;
  const revisiCount = docs.filter((d) => d.status === 'revisi').length;
  const pct = total ? Math.round((accCount / total) * 100) : 0;

  const eventsByDoc = useMemo(() => {
    const m = {};
    for (const e of events) (m[e.document_id] ||= []).push(e);
    return m;
  }, [events]);

  // Sintesis data kurva-S dari tanggal ACC tiap dokumen (kumulatif).
  const projLogs = (() => {
    const step = 100 / (total || 1);
    const accs = docs.filter((d) => d.status === 'acc' && d.qc_at).sort((a, b) => new Date(a.qc_at) - new Date(b.qc_at));
    const out = [];
    if (sel?.created_at) out.push({ tanggal: sel.created_at.slice(0, 10), persen_progress: 0 });
    accs.forEach((d, i) => out.push({ tanggal: d.qc_at.slice(0, 10), persen_progress: Math.round((i + 1) * step) }));
    return out;
  })();

  // "Kurva datar": berapa hari sejak progress terakhir bertambah (ACC terakhir,
  // atau tanggal project dibuat bila belum ada ACC). Untuk memicu prompt kendala.
  const lastMoveMs = (() => {
    const accMs = docs.filter((d) => d.status === 'acc' && d.qc_at).map((d) => +new Date(d.qc_at));
    if (accMs.length) return Math.max(...accMs);
    return sel?.created_at ? +new Date(sel.created_at) : null;
  })();
  const flatDays = lastMoveMs ? Math.floor((Date.now() - lastMoveMs) / DAY) : 0;
  const isFlat = sel && pct < 100 && flatDays >= 3;

  const [pNama, setPNama] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pTarget, setPTarget] = useState('');
  const [docNames, setDocNames] = useState(DEFAULT_DOCS);
  const [creating, setCreating] = useState(false);

  // Form komentar/kendala
  const [cText, setCText] = useState('');
  const [cKat, setCKat] = useState('umum');
  const [cBusy, setCBusy] = useState(false);
  const [cErr, setCErr] = useState(null);

  async function createProject(e) {
    e.preventDefault();
    setErr(null);
    if (!pNama.trim()) return;
    setCreating(true);
    const { data: proj, error } = await supabase.from('projects')
      .insert({ nama: pNama.trim(), deskripsi: pDesc || null, target_date: pTarget || null, created_by: userId }).select().single();
    if (error) { setErr(error.message); setCreating(false); return; }
    const rows = docNames.map((nm, i) => ({ project_id: proj.id, nama: (nm || '').trim() || `Dokumen ${i + 1}`, urutan: i }));
    const { error: e2 } = await supabase.from('project_documents').insert(rows);
    if (e2) { setErr(e2.message); setCreating(false); return; }
    setPNama(''); setPDesc(''); setPTarget(''); setDocNames(DEFAULT_DOCS); setCreating(false);
    await loadProjects();
    setSelId(proj.id);
  }

  async function submitDoc(docId, fields) {
    setErr(null);
    const { error } = await supabase.from('project_documents')
      .update({ status: 'submitted', submitted_by: userId, submitted_at: nowIso(), updated_at: nowIso(), ...fields })
      .eq('id', docId);
    if (error) { setErr(error.message); return; }
    await loadDocs(selId); await loadEvents(selId);
  }

  async function deleteProject(id) {
    if (!window.confirm('Hapus project ini beserta semua dokumennya? Tindakan ini tidak bisa dibatalkan.')) return;
    setErr(null);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    if (selId === id) { setSelId(null); setDocs([]); }
    await loadProjects();
  }

  async function qcDoc(docId, decision, qc_catatan) {
    setErr(null);
    const { error } = await supabase.from('project_documents')
      .update({ status: decision, qc_catatan, qc_by: userId, qc_at: nowIso(), updated_at: nowIso() })
      .eq('id', docId);
    if (error) { setErr(error.message); return; }
    await loadDocs(selId); await loadEvents(selId);
  }

  async function addComment(e) {
    e.preventDefault();
    if (!cText.trim() || !selId) return;
    setCBusy(true); setCErr(null);
    const { error } = await supabase.from('project_comments')
      .insert({ project_id: selId, catatan: cText.trim(), kategori: cKat, created_by: userId });
    setCBusy(false);
    if (error) { setCErr(error.message); return; }
    setCText(''); setCKat('umum');
    await loadComments(selId);
  }

  async function deleteComment(id) {
    const { error } = await supabase.from('project_comments').delete().eq('id', id);
    if (!error) await loadComments(selId);
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
                  <div key={p.id} className="wi-row">
                    <button className={`wi-item ${p.id === selId ? 'active' : ''}`} onClick={() => setSelId(p.id)}>
                      <span className="nm">{p.nama}</span>
                      <span className="meta">{p.deskripsi || '—'}</span>
                    </button>
                    {isLeader && <button className="wi-del" title="Hapus project" onClick={() => deleteProject(p.id)}>🗑</button>}
                  </div>
                ))}

            {isLeader ? (
              <>
                <h3>Buat project baru</h3>
                <form className="form-col" onSubmit={createProject}>
                  <label>Judul project<input value={pNama} onChange={(e) => setPNama(e.target.value)} required /></label>
                  <label>Deskripsi<textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={2} /></label>
                  <label>Tanggal target (deadline)<input type="date" value={pTarget} onChange={(e) => setPTarget(e.target.value)} /></label>
                  <p className="muted-note">5 dokumen (boleh diubah namanya):</p>
                  {docNames.map((nm, i) => (
                    <input key={i} value={nm} onChange={(e) => setDocName(i, e.target.value)} placeholder={`Dokumen ${i + 1}`} />
                  ))}
                  <button className="btn" type="submit" disabled={creating}>{creating ? 'Menyimpan…' : 'Buat project + 5 dokumen'}</button>
                </form>
              </>
            ) : (
              <p className="muted-note">
                Hanya <b>lead</b> yang dapat membuat/menghapus project. Engineer: update progress
                (submit laporan dokumen) &amp; tulis catatan kendala pada project yang ada.
              </p>
            )}
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
                  {revisiCount > 0 && <> · <span className="stat-revisi">{revisiCount} revisi</span></>}
                  {sel.target_date && <> · target: <b>{sel.target_date}</b></>}
                </p>
              </div>

              <div className="panel">
                <h2>Kurva-S (rencana vs aktual)</h2>
                <SCurve logs={projLogs} startDate={sel.created_at ? sel.created_at.slice(0, 10) : null} targetDate={sel.target_date} />
                {!sel.target_date && <p className="muted-note">Tetapkan tanggal target saat membuat project agar garis rencana muncul.</p>}
              </div>

              <div className="panel">
                <h2>Catatan kendala &amp; progress</h2>
                <p className="muted-note">
                  Bila kurva-S datar, engineer menuliskan kendalanya di sini (mis. menunggu disiplin lain,
                  perubahan data vendor). Leader &amp; tim bisa melihat alasannya.
                </p>

                {isFlat && (
                  <p className="flat-warn">
                    ⏳ Progress belum bertambah <b>{flatDays} hari</b> (target {pct}% tercapai).
                    {isEngineer ? ' Mohon jelaskan kendalanya di bawah.' : ' Menunggu penjelasan kendala dari engineer.'}
                  </p>
                )}

                {isEngineer && (
                  <form className="cmt-form" onSubmit={addComment}>
                    <select value={cKat} onChange={(e) => setCKat(e.target.value)}>
                      {Object.entries(KAT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <textarea rows={2} value={cText} onChange={(e) => setCText(e.target.value)}
                      placeholder="Tulis kendala / update progress… (mis. menunggu data vendor pompa)" />
                    <div className="doc-actions">
                      <button className="btn" type="submit" disabled={cBusy || !cText.trim()}>{cBusy ? '…' : 'Tambah catatan'}</button>
                    </div>
                  </form>
                )}
                {cErr && <p className="err">Gagal menyimpan catatan: {cErr} — pastikan migrasi SQL bagian 6 sudah dijalankan di Supabase.</p>}

                <div className="cmt-list">
                  {comments.length === 0 ? <p className="role-hint">Belum ada catatan kendala.</p>
                    : comments.map((c) => (
                      <div key={c.id} className="cmt-item">
                        <div className="cmt-top">
                          <span className={`cmt-kat k-${c.kategori}`}>{KAT_LABEL[c.kategori] || 'Umum'}</span>
                          <b className="cmt-author">{profilesMap[c.created_by] || '—'}</b>
                          <span className="cmt-date">{fmtDateTime(c.created_at)}</span>
                          {c.created_by === userId && <button className="cmt-del" title="Hapus catatan" onClick={() => deleteComment(c.id)}>✕</button>}
                        </div>
                        <p className="cmt-text">{c.catatan}</p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="panel">
                <h2>Dokumen ({total})</h2>
                {docs.length === 0 ? <p className="role-hint">Belum ada dokumen.</p>
                  : docs.map((d) => <DocRow key={d.id} doc={d} role={role} designs={designs} profilesMap={profilesMap} events={eventsByDoc[d.id] || []} onSubmit={submitDoc} onQc={qcDoc} />)}
                {role !== 'engineer' && role !== 'qc' && role !== 'leader' && <p className="muted-note">Mode lihat (viewer): hanya membaca.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
