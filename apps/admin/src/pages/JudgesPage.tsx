import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal } from "@pageant/ui";
import type { Judge } from "@pageant/types";

const API_BASE = "/api";

export function JudgesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", pin: "" });
  const [showPins, setShowPins] = useState(false);

  const fetchJudges = async () => {
    const res = await fetch(`${API_BASE}/pageants/${id}/judges`, { credentials: "include" });
    const data = await res.json();
    if (data.success) setJudges(data.data);
  };

  useEffect(() => { fetchJudges(); }, [id]);

  const createJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/pageants/${id}/judges`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      setShowCreate(false);
      setForm({ name: "", pin: "" });
      fetchJudges();
    }
  };

  const deleteJudge = async (jId: string) => {
    if (!confirm("Remove this judge? Their scores will also be deleted.")) return;
    await fetch(`${API_BASE}/judges/${jId}`, { method: "DELETE", credentials: "include" });
    fetchJudges();
  };

  const generatePin = () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setForm({ ...form, pin });
  };

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-border-subtle bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-white/40 hover:text-white">← Back</button>
            <h1 className="text-lg font-bold text-white">Judges</h1>
            <span className="text-xs text-white/30">{judges.length} total</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPins(!showPins)} className="bg-surface-elevated hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              {showPins ? "Hide PINs" : "Show PINs"}
            </button>
            <button onClick={() => { generatePin(); setShowCreate(true); }} className="bg-pageant-purple hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              + Add Judge
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 animate-fade-in-up">
        {judges.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-4">⚖️</div>
            <p>No judges yet. Add judges and assign PINs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {judges.map((j, i) => (
              <div key={j.id} className="bg-surface-secondary border border-border-subtle rounded-xl p-4 flex items-center justify-between hover:border-pageant-purple/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-pageant-purple/20 rounded-full flex items-center justify-center text-pageant-purple font-bold text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{j.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/30">PIN:</span>
                      {showPins ? (
                        <span className="text-sm font-mono font-bold text-pageant-gold tracking-wider">{j.pin}</span>
                      ) : (
                        <span className="text-sm text-white/20">••••</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteJudge(j.id)} className="text-white/20 hover:text-red-400 transition-colors p-2">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Print-friendly PIN cards */}
        {judges.length > 0 && showPins && (
          <div className="mt-8 bg-surface-secondary border border-border-subtle rounded-xl p-6">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">PIN Cards (for printing)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {judges.map((j) => (
                <div key={j.id} className="bg-white text-black rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Judge</p>
                  <p className="font-bold text-lg">{j.name}</p>
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] mt-2 text-indigo-600">{j.pin}</p>
                  <p className="text-[10px] text-gray-400 mt-2">Enter this PIN to access scoring</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Judge">
        <form onSubmit={createJudge} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" placeholder="e.g. Judge Alpha" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">PIN *</label>
            <div className="flex gap-2">
              <input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} className="flex-1 bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-pageant-purple" placeholder="1234" required />
              <button type="button" onClick={generatePin} className="bg-surface-elevated hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm transition-colors">
                🎲 Random
              </button>
            </div>
          </div>
          <button type="submit" className="w-full bg-pageant-purple hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all">Add Judge</button>
        </form>
      </Modal>
    </div>
  );
}
