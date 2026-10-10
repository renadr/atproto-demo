import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getAccountHandle } from "@/lib/db/queries";
import { getLists, getPlaces } from "@/lib/places";
import { PlacesApp } from "@/components/places/PlacesApp";

export default async function PlacesPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Mes adresses</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Connecte-toi pour enregistrer des lieux dans ton repo atproto.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const [places, lists, handle] = await Promise.all([
    getPlaces(session.did),
    getLists(session.did),
    getAccountHandle(session.did),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-7xl p-4">
        <header className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Mes adresses</h1>
            <p className="text-sm text-zinc-500">
              Stockées dans le repo de @{handle ?? session.did} (
              <code>xyz.atmap.place</code>, <code>xyz.atmap.list</code>)
            </p>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Statusphere
          </Link>
        </header>
        <PlacesApp places={places} lists={lists} />
      </main>
    </div>
  );
}
