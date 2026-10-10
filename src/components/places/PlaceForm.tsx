"use client";

import { useState } from "react";
import { CATEGORIES, type ListView } from "@/lib/places/types";

export interface PlaceFormValues {
  name: string;
  category: string;
  tags: string[];
  lists: string[];
  note: string;
}

interface PlaceFormProps {
  initial: PlaceFormValues;
  lists: ListView[];
  submitLabel: string;
  onSubmit: (values: PlaceFormValues) => Promise<void>;
  onCancel: () => void;
}

export function PlaceForm({
  initial,
  lists,
  submitLabel,
  onSubmit,
  onCancel,
}: PlaceFormProps) {
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [selectedLists, setSelectedLists] = useState(initial.lists);
  const [note, setNote] = useState(initial.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name,
        category,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        lists: selectedLists,
        note,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSaving(false);
    }
  }

  function toggleList(uri: string) {
    setSelectedLists((cur) =>
      cur.includes(uri) ? cur.filter((u) => u !== uri) : [...cur, uri],
    );
  }

  const input =
    "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        className={input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom"
        required
      />
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`px-2 py-1 rounded-full text-sm border ${
              category === c.value
                ? "bg-blue-100 dark:bg-blue-900 border-blue-500"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <input
        className={input}
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        placeholder="Tags, séparés par des virgules (terrasse, date, brunch)"
      />
      {lists.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {lists.map((l) => (
            <label key={l.uri} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selectedLists.includes(l.uri)}
                onChange={() => toggleList(l.uri)}
              />
              {l.name}
            </label>
          ))}
        </div>
      )}
      <textarea
        className={input}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)"
        rows={2}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {saving ? "Enregistrement..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="py-2 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
