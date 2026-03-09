const palette = [
  ["#ffb36b", "#ff7a7a"],
  ["#8ad7ff", "#4c8dff"],
  ["#91f2c5", "#34c38f"],
  ["#d0b4ff", "#8b6bff"],
  ["#ffd36e", "#ff9f43"],
  ["#ffb6d9", "#ff6fae"],
  ["#b5f0ff", "#4db6d6"],
  ["#d4ef7d", "#76b947"]
];

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = input.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

export function coverGradient(seed: string) {
  const pair = palette[hash(seed) % palette.length];
  return `linear-gradient(160deg, ${pair[0]}, ${pair[1]})`;
}

export function coverLabel(title: string) {
  const parts = title.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "BK";
}

export function categoryEmoji(category: string) {
  const value = category.toLowerCase();
  if (value.includes("software") || value.includes("tech")) return "💻";
  if (value.includes("history")) return "🏛️";
  if (value.includes("science")) return "🧪";
  if (value.includes("business")) return "📈";
  if (value.includes("novel") || value.includes("fiction")) return "📖";
  if (value.includes("design") || value.includes("art")) return "🎨";
  return "📚";
}