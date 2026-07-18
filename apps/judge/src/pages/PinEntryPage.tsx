import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "/api";

export function PinEntryPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/judges/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (data.success) {
        // Store JWT and judge info
        sessionStorage.setItem("judgeToken", data.data.token);
        sessionStorage.setItem("judgeInfo", JSON.stringify(data.data.judge));
        navigate("/score");
      } else {
        setError(data.error || "Invalid PIN");
      }
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 6) setPin(pin + digit);
  };

  const handleClear = () => setPin("");
  const handleBackspace = () => setPin(pin.slice(0, -1));

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-pageant-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚖️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Judge Login</h1>
          <p className="text-sm text-white/40 mt-1">Enter your PIN to start scoring</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PIN Display */}
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold font-mono transition-all ${
                  pin[i]
                    ? "border-pageant-gold bg-pageant-gold/10 text-pageant-gold"
                    : "border-white/10 bg-surface-secondary text-white/20"
                }`}
              >
                {pin[i] ? "●" : ""}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handlePinDigit(d)}
                className="h-16 bg-surface-secondary border border-border-subtle rounded-xl text-xl font-bold text-white hover:bg-surface-elevated active:scale-95 transition-all"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-16 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handlePinDigit("0")}
              className="h-16 bg-surface-secondary border border-border-subtle rounded-xl text-xl font-bold text-white hover:bg-surface-elevated active:scale-95 transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-16 bg-surface-secondary border border-border-subtle rounded-xl text-xl font-bold text-white/40 hover:bg-surface-elevated active:scale-95 transition-all"
            >
              ←
            </button>
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || loading}
            className="w-full bg-pageant-gold hover:bg-amber-400 disabled:opacity-30 text-black font-bold py-4 rounded-xl transition-all text-lg active:scale-[0.98]"
          >
            {loading ? "Verifying..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
