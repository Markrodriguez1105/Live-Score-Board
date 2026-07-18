import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal, Button, Input, Card } from "@pageant/ui";
import type { CategoryWithCriteria, CreateCriteria, Category, Criteria } from "@pageant/types";

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
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-border-subtle bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-white/40 hover:text-white">← Back</button>
            <h1 className="text-lg font-bold text-white">Categories & Criteria</h1>
          </div>
          <Button onClick={() => setShowCatModal(true)} variant="primary">
            + Add Category
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4 animate-fade-in-up">
        {/* Weight Summary */}
        <div className={`text-sm px-4 py-3 rounded-xl border ${totalWeight === 100 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
          Total Category Weight: <span className="font-bold">{totalWeight}%</span> {totalWeight !== 100 && "(should equal 100%)"}
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-4">📋</div>
            <p>No categories yet. Add your first scoring category.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const critWeight = cat.criteria.reduce((sum, c) => sum + c.weight, 0);
            return (
              <Card key={cat.id}>
                {/* Category Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-border-subtle bg-white/[0.01]">
                  <div>
                    <h3 className="font-bold text-white text-base">{cat.name}</h3>
                    <p className="text-xs text-white/40">Weight: {cat.weight}% of total</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowCritModal(cat.id)}>
                      + Criteria
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditCategoryData(cat)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => deleteCategory(cat.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Criteria List */}
                <div className="divide-y divide-border-subtle">
                  {cat.criteria.length === 0 ? (
                    <div className="px-5 py-6 text-center text-white/20 text-sm">No criteria yet</div>
                  ) : (
                    <>
                      {cat.criteria.map((cr) => (
                        <div key={cr.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                          <div>
                            <span className="text-sm font-medium text-white">{cr.name}</span>
                            <div className="flex gap-3 mt-0.5 text-xs text-white/30">
                              <span>Weight: {cr.weight}%</span>
                              <span>Range: {cr.minScore}–{cr.maxScore}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditCriterionData(cr)} className="text-white/40 hover:text-white">
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCriterion(cr.id)} className="text-white/30 hover:text-red-400">
                              ✕
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

      {/* Create Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title="Add Category">
        <form onSubmit={createCategory} className="space-y-4">
          <Input
            label="Name *"
            placeholder="e.g. Swimwear"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            required
          />
          <Input
            type="number"
            min={0}
            max={100}
            label="Weight (%) *"
            placeholder="e.g. 25"
            value={catForm.weight || ""}
            onChange={(e) => setCatForm({ ...catForm, weight: Number(e.target.value) })}
            required
          />
          <Button type="submit" variant="primary" className="w-full py-3">Add Category</Button>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal isOpen={!!editCategoryData} onClose={() => setEditCategoryData(null)} title="Edit Category">
        {editCategoryData && (
          <form onSubmit={updateCategory} className="space-y-4">
            <Input
              label="Name *"
              value={editCategoryData.name}
              onChange={(e) => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
              required
            />
            <Input
              type="number"
              min={0}
              max={100}
              label="Weight (%) *"
              value={editCategoryData.weight}
              onChange={(e) => setEditCategoryData({ ...editCategoryData, weight: Number(e.target.value) })}
              required
            />
            <div className="flex gap-2 justify-end mt-4">
              <Button type="button" variant="ghost" onClick={() => setEditCategoryData(null)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create Criterion Modal */}
      <Modal isOpen={!!showCritModal} onClose={() => setShowCritModal(null)} title="Add Criterion">
        <form onSubmit={createCriterion} className="space-y-4">
          <Input
            label="Name *"
            placeholder="e.g. Poise & Bearing"
            value={critForm.name}
            onChange={(e) => setCritForm({ ...critForm, name: e.target.value })}
            required
          />
          <Input
            type="number"
            min={0}
            max={100}
            label="Weight within Category (%) *"
            placeholder="e.g. 40"
            value={critForm.weight || ""}
            onChange={(e) => setCritForm({ ...critForm, weight: Number(e.target.value) })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Min Score *"
              value={critForm.minScore}
              onChange={(e) => setCritForm({ ...critForm, minScore: Number(e.target.value) })}
              required
            />
            <Input
              type="number"
              label="Max Score *"
              value={critForm.maxScore}
              onChange={(e) => setCritForm({ ...critForm, maxScore: Number(e.target.value) })}
              required
            />
          </div>
          <Button type="submit" variant="primary" className="w-full py-3">Add Criterion</Button>
        </form>
      </Modal>

      {/* Edit Criterion Modal */}
      <Modal isOpen={!!editCriterionData} onClose={() => setEditCriterionData(null)} title="Edit Criterion">
        {editCriterionData && (
          <form onSubmit={updateCriterion} className="space-y-4">
            <Input
              label="Name *"
              value={editCriterionData.name}
              onChange={(e) => setEditCriterionData({ ...editCriterionData, name: e.target.value })}
              required
            />
            <Input
              type="number"
              min={0}
              max={100}
              label="Weight within Category (%) *"
              value={editCriterionData.weight}
              onChange={(e) => setEditCriterionData({ ...editCriterionData, weight: Number(e.target.value) })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                label="Min Score *"
                value={editCriterionData.minScore}
                onChange={(e) => setEditCriterionData({ ...editCriterionData, minScore: Number(e.target.value) })}
                required
              />
              <Input
                type="number"
                label="Max Score *"
                value={editCriterionData.maxScore}
                onChange={(e) => setEditCriterionData({ ...editCriterionData, maxScore: Number(e.target.value) })}
                required
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button type="button" variant="ghost" onClick={() => setEditCriterionData(null)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
