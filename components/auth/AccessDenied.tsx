"use client";

export default function AccessDenied() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-lg border border-red-800/40 bg-gray-900 p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-300">
          403
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-gray-400">
          You do not have permission to access this page.
        </p>
      </section>
    </main>
  );
}
