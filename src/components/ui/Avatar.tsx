const PALETTE = [
  { bg: "#E0E7FF", fg: "#3730A3" }, // Indigo
  { bg: "#D1FAE5", fg: "#065F46" }, // Emerald
  { bg: "#FEE2E2", fg: "#991B1B" }, // Rose
  { bg: "#FEF3C7", fg: "#92400E" }, // Amber
  { bg: "#F3E8FF", fg: "#6B21A8" }, // Purple
  { bg: "#E0F2FE", fg: "#075985" }, // Sky
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const { bg, fg } = colorFor(name);
  return (
    <div
      title={name}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white shadow-2xs select-none"
    >
      {initials(name)}
    </div>
  );
}
