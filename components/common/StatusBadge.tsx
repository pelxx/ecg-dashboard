type Tone = "green" | "yellow" | "red" | "gray" | "blue";

type Props = {
  readonly label: string;
  readonly tone?: Tone;
};

const toneClass: Record<Tone, string> = {
  green:
    "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",

  yellow:
    "border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",

  red:
    "border-red-600/30 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300",

  gray:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",

  blue:
    "border-blue-600/30 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300",
};

export default function StatusBadge({ label, tone = "gray" }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors duration-200 ${toneClass[tone]}`}
    >
      {label}
    </span>
  );
}
