"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import type { DriveStatus } from "@/lib/types";

/** Polls the project's Drive status: faster while a sync is catching up, slower when idle. */
export function useDriveStatus(projectId: string) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/drive`, { cache: "no-store" });
    if (res.ok) setStatus(await res.json());
  }, [projectId]);

  const pending = !!status?.link && (status.syncing || status.synced < status.approved);
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, pending ? 2000 : 8000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh, pending]);

  return { status, setStatus, refresh };
}

/** Header button: shows where the Drive mirror stands at a glance. */
export function DriveChip({ status, onClick }: { status: DriveStatus | null; onClick: () => void }) {
  const link = status?.link;
  const behind = link ? status.approved - status.synced : 0;
  const state = !link ? "off" : link.lastError ? "error" : status.syncing || behind > 0 ? "syncing" : "ok";
  return (
    <button onClick={onClick} className="btn-secondary" title={link ? `Sincronizando com “${link.folderName}”` : "Sincronizar a saída com uma pasta do Google Drive"}>
      <DriveIcon />
      Drive
      {state === "syncing" && (
        <span className="flex items-center gap-1 text-xs tabular-nums text-stone-500">
          <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-stone-200 border-t-accent-500" />
          {status!.synced}/{status!.approved}
        </span>
      )}
      {state === "ok" && <span className="text-xs text-emerald-600 tabular-nums">✓ {status!.synced}</span>}
      {state === "error" && <span className="text-xs text-rose-600">erro</span>}
    </button>
  );
}

export function DriveModal({
  open,
  onClose,
  projectId,
  status,
  setStatus,
  refresh,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  status: DriveStatus | null;
  setStatus: (s: DriveStatus) => void;
  refresh: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function call(label: string, init: RequestInit & { url?: string } = {}) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(init.url ?? `/api/projects/${projectId}/drive`, init);
      const json = res.status === 204 ? null : await res.json();
      if (!res.ok) throw new Error(json?.error ?? res.statusText);
      if (json && "approved" in json) setStatus(json);
      return true;
    } catch (e) {
      setError((e as Error).message);
      sfx("error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const link = status?.link;
  const connectHref = `/api/drive/connect?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/dashboard" : window.location.pathname)}`;
  const origin = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl bg-white p-0 text-stone-800 shadow-2xl shadow-stone-900/20 open:animate-[modal-in_220ms_cubic-bezier(0.2,0.9,0.3,1)]"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-stone-100"><DriveIcon className="size-5" /></span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Google Drive</h2>
              <p className="text-sm text-stone-500">Cada take aprovado vai para a pasta escolhida, em &lt;ID&gt;/&lt;frase&gt;.mp3.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="btn-ghost size-9 rounded-full p-0">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="m4 4 8 8M12 4l-8 8" /></svg>
          </button>
        </header>

        <div className="space-y-5 overflow-y-auto px-6 py-5 text-sm">
          {!status ? (
            <p className="text-stone-500">Carregando…</p>
          ) : !status.configured ? (
            <Setup origin={origin} />
          ) : (
            <>
              {/* 1. Account */}
              <Step n={1} title="Conta Google" done={status.connected}>
                {status.connected ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-600">{status.email ?? "Conta conectada"}</span>
                    <button
                      disabled={!!busy}
                      onClick={async () => {
                        if (await call("disconnect", { url: "/api/drive", method: "DELETE" })) await refresh();
                      }}
                      className="btn-ghost px-2 text-xs"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <a href={connectHref} onPointerDown={() => sfx("press", 0.8)} className="btn-primary">
                    Conectar conta Google
                  </a>
                )}
              </Step>

              {/* 2. Folder */}
              <Step n={2} title="Pasta de destino" done={!!link} disabled={!status.connected}>
                {link && !changing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
                      <DriveIcon className="size-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{link.folderName}</div>
                        <a href={link.folderUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-700 hover:underline">
                          Abrir no Drive ↗
                        </a>
                      </div>
                      {link.isPublic ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">Pública</span>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">Privada</span>
                      )}
                    </div>
                    {!link.isPublic && (
                      <button
                        disabled={!!busy}
                        onClick={async () => {
                          if (await call("public", { method: "POST", body: JSON.stringify({ action: "public" }) })) sfx("toggle");
                        }}
                        className="btn-secondary w-full"
                      >
                        {busy === "public" ? "Publicando…" : "Tornar pública (qualquer pessoa com o link pode ver)"}
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setChanging(true)} className="btn-ghost px-2 text-xs">Trocar pasta</button>
                      <button
                        disabled={!!busy}
                        onClick={() => call("unlink", { method: "DELETE" })}
                        className="btn-ghost px-2 text-xs"
                        title="Os arquivos que já estão no Drive continuam lá"
                      >
                        Desvincular
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await call("link", { method: "PUT", body: JSON.stringify({ folder }) });
                      if (ok) {
                        sfx("success");
                        setChanging(false);
                        setFolder("");
                      }
                    }}
                    className="space-y-2"
                  >
                    <input
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/…"
                      disabled={!status.connected}
                      className="input w-full font-mono text-xs"
                    />
                    <p className="text-xs text-stone-400">Abra a pasta no Drive e copie o link da barra de endereço. Sua conta precisa poder editar a pasta.</p>
                    <div className="flex gap-2">
                      <button type="submit" disabled={!folder.trim() || !!busy || !status.connected} className="btn-primary">
                        {busy === "link" ? "Verificando…" : "Vincular pasta"}
                      </button>
                      {changing && (
                        <button type="button" onClick={() => setChanging(false)} className="btn-ghost">Cancelar</button>
                      )}
                    </div>
                  </form>
                )}
              </Step>

              {/* 3. Sync */}
              <Step n={3} title="Sincronização" done={!!link && status.synced === status.approved && !link.lastError} disabled={!link}>
                {link ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-600 tabular-nums">
                        {status.synced} de {status.approved} aprovados no Drive
                      </span>
                      <button
                        disabled={!!busy || status.syncing}
                        onClick={() => call("sync", { method: "POST", body: JSON.stringify({ action: "sync" }) })}
                        className="btn-secondary px-2.5 py-1 text-xs"
                      >
                        {busy === "sync" || status.syncing ? "Sincronizando…" : "Sincronizar agora"}
                      </button>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                        style={{ width: `${status.approved ? (status.synced / status.approved) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-stone-400">
                      Automática: aprovar envia, trocar o take aprovado substitui o arquivo, desaprovar manda para a lixeira do Drive.
                      {link.lastSyncAt && ` Última: ${new Date(link.lastSyncAt).toLocaleTimeString("pt-BR")}.`}
                    </p>
                    {link.lastError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{link.lastError}</p>}
                  </div>
                ) : (
                  <p className="text-stone-400">Vincule uma pasta para começar.</p>
                )}
              </Step>
            </>
          )}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{error}</p>}
        </div>
      </div>
    </dialog>
  );
}

function Step({ n, title, done, disabled, children }: { n: number; title: string; done?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <section className={`flex gap-3 ${disabled ? "pointer-events-none opacity-40" : ""}`}>
      <span
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? "bg-emerald-500 text-white" : "bg-stone-100 text-stone-600"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="mb-2 font-medium text-stone-900">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function Setup({ origin }: { origin: string }) {
  return (
    <div className="space-y-3">
      <p className="text-stone-600">Falta configurar o acesso ao Google, uma vez só:</p>
      <ol className="list-decimal space-y-2 pl-5 text-stone-600">
        <li>
          No{" "}
          <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="text-accent-700 underline">
            Google Cloud Console
          </a>
          , ative a <b>Google Drive API</b> num projeto.
        </li>
        <li>
          Em <b>APIs e serviços → Tela de consentimento OAuth</b>, crie o app como <b>Externo</b> e adicione seu e-mail como usuário de teste.
        </li>
        <li>
          Em <b>Credenciais → Criar credenciais → ID do cliente OAuth</b>, escolha <b>Aplicativo da Web</b> e adicione este URI de redirecionamento:
          <code className="mt-1 block rounded bg-stone-100 px-2 py-1 font-mono text-xs break-all">{origin}/api/drive/callback</code>
        </li>
        <li>
          Coloque no <code className="rounded bg-stone-100 px-1 font-mono text-xs">.env</code> e reinicie o <code className="font-mono text-xs">pnpm dev</code>:
          <code className="mt-1 block rounded bg-stone-100 px-2 py-1 font-mono text-xs whitespace-pre">{"GOOGLE_CLIENT_ID=…\nGOOGLE_CLIENT_SECRET=…"}</code>
        </li>
      </ol>
    </div>
  );
}

function DriveIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M8.3 3h7.4l6 10.4-3.7 6.4L12 9.4 8.3 3Z" fill="#FBBC04" />
      <path d="M2.3 13.4 8.3 3l3.7 6.4-6 10.4-3.7-6.4Z" fill="#34A853" />
      <path d="M6 19.8 9.7 13.4h12L18 19.8H6Z" fill="#4285F4" />
    </svg>
  );
}
