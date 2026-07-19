import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Judge } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Card } from "@pageant/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";

const API_BASE = "/api";

export function JudgesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editJudgeData, setEditJudgeData] = useState<Judge | null>(null);
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
    } else {
      alert(data.error || "Failed to create judge");
    }
  };

  const updateJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJudgeData) return;
    const res = await fetch(`${API_BASE}/judges/${editJudgeData.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: editJudgeData.name, pin: editJudgeData.pin }),
    });
    const data = await res.json();
    if (data.success) {
      setEditJudgeData(null);
      fetchJudges();
    } else {
      alert(data.error || "Failed to update judge");
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

  const generatePinForEdit = () => {
    if (!editJudgeData) return;
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setEditJudgeData({ ...editJudgeData, pin });
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
            <Button onClick={() => setShowPins(!showPins)} variant="secondary">
              {showPins ? "Hide PINs" : "Show PINs"}
            </Button>
            <Button onClick={() => { generatePin(); setShowCreate(true); }}>
              + Add Judge
            </Button>
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
              <Card key={j.id} className="p-4 flex items-center justify-between hover:border-pageant-purple/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-pageant-purple/10 text-pageant-purple rounded-full flex items-center justify-center font-bold text-sm">
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
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditJudgeData(j)}>
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteJudge(j.id)} className="px-3">
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* PIN cards */}
        {judges.length > 0 && showPins && (
          <div className="mt-8 bg-surface-secondary border border-border-subtle rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">PIN Cards (for printing)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {judges.map((j) => (
                <div key={j.id} className="bg-white text-black rounded-xl p-5 text-center shadow-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">Scoring Portal PIN</p>
                  <p className="font-extrabold text-base mt-0.5 text-gray-800">{j.name}</p>
                  <p className="text-3xl font-mono font-black tracking-[0.25em] mt-3 text-indigo-600 bg-indigo-50/50 py-1.5 rounded-lg border border-indigo-100">{j.pin}</p>
                  <p className="text-[9px] text-gray-400 mt-3 font-medium">Use this passcode to sign in</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add Judge Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Judge</DialogTitle>
          </DialogHeader>
          <form onSubmit={createJudge} className="space-y-4">
            <div className="space-y-1.5 w-full">
              <Label htmlFor="judge-name">Name *</Label>
              <Input
                id="judge-name"
                placeholder="e.g. Judge Alpha"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="judge-pin">PIN *</Label>
              <div className="flex gap-2">
                <Input
                  id="judge-pin"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  className="font-mono tracking-wider"
                  placeholder="1234"
                  required
                />
                <Button type="button" variant="secondary" onClick={generatePin} className="shrink-0">
                  🎲 Random
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full py-3">Add Judge</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Judge Dialog */}
      <Dialog open={!!editJudgeData} onOpenChange={(open) => { if (!open) setEditJudgeData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Judge</DialogTitle>
          </DialogHeader>
          {editJudgeData && (
            <form onSubmit={updateJudge} className="space-y-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-judge-name">Name *</Label>
                <Input
                  id="edit-judge-name"
                  value={editJudgeData.name}
                  onChange={(e) => setEditJudgeData({ ...editJudgeData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-judge-pin">PIN *</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-judge-pin"
                    value={editJudgeData.pin}
                    onChange={(e) => setEditJudgeData({ ...editJudgeData, pin: e.target.value })}
                    className="font-mono tracking-wider"
                    required
                  />
                  <Button type="button" variant="secondary" onClick={generatePinForEdit} className="shrink-0">
                    🎲 Random
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditJudgeData(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
