import type { ReactNode } from "react";

type Props = {
  readonly title: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export default function MedicalCard({
  title,
  action,
  children,
  className = "",
}: Props) {
  return (
    <section
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg shadow-black/5 transition-colors duration-200 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-normal text-[var(--success)]">
          {title}
        </h2>
        {action}
      </div>

      <div className="text-[var(--foreground)]">
        {children}
      </div>
    </section>
  );
}
