type Tone = "green" | "yellow" | "red" | "gray" | "blue";

type Props = {
  readonly label: string;
  readonly tone?: Tone;
};

const toneClass: Record<Tone, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  yellow: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  red: "border-red-500/40 bg-red-500/10 text-red-200",
  gray: "border-slate-600 bg-slate-800 text-slate-300",
  blue: "border-sky-500/40 bg-sky-500/10 text-sky-200",
};

export default function StatusBadge({ label, tone = "gray" }: Props) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs ${toneClass[tone]}`}>
      {label}
    </span>
  );
}
