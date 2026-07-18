import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "/api";

interface ResultData {
  scores: Array<{
    score_id: string;
    value: number;
    judge_id: string;
    judge_name: string;
    candidate_id: string;
    candidate_name: string;
    candidate_number: number;
    criteria_name: string;
    criteria_weight: number;
    category_name: string;
    category_weight: number;
  }>;
  candidates: Array<{ id: string; name: string; candidateNumber: number; photoUrl?: string }>;
  categories: Array<{ id: string; name: string; weight: number; criteria: Array<{ id: string; name: string; weight: number }> }>;
  judges: Array<{ id: string; name: string }>;
}

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ResultData | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE}/pageants/${id}/results`, { credentials: "include" });
      const json = await res.json();
      if (json.success) setData(json.data);
    })();
  }, [id]);

  if (!data) return <div className="min-h-screen bg-surface-primary flex items-center justify-center"><div className="h-8 w-8 border-[3px] border-pageant-purple border-t-transparent rounded-full animate-spin" /></div>;

  // Compute totals per candidate
  const candidateTotals = data.candidates.map((c) => {
    let total = 0;
    for (const cat of data.categories) {
      let catTotal = 0;
      for (const cr of cat.criteria) {
        const criteriaScores = data.scores.filter(
          (s) => s.candidate_id === c.id && s.criteria_name === cr.name && s.category_name === cat.name
        );
        if (criteriaScores.length > 0) {
          const avg = criteriaScores.reduce((sum, s) => sum + Number(s.value), 0) / criteriaScores.length;
          catTotal += avg * (cr.weight / 100);
        }
      }
      total += catTotal * (cat.weight / 100);
    }
    return { ...c, total };
  }).sort((a, b) => b.total - a.total);

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`;

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-border-subtle bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(`/pageants/${id}`)} className="text-white/40 hover:text-white">← Back</button>
          <h1 className="text-lg font-bold text-white">🏆 Results & Rankings</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
        {/* Rankings */}
        <div className="space-y-3">
          {candidateTotals.map((c, i) => (
            <div
              key={c.id}
              className={`bg-surface-secondary border rounded-xl p-4 flex items-center gap-4 transition-all ${
                i === 0 ? "border-pageant-gold/30 shadow-lg shadow-pageant-gold/5" :
                i === 1 ? "border-gray-400/20" :
                i === 2 ? "border-amber-700/20" : "border-border-subtle"
              }`}
            >
              {/* Rank */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                i === 0 ? "bg-pageant-gold text-black" :
                i === 1 ? "bg-gray-400 text-black" :
                i === 2 ? "bg-amber-700 text-white" : "bg-surface-elevated text-white/40"
              }`}>
                {i + 1}
              </div>

              {/* Photo */}
              <img src={c.photoUrl || getFallback(c.name)} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white">{c.name}</h3>
                <p className="text-xs text-white/30">Candidate #{c.candidateNumber}</p>
              </div>

              {/* Score */}
              <div className="text-right">
                <span className="text-2xl font-bold font-mono text-pageant-gold">{c.total.toFixed(2)}</span>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Total Score</p>
              </div>
            </div>
          ))}
        </div>

        {candidateTotals.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <div className="text-5xl mb-4">📊</div>
            <p>No scores submitted yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
