import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Layers, Users, Scale, Clapperboard, Trophy, AlertTriangle, Trash2 } from "lucide-react";
import type { Pageant } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Card, CardContent } from "@pageant/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";

const API_BASE = "/api";

export function PageantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pageant, setPageant] = useState<Pageant | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", venue: "", description: "", status: "" as Pageant["status"] });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchPageant = async () => {
    const res = await fetch(`${API_BASE}/pageants/${id}`, { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      const formattedDate = data.data.date ? String(data.data.date).split("T")[0].split(" ")[0] : "";
      setPageant({ ...data.data, date: formattedDate });
      setForm({ name: data.data.name, date: formattedDate, venue: data.data.venue, description: data.data.description || "", status: data.data.status });
    }
  };

  useEffect(() => { fetchPageant(); }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/pageants/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    setEditing(false);
    fetchPageant();
  };

  const handleDelete = async () => {
    if (!pageant || confirmTitle !== pageant.name) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/pageants/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        navigate("/dashboard");
      }
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    await fetch(`${API_BASE}/pageants/${id}/logo`, { method: "POST", credentials: "include", body: fd });
    fetchPageant();
  };

  if (!pageant) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-8 w-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const navItems = [
    { label: "Segments", path: `/pageants/${id}/segments`, icon: Layers },
    { label: "Candidates", path: `/pageants/${id}/candidates`, icon: Users },
    { label: "Judges", path: `/pageants/${id}/judges`, icon: Scale },
    { label: "Live Control", path: `/pageants/${id}/live`, icon: Clapperboard },
    { label: "Results", path: `/pageants/${id}/results`, icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-lg font-bold text-foreground truncate">{pageant.name}</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Pageant Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {/* Logo */}
              <div className="relative group shrink-0">
                <img src={pageant.logoUrl} alt="Logo" className="w-24 h-24 rounded-2xl object-cover bg-secondary" />
                <label className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-white text-xs font-bold">Change</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-foreground">{pageant.name}</h2>
                  <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{pageant.status}</span>
                </div>
                {pageant.description && <p className="text-sm text-muted-foreground mb-2">{pageant.description}</p>}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {pageant.date ? String(pageant.date).split("T")[0].split(" ")[0] : ""}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {pageant.venue}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit Details</Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>Delete</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="bg-card border p-5"
              >
                <div className="flex items-center gap-2">
                  <Icon />
                  <h3 className="font-bold">{item.label}</h3>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pageant Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5 w-full">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-venue">Venue *</Label>
                <Input
                  id="edit-venue"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Pageant["status"] })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 transition-all"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <textarea
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 resize-none transition-all"
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setConfirmTitle("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Delete Pageant</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive/90 leading-relaxed">
              This will permanently delete the pageant <span className="font-bold text-foreground underline">{pageant.name}</span>, including all associated categories, criteria, candidates, judges, and score records.
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-delete-name" className="text-xs text-muted-foreground">
                To confirm, type <span className="font-bold text-foreground font-mono select-all">{pageant.name}</span> below:
              </Label>
              <Input
                id="confirm-delete-name"
                value={confirmTitle}
                onChange={(e) => setConfirmTitle(e.target.value)}
                placeholder={pageant.name}
                className="font-mono text-sm"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowDeleteDialog(false);
                setConfirmTitle("");
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmTitle !== pageant.name || deleting}
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "I understand, delete this pageant"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
