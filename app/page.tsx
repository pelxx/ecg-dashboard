"use client";

import { useState, useEffect } from "react";
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
    <main className="flex items-center justify-center min-h-screen bg-black text-white">
      <form
        onSubmit={handleLogin}
        className="bg-gray-900 p-8 rounded-xl w-full max-w-sm shadow-2xl border border-gray-800"
      >
        <h1 className="text-2xl font-bold text-center">Login</h1>

        <p className="text-center text-gray-400 mb-6">
          ECG Dashboard
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm px-3 py-2 rounded-md mb-4">
            ⚠ {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-green-500"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-green-500"
        />

        <button
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-md font-semibold disabled:opacity-50"
        >
          {loading ? "Loading..." : "Login"}
        </button>
      </form>
    </main>
  );
}