export function coverGradient(seed: string) {
  const key = seed.trim().toLowerCase();

  if (key.includes("history") || key.includes("biography") || key.includes("culture")) {
    return "linear-gradient(160deg, #243b55, #141e30)";
  }

  if (key.includes("fiction") || key.includes("novel") || key.includes("romance")) {
    return "linear-gradient(160deg, #312e81, #1e1b4b)";
  }

  if (key.includes("technology") || key.includes("computer") || key.includes("program")) {
    return "linear-gradient(160deg, #1f3b73, #132a4f)";
  }

  if (key.includes("business") || key.includes("finance") || key.includes("economics")) {
    return "linear-gradient(160deg, #4b2e19, #23140a)";
  }

  if (key.includes("science") || key.includes("math")) {
    return "linear-gradient(160deg, #0f4c5c, #082f3a)";
  }

  if (key.includes("art") || key.includes("design")) {
    return "linear-gradient(160deg, #5b2333, #2f111a)";
  }

  return "linear-gradient(160deg, #334155, #0f172a)";
}