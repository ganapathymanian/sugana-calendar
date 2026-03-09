// Family members & their themes
export const FAMILY_MEMBERS = [
  { id: "gana", name: "Gana", emoji: "👨", color: "#6366f1", lightColor: "#e0e7ff" },
  { id: "suganya", name: "Suganya", emoji: "👩", color: "#ec4899", lightColor: "#fce7f3" },
  { id: "aadarsh", name: "Aadarsh", emoji: "👦", color: "#f59e0b", lightColor: "#fef3c7" },
  { id: "avanthika", name: "Avanthika", emoji: "👧", color: "#10b981", lightColor: "#d1fae5" },
] as const;

export type MemberId = typeof FAMILY_MEMBERS[number]["id"];

export const getMember = (id: string) => FAMILY_MEMBERS.find(m => m.id === id);
export const getMemberColor = (id: string) => getMember(id)?.color || "#6366f1";

// Category icons
export const CATEGORIES = [
  { id: "work", label: "Work", icon: "💼" },
  { id: "school", label: "School", icon: "📚" },
  { id: "health", label: "Health", icon: "🏥" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "shopping", label: "Shopping", icon: "🛒" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧‍👦" },
  { id: "personal", label: "Personal", icon: "⭐" },
  { id: "other", label: "Other", icon: "📌" },
] as const;

export const PIN_CODE = "2024"; // Default family PIN

export const NOTIFICATION_SOUNDS = [
  { id: "default", label: "Default", value: "default" },
  { id: "gentle", label: "Gentle Chime", value: "gentle" },
  { id: "none", label: "Silent", value: "none" },
];
