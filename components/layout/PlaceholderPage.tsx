
"use client";

type Props = {
  title: string;
  description: string;
};

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <section className="p-6 text-[var(--foreground)] transition-colors duration-200">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm shadow-black/5">
        <h1 className="text-2xl font-bold text-[var(--primary)]">
          {title}
        </h1>

        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
    </section>
  );
}
