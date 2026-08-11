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
      className={`rounded-lg border border-emerald-800/30 bg-slate-950/85 p-4 shadow-lg shadow-black/20 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-normal text-emerald-300">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
