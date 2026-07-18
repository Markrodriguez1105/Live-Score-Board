import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@pageant/ui";
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
    draft: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
    active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    completed: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
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
          <Button
            id="create-pageant-btn"
            onClick={() => setShowCreate(true)}
            variant="primary"
          >
            + New Pageant
          </Button>
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
            <Button
              onClick={() => setShowCreate(true)}
              variant="primary"
              size="lg"
            >
              Create Pageant
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pageants.map((p) => (
              <Card
                key={p.id}
                onClick={() => navigate(`/pageants/${p.id}`)}
                className="cursor-pointer hover:border-pageant-purple/30 hover:shadow-lg hover:shadow-pageant-purple/5 transition-all group animate-fade-in-up"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="group-hover:text-pageant-gold transition-colors truncate pr-2">
                      {p.name}
                    </CardTitle>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${statusColors[p.status]}`}>
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <CardDescription className="line-clamp-2 mt-1.5">{p.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4 text-xs text-white/30">
                    <span>📅 {p.date}</span>
                    <span>📍 {p.venue}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Pageant">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name *"
            placeholder="e.g. Miss Universe 2026"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="date"
              label="Date *"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <Input
              label="Venue *"
              placeholder="e.g. Arena Hall"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Description</label>
            <textarea
              placeholder="Provide a description..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:border-pageant-purple focus:ring-pageant-purple/20 resize-none transition-all"
            />
          </div>
          <Button type="submit" variant="primary" className="w-full py-3 mt-2">
            Create Pageant
          </Button>
        </form>
      </Modal>
    </div>
  );
}
