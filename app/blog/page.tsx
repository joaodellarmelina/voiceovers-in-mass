import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { SfxLink } from "@/components/sound-toggle";
import { formatDate, POSTS } from "@/lib/blog";
import { absoluteUrl, jsonLd, SITE } from "@/lib/site";

const TITLE = "Blog: bulk text-to-speech, voiceovers para jogos e custos de TTS";
const DESCRIPTION = "Guias práticos para gerar voiceovers em massa: text-to-speech em lote a partir de planilhas, localização de voz para jogos e custo da API do ElevenLabs.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/blog" },
};

export default function BlogIndex() {
  const posts = [...POSTS].sort((a, b) => b.published.localeCompare(a.published));
  return (
    <div className="min-h-full bg-[#faf9f7] text-stone-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `Blog ${SITE.name}`,
          url: absoluteUrl("/blog"),
          inLanguage: "pt-BR",
          blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: absoluteUrl(`/blog/${p.slug}`), datePublished: p.published })),
        })}
      />
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-20">
        <header>
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[52px]">
            Blog <span className="font-serif font-normal tracking-[-0.01em] text-accent-500 italic">voiceovers</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-stone-500">{DESCRIPTION}</p>
        </header>
        <ul className="mt-12 divide-y divide-stone-200 border-y border-stone-200">
          {posts.map((p) => (
            <li key={p.slug}>
              <article className="py-7">
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <time dateTime={p.published}>{formatDate(p.published)}</time>
                  <span aria-hidden>·</span>
                  <span>{p.readingMinutes} min de leitura</span>
                </div>
                <h2 className="mt-2 text-[22px] leading-snug font-semibold tracking-[-0.015em]">
                  <SfxLink href={`/blog/${p.slug}`} sound="page" className="transition hover:text-accent-600">
                    {p.title}
                  </SfxLink>
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-stone-500">{p.description}</p>
              </article>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
