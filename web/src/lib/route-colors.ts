export const ROUTE_COLORS = [
  { bg: "#3b82f6", border: "#2563eb", name: "Blue" },
  { bg: "#f97316", border: "#ea580c", name: "Orange" },
  { bg: "#ec4899", border: "#db2777", name: "Pink" },
  { bg: "#8b5cf6", border: "#7c3aed", name: "Purple" },
  { bg: "#14b8a6", border: "#0d9488", name: "Teal" },
  { bg: "#eab308", border: "#ca8a04", name: "Yellow" },
  { bg: "#ef4444", border: "#dc2626", name: "Red" },
  { bg: "#22c55e", border: "#16a34a", name: "Green" },
];
export function getRouteColor(index: number) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}