import { Button } from "@pageant/ui/components/button";
import { Card, CardContent } from "@pageant/ui/components/card";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";
import Logo from "@pageant/ui/components/logo";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/pageants/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        navigate("/dashboard");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-80 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col justify-center items-center mb-8 gap-4">
          <Logo size={40} />
          <div className="flex flex-col justify-center items-center text-center">
            <h1 className="text-2xl font-bold tracking-tight">Pageant Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage your pageants</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2 w-full">
            <Label htmlFor="admin-username">Username</Label>
            <Input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="space-y-2 w-full">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            id="admin-login-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
