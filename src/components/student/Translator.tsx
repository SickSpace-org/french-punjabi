"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { requestTranslation } from "@/app/student/(portal)/quiz/actions";
import type { Translation } from "@/lib/quiz/translate";

export default function Translator() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Translation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setError(null);
    const response = await requestTranslation(text);
    setLoading(false);

    if (!response.ok) {
      setError(response.error);
      setResult(null);
      return;
    }
    setResult(response.translation);
  }

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
        <Languages className="h-5 w-5" />
        Translator
      </h2>
      <p className="mt-1 text-sm text-navy/60">Look up any English word or phrase in French.</p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder="e.g. good morning"
          className="flex-1 rounded-xl border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-red/50"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-dark disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Translate"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red">{error}</p>}

      {result && (
        <div className="mt-4 rounded-xl bg-cream-dim p-4">
          <p className="font-display text-lg font-bold text-navy">{result.translation}</p>
          <p className="mt-1 text-sm text-navy/60">{result.example}</p>
        </div>
      )}
    </div>
  );
}
