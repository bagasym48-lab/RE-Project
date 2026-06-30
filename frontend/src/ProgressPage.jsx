// ProgressPage.jsx — halaman Progress = Project & Dokumen.
// Kurva-S kini per-project (di dalam ProjectsPage), jadi view work-items lama
// (kurva-S terpisah) sudah dihapus.
import ProjectsPage from './ProjectsPage.jsx';

export default function ProgressPage({ userId, role }) {
  return <ProjectsPage userId={userId} role={role} />;
}
