"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sfx } from "@/lib/sfx";

type Result = { name: string; takes: number; approved: number; error?: string };

/** Offers to move projects saved on this computer (pre-accounts) into the signed-in account. */
export function LocalImport({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    sfx("loading", 0.7);
    const res = await fetch("/api/import-local", { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      sfx("error");
      return setError(json.error);
    }
    setResults(json);
    sfx(json.some((r: Result) => r.error) ? "error" : "success");
    router.refresh();
  }

  return (
    <section className="card mb-6 border-accent-200 bg-accent-50/60 p-5">
      <h2 className="font-semibold text-stone-900">
        {count} {count === 1 ? "projeto salvo" : "projetos salvos"} neste computador
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Eles foram criados antes das contas existirem. Importar leva as frases, todos os takes e as aprovações para a sua conta e para o
        storage. Os arquivos locais são movidos para <code className="rounded bg-white/70 px-1 text-xs">data/projects-imported/</code>, nada é apagado.
      </p>
      {results ? (
        <ul className="mt-3 space-y-1 text-sm">
          {results.map((r) => (
            <li key={r.name} className={r.error ? "text-rose-700" : "text-stone-700"}>
              {r.error ? `✕ ${r.name}: ${r.error}` : `✓ ${r.name}: ${r.takes} takes, ${r.approved} aprovados`}
            </li>
          ))}
        </ul>
      ) : (
        <button onClick={run} disabled={busy} className="btn-primary mt-3">
          {busy ? "Importando… (enviando os áudios)" : "Importar para minha conta"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
