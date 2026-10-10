import { Client } from "@atproto/lex";
import { getSession } from "./session";

// Returns a lex Client acting on the signed-in user's repo, or null.
export async function getLexClient() {
  const session = await getSession();
  if (!session) return null;
  return { did: session.did, client: new Client(session) };
}
