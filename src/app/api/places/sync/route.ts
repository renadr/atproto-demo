import { NextResponse } from "next/server";
import { getLexClient } from "@/lib/auth/lex-client";
import { resyncFromRepo } from "@/lib/places";

// Re-reads the user's xyz.atmap.* collections from their PDS and rebuilds
// the local index for that account.
export async function POST() {
  const auth = await getLexClient();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const counts = await resyncFromRepo(auth.did, auth.client);
  return NextResponse.json(counts);
}
