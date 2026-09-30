"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sfx } from "@/lib/sfx";
import { createClient } from "@/lib/supabase/client";

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).",
  "User already registered": "Já existe uma conta com esse e-mail. Entre com sua senha.",
  auth: "O link de confirmação expirou ou já foi usado. Entre ou crie a conta de novo.",
  forbidden: "Esta conta não tem acesso a este app.",
};

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? (MESSAGES[initialError] ?? initialError) : null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const res =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
          });
    setBusy(false);
    if (res.error) {
      sfx("error");
      return setError(MESSAGES[res.error.message] ?? res.error.message);
    }
    if (mode === "signup" && !res.data.session) {
      sfx("chime");
      return setInfo(`Enviamos um link de confirmação para ${email}. Abra-o para ativar a conta.`);
    }
    sfx("success");
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
      <div className="grid grid-cols-2 rounded-lg bg-stone-100 p-0.5 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
              sfx("tick", 0.7);
            }}
            className={`rounded-md py-1.5 font-medium transition ${mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
          >
            {m === "signin" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-stone-700">E-mail</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-stone-700">Senha</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input w-full"
        />
        {mode === "signup" && <span className="mt-1 block text-xs text-stone-400">Mínimo de 8 caracteres.</span>}
      </label>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full py-2">
        {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
      </button>
    </form>
  );
}
