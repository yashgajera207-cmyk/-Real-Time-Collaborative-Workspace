const PALETTE = [
  { bg: "#CECBF6", fg: "#26215C" },
  { bg: "#9FE1CB", fg: "#04342C" },
  { bg: "#F5C4B3", fg: "#4A1B0C" },
  { bg: "#F4C0D1", fg: "#4B1528" },
  { bg: "#FAC775", fg: "#412402" },
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
      className="flex shrink-0 items-center justify-center rounded-full font-medium ring-2 ring-white"
    >
      {initials(name)}
    </div>
  );
}
