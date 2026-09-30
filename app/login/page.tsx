import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { SiteNav } from "@/components/site-chrome";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
  const error = typeof params.error === "string" ? params.error : undefined;
  return (
    <div className="min-h-full bg-[#faf9f7] text-stone-900">
      <SiteNav />
      <main className="mx-auto flex max-w-sm flex-col px-5 py-20">
        <h1 className="text-center text-[32px] leading-tight font-semibold tracking-[-0.03em]">
          Entre para <span className="font-serif font-normal text-accent-500 italic">gerar</span>
        </h1>
        <p className="mt-2 text-center text-sm text-stone-500">Seus projetos e áudios ficam salvos na sua conta.</p>
        <LoginForm next={next} initialError={error} />
      </main>
    </div>
  );
}
