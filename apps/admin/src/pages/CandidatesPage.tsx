import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Plus, Trash2 } from "lucide-react";
import type { Candidate } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Card } from "@pageant/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";

const API_BASE = "/api";

export function CandidatesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editCandidateData, setEditCandidateData] = useState<Candidate | null>(null);
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

  const updateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCandidateData) return;
    await fetch(`${API_BASE}/candidates/${editCandidateData.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: editCandidateData.name, candidateNumber: editCandidateData.candidateNumber }),
    });
    setEditCandidateData(null);
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-lg font-bold text-foreground">Candidates</h1>
            <span className="text-xs text-muted-foreground">{candidates.length} total</span>
          </div>
          <Button onClick={() => { setForm({ name: "", candidateNumber: candidates.length + 1 }); setShowCreate(true); }} >
            <Plus className="w-4 h-4 mr-1.5" /> Add Candidate
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {candidates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p>No candidates yet. Add your first candidate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <Card key={c.id} className="p-4 group hover:border-primary/30 transition-all flex flex-col justify-between">
                {/* Photo */}
                <div className="relative mb-3">
                  <img src={c.photoUrl || getFallback(c.name)} alt={c.name} className="w-full aspect-square object-cover rounded-xl bg-secondary" />
                  <label className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-primary-foreground text-xs font-bold bg-primary px-3 py-1.5 rounded-lg shadow-lg">Upload Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(c.id, e.target.files[0])} className="hidden" />
                  </label>
                  <div className="absolute top-2 left-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground shadow-lg">
                    {c.candidateNumber}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-foreground text-sm truncate max-w-37.5">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">Candidate #{c.candidateNumber}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setEditCandidateData(c)} className="text-xs py-1 px-2.5">
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteCandidate(c.id)} className="text-xs py-1 px-2.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add Candidate Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
          </DialogHeader>
          <form onSubmit={createCandidate} className="space-y-4">
            <div className="space-y-1.5 w-full">
              <Label htmlFor="candidate-name">Name *</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Candidate Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5 w-full">
              <Label htmlFor="candidate-number">Candidate Number *</Label>
              <Input
                id="candidate-number"
                type="number"
                min={1}
                value={form.candidateNumber}
                onChange={(e) => setForm({ ...form, candidateNumber: Number(e.target.value) })}
                required
              />
            </div>
            <Button type="submit" className="w-full py-3">Add Candidate</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Dialog */}
      <Dialog open={!!editCandidateData} onOpenChange={(open) => { if (!open) setEditCandidateData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
          </DialogHeader>
          {editCandidateData && (
            <form onSubmit={updateCandidate} className="space-y-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-candidate-name">Name *</Label>
                <Input
                  id="edit-candidate-name"
                  value={editCandidateData.name}
                  onChange={(e) => setEditCandidateData({ ...editCandidateData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-candidate-number">Candidate Number *</Label>
                <Input
                  id="edit-candidate-number"
                  type="number"
                  min={1}
                  value={editCandidateData.candidateNumber}
                  onChange={(e) => setEditCandidateData({ ...editCandidateData, candidateNumber: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditCandidateData(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
