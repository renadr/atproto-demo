"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  categoryInfo,
  formatAddress,
  type ListView,
  type OsmResult,
  type PlaceView,
} from "@/lib/places/types";
import { PlaceForm, type PlaceFormValues } from "./PlaceForm";

// Leaflet touches `window`, so the map only renders in the browser.
const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-sm text-zinc-500">
      Chargement de la carte…
    </div>
  ),
});

interface PlacesAppProps {
  places: PlaceView[];
  lists: ListView[];
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const card =
  "bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4";
const input =
  "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm";

export function PlacesApp({ places, lists }: PlacesAppProps) {
  const router = useRouter();

  // OSM search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OsmResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<OsmResult | null>(null);
  const viewboxRef = useRef("");

  // Selection / editing
  const [focusUri, setFocusUri] = useState<string | null>(null);
  const [editingUri, setEditingUri] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [newListName, setNewListName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced Nominatim search (their policy allows max 1 req/s).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q });
        if (viewboxRef.current) params.set("viewbox", viewboxRef.current);
        const res = await fetch(`/api/osm/search?${params}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        // aborted or network error: keep previous results
      } finally {
        setSearching(false);
      }
    }, 1000);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const listNames = useMemo(
    () => new Map(lists.map((l) => [l.uri, l.name])),
    [lists],
  );
  const allTags = useMemo(
    () => [...new Set(places.flatMap((p) => p.tags))].sort(),
    [places],
  );
  const filtered = useMemo(
    () =>
      places.filter(
        (p) =>
          (!category || p.category === category) &&
          (!listFilter || p.lists.includes(listFilter)) &&
          (!tagFilter || p.tags.includes(tagFilter)),
      ),
    [places, category, listFilter, tagFilter],
  );

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(values: PlaceFormValues) {
    if (!draft) return;
    await api("/api/places", "POST", {
      ...values,
      latitude: draft.latitude,
      longitude: draft.longitude,
      address: draft.address,
      osm: draft.osm,
    });
    setDraft(null);
    setQuery("");
    setResults([]);
    router.refresh();
  }

  async function saveEdit(rkey: string, values: PlaceFormValues) {
    await api("/api/places", "PATCH", { rkey, ...values });
    setEditingUri(null);
    router.refresh();
  }

  const chip = (active: boolean) =>
    `px-2 py-1 rounded-full text-xs border ${
      active
        ? "bg-blue-100 dark:bg-blue-900 border-blue-500"
        : "border-zinc-300 dark:border-zinc-700"
    }`;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        {/* Search OSM */}
        <section className={card}>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            Ajouter une adresse depuis OpenStreetMap
          </h2>
          <input
            className={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDraft(null);
              if (e.target.value.trim().length < 3) setResults([]);
            }}
            placeholder="ex : Café de Flore, Paris"
          />
          {searching && (
            <p className="text-xs text-zinc-500 mt-2">Recherche…</p>
          )}
          {!draft && results.length > 0 && (
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((r) => (
                <li key={`${r.osm.type}/${r.osm.id}`}>
                  <button
                    onClick={() => setDraft(r)}
                    className="w-full text-left py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1"
                  >
                    <span className="mr-1">
                      {categoryInfo(r.category).emoji}
                    </span>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-zinc-500 truncate">
                      {r.displayName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draft && (
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-2">{draft.displayName}</p>
              <PlaceForm
                key={`${draft.osm.type}/${draft.osm.id}`}
                initial={{
                  name: draft.name,
                  category: draft.category,
                  tags: [],
                  lists: listFilter ? [listFilter] : [],
                  note: "",
                }}
                lists={lists}
                submitLabel="Enregistrer dans mon repo"
                onSubmit={saveDraft}
                onCancel={() => setDraft(null)}
              />
            </div>
          )}
        </section>

        {/* Lists */}
        <section className={card}>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            Mes listes
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              className={chip(listFilter === null)}
              onClick={() => setListFilter(null)}
            >
              Toutes ({places.length})
            </button>
            {lists.map((l) => (
              <span key={l.uri} className="inline-flex items-center">
                <button
                  className={chip(listFilter === l.uri)}
                  onClick={() =>
                    setListFilter(listFilter === l.uri ? null : l.uri)
                  }
                >
                  {l.name} (
                  {places.filter((p) => p.lists.includes(l.uri)).length})
                </button>
                <button
                  title="Supprimer la liste"
                  disabled={busy}
                  className="ml-1 text-xs text-zinc-400 hover:text-red-500"
                  onClick={() => {
                    if (!confirm(`Supprimer la liste « ${l.name} » ?`)) return;
                    if (listFilter === l.uri) setListFilter(null);
                    run(() => api("/api/lists", "DELETE", { rkey: l.rkey }));
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newListName.trim();
              if (!name) return;
              run(async () => {
                await api("/api/lists", "POST", { name });
                setNewListName("");
              });
            }}
          >
            <input
              className={input}
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nouvelle liste (ex : Brunchs à Lyon)"
            />
            <button
              type="submit"
              disabled={busy || !newListName.trim()}
              className="px-3 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              Créer
            </button>
          </form>
        </section>

        {/* Filters + places */}
        <section className={card}>
          <div className="flex flex-wrap gap-1 mb-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={chip(category === c.value)}
                onClick={() =>
                  setCategory(category === c.value ? null : c.value)
                }
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {allTags.map((t) => (
                <button
                  key={t}
                  className={chip(tagFilter === t)}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {places.length === 0
                ? "Aucune adresse pour l'instant. Cherche un lieu ci-dessus."
                : "Aucune adresse ne correspond aux filtres."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((p) => (
                <li
                  key={p.uri}
                  className={`py-3 ${focusUri === p.uri ? "bg-blue-50 dark:bg-blue-950 -mx-2 px-2 rounded" : ""}`}
                >
                  {editingUri === p.uri ? (
                    <PlaceForm
                      initial={{
                        name: p.name,
                        category: p.category,
                        tags: p.tags,
                        lists: p.lists,
                        note: p.note ?? "",
                      }}
                      lists={lists}
                      submitLabel="Mettre à jour"
                      onSubmit={(v) => saveEdit(p.rkey, v)}
                      onCancel={() => setEditingUri(null)}
                    />
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <button
                          className="text-left flex-1"
                          onClick={() => setFocusUri(p.uri)}
                        >
                          <span className="mr-1">
                            {categoryInfo(p.category).emoji}
                          </span>
                          <span className="font-medium text-sm">{p.name}</span>
                          <span className="block text-xs text-zinc-500">
                            {formatAddress(p.address)}
                          </span>
                        </button>
                        <button
                          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                          onClick={() => setEditingUri(p.uri)}
                        >
                          Modifier
                        </button>
                        <button
                          className="text-xs text-zinc-500 hover:text-red-500"
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(`Supprimer « ${p.name} » ?`)) return;
                            run(() =>
                              api("/api/places", "DELETE", { rkey: p.rkey }),
                            );
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.lists
                          .filter((u) => listNames.has(u))
                          .map((u) => (
                            <span
                              key={u}
                              className="text-xs px-2 rounded-full bg-zinc-100 dark:bg-zinc-800"
                            >
                              {listNames.get(u)}
                            </span>
                          ))}
                        {p.tags.map((t) => (
                          <span key={t} className="text-xs text-blue-600">
                            #{t}
                          </span>
                        ))}
                      </div>
                      {p.note && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                          {p.note}
                        </p>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          disabled={busy}
          onClick={() => run(() => api("/api/places/sync", "POST"))}
          title="Relit les collections xyz.atmap.* depuis ton PDS et reconstruit l'index local"
        >
          ↻ Resynchroniser depuis mon PDS
        </button>
      </div>

      <div className="h-[60vh] lg:h-[calc(100vh-8rem)] rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 lg:sticky lg:top-4">
        <PlacesMap
          places={filtered}
          draft={draft}
          focusUri={focusUri}
          onSelect={setFocusUri}
          onViewboxChange={(vb) => {
            viewboxRef.current = vb;
          }}
        />
      </div>
    </div>
  );
}
