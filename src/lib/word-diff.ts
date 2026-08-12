export interface DiffPart {
  type: "same" | "added" | "removed";
  text: string;
}

/**
 * A small longest-common-subsequence word diff. Not meant to compete with
 * a proper diff library - it's enough to visually show what changed
 * between two plain-text extractions of a document for the version
 * history panel.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);

  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      parts.push({ type: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      parts.push({ type: "removed", text: a[i]! });
      i++;
    } else {
      parts.push({ type: "added", text: b[j]! });
      j++;
    }
  }
  while (i < n) {
    parts.push({ type: "removed", text: a[i]! });
    i++;
  }
  while (j < m) {
    parts.push({ type: "added", text: b[j]! });
    j++;
  }

  return mergeAdjacent(parts);
}

function mergeAdjacent(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.type === part.type) {
      last.text += part.text;
    } else {
      merged.push({ ...part });
    }
  }
  return merged;
}
