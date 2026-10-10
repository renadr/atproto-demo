import { NextRequest, NextResponse } from "next/server";
import { getLexClient } from "@/lib/auth/lex-client";
import { LIST_NSID, indexList, unindexList } from "@/lib/places";
import * as xyz from "@/lexicons/xyz";

export async function POST(request: NextRequest) {
  const auth = await getLexClient();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = xyz.atmap.list.$safeParse({
    $type: LIST_NSID,
    name: typeof body.name === "string" ? body.name.trim() : "",
    description:
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : undefined,
    createdAt: new Date().toISOString(),
  });
  if (!parsed.success || !parsed.value.name) {
    return NextResponse.json(
      { error: parsed.success ? "Name is required" : parsed.message },
      { status: 400 },
    );
  }
  const res = await auth.client.create(xyz.atmap.list, parsed.value);
  await indexList(res.uri, res.cid, parsed.value);
  return NextResponse.json({ uri: res.uri });
}

// Deleting a list leaves AT-URI references to it in place records, as is
// normal on atproto (references can dangle); the UI ignores unknown lists.
export async function DELETE(request: NextRequest) {
  const auth = await getLexClient();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rkey } = await request.json();
  if (typeof rkey !== "string") {
    return NextResponse.json({ error: "rkey is required" }, { status: 400 });
  }
  await auth.client.delete(xyz.atmap.list, { rkey });
  await unindexList(`at://${auth.did}/${LIST_NSID}/${rkey}`);
  return NextResponse.json({ success: true });
}
