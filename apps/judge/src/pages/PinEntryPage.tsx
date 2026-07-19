import { Button } from "@pageant/ui/components/button";
import Logo from "@pageant/ui/components/logo";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "/api";

export function PinEntryPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (pinValue.length !== 4 || isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setError("");
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE}/judges/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: pinValue }),
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
        isSubmittingRef.current = false;
      }
    },
    [navigate]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPin(pin);
  };

  useEffect(() => {
    if (pin.length === 4) {
      submitPin(pin);
    }
  }, [pin, submitPin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= "0" && e.key <= "9") {
        setPin((prev) => (prev.length < 4 ? prev + e.key : prev));
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading]);

  const handlePinDigit = (digit: string) => {
    if (loading) return;
    setPin((prev) => (prev.length < 4 ? prev + digit : prev));
  };

  const handleClear = () => {
    if (loading) return;
    setPin("");
    setError("");
  };

  const handleBackspace = () => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col justify-center items-center mb-8 gap-4">
          <Logo size={30} />
          <div className="flex flex-col justify-center items-center text-center">
            <h1 className="text-2xl font-bold tracking-tight">Judge Login</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your PIN to start scoring</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PIN Display */}
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold font-mono transition-all ${pin[i]
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
                  } ${error ? "border-red-500/20 bg-red-500/10 text-red-400" : ""}`}
              >
                {pin[i] ? "●" : ""}
              </div>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <Button
                key={d}
                type="button"
                disabled={loading}
                onClick={() => handlePinDigit(d)}
                className="h-16 bg-card border border-border rounded-xl text-xl font-bold text-foreground hover:bg-secondary active:scale-95 transition-all"
              >
                {d}
              </Button>
            ))}
            <Button
              type="button"
              disabled={loading}
              onClick={handleClear}
              className="h-16 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              Clear
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={() => handlePinDigit("0")}
              className="h-16 bg-card border border-border rounded-xl text-xl font-bold text-foreground hover:bg-secondary active:scale-95 transition-all"
            >
              0
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={handleBackspace}
              className="h-16 bg-card border border-border rounded-xl text-xl font-bold text-muted-foreground hover:bg-secondary active:scale-95 transition-all"
            >
              ←
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
