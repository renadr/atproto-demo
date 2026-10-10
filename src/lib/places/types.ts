// Client-safe view types shared by the /places page and its API routes.

export const CATEGORIES = [
  { value: "restaurant", label: "Restaurant", emoji: "🍽️" },
  { value: "cafe", label: "Café", emoji: "☕" },
  { value: "bar", label: "Bar", emoji: "🍸" },
  { value: "cinema", label: "Cinéma", emoji: "🎬" },
  { value: "architecture", label: "Architecture", emoji: "🏛️" },
  { value: "other", label: "Autre", emoji: "📍" },
] as const;

export function categoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[5];
}

export interface PlaceAddress {
  street?: string;
  postalCode?: string;
  locality?: string;
  region?: string;
  country?: string;
}

export interface PlaceView {
  uri: string;
  rkey: string;
  name: string;
  category: string;
  latitude: string;
  longitude: string;
  address: PlaceAddress | null;
  osm: { type: string; id: number } | null;
  tags: string[];
  lists: string[];
  note: string | null;
  createdAt: string;
}

export interface ListView {
  uri: string;
  rkey: string;
  name: string;
  description: string | null;
  createdAt: string;
}

// A candidate place returned by the OSM search proxy.
export interface OsmResult {
  osm: { type: "node" | "way" | "relation"; id: number };
  name: string;
  displayName: string;
  category: string;
  latitude: string;
  longitude: string;
  address: PlaceAddress;
}

export function formatAddress(a: PlaceAddress | null): string {
  if (!a) return "";
  return [a.street, [a.postalCode, a.locality].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}
