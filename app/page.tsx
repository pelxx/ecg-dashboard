"use client";

import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await new Promise((res) => setTimeout(res, 800));

      await setPersistence(auth, browserSessionPersistence);

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      router.push("/devices");
    } catch (err: unknown) {
      console.error(err);
      setError("Email atau password salah");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050b0a] px-6 text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      {/* ECG background line */}
      <div className="pointer-events-none absolute inset-x-0 top-[20%] opacity-[0.08]">
        <svg
          viewBox="0 0 1600 180"
          className="h-[180px] w-full"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="
              M0 90
              H180
              L205 90
              L220 84
              L235 96
              L250 90
              H430
              L455 90
              L470 82
              L485 98
              L500 90
              H650
              L675 90
              L700 90
              L715 30
              L735 145
              L755 90
              H920
              L945 90
              L960 84
              L975 96
              L990 90
              H1160
              L1185 90
              L1200 82
              L1215 98
              L1230 90
              H1410
              L1435 90
              L1450 84
              L1465 96
              L1480 90
              H1600
            "
            stroke="currentColor"
            strokeWidth="2"
            className="text-emerald-400"
          />
        </svg>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
            <svg
              viewBox="0 0 48 48"
              className="h-9 w-9 text-emerald-400"
              fill="none"
            >
              <path
                d="M4 25H12L16 15L22 34L27 20L31 25H44"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
            ECG Telemetry
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Monitoring Dashboard
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in to access the ECG monitoring system
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Welcome back
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter your account credentials to continue.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <span className="mt-0.5 text-red-400">!</span>

              <div>
                <p className="text-sm font-medium text-red-300">
                  Authentication failed
                </p>

                <p className="mt-0.5 text-xs text-red-400/80">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-emerald-500/70 focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-emerald-500/70 focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500/10"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.8 10.8 0 0112 4c5 0 8.5 4 9.5 6a10.7 10.7 0 01-3.2 3.7M6.2 6.2C4.4 7.3 3.2 8.8 2.5 10c1 2 4.5 6 9.5 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Login */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <span className="ml-2">→</span>
              </>
            )}
          </button>

          {/* Security info */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-600">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect
                x="5"
                y="10"
                width="14"
                height="10"
                rx="2"
              />
              <path
                d="M8 10V7a4 4 0 018 0v3"
                strokeLinecap="round"
              />
            </svg>

            <span>Authorized personnel only</span>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] uppercase tracking-wider text-slate-700">
          ECG Telemetry System · 3-Lead Monitoring
        </p>
        <p className="mt-1 text-center text-[11px] uppercase tracking-wider text-slate-700">
          DIBUAT OLEH PELEG AKA HARISH
        </p>
      </div>
    </main>
  );
}