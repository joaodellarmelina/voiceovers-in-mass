import type { Metadata } from "next";
import Image from "next/image";
import { REAL } from "@/components/landing/story-data";
import { CountUp, HeroPlayer, QueueStory, ReadyStory, Reveal, ReviewStory } from "@/components/landing/story";
import { CopyButton, PasteTile } from "@/components/landing/tiles";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { SfxLink } from "@/components/sound-toggle";
import { POSTS } from "@/lib/blog";
import { absoluteUrl, jsonLd, SITE } from "@/lib/site";
import drive from "@/public/landing/drive-manual.jpg";
import elevenlabs from "@/public/landing/elevenlabs-manual.jpg";
import planilha from "@/public/landing/planilha.jpg";

export const metadata: Metadata = {
  title: { absolute: SITE.title },
  description: SITE.description,
  keywords: SITE.keywords,
  alternates: { canonical: "/" },
};

const ACCENT = "text-[#e4572e]";
const fmt = (n: number) => n.toLocaleString("pt-BR");

const FAQ = [
  {
    q: "O que é bulk text-to-speech?",
    a: "É gerar muitas falas de uma vez a partir de uma lista, em vez de colar frase por frase numa ferramenta de voz. Aqui, a lista é a sua planilha: uma linha por fala e uma coluna por idioma.",
  },
  {
    q: "Dá para gerar áudio direto de uma planilha Excel ou CSV?",
    a: "Sim. O app lê .xlsx, .xls, .csv e .ods, ou células coladas do Google Sheets. Ele reconhece a coluna de ID e os idiomas pelo cabeçalho, como “Português (PT)”.",
  },
  {
    q: "Serve para dublagem e localização de jogos?",
    a: "Serve para qualquer diálogo em massa: falas de NPCs, narração, tutoriais e instruções de fase, em vários idiomas, com uma voz por idioma se precisar.",
  },
  {
    q: "Quanto custa gerar voiceovers em massa?",
    a: "O ElevenLabs cobra por caractere. Um lote de 128 falas em 4 idiomas, com 2 takes cada, gastou cerca de 21 mil créditos no Eleven v4, o que cabe no plano Starter. O app mostra a estimativa antes de gerar.",
  },
  {
    q: "Preciso de plano pago no ElevenLabs?",
    a: "Para uso comercial e para usar vozes da Voice Library pela API, sim. No plano Free só as vozes padrão funcionam pela API.",
  },
];

const MANUAL_STEPS = ["colar a frase", "gerar", "ouvir", "baixar", "renomear", "subir no Drive"];

export default function Landing() {
  const takes = REAL.audios * REAL.takesPerPhrase;
  const manualSteps = REAL.audios * MANUAL_STEPS.length;
  const credits = REAL.totalChars * REAL.takesPerPhrase;

  return (
    <div className="min-h-full bg-[#faf9f7] text-stone-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: SITE.name,
            applicationCategory: "MultimediaApplication",
            operatingSystem: "macOS, Windows, Linux",
            description: SITE.description,
            url: absoluteUrl("/"),
            inLanguage: "pt-BR",
            keywords: SITE.keywords.join(", "),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ])}
      />
      <SiteNav />

      <main>
        {/* Hero: the product, straight */}
        <section className="mx-auto max-w-5xl px-5 pt-20 pb-24 sm:pt-28">
          <Reveal className="text-center">
            <Kicker>Bulk text-to-speech para jogos, apps e diálogos</Kicker>
            <h1 className="mx-auto mt-5 max-w-3xl text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[68px]">
              Voiceovers <Em>em massa</Em>
              <br />
              para o seu diálogo.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-stone-500">
              Text-to-speech em massa a partir da sua planilha: gere todas as falas em todos os idiomas pelo ElevenLabs, ouça, aprove as melhores e receba tudo organizado em uma pasta por ID.
            </p>
            <div className="mt-7 flex justify-center gap-2">
              <SfxLink href="/dashboard" className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 active:scale-[0.97]">
                Abrir o app
              </SfxLink>
              <SfxLink href="#historia" sound="page" className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 active:scale-[0.97]">
                Ver como funciona
              </SfxLink>
            </div>
          </Reveal>
          <Reveal delay={150} className="mx-auto mt-14 max-w-3xl">
            <Screen title="voiceovers · Prontos" app>
              <HeroPlayer />
            </Screen>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-stone-500">
              {["TTS em lote a partir de Excel, CSV ou células coladas", "Várias versões por fala, em paralelo", "Revisão com player e aprovação em um clique", "Custo em créditos antes de gerar"].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-[#e4572e]" />
                  {f}
                </li>
              ))}
            </ul>
            <Caption>Áudios originais gerados com Eleven v4. Aperte ▶.</Caption>
          </Reveal>
        </section>

        {/* 01: the story starts with the sheet */}
        <section id="historia" className="scroll-mt-12 border-t border-stone-200/70 bg-[#f3f2ee] py-20 sm:py-24">
          <div className="mx-auto max-w-5xl px-5">
            <Reveal className="mb-8 max-w-2xl">
              <div className="font-mono text-[11px] tracking-[0.14em] text-stone-400">01 —</div>
              <h2 className="mt-2 text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[42px]">
                Imagine uma planilha <Em>assim</Em>.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
                Falas de personagens, narração, tutoriais, instruções de cada fase. Dezenas, às vezes centenas de linhas, em vários idiomas. E cada célula precisa de uma voz.
              </p>
            </Reveal>
            <Reveal delay={120} className="relative">
              <Screen title="Google Sheets · Frases Únicas">
                <Image src={planilha} alt="Planilha com ID do áudio, tipo, contexto e as falas em português, inglês e espanhol" placeholder="blur" sizes="(min-width: 1024px) 960px, 100vw" className="h-auto w-full" />
              </Screen>
              <Callout className="-top-3 left-6">{REAL.phrases} falas</Callout>
              <Callout className="-top-3 right-6">{REAL.languages} idiomas</Callout>
            </Reveal>
          </div>
        </section>

        {/* 02: the math */}
        <Chapter n="02" title={<>Cada célula precisa <Em>virar voz</Em>.</>}>
          <Reveal className="grid gap-3 sm:grid-cols-3">
            <Stat value={REAL.phrases} label="falas" detail="uma por linha da planilha" />
            <Stat value={REAL.audios} label="áudios" detail={`× ${REAL.languages} idiomas`} />
            <Stat value={takes} label="gerações" detail="× 2 takes, para escolher o melhor de cada" accent />
          </Reveal>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-stone-500">
            Voz sintética não acerta sempre de primeira. Uma entonação estranha no meio de um diálogo e o jogador percebe na hora. Então cada fala precisa de opções, e alguém precisa ouvir todas.
          </p>
        </Chapter>

        {/* 03: the manual way */}
        <Chapter n="03" title={<>Do jeito manual, <Em>uma por uma</Em>.</>} muted>
          <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
            <Reveal>
              {/* The screenshot already carries its own Safari window, so no extra frame here. */}
              <div className="overflow-hidden rounded-[14px] shadow-[0_1px_2px_rgba(28,25,23,0.06),0_24px_60px_-24px_rgba(28,25,23,0.3)] ring-1 ring-stone-900/10">
                <Image src={elevenlabs} alt="Tela de Text to Speech do ElevenLabs com a voz Gus e o modelo Eleven v4 selecionados" placeholder="blur" sizes="(min-width: 768px) 540px, 100vw" className="h-auto w-full" />
              </div>
              <Caption>Escolher voz e modelo, colar a frase, gerar, ouvir, baixar. Para cada célula.</Caption>
            </Reveal>
            <Reveal delay={120}>
              <Screen title="Google Drive · VOICE OVERS">
                <Image src={drive} alt="Pastas PERG_001 a PERG_020 no Google Drive, com PERG_14 e PERG_15 fora do padrão" placeholder="blur" sizes="(min-width: 768px) 460px, 100vw" className="h-auto w-full" />
              </Screen>
              <Caption>Criar a pasta de cada ID à mão. Repare no PERG_14 e no PERG_15.</Caption>
            </Reveal>
          </div>
          <Reveal className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {MANUAL_STEPS.map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">{s}</span>
                  {i < MANUAL_STEPS.length - 1 && <span className="text-stone-300">→</span>}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[15px] text-stone-500">
              {MANUAL_STEPS.length} passos × {fmt(REAL.audios)} áudios ={" "}
              <b className="text-2xl font-semibold tracking-tight text-stone-900 tabular-nums">
                <CountUp to={manualSteps} /> passos
              </b>{" "}
              de copiar, clicar e renomear, sem errar nenhum nome de arquivo.
            </p>
          </Reveal>
        </Chapter>

        {/* The turn */}
        <section className="px-5 py-24 text-center sm:py-32">
          <Reveal>
            <p className="mx-auto max-w-3xl font-serif text-[40px] leading-[1.05] tracking-[-0.01em] italic sm:text-[60px]">
              E se a planilha fosse <span className={ACCENT}>o roteiro</span>?
            </p>
            <p className="mx-auto mt-5 max-w-md text-[15px] text-stone-500">A partir daqui, é a ferramenta de verdade, com os áudios que ela gerou.</p>
          </Reveal>
        </section>

        {/* 04: paste */}
        <Chapter n="04" title={<>Cole a planilha <Em>uma vez</Em>.</>} lead="O app acha a coluna de ID e os idiomas pelo cabeçalho, como “Português (PT)”. Linhas vazias que o Sheets copia junto são descartadas. Experimente:">
          <Reveal>
            <Screen title="voiceovers · Novo projeto" app>
              <div className="p-4 sm:p-5">
                <PasteTile />
              </div>
            </Screen>
          </Reveal>
        </Chapter>

        {/* 05: generate */}
        <Chapter
          n="05"
          title={<>Gere <Em>tudo</Em> de uma vez.</>}
          lead={`Um clique em “Gerar pendentes” coloca as ${fmt(takes)} gerações na fila. Ela roda em paralelo no limite do seu plano, pausa sozinha se a chave, a voz ou os créditos falharem, e mostra o custo antes de começar.`}
        >
          <Reveal className="flex justify-center rounded-2xl border border-stone-200 bg-[radial-gradient(ellipse_at_top,#fff4ee,transparent_70%)] px-5 py-14">
            <QueueStory total={takes} credits={credits} />
          </Reveal>
          <Caption>
            {fmt(REAL.totalChars)} caracteres × 2 takes, a 1 crédito por caractere (Eleven v4, medido nesta conta) ={" "}
            {fmt(credits)} créditos. Cabe no plano Starter.
          </Caption>
        </Chapter>

        {/* 06: review */}
        <Chapter
          n="06"
          title={<>Ouça, compare, <Em>aprove</Em>.</>}
          lead="Cada frase mostra seus takes lado a lado, por idioma. Toque ▶, arraste na onda para ouvir um trecho, aprove com 👍 ou descarte com 👎. Descartar tudo devolve a frase para gerar de novo."
        >
          <Reveal id="revisao">
            <Screen title="voiceovers · Gerar e revisar" app>
              <div className="bg-[#faf9f7] p-3 sm:p-4">
                <ReviewStory />
              </div>
            </Screen>
            <Caption>Áudios originais, gerados pela ferramenta com Eleven v4 e a voz Will. Nada aqui é regravado para a página.</Caption>
          </Reveal>
        </Chapter>

        {/* 07: the folder */}
        <Chapter
          n="07"
          title={<>E a pasta <Em>se monta sozinha</Em>.</>}
          lead="Aprovar copia o áudio para output/<projeto>/<ID>/, com a própria frase como nome do arquivo: a mesma estrutura do Drive, sem ninguém renomear nada. No fim, também sai em ZIP."
        >
          <Reveal>
            <Screen title="voiceovers · Prontos" app>
              <div className="bg-[#faf9f7] p-3 sm:p-4">
                <ReadyStory onReviewHref="#revisao" />
              </div>
            </Screen>
          </Reveal>
        </Chapter>

        {/* FAQ + blog: answers the searches people make before finding this */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto grid max-w-5xl gap-12 px-5 md:grid-cols-[1.3fr_1fr]">
            <Reveal>
              <h2 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[32px]">Perguntas frequentes</h2>
              <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
                {FAQ.map((f) => (
                  <details key={f.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-stone-900">
                      <h3>{f.q}</h3>
                      <span className="text-stone-400 transition-transform group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <p className="mt-2 text-[14px] leading-relaxed text-stone-500">{f.a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[32px]">Do blog</h2>
              <ul className="mt-6 space-y-3">
                {POSTS.map((p) => (
                  <li key={p.slug}>
                    <SfxLink href={`/blog/${p.slug}`} sound="page" className="block rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 active:scale-[0.99]">
                      <span className="text-[15px] leading-snug font-medium text-stone-900">{p.title}</span>
                      <span className="mt-1 block text-[13px] text-stone-500">{p.readingMinutes} min de leitura</span>
                    </SfxLink>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* Epilogue */}
        <section className="border-t border-stone-200/70 bg-[#f6f5f2] px-5 py-24 sm:py-32">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[52px]">
              De {fmt(manualSteps)} passos <br className="hidden sm:block" />
              para <Em>três</Em>.
            </h2>
            <ol className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
              {[
                ["Colar", "a planilha, uma vez"],
                ["Gerar", "todas as variações"],
                ["Aprovar", "e a pasta está pronta"],
              ].map(([verb, rest], i) => (
                <li key={verb} className="rounded-xl border border-stone-200 bg-white p-4">
                  <span className="font-mono text-[11px] text-stone-400">0{i + 1}</span>
                  <div className="mt-1 font-serif text-[26px] leading-none italic">{verb}</div>
                  <div className="mt-1 text-sm text-stone-500">{rest}</div>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-col items-center gap-3">
              <SfxLink href="/dashboard" className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 active:scale-[0.97]">
                Abrir o app
              </SfxLink>
              <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white py-1 pr-1 pl-3 font-mono text-[12px] text-stone-600">
                <span className="text-stone-400">$</span> pnpm dev
                <CopyButton text="pnpm dev" />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className={`font-serif font-normal tracking-[-0.01em] italic ${ACCENT}`}>{children}</span>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[11px] text-stone-500 shadow-sm">
      <span className="size-1.5 rounded-full bg-[#e4572e]" />
      {children}
    </span>
  );
}

function Chapter({ n, title, lead, muted, children }: { n: string; title: React.ReactNode; lead?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <section className={`py-20 sm:py-24 ${muted ? "border-y border-stone-200/70 bg-[#f3f2ee]" : ""}`}>
      <div className="mx-auto max-w-5xl px-5">
        <Reveal className="mb-8 max-w-2xl">
          <div className="font-mono text-[11px] tracking-[0.14em] text-stone-400">{n} —</div>
          <h2 className="mt-2 text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[42px]">{title}</h2>
          {lead && <p className="mt-3 text-[15px] leading-relaxed text-stone-500">{lead}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function Screen({ title, app, children }: { title: string; app?: boolean; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_24px_60px_-24px_rgba(28,25,23,0.22)]">
      <div className="flex items-center gap-2 border-b border-stone-200/80 bg-stone-50/80 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto flex items-center gap-1.5 text-[11px] text-stone-500">
          {app && <span className="size-1.5 rounded-full bg-accent-500" />}
          {title}
        </span>
        <span className="w-10" />
      </div>
      {children}
    </div>
  );
}

function Callout({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`absolute rounded-full bg-stone-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg ${className}`}>{children}</span>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-center text-[13px] text-stone-500">{children}</p>;
}

function Stat({ value, label, detail, accent }: { value: number; label: string; detail: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-[#f6d5c6] bg-[#fff4ee]" : "border-stone-200 bg-white"}`}>
      <div className={`text-[44px] leading-none font-semibold tracking-[-0.04em] ${accent ? "text-[#c2410c]" : "text-stone-900"}`}>
        <CountUp to={value} />
      </div>
      <div className="mt-1 text-sm font-medium text-stone-700">{label}</div>
      <div className="mt-0.5 text-[13px] text-stone-500">{detail}</div>
    </div>
  );
}

