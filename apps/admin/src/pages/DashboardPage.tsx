import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@pageant/ui";
import type { Pageant } from "@pageant/types";

const API_BASE = "/api";

export function DashboardPage() {
  const navigate = useNavigate();
  const [pageants, setPageants] = useState<Pageant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", venue: "", logoUrl: "/uploads/logo-default.png", description: "" });

  const fetchPageants = async () => {
    try {
      const res = await fetch(`${API_BASE}/pageants`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setPageants(data.data);
      else if (res.status === 401) navigate("/");
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchPageants(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/pageants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setForm({ name: "", date: "", venue: "", logoUrl: "/uploads/logo-default.png", description: "" });
        fetchPageants();
      }
    } catch { /* ignore */ }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    active: "bg-green-500/20 text-green-400",
    completed: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      {/* Header */}
      <header className="border-b border-border-subtle bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <h1 className="text-xl font-bold text-white">Pageant Admin</h1>
          </div>
          <button
            id="create-pageant-btn"
            onClick={() => setShowCreate(true)}
            className="bg-pageant-purple hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-pageant-purple/20 active:scale-95"
          >
            + New Pageant
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-[3px] border-pageant-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pageants.length === 0 ? (
          <div className="text-center py-20 animate-fade-in-up">
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-xl font-bold text-white mb-2">No Pageants Yet</h2>
            <p className="text-white/40 mb-6">Create your first pageant to get started</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-pageant-purple hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              Create Pageant
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pageants.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/pageants/${p.id}`)}
                className="bg-surface-secondary border border-border-subtle rounded-2xl p-5 cursor-pointer hover:border-pageant-purple/30 hover:shadow-lg hover:shadow-pageant-purple/5 transition-all group animate-fade-in-up"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-white group-hover:text-pageant-gold transition-colors truncate pr-2">
                    {p.name}
                  </h3>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${statusColors[p.status]}`}>
                    {p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="text-sm text-white/40 mb-3 line-clamp-2">{p.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-white/30">
                  <span>📅 {p.date}</span>
                  <span>📍 {p.venue}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Pageant">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Venue *</label>
              <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple resize-none" />
          </div>
          <button type="submit" className="w-full bg-pageant-purple hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all mt-2">
            Create Pageant
          </button>
        </form>
      </Modal>
    </div>
  );
}
