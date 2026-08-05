"use client";

type Props = {
  title: string;
  description: string;
};

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <section className="p-6">
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-2xl font-bold text-blue-400">{title}</h1>
        <p className="mt-2 text-sm text-gray-400">{description}</p>
      </div>
    </section>
  );
}
