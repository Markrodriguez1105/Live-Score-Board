import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Layers, Plus, AlertTriangle, Trash2, Eye, EyeOff } from "lucide-react";
import type { SegmentWithCategories, CreateSegment, Segment } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Card } from "@pageant/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";

const API_BASE = "/api";

export function SegmentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [segments, setSegments] = useState<SegmentWithCategories[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editSegmentData, setEditSegmentData] = useState<Segment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<CreateSegment>({ name: "", order: 0, isSimultaneous: false });

  const fetchSegments = async () => {
    const res = await fetch(`${API_BASE}/pageants/${id}/segments`, { credentials: "include" });
    const data = await res.json();
    if (data.success) setSegments(data.data);
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/pageants/admin/session`, { credentials: "include" });
        const d = await res.json();
        if (!d.success || !d.data?.isAdmin) {
          navigate("/");
          return;
        }
        fetchSegments();
      } catch {
        navigate("/");
      }
    };
    checkSession();
  }, [id, navigate]);

  const toggleHideSegment = async (seg: Segment) => {
    const newHideState = !(seg.isHidden || seg.isLocked);
    await fetch(`${API_BASE}/segments/${seg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isHidden: newHideState, isLocked: newHideState }),
    });
    fetchSegments();
  };

  const createSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/pageants/${id}/segments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ ...form, order: segments.length + 1 }),
    });
    setShowCreateModal(false);
    setForm({ name: "", order: 0, isSimultaneous: false });
    fetchSegments();
  };

  const updateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSegmentData) return;
    await fetch(`${API_BASE}/segments/${editSegmentData.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: editSegmentData.name, isSimultaneous: !!editSegmentData.isSimultaneous }),
    });
    setEditSegmentData(null);
    fetchSegments();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/segments/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      setDeleteTarget(null);
      fetchSegments();
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Segments
            </h1>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Segment
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {segments.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p>No segments yet. Add your first competition segment.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">e.g. "Preliminary Round", "Semifinal", "Final Round"</p>
          </div>
        ) : (
          segments.map((seg) => {
            const totalWeight = seg.categories.reduce((sum, c) => sum + c.weight, 0);
            const totalCandidates = new Set(seg.categories.flatMap(c => c.candidates.map(ca => ca.id))).size;
            const isHidden = seg.isHidden || seg.isLocked;

            return (
              <Card key={seg.id} className="overflow-hidden">
                {/* Segment Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-border bg-card/50">
                  <div>
                    <h3 className="font-bold text-foreground text-base flex items-center gap-2 flex-wrap">
                      <Layers className="w-4 h-4 text-primary" />
                      {seg.name}
                      {seg.isSimultaneous && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ⚡ SIMULTANEOUS SCORING
                        </span>
                      )}
                      {isHidden && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> HIDDEN
                        </span>
                      )}
                    </h3>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{seg.categories.length} {seg.categories.length === 1 ? "category" : "categories"}</span>
                      <span>·</span>
                      <span>{totalCandidates} {totalCandidates === 1 ? "candidate" : "candidates"}</span>
                      <span>·</span>
                      <span className={totalWeight === 100 ? "text-emerald-400" : "text-amber-400"}>
                        Total weight: {totalWeight}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isHidden ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleHideSegment(seg)}
                      className={isHidden ? "text-amber-400 border-amber-500/30" : ""}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                      {isHidden ? "Unhide" : "Hide"}
                    </Button>
                    <Link to={`/pageants/${id}/segments/${seg.id}/categories`}>
                      <Button variant="outline" size="sm">
                        Manage Categories
                      </Button>
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => setEditSegmentData(seg)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(seg)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Categories Preview */}
                <div className="divide-y divide-border">
                  {seg.categories.length === 0 ? (
                    <div className="px-5 py-6 text-center text-muted-foreground/50 text-sm">
                      No categories yet — click "Manage Categories" to add some
                    </div>
                  ) : (
                    seg.categories.map((cat) => (
                      <div key={cat.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div>
                          <span className="text-sm font-medium text-foreground">{cat.name}</span>
                          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>Weight: {cat.weight}%</span>
                            <span>{cat.criteria.length} criteria</span>
                            <span>{cat.candidates.length} candidates</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })
        )}
      </main>

      {/* Create Segment Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Segment</DialogTitle>
          </DialogHeader>
          <form onSubmit={createSegment} className="space-y-4">
            <div className="space-y-1.5 w-full">
              <Label htmlFor="seg-name">Name *</Label>
              <Input
                id="seg-name"
                placeholder="e.g. Preliminary Round"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="seg-simultaneous"
                checked={!!form.isSimultaneous}
                onChange={(e) => setForm({ ...form, isSimultaneous: e.target.checked })}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <Label htmlFor="seg-simultaneous" className="text-xs cursor-pointer font-medium">
                ⚡ Simultaneous Category Scoring (Judges score all categories in this segment at the same time)
              </Label>
            </div>
            <Button type="submit" className="w-full py-3">Add Segment</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Segment Dialog */}
      <Dialog open={!!editSegmentData} onOpenChange={(open) => { if (!open) setEditSegmentData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Segment</DialogTitle>
          </DialogHeader>
          {editSegmentData && (
            <form onSubmit={updateSegment} className="space-y-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-seg-name">Name *</Label>
                <Input
                  id="edit-seg-name"
                  value={editSegmentData.name}
                  onChange={(e) => setEditSegmentData({ ...editSegmentData, name: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-seg-simultaneous"
                  checked={!!editSegmentData.isSimultaneous}
                  onChange={(e) => setEditSegmentData({ ...editSegmentData, isSimultaneous: e.target.checked })}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <Label htmlFor="edit-seg-simultaneous" className="text-xs cursor-pointer font-medium">
                  ⚡ Simultaneous Category Scoring (Judges score all categories in this segment at the same time)
                </Label>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditSegmentData(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Delete Segment</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
          </DialogHeader>

          {deleteTarget && (
            <div className="py-2">
              <p className="text-sm text-foreground">
                Are you sure you want to delete <span className="font-bold">{deleteTarget.name}</span>? All categories, criteria, and associated scores within this segment will be permanently removed.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "Delete Segment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
