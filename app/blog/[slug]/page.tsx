import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { SfxLink } from "@/components/sound-toggle";
import { formatDate, getPost, POSTS, type Block } from "@/lib/blog";
import { absoluteUrl, jsonLd, SITE } from "@/lib/site";

// Every post is known at build time; unknown slugs 404 instead of rendering on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  const url = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.published,
      modifiedTime: post.updated,
      tags: post.keywords,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const url = absoluteUrl(`/blog/${post.slug}`);
  const toc = post.body.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");
  const related = post.related.map(getPost).filter((p) => p !== undefined);

  return (
    <div className="min-h-full bg-[#faf9f7] text-stone-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.published,
            dateModified: post.updated,
            inLanguage: "pt-BR",
            keywords: post.keywords.join(", "),
            mainEntityOfPage: url,
            url,
            publisher: { "@type": "Organization", name: SITE.name, url: absoluteUrl("/") },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          },
        ])}
      />
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
        <nav aria-label="Trilha" className="text-xs text-stone-400">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><SfxLink href="/" sound="tick" className="hover:text-stone-700">Início</SfxLink></li>
            <li aria-hidden>/</li>
            <li><SfxLink href="/blog" sound="tick" className="hover:text-stone-700">Blog</SfxLink></li>
          </ol>
        </nav>
        <article className="mt-6">
          <header>
            <h1 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[44px]">{post.title}</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-stone-500">{post.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-stone-400">
              <time dateTime={post.published}>{formatDate(post.published)}</time>
              {post.updated !== post.published && (
                <>
                  <span aria-hidden>·</span>
                  <span>atualizado em <time dateTime={post.updated}>{formatDate(post.updated)}</time></span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>{post.readingMinutes} min de leitura</span>
            </div>
          </header>

          {toc.length > 2 && (
            <nav aria-label="Neste artigo" className="mt-8 rounded-xl border border-stone-200 bg-white p-4 text-sm">
              <div className="mb-2 font-mono text-[10px] tracking-[0.14em] text-stone-400 uppercase">Neste artigo</div>
              <ol className="space-y-1">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="text-stone-600 hover:text-accent-600">{h.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="mt-10 space-y-5 text-[16px] leading-[1.75] text-stone-700">
            {post.body.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </div>

          {post.sources && (
            <section className="mt-12 border-t border-stone-200 pt-6">
              <h2 className="text-sm font-semibold text-stone-900">Fontes</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {post.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-accent-700 underline decoration-accent-200 underline-offset-2 hover:decoration-accent-500">{s.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="mt-14 rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-[15px] text-stone-600">
            Quer gerar voiceovers em massa a partir da sua planilha?{" "}
            <span className="font-serif text-[20px] text-accent-500 italic">Experimente o app.</span>
          </p>
          <SfxLink href="/dashboard" className="mt-4 inline-flex rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-stone-800 active:scale-[0.97]">
            Abrir o app
          </SfxLink>
        </aside>

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-semibold tracking-tight">Leia também</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((p) => (
                <li key={p.slug}>
                  <SfxLink href={`/blog/${p.slug}`} sound="page" className="block h-full rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 active:scale-[0.99]">
                    <span className="text-[15px] leading-snug font-medium">{p.title}</span>
                    <span className="mt-1 block text-[13px] text-stone-500">{p.readingMinutes} min de leitura</span>
                  </SfxLink>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function BlockView({ block: b }: { block: Block }) {
  switch (b.type) {
    case "h2":
      return (
        <h2 id={b.id} className="scroll-mt-20 pt-6 text-[24px] leading-tight font-semibold tracking-[-0.02em] text-stone-900">
          {b.text}
        </h2>
      );
    case "p":
      return <p>{b.text}</p>;
    case "ul":
      return (
        <ul className="list-disc space-y-2 pl-5 marker:text-accent-400">
          {b.items.map((t) => <li key={t}>{t}</li>)}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-2 pl-5 marker:text-stone-400">
          {b.items.map((t) => <li key={t}>{t}</li>)}
        </ol>
      );
    case "callout":
      return <p className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-[15px] text-stone-700">{b.text}</p>;
    case "code":
      return <pre className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-4 font-mono text-[13px] leading-6 text-stone-800">{b.text}</pre>;
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-stone-50 text-stone-600">
              <tr>{b.head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} dir="auto" className="px-3 py-2">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
