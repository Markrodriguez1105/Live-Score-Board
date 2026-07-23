import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Scale, Plus, Dices, Eye, EyeOff, Edit2, Trash2, AlertTriangle } from "lucide-react";
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
  const [deleteJudgeTarget, setDeleteJudgeTarget] = useState<Judge | null>(null);
  const [deletingJudge, setDeletingJudge] = useState(false);
  const [form, setForm] = useState({ name: "", pin: "", judgeNumber: "" });
  const [showPins, setShowPins] = useState(false);

  const fetchJudges = async () => {
    const res = await fetch(`${API_BASE}/pageants/${id}/judges`, { credentials: "include" });
    const data = await res.json();
    if (data.success) setJudges(data.data);
  };

  useEffect(() => { fetchJudges(); }, [id]);

  const createJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      pin: form.pin,
      judgeNumber: form.judgeNumber ? parseInt(form.judgeNumber) : undefined,
    };
    const res = await fetch(`${API_BASE}/pageants/${id}/judges`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      setShowCreate(false);
      setForm({ name: "", pin: "", judgeNumber: "" });
      fetchJudges();
    } else {
      alert(data.error || "Failed to create judge");
    }
  };

  const updateJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJudgeData) return;
    const payload = {
      name: editJudgeData.name,
      pin: editJudgeData.pin,
      judgeNumber: editJudgeData.judgeNumber ? Number(editJudgeData.judgeNumber) : undefined,
    };
    const res = await fetch(`${API_BASE}/judges/${editJudgeData.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      setEditJudgeData(null);
      fetchJudges();
    } else {
      alert(data.error || "Failed to update judge");
    }
  };

  const handleDeleteJudge = async () => {
    if (!deleteJudgeTarget) return;
    setDeletingJudge(true);
    try {
      await fetch(`${API_BASE}/judges/${deleteJudgeTarget.id}`, { method: "DELETE", credentials: "include" });
      setDeleteJudgeTarget(null);
      fetchJudges();
    } catch {
      /* ignore */
    } finally {
      setDeletingJudge(false);
    }
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-lg font-bold text-foreground">Judges</h1>
            <span className="text-xs text-muted-foreground">{judges.length} total</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowPins(!showPins)} variant="secondary">
              {showPins ? (
                <>
                  <EyeOff className="w-4 h-4 mr-1.5 inline" /> Hide PINs
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1.5 inline" /> Show PINs
                </>
              )}
            </Button>
            <Button onClick={() => { generatePin(); setShowCreate(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Judge
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {judges.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Scale className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p>No judges yet. Add judges and assign PINs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {judges.map((j, i) => (
              <Card key={j.id} className="p-4 flex flex-col justify-between hover:border-primary/30 transition-all rounded-xl">
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                    {j.judgeNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground text-sm truncate">{j.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">PIN:</span>
                      {showPins ? (
                        <span className="text-xs font-mono font-bold tracking-wider text-primary">{j.pin}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 tracking-widest">••••</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end border-t border-border pt-3 mt-1">
                  <Button variant="outline" size="sm" onClick={() => setEditJudgeData(j)} className="text-xs py-1 px-2.5">
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteJudgeTarget(j)} className="text-xs py-1 px-2.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* PIN cards */}
        {judges.length > 0 && showPins && (
          <div className="mt-8 bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">PIN Cards (for printing)</h3>
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
            <div className="space-y-1.5 w-full">
              <Label htmlFor="judge-number">Judge Number (optional)</Label>
              <Input
                id="judge-number"
                type="number"
                placeholder="e.g. 1"
                value={form.judgeNumber}
                onChange={(e) => setForm({ ...form, judgeNumber: e.target.value })}
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
                <Button type="button" variant="secondary" onClick={generatePin} className="shrink-0 flex items-center">
                  <Dices className="w-4 h-4 mr-1.5 inline" /> Random
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
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-judge-number">Judge Number *</Label>
                <Input
                  id="edit-judge-number"
                  type="number"
                  placeholder="e.g. 1"
                  value={editJudgeData.judgeNumber || ""}
                  onChange={(e) => setEditJudgeData({ ...editJudgeData, judgeNumber: parseInt(e.target.value) || 0 })}
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
                  <Button type="button" variant="secondary" onClick={generatePinForEdit} className="shrink-0 flex items-center">
                    <Dices className="w-4 h-4 mr-1.5 inline" /> Random
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
      {/* Delete Judge Confirmation Dialog */}
      <Dialog open={!!deleteJudgeTarget} onOpenChange={(open) => { if (!open) setDeleteJudgeTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Remove Judge</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
          </DialogHeader>

          {deleteJudgeTarget && (
            <div className="py-2">
              <p className="text-sm text-foreground">
                Are you sure you want to remove <span className="font-bold">{deleteJudgeTarget.name}</span>? Their submitted scores will also be permanently deleted.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteJudgeTarget(null)}
              disabled={deletingJudge}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingJudge}
              onClick={handleDeleteJudge}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {deletingJudge ? "Removing..." : "Remove Judge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
