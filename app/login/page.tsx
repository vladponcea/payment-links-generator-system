"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Lock, Eye, EyeOff, Mail, User } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setNeedsSetup(d.data.needsSetup);
        else setNeedsSetup(false);
      })
      .catch(() => setNeedsSetup(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (data.success) {
        // Setup done — now log in
        setNeedsSetup(false);
        setName("");
        setError("");
        // Auto-login after setup
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();
        if (loginData.success) {
          router.push("/");
          router.refresh();
        }
      } else {
        setError(data.error || "Setup failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-cyber-black bg-grid flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-black bg-grid flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-cyber-cyan/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-cyber-cyan" />
          </div>
          <span className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-white tracking-wider">
            Career<span className="text-cyber-cyan">Growth</span>
          </span>
        </div>

        {/* Card */}
        <div className="bg-cyber-dark border border-cyber-border rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-cyber-muted" />
            <h2 className="text-sm font-medium text-cyber-muted">
              {needsSetup ? "Create admin account" : "Sign in to continue"}
            </h2>
          </div>

          <form
            onSubmit={needsSetup ? handleSetup : handleLogin}
            className="space-y-4"
          >
            {/* Name (setup only) */}
            {needsSetup && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted/60" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="Full name"
                  autoFocus
                  className="w-full bg-cyber-black border border-cyber-border rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-cyber-muted/60 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 focus:outline-none transition-all duration-200"
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted/60" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Email address"
                autoFocus={!needsSetup}
                className="w-full bg-cyber-black border border-cyber-border rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-cyber-muted/60 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 focus:outline-none transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted/60" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Password"
                className="w-full bg-cyber-black border border-cyber-border rounded-lg pl-10 pr-10 py-3 text-sm text-white placeholder:text-cyber-muted/60 focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan/50 focus:outline-none transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-cyber-text transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {error && <p className="text-xs text-cyber-red">{error}</p>}

            <button
              type="submit"
              disabled={
                loading ||
                !email ||
                !password ||
                (needsSetup && !name)
              }
              className="w-full bg-cyber-cyan text-black font-bold rounded-lg px-4 py-3 text-sm hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Please wait..."
                : needsSetup
                ? "Create Admin Account"
                : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
