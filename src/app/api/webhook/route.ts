import { NextRequest, NextResponse } from "next/server";
import { parseTapEvent, assureAdminAuth } from "@atproto/tap";
import { AtUri } from "@atproto/syntax";
import {
  upsertAccount,
  insertStatus,
  deleteStatus,
  deleteAccount,
} from "@/lib/db/queries";
import {
  indexList,
  indexPlace,
  unindexList,
  unindexPlace,
} from "@/lib/places";
import * as xyz from "@/lexicons/xyz";

const TAP_ADMIN_PASSWORD = process.env.TAP_ADMIN_PASSWORD;

export async function POST(request: NextRequest) {
  // Verify request is from our TAP server
  if (TAP_ADMIN_PASSWORD) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      assureAdminAuth(TAP_ADMIN_PASSWORD, authHeader);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json();
  const evt = parseTapEvent(body);

  // Handle account/identity changes
  if (evt.type === "identity") {
    if (evt.status === "deleted") {
      await deleteAccount(evt.did);
    } else {
      await upsertAccount({
        did: evt.did,
        handle: evt.handle,
        active: evt.isActive ? 1 : 0,
      });
    }
  }

  // Handle place / list record changes
  if (
    evt.type === "record" &&
    (evt.collection === xyz.atmap.place.$nsid ||
      evt.collection === xyz.atmap.list.$nsid)
  ) {
    const uri = AtUri.make(evt.did, evt.collection, evt.rkey).toString();
    const isPlace = evt.collection === xyz.atmap.place.$nsid;

    if (evt.action === "create" || evt.action === "update") {
      const parsed = isPlace
        ? xyz.atmap.place.$safeParse(evt.record)
        : xyz.atmap.list.$safeParse(evt.record);
      if (!parsed.success) {
        return NextResponse.json({ success: false });
      }
      if (isPlace) {
        await indexPlace(uri, evt.cid ?? null, parsed.value as xyz.atmap.place.Main);
      } else {
        await indexList(uri, evt.cid ?? null, parsed.value as xyz.atmap.list.Main);
      }
    } else if (evt.action === "delete") {
      await (isPlace ? unindexPlace(uri) : unindexList(uri));
    }
  }

  // Handle status record changes
  if (evt.type === "record" && evt.collection === xyz.statusphere.status.$nsid) {
    const uri = AtUri.make(evt.did, evt.collection, evt.rkey);

    if (evt.action === "create" || evt.action === "update") {
      let record: xyz.statusphere.status.Main;
      try {
        record = xyz.statusphere.status.$parse(evt.record);
      } catch {
        return NextResponse.json({ success: false });
      }

      await insertStatus({
        uri: uri.toString(),
        authorDid: evt.did,
        status: record.status,
        createdAt: record.createdAt,
        indexedAt: new Date().toISOString(),
        current: 1,
      });
    } else if (evt.action === "delete") {
      await deleteStatus(uri);
    }
  }

  return NextResponse.json({ success: true });
}
