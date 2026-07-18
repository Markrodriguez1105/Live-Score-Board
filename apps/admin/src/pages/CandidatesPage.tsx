import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal } from "@pageant/ui";
import type { Candidate } from "@pageant/types";

const API_BASE = "/api";

export function CandidatesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", candidateNumber: 1 });

  const fetchCandidates = async () => {
    const res = await fetch(`${API_BASE}/pageants/${id}/candidates`, { credentials: "include" });
    const data = await res.json();
    if (data.success) setCandidates(data.data);
  };

  useEffect(() => { fetchCandidates(); }, [id]);

  const createCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/pageants/${id}/candidates`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(form),
    });
    setShowCreate(false);
    setForm({ name: "", candidateNumber: candidates.length + 2 });
    fetchCandidates();
  };

  const deleteCandidate = async (cId: string) => {
    if (!confirm("Delete this candidate?")) return;
    await fetch(`${API_BASE}/candidates/${cId}`, { method: "DELETE", credentials: "include" });
    fetchCandidates();
  };

  const uploadPhoto = async (cId: string, file: File) => {
    const fd = new FormData();
    fd.append("photo", file);
    await fetch(`${API_BASE}/candidates/${cId}/photo`, { method: "POST", credentials: "include", body: fd });
    fetchCandidates();
  };

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=256&bold=true`;

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-border-subtle bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-white/40 hover:text-white">← Back</button>
            <h1 className="text-lg font-bold text-white">Candidates</h1>
            <span className="text-xs text-white/30">{candidates.length} total</span>
          </div>
          <button onClick={() => { setForm({ name: "", candidateNumber: candidates.length + 1 }); setShowCreate(true); }} className="bg-pageant-purple hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            + Add Candidate
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 animate-fade-in-up">
        {candidates.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-4">👥</div>
            <p>No candidates yet. Add your first candidate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <div key={c.id} className="bg-surface-secondary border border-border-subtle rounded-2xl p-4 group hover:border-pageant-purple/30 transition-all">
                {/* Photo */}
                <div className="relative mb-3">
                  <img src={c.photoUrl || getFallback(c.name)} alt={c.name} className="w-full aspect-square object-cover rounded-xl bg-surface-elevated" />
                  <label className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-white text-sm font-bold bg-pageant-purple px-3 py-1.5 rounded-lg">Upload Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(c.id, e.target.files[0])} className="hidden" />
                  </label>
                  <div className="absolute top-2 left-2 w-8 h-8 bg-pageant-purple rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg">
                    {c.candidateNumber}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{c.name}</h3>
                    <p className="text-xs text-white/30">Candidate #{c.candidateNumber}</p>
                  </div>
                  <button onClick={() => deleteCandidate(c.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Candidate">
        <form onSubmit={createCandidate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Candidate Number *</label>
            <input type="number" min={1} value={form.candidateNumber} onChange={(e) => setForm({ ...form, candidateNumber: Number(e.target.value) })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
          </div>
          <button type="submit" className="w-full bg-pageant-purple hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all">Add Candidate</button>
        </form>
      </Modal>
    </div>
  );
}
