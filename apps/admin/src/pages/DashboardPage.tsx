import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Calendar, MapPin, Sparkles } from "lucide-react";
import type { Pageant } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@pageant/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";
import Logo from "@pageant/ui/components/logo";

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={40} />
            <h1 className="text-xl font-bold text-foreground">Pageant Admin</h1>
          </div>
          <Button
            id="create-pageant-btn"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" /> New Pageant
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-[3px] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pageants.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 text-primary/40 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No Pageants Yet</h2>
            <p className="text-muted-foreground mb-6">Create your first pageant to get started</p>
            <Button
              onClick={() => setShowCreate(true)}
              size="lg"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Pageant
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pageants.map((p) => (
              <Card
                key={p.id}
                onClick={() => navigate(`/pageants/${p.id}`)}
                className="cursor-pointer transition-all group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="transition-colors truncate pr-2">
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
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {p.date}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {p.venue}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Pageant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5 w-full">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                placeholder="e.g. Miss Universe 2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="create-date">Date *</Label>
                <Input
                  id="create-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="create-venue">Venue *</Label>
                <Input
                  id="create-venue"
                  placeholder="e.g. Arena Hall"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5 w-full">
              <Label htmlFor="create-description">Description</Label>
              <textarea
                id="create-description"
                placeholder="Provide a description..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 resize-none transition-all"
              />
            </div>
            <Button type="submit" className="w-full py-3 mt-2">
              Create Pageant
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
