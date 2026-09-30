"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { sfx } from "@/lib/sfx";
import { buildProject, guessRoles, readWorkbook, splitHeader, type ColumnRole, type Grid } from "@/lib/sheet";

export function Importer() {
  const router = useRouter();
  const [grid, setGrid] = useState<Grid | null>(null);
  const [sheet, setSheet] = useState("");
  const [name, setName] = useState("");
  const [paste, setPaste] = useState("");
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { header, body } = useMemo(() => (grid && sheet ? splitHeader(grid.read(sheet)) : { header: [], body: [] }), [grid, sheet]);

  function load(next: Grid, fileName: string) {
    setError(null);
    sfx("chime");
    setGrid(next);
    // Prefer the sheet that looks like it has language columns ("Frases Únicas" in the example workbook).
    const pick =
      next.sheets.find((s) => splitHeader(next.read(s)).header.filter((h) => /\([a-z]{2,3}\)\s*$/i.test(h)).length >= 2) ??
      next.sheets[0];
    selectSheet(next, pick);
    setName((n) => n || fileName.replace(/\.[^.]+$/, ""));
  }

  function selectSheet(g: Grid, s: string) {
    setSheet(s);
    const { header, body } = splitHeader(g.read(s));
    setRoles(guessRoles(header, body));
  }

  async function onFile(file: File) {
    try {
      load(readWorkbook(await file.arrayBuffer()), file.name);
    } catch (e) {
      sfx("error");
      setError(`Não consegui ler o arquivo: ${(e as Error).message}`);
    }
  }

  function onPaste() {
    if (!paste.trim()) return;
    load(readWorkbook(paste), "Frases coladas");
  }

  const project = useMemo(
    () => (header.length ? buildProject(name.trim() || "Projeto", header, body, roles) : null),
    [header, body, roles, name],
  );

  async function create() {
    if (!project) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/projects", { method: "POST", body: JSON.stringify(project) });
    const json = await res.json();
    if (!res.ok) {
      setSaving(false);
      sfx("error");
      return setError(json.error);
    }
    sfx("arrival");
    router.push(`/dashboard/projects/${json.id}`);
  }

  function setRole(i: number, role: ColumnRole) {
    setRoles((prev) => prev.map((r, j) => (j === i ? role : role.kind === "id" && r.kind === "id" ? { kind: "meta" } : r)));
  }

  return (
    <section className="card p-6">
      <h2 className="text-base font-semibold tracking-tight text-stone-900">Novo projeto</h2>
      <p className="mt-0.5 text-sm text-stone-500">Uma linha por ID de áudio, uma coluna por idioma.</p>
      {!grid ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label
            className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-accent-200 bg-accent-50/40 p-6 text-center text-sm transition hover:border-accent-400 hover:bg-accent-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
          >
            <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-white text-accent-600 shadow-sm"><svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg></span>
            <span className="font-medium text-stone-800">Arraste a planilha aqui ou clique</span>
            <span className="text-stone-500">.xlsx, .xls, .csv ou .ods — exporte do Google Sheets em Arquivo → Fazer download</span>
            <input type="file" className="sr-only" accept=".xlsx,.xls,.csv,.ods,.tsv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <div className="flex flex-col gap-2">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onPaste={(e) => {
                // Sheets copies the sheet's empty rows/columns too (lines of bare tabs), which leaves the
                // textarea scrolled to a blank end. Clean it and go straight to the preview.
                e.preventDefault();
                const cleaned = cleanPasted(e.clipboardData.getData("text"));
                setPaste(cleaned);
                if (cleaned.includes("\t") && cleaned.includes("\n")) load(readWorkbook(cleaned), "Frases coladas");
              }}
              placeholder={"…ou cole as células direto do Sheets (com o cabeçalho):\nID do Áudio\tPortuguês (PT)\tInglês (EN)\nPERG_001\tQuanto é…\tHow much…"}
              className="input min-h-32 flex-1 resize-y p-3 font-mono text-xs whitespace-pre [tab-size:4]"
            />
            <button onClick={onPaste} disabled={!paste.trim()} className="btn-secondary self-end">
              Usar texto colado
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-500">Nome do projeto</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input w-72" />
            </label>
            {grid.sheets.length > 1 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-stone-500">Aba</span>
                <select value={sheet} onChange={(e) => selectSheet(grid, e.target.value)} className="input">
                  {grid.sheets.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={() => setGrid(null)} className="btn-ghost ml-auto">
              Trocar arquivo
            </button>
          </div>

          <p className="text-sm text-stone-500">
            Confira o papel de cada coluna. Colunas de idioma viram áudios; a coluna ID vira o nome da pasta.
          </p>
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/80">
                <tr>
                  {header.map((h, i) => (
                    <th key={i} className="min-w-44 border-b border-stone-200 p-2 align-top font-medium">
                      <div className="mb-1.5 truncate">{h}</div>
                      <RoleSelect role={roles[i]} onChange={(r) => setRole(i, r)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.slice(0, 5).map((r, n) => (
                  <tr key={n} className="border-b border-stone-100 last:border-0">
                    {header.map((_, i) => (
                      <td key={i} className={`max-w-64 truncate p-2 ${roles[i]?.kind === "ignore" ? "text-stone-400 line-through" : ""}`}>
                        {r[i]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {project && (
                <>
                  <b>{project.rows.length}</b> frases × <b>{project.languages.length}</b> idiomas ={" "}
                  <b>{project.rows.reduce((n, r) => n + Object.keys(r.texts).length, 0)}</b> áudios
                </>
              )}
            </p>
            <button onClick={create} disabled={saving || !project?.rows.length || !project.languages.length} className="btn-primary">
              {saving ? "Criando…" : "Criar projeto"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </section>
  );
}

/** Drops trailing empty cells on each line and blank lines (Sheets pastes its whole used range). */
export function cleanPasted(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/, ""))
    .filter((line) => line.trim())
    .join("\n");
}

function RoleSelect({ role, onChange }: { role: ColumnRole; onChange: (r: ColumnRole) => void }) {
  return (
    <div className="flex gap-1">
      <select
        value={role.kind}
        onChange={(e) => {
          const kind = e.target.value as ColumnRole["kind"];
          onChange(kind === "lang" ? { kind, code: "" } : { kind });
        }}
        className="input py-1 text-xs font-normal"
      >
        <option value="id">ID do áudio</option>
        <option value="lang">Idioma</option>
        <option value="meta">Informação</option>
        <option value="ignore">Ignorar</option>
      </select>
      {role.kind === "lang" && (
        <input
          value={role.code}
          onChange={(e) => onChange({ kind: "lang", code: e.target.value })}
          placeholder="pt"
          title="Código ISO 639-1 (pt, en, es, ar…)"
          className="input w-12 py-1 text-xs font-normal"
        />
      )}
    </div>
  );
}
