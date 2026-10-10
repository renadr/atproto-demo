import { NextRequest, NextResponse } from "next/server";
import { getLexClient } from "@/lib/auth/lex-client";
import { PLACE_NSID, indexPlace, unindexPlace } from "@/lib/places";
import * as xyz from "@/lexicons/xyz";

type PlaceRecord = xyz.atmap.place.Main;

// Builds and validates a place record from a JSON body. Returns an error
// message when the input doesn't match the xyz.atmap.place lexicon.
function buildRecord(
  body: Record<string, unknown>,
  createdAt: string,
): { record: PlaceRecord } | { error: string } {
  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: "Invalid coordinates" };
  }
  const tags = Array.isArray(body.tags)
    ? [
        ...new Set(
          body.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        ),
      ]
    : [];
  const candidate = {
    $type: PLACE_NSID,
    name: typeof body.name === "string" ? body.name.trim() : "",
    category: typeof body.category === "string" ? body.category : "other",
    // Store a fixed precision (~1cm) as strings: the atproto data model has no floats.
    location: { latitude: lat.toFixed(7), longitude: lon.toFixed(7) },
    address: cleanObject(body.address),
    osm: body.osm ?? undefined,
    tags: tags.length ? tags : undefined,
    lists:
      Array.isArray(body.lists) && body.lists.length ? body.lists : undefined,
    note:
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim()
        : undefined,
    createdAt,
  };
  const parsed = xyz.atmap.place.$safeParse(candidate);
  if (!parsed.success) return { error: parsed.message };
  return { record: parsed.value };
}

function cleanObject(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value).filter(
    ([, v]) => typeof v === "string" && v.trim() !== "",
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

// Create a place in the user's repo.
export async function POST(request: NextRequest) {
  const auth = await getLexClient();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const built = buildRecord(await request.json(), new Date().toISOString());
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const res = await auth.client.create(xyz.atmap.place, built.record);
  await indexPlace(res.uri, res.cid, built.record);
  return NextResponse.json({ uri: res.uri });
}

// Update a place (full record replacement, keeping its original createdAt).
export async function PATCH(request: NextRequest) {
  const auth = await getLexClient();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (typeof body.rkey !== "string") {
    return NextResponse.json({ error: "rkey is required" }, { status: 400 });
  }
  const existing = await auth.client.get(xyz.atmap.place, { rkey: body.rkey });
  const built = buildRecord(
    { ...existing.value, ...existing.value.location, ...body },
    existing.value.createdAt,
  );
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const res = await auth.client.put(xyz.atmap.place, built.record, {
    rkey: body.rkey,
    swapRecord: existing.cid,
  });
  await indexPlace(res.uri, res.cid, built.record);
  return NextResponse.json({ uri: res.uri });
}

export async function DELETE(request: NextRequest) {
  const auth = await getLexClient();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rkey } = await request.json();
  if (typeof rkey !== "string") {
    return NextResponse.json({ error: "rkey is required" }, { status: 400 });
  }
  await auth.client.delete(xyz.atmap.place, { rkey });
  await unindexPlace(`at://${auth.did}/${PLACE_NSID}/${rkey}`);
  return NextResponse.json({ success: true });
}
