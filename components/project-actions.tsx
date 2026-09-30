"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";

export async function renameProject(id: string, name: string) {
  const res = await fetch(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error((await res.json()).error ?? "Não foi possível renomear.");
}

/**
 * "⋯" menu with Rename and Delete. Deleting is permanent (rows, every take and its audio in
 * Storage), so it always goes through a confirmation that says exactly that.
 */
export function ProjectMenu({
  id,
  name,
  onRenamed,
  onDeleted,
  className = "",
}: {
  id: string;
  name: string;
  onRenamed?: (name: string) => void;
  onDeleted?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-stone-50";
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Ações do projeto ${name}`}
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-800 active:scale-90"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-1 w-44 origin-top-right rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-900/10"
          style={{ animation: "modal-in 150ms cubic-bezier(0.2,0.9,0.3,1)" }}
        >
          <button role="menuitem" className={item} onClick={() => { setOpen(false); setDialog("rename"); sfx("page", 0.7); }}>
            <svg viewBox="0 0 16 16" className="size-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden><path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5Z" /></svg>
            Renomear
          </button>
          <button role="menuitem" className={`${item} text-rose-600 hover:bg-rose-50`} onClick={() => { setOpen(false); setDialog("delete"); sfx("page", 0.7); }}>
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg>
            Excluir
          </button>
        </div>
      )}

      {dialog === "rename" && (
        <RenameDialog
          name={name}
          onClose={() => setDialog(null)}
          onSave={async (next) => {
            await renameProject(id, next);
            sfx("success");
            setDialog(null);
            onRenamed?.(next);
            router.refresh();
          }}
        />
      )}
      {dialog === "delete" && (
        <DeleteDialog
          name={name}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error((await res.json()).error ?? "Não foi possível excluir.");
            sfx("release");
            setDialog(null);
            if (onDeleted) onDeleted();
            else router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-stone-800 shadow-2xl shadow-stone-900/20 open:animate-[modal-in_200ms_cubic-bezier(0.2,0.9,0.3,1)]"
    >
      {children}
    </dialog>
  );
}

function RenameDialog({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();
  return (
    <Modal onClose={onClose}>
      <form
        className="p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!trimmed || trimmed === name) return onClose();
          setBusy(true);
          try {
            await onSave(trimmed);
          } catch (err) {
            sfx("error");
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <h2 className="text-lg font-semibold tracking-tight">Renomear projeto</h2>
        <p className="mt-1 text-sm text-stone-500">O ZIP exportado passa a usar o novo nome.</p>
        <input
          autoFocus
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="input mt-4 w-full"
          aria-label="Nome do projeto"
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={busy || !trimmed} className="btn-primary">{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold tracking-tight">Excluir “{name}”?</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Apaga para sempre as frases, todos os takes e os áudios deste projeto. Não dá para desfazer. Arquivos já enviados ao Google Drive continuam lá.
        </p>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus onClick={onClose} className="btn-ghost">Cancelar</button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } catch (err) {
                sfx("error");
                setError((err as Error).message);
                setBusy(false);
              }
            }}
            className="btn-primary bg-rose-600 hover:bg-rose-700"
          >
            {busy ? "Excluindo…" : "Excluir projeto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
