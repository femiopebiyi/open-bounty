export const SUPPORTED_LANGUAGES = [
  "Rust",
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Solidity",
  "C++",
  "Java",
  "Swift",
  "Kotlin",
  "Move",
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Authentic brand colors from github linguist
export const LANGUAGE_COLORS: Record<string, string> = {
  Rust: "#DEA584",
  TypeScript: "#3178C6",
  JavaScript: "#F1E05A",
  Python: "#3572A5",
  Go: "#00ADD8",
  Solidity: "#AA6746",
  "C++": "#F34B7D",
  Java: "#B07219",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Move: "#4A90D9",
};

export const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "winner_selected", label: "Awarded" },
  { value: "claimed", label: "Claimed" },
] as const;

export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;
export const USD_DECIMALS = 6; // microdollars
