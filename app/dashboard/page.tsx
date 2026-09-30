import { Importer } from "@/components/importer";
import { LocalImport } from "@/components/local-import";
import { ProjectMenu } from "@/components/project-actions";
import { SfxLink, SoundToggle } from "@/components/sound-toggle";
import { localProjectCount } from "@/lib/local-import";
import { pageUser } from "@/lib/page-auth";
import { listProjects } from "@/lib/store";

export default async function Home() {
  // Reading the session makes this page render per request.
  const { supabase, userId, email } = await pageUser();
  const [projects, localCount] = await Promise.all([listProjects(supabase, userId), localProjectCount()]);
  return (
    <>
      <header className="glass sticky top-0 z-20 border-b border-stone-200/60 bg-[#faf9f7]/80 backdrop-blur-md">
        <nav className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6">
          <SfxLink href="/" sound="page" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-stone-900">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></svg>
            voiceovers
          </SfxLink>
          <div className="flex items-center gap-1">
            <span className="hidden px-2 text-xs text-stone-500 sm:inline">{email}</span>
            <SoundToggle />
            <form action="/auth/signout" method="post">
              <button className="btn-ghost px-2 py-1 text-xs">Sair</button>
            </form>
          </div>
        </nav>
      </header>
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-stone-900">
          Voiceovers <span className="font-serif font-normal tracking-[-0.01em] text-accent-500 italic">em massa</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-500">
          Importe a planilha, gere todas as variações no ElevenLabs e aprove as melhores. Todos os áudios ficam salvos na sua conta; os aprovados saem em ZIP ou direto no Google Drive, em <code className="rounded bg-stone-200/60 px-1 text-[13px] text-stone-700">&lt;ID&gt;/&lt;frase&gt;.mp3</code>.
        </p>
      </header>

      {localCount > 0 && <LocalImport count={localCount} />}

      <Importer />

      {projects.length > 0 && (
        <section className="mt-10">
          <h2 className="label mb-3">Projetos</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => {
              const pct = p.cells ? Math.round((p.approved / p.cells) * 100) : 0;
              return (
                <li key={p.id} className="relative">
                  <SfxLink
                    sound="page"
                    href={`/dashboard/projects/${p.id}`}
                    className="card block p-4 transition hover:-translate-y-px hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate pr-8 font-semibold text-stone-900">{p.name}</div>
                        <div className="mt-0.5 text-xs text-stone-500">
                          {p.rows} frases · atualizado {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <span className="mr-8 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 tabular-nums">{pct}%</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.languages.map((l) => (
                        <span key={l} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">{l}</span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="tabular-nums">{p.approved}/{p.cells} aprovados</span>
                    </div>
                  </SfxLink>
                  {/* Sibling of the link, not inside it: a button can't live inside an <a>. */}
                  <ProjectMenu id={p.id} name={p.name} className="absolute top-3 right-3" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
    </>
  );
}
