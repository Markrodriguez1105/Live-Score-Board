import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal } from "@pageant/ui";
import type { CategoryWithCriteria, CreateCriteria } from "@pageant/types";

const API_BASE = "/api";

export function CategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryWithCriteria[]>([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showCritModal, setShowCritModal] = useState<string | null>(null);
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

  const deleteCriterion = async (critId: string) => {
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
          <button onClick={() => setShowCatModal(true)} className="bg-pageant-purple hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            + Add Category
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4 animate-fade-in-up">
        {/* Weight Summary */}
        <div className={`text-sm px-4 py-2 rounded-xl ${totalWeight === 100 ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
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
              <div key={cat.id} className="bg-surface-secondary border border-border-subtle rounded-2xl overflow-hidden">
                {/* Category Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-border-subtle">
                  <div>
                    <h3 className="font-bold text-white">{cat.name}</h3>
                    <p className="text-xs text-white/40">Weight: {cat.weight}% of total</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowCritModal(cat.id)} className="text-xs bg-surface-elevated hover:bg-white/10 text-white px-3 py-1.5 rounded-lg transition-colors">
                      + Criteria
                    </button>
                    <button onClick={() => deleteCategory(cat.id)} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Criteria List */}
                <div className="divide-y divide-border-subtle">
                  {cat.criteria.length === 0 ? (
                    <div className="px-5 py-6 text-center text-white/20 text-sm">No criteria yet</div>
                  ) : (
                    <>
                      {cat.criteria.map((cr) => (
                        <div key={cr.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                          <div>
                            <span className="text-sm text-white">{cr.name}</span>
                            <div className="flex gap-3 mt-0.5 text-xs text-white/30">
                              <span>Weight: {cr.weight}%</span>
                              <span>Range: {cr.minScore}–{cr.maxScore}</span>
                            </div>
                          </div>
                          <button onClick={() => deleteCriterion(cr.id)} className="text-white/20 hover:text-red-400 transition-colors text-sm">✕</button>
                        </div>
                      ))}
                      <div className={`px-5 py-2 text-xs ${critWeight === 100 ? "text-green-400" : "text-amber-400"}`}>
                        Criteria weight total: {critWeight}% {critWeight !== 100 && "(should equal 100%)"}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Create Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title="Add Category">
        <form onSubmit={createCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Name *</label>
            <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" placeholder="e.g. Swimwear" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Weight (%) *</label>
            <input type="number" min={0} max={100} value={catForm.weight} onChange={(e) => setCatForm({ ...catForm, weight: Number(e.target.value) })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
          </div>
          <button type="submit" className="w-full bg-pageant-purple hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all">Add Category</button>
        </form>
      </Modal>

      {/* Create Criterion Modal */}
      <Modal isOpen={!!showCritModal} onClose={() => setShowCritModal(null)} title="Add Criterion">
        <form onSubmit={createCriterion} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Name *</label>
            <input value={critForm.name} onChange={(e) => setCritForm({ ...critForm, name: e.target.value })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" placeholder="e.g. Poise & Bearing" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Weight within Category (%) *</label>
            <input type="number" min={0} max={100} value={critForm.weight} onChange={(e) => setCritForm({ ...critForm, weight: Number(e.target.value) })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Min Score *</label>
              <input type="number" value={critForm.minScore} onChange={(e) => setCritForm({ ...critForm, minScore: Number(e.target.value) })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Max Score *</label>
              <input type="number" value={critForm.maxScore} onChange={(e) => setCritForm({ ...critForm, maxScore: Number(e.target.value) })} className="w-full bg-surface-primary border border-border-default rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pageant-purple" required />
            </div>
          </div>
          <button type="submit" className="w-full bg-pageant-purple hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all">Add Criterion</button>
        </form>
      </Modal>
    </div>
  );
}
