import { AtUri } from "@atproto/syntax";
import type { Client } from "@atproto/lex";
import { getDb } from "@/lib/db";
import * as xyz from "@/lexicons/xyz";
import type { ListView, PlaceView } from "./types";

export const PLACE_NSID = xyz.atmap.place.$nsid;
export const LIST_NSID = xyz.atmap.list.$nsid;

// --- Indexing: turn repo records into index rows -------------------------
// Called both from the Tap webhook and right after our own writes, so the
// UI doesn't have to wait for the firehose. All writes are idempotent upserts
// keyed by AT-URI.

export async function indexPlace(
  uri: string,
  cid: string | null,
  record: xyz.atmap.place.Main,
) {
  const { host: authorDid, rkey } = new AtUri(uri);
  const row = {
    uri,
    cid,
    authorDid,
    rkey,
    name: record.name,
    category: record.category,
    latitude: record.location.latitude,
    longitude: record.location.longitude,
    address: record.address ? JSON.stringify(record.address) : null,
    osmType: record.osm?.type ?? null,
    osmId: record.osm?.id ?? null,
    tags: JSON.stringify(record.tags ?? []),
    lists: JSON.stringify(record.lists ?? []),
    note: record.note ?? null,
    createdAt: record.createdAt,
    indexedAt: new Date().toISOString(),
  };
  await getDb()
    .insertInto("place")
    .values(row)
    .onConflict((oc) => oc.column("uri").doUpdateSet(row))
    .execute();
}

export async function indexList(
  uri: string,
  cid: string | null,
  record: xyz.atmap.list.Main,
) {
  const { host: authorDid, rkey } = new AtUri(uri);
  const row = {
    uri,
    cid,
    authorDid,
    rkey,
    name: record.name,
    description: record.description ?? null,
    createdAt: record.createdAt,
    indexedAt: new Date().toISOString(),
  };
  await getDb()
    .insertInto("place_list")
    .values(row)
    .onConflict((oc) => oc.column("uri").doUpdateSet(row))
    .execute();
}

export async function unindexPlace(uri: string) {
  await getDb().deleteFrom("place").where("uri", "=", uri).execute();
}

export async function unindexList(uri: string) {
  await getDb().deleteFrom("place_list").where("uri", "=", uri).execute();
}

// Rebuild a user's index straight from their repo. Useful when Tap isn't
// running or hasn't backfilled the account yet.
export async function resyncFromRepo(did: string, client: Client) {
  const db = getDb();
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom("place").where("authorDid", "=", did).execute();
    await tx.deleteFrom("place_list").where("authorDid", "=", did).execute();
  });
  let places = 0;
  let lists = 0;
  for await (const item of client.listAll(xyz.atmap.list)) {
    if (!item.valid) continue;
    await indexList(item.uri, item.cid, item.value);
    lists++;
  }
  for await (const item of client.listAll(xyz.atmap.place)) {
    if (!item.valid) continue;
    await indexPlace(item.uri, item.cid, item.value);
    places++;
  }
  return { places, lists };
}

// --- Queries --------------------------------------------------------------

export async function getPlaces(did: string): Promise<PlaceView[]> {
  const rows = await getDb()
    .selectFrom("place")
    .selectAll()
    .where("authorDid", "=", did)
    .orderBy("createdAt", "desc")
    .execute();
  return rows.map((r) => ({
    uri: r.uri,
    rkey: r.rkey,
    name: r.name,
    category: r.category,
    latitude: r.latitude,
    longitude: r.longitude,
    address: r.address ? JSON.parse(r.address) : null,
    osm:
      r.osmType && r.osmId ? { type: r.osmType, id: Number(r.osmId) } : null,
    tags: JSON.parse(r.tags),
    lists: JSON.parse(r.lists),
    note: r.note,
    createdAt: r.createdAt,
  }));
}

export async function getLists(did: string): Promise<ListView[]> {
  const rows = await getDb()
    .selectFrom("place_list")
    .selectAll()
    .where("authorDid", "=", did)
    .orderBy("createdAt", "asc")
    .execute();
  return rows.map((r) => ({
    uri: r.uri,
    rkey: r.rkey,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt,
  }));
}
