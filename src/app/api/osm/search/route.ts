import { NextRequest, NextResponse } from "next/server";
import type { OsmResult } from "@/lib/places/types";

// Server-side proxy to Nominatim so we can send an identifying User-Agent,
// as required by https://operations.osmfoundation.org/policies/nominatim/
// (max 1 req/s — the client debounces searches).
const NOMINATIM_URL =
  process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT || "atproto-demo-places/0.1 (POC)";

interface NominatimResult {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category: string;
  type: string;
  address?: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL("/search", NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");
  // Bias results towards the visible map area when provided.
  const viewbox = params.get("viewbox");
  if (viewbox) url.searchParams.set("viewbox", viewbox);
  const lang = request.headers.get("accept-language");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        ...(lang ? { "Accept-Language": lang } : {}),
      },
    });
  } catch (error) {
    console.error("Nominatim fetch error:", error);
    return NextResponse.json({ error: "Nominatim unreachable" }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `Nominatim error ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as NominatimResult[];
  const results: OsmResult[] = data
    .filter((r) => ["node", "way", "relation"].includes(r.osm_type))
    .map((r) => {
      const a = r.address ?? {};
      return {
        osm: { type: r.osm_type as OsmResult["osm"]["type"], id: r.osm_id },
        name: r.name || r.display_name.split(",")[0],
        displayName: r.display_name,
        category: guessCategory(r.category, r.type),
        latitude: r.lat,
        longitude: r.lon,
        address: {
          street: [a.house_number, a.road].filter(Boolean).join(" ") || undefined,
          postalCode: a.postcode,
          locality: a.city || a.town || a.village || a.municipality,
          region: a.state,
          country: a.country_code?.toUpperCase(),
        },
      };
    });

  return NextResponse.json({ results });
}

function guessCategory(osmClass: string, osmType: string): string {
  if (osmClass === "amenity") {
    if (["restaurant", "fast_food", "food_court"].includes(osmType))
      return "restaurant";
    if (["cafe", "ice_cream"].includes(osmType)) return "cafe";
    if (["bar", "pub", "biergarten", "nightclub"].includes(osmType))
      return "bar";
    if (osmType === "cinema") return "cinema";
    if (["place_of_worship", "townhall"].includes(osmType))
      return "architecture";
  }
  if (["historic", "building", "man_made"].includes(osmClass))
    return "architecture";
  if (
    osmClass === "tourism" &&
    ["attraction", "artwork", "museum"].includes(osmType)
  )
    return "architecture";
  return "other";
}
