import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Plus, X } from "lucide-react";
import type { CategoryWithCriteria, CreateCriteria, Category, Criteria } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Card } from "@pageant/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";

const API_BASE = "/api";

export function CategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryWithCriteria[]>([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showCritModal, setShowCritModal] = useState<string | null>(null);
  const [editCategoryData, setEditCategoryData] = useState<Category | null>(null);
  const [editCriterionData, setEditCriterionData] = useState<Criteria | null>(null);

  const [catForm, setCatForm] = useState({ name: "", weight: 0, order: 0 });
  const [critForm, setCritForm] = useState<CreateCriteria>({ name: "", weight: 0, minScore: 10, maxScore: 20, order: 0 });

  const fetchCategories = async () => {
    const res = await fetch(`${API_BASE}/pageants/${id}/categories`, { credentials: "include" });
    const data = await res.json();
    if (data.success) setCategories(data.data);
  };

  useEffect(() => { fetchCategories(); }, [id]);

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/pageants/${id}/categories`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ ...catForm, order: categories.length + 1 }),
    });
    setShowCatModal(false);
    setCatForm({ name: "", weight: 0, order: 0 });
    fetchCategories();
  };

  const updateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategoryData) return;
    await fetch(`${API_BASE}/categories/${editCategoryData.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: editCategoryData.name, weight: editCategoryData.weight }),
    });
    setEditCategoryData(null);
    fetchCategories();
  };

  const deleteCategory = async (catId: string) => {
    if (!confirm("Delete this category and all its criteria?")) return;
    await fetch(`${API_BASE}/categories/${catId}`, { method: "DELETE", credentials: "include" });
    fetchCategories();
  };

  const createCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCritModal) return;
    const cat = categories.find((c) => c.id === showCritModal);
    await fetch(`${API_BASE}/categories/${showCritModal}/criteria`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ ...critForm, order: cat ? cat.criteria.length + 1 : 0 }),
    });
    setShowCritModal(null);
    setCritForm({ name: "", weight: 0, minScore: 10, maxScore: 20, order: 0 });
    fetchCategories();
  };

  const updateCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCriterionData) return;
    await fetch(`${API_BASE}/criteria/${editCriterionData.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        name: editCriterionData.name,
        weight: editCriterionData.weight,
        minScore: editCriterionData.minScore,
        maxScore: editCriterionData.maxScore,
      }),
    });
    setEditCriterionData(null);
    fetchCategories();
  };

  const deleteCriterion = async (critId: string) => {
    if (!confirm("Delete this criterion?")) return;
    await fetch(`${API_BASE}/criteria/${critId}`, { method: "DELETE", credentials: "include" });
    fetchCategories();
  };

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-lg font-bold text-foreground">Categories & Criteria</h1>
          </div>
          <Button onClick={() => setShowCatModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Category
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {/* Weight Summary */}
        <div className={`text-sm px-4 py-3 rounded-xl border ${totalWeight === 100 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
          Total Category Weight: <span className="font-bold">{totalWeight}%</span> {totalWeight !== 100 && "(should equal 100%)"}
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p>No categories yet. Add your first scoring category.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const critWeight = cat.criteria.reduce((sum, c) => sum + c.weight, 0);
            return (
              <Card key={cat.id}>
                {/* Category Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-border bg-card/50">
                  <div>
                    <h3 className="font-bold text-foreground text-base">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground">Weight: {cat.weight}% of total</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowCritModal(cat.id)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Criteria
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditCategoryData(cat)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteCategory(cat.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Criteria List */}
                <div className="divide-y divide-border">
                  {cat.criteria.length === 0 ? (
                    <div className="px-5 py-6 text-center text-muted-foreground/50 text-sm">No criteria yet</div>
                  ) : (
                    <>
                      {cat.criteria.map((cr) => (
                        <div key={cr.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                          <div>
                            <span className="text-sm font-medium text-foreground">{cr.name}</span>
                            <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                              <span>Weight: {cr.weight}%</span>
                              <span>Range: {cr.minScore}–{cr.maxScore}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditCriterionData(cr)} className="text-muted-foreground hover:text-foreground">
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCriterion(cr.id)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className={`px-5 py-2.5 text-xs ${critWeight === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                        Criteria weight total: {critWeight}% {critWeight !== 100 && "(should equal 100%)"}
                      </div>
                    </>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </main>

      {/* Create Category Dialog */}
      <Dialog open={showCatModal} onOpenChange={setShowCatModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={createCategory} className="space-y-4">
            <div className="space-y-1.5 w-full">
              <Label htmlFor="cat-name">Name *</Label>
              <Input
                id="cat-name"
                placeholder="e.g. Swimwear"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5 w-full">
              <Label htmlFor="cat-weight">Weight (%) *</Label>
              <Input
                id="cat-weight"
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 25"
                value={catForm.weight || ""}
                onChange={(e) => setCatForm({ ...catForm, weight: Number(e.target.value) })}
                required
              />
            </div>
            <Button type="submit" className="w-full py-3">Add Category</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editCategoryData} onOpenChange={(open) => { if (!open) setEditCategoryData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editCategoryData && (
            <form onSubmit={updateCategory} className="space-y-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-cat-name">Name *</Label>
                <Input
                  id="edit-cat-name"
                  value={editCategoryData.name}
                  onChange={(e) => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-cat-weight">Weight (%) *</Label>
                <Input
                  id="edit-cat-weight"
                  type="number"
                  min={0}
                  max={100}
                  value={editCategoryData.weight}
                  onChange={(e) => setEditCategoryData({ ...editCategoryData, weight: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditCategoryData(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Criterion Dialog */}
      <Dialog open={!!showCritModal} onOpenChange={(open) => { if (!open) setShowCritModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Criterion</DialogTitle>
          </DialogHeader>
          <form onSubmit={createCriterion} className="space-y-4">
            <div className="space-y-1.5 w-full">
              <Label htmlFor="crit-name">Name *</Label>
              <Input
                id="crit-name"
                placeholder="e.g. Poise & Bearing"
                value={critForm.name}
                onChange={(e) => setCritForm({ ...critForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5 w-full">
              <Label htmlFor="crit-weight">Weight within Category (%) *</Label>
              <Input
                id="crit-weight"
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 40"
                value={critForm.weight || ""}
                onChange={(e) => setCritForm({ ...critForm, weight: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="crit-min-score">Min Score *</Label>
                <Input
                  id="crit-min-score"
                  type="number"
                  value={critForm.minScore}
                  onChange={(e) => setCritForm({ ...critForm, minScore: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="crit-max-score">Max Score *</Label>
                <Input
                  id="crit-max-score"
                  type="number"
                  value={critForm.maxScore}
                  onChange={(e) => setCritForm({ ...critForm, maxScore: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full py-3">Add Criterion</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Criterion Dialog */}
      <Dialog open={!!editCriterionData} onOpenChange={(open) => { if (!open) setEditCriterionData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Criterion</DialogTitle>
          </DialogHeader>
          {editCriterionData && (
            <form onSubmit={updateCriterion} className="space-y-4">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-crit-name">Name *</Label>
                <Input
                  id="edit-crit-name"
                  value={editCriterionData.name}
                  onChange={(e) => setEditCriterionData({ ...editCriterionData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-crit-weight">Weight within Category (%) *</Label>
                <Input
                  id="edit-crit-weight"
                  type="number"
                  min={0}
                  max={100}
                  value={editCriterionData.weight}
                  onChange={(e) => setEditCriterionData({ ...editCriterionData, weight: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 w-full">
                  <Label htmlFor="edit-crit-min-score">Min Score *</Label>
                  <Input
                    id="edit-crit-min-score"
                    type="number"
                    value={editCriterionData.minScore}
                    onChange={(e) => setEditCriterionData({ ...editCriterionData, minScore: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-1.5 w-full">
                  <Label htmlFor="edit-crit-max-score">Max Score *</Label>
                  <Input
                    id="edit-crit-max-score"
                    type="number"
                    value={editCriterionData.maxScore}
                    onChange={(e) => setEditCriterionData({ ...editCriterionData, maxScore: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditCriterionData(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
