/**
 * Blog posts. Each one targets one search intent (its `keywords`), states its answer in the first
 * paragraph, uses real numbers with an as-of date, and links to related posts and to the product.
 */
export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "callout"; text: string }
  | { type: "code"; text: string };

export type Post = {
  slug: string;
  title: string;
  /** ≤ 160 characters: used as meta description and in listings. */
  description: string;
  keywords: string[];
  published: string;
  updated: string;
  readingMinutes: number;
  body: Block[];
  sources?: { label: string; url: string }[];
  related: string[];
};

export const POSTS: Post[] = [
  {
    slug: "bulk-text-to-speech-planilha",
    title: "Bulk text-to-speech: como gerar centenas de voiceovers a partir de uma planilha",
    description:
      "Um passo a passo para transformar uma planilha de falas em voiceovers em lote: estrutura das colunas, IDs, variações, revisão e organização dos arquivos.",
    keywords: ["bulk text-to-speech", "text-to-speech em massa", "TTS em lote", "text-to-speech Excel", "gerar áudio a partir de planilha"],
    published: "2026-09-29",
    updated: "2026-09-29",
    readingMinutes: 6,
    related: ["voiceovers-multilingues-para-jogos", "custo-text-to-speech-em-massa-elevenlabs"],
    body: [
      {
        type: "p",
        text: "Bulk text-to-speech é gerar muitas falas de uma vez a partir de uma lista, em vez de colar frase por frase numa ferramenta de voz. O jeito mais confiável de fazer isso é tratar a planilha como roteiro: uma linha por fala, uma coluna por idioma e um ID que vira o nome da pasta final.",
      },
      { type: "h2", id: "estrutura", text: "1. Estruture a planilha como roteiro" },
      {
        type: "p",
        text: "O formato que funciona melhor para geração em lote tem uma coluna de ID, algumas colunas de contexto e uma coluna por idioma, com o código do idioma no cabeçalho.",
      },
      {
        type: "table",
        head: ["ID do Áudio", "Personagem", "Português (PT)", "Inglês (EN)", "Espanhol (ES)"],
        rows: [
          ["FALA_001", "Ferreiro", "Bem-vindo à vila, viajante!", "Welcome to the village, traveler!", "¡Bienvenido a la aldea, viajero!"],
          ["FALA_002", "Guarda", "Cuidado, a ponte está quebrada.", "Careful, the bridge is broken.", "Cuidado, el puente está roto."],
        ],
      },
      {
        type: "ul",
        items: [
          "Código entre parênteses no cabeçalho, como “Português (PT)”: assim a ferramenta reconhece a coluna como idioma e sabe qual código enviar para a API.",
          "Colunas de contexto (personagem, cena, fase) ajudam na revisão, mas não são enviadas para a voz.",
          "Uma célula vazia significa que aquela fala não existe naquele idioma. Ela é pulada, sem gastar créditos.",
        ],
      },
      { type: "h2", id: "ids", text: "2. Padronize os IDs antes de gerar" },
      {
        type: "p",
        text: "O ID vira o nome da pasta. Um erro comum em fluxos manuais é misturar PERG_014 e PERG_14 na mesma lista: ordenado por nome, o arquivo some do lugar esperado. Defina o padrão (prefixo e número com zeros à esquerda) e deixe a ferramenta criar as pastas a partir da planilha, nunca à mão.",
      },
      { type: "h2", id: "variacoes", text: "3. Gere variações, não uma versão só" },
      {
        type: "p",
        text: "Vozes sintéticas variam de uma geração para outra. Gerar 2 takes por fala costuma bastar para ter uma boa opção sem dobrar a revisão. Guarde a semente (seed) de cada take: com ela, um take bom pode ser reproduzido depois com os mesmos ajustes.",
      },
      {
        type: "callout",
        text: "Regra prática: comece com 2 takes por fala. Se uma fala não tiver nenhum take bom, descarte os dois e peça mais, só para ela.",
      },
      { type: "h2", id: "paralelo", text: "4. Rode em paralelo, dentro do limite do plano" },
      {
        type: "p",
        text: "APIs de voz limitam quantas requisições simultâneas cada plano aceita. Uma fila que respeita esse limite gera centenas de falas sem erros de “too many requests”, e deve parar sozinha quando o erro não vai se resolver repetindo: chave inválida, créditos esgotados ou voz não liberada no plano.",
      },
      { type: "h2", id: "revisao", text: "5. Revise por fala, com os idiomas lado a lado" },
      {
        type: "ul",
        items: [
          "Ouça os takes da mesma fala em sequência e aprove um por idioma.",
          "Descartar todos os takes devolve a fala para a próxima rodada de geração.",
          "Revise em lotes por intervalo de IDs (por exemplo, da FALA_010 à FALA_050) para não perder o fio.",
        ],
      },
      { type: "h2", id: "entrega", text: "6. Entregue os arquivos já organizados" },
      {
        type: "p",
        text: "Ao aprovar, o arquivo vai para a pasta do ID, com o próprio texto da fala como nome. É a estrutura que se montaria à mão no Drive, sem ninguém renomear arquivos:",
      },
      { type: "code", text: "output/Meu jogo/\n  FALA_001/\n    Bem-vindo à vila, viajante!.mp3\n    Welcome to the village, traveler!.mp3\n    ¡Bienvenido a la aldea, viajero!.mp3" },
      {
        type: "p",
        text: "Quanto isso custa depende do número de caracteres, idiomas e takes. As contas estão em “Quanto custa text-to-speech em massa na API do ElevenLabs”.",
      },
    ],
  },
  {
    slug: "voiceovers-multilingues-para-jogos",
    title: "Voiceovers multilíngues para jogos: boas práticas de TTS em lote",
    description:
      "Como gerar falas de NPCs, narração e tutoriais em vários idiomas com text-to-speech: vozes por idioma, código de idioma, texto da direita para a esquerda e revisão.",
    keywords: ["dublagem de jogos com IA", "localização de voz para jogos", "voz para NPC", "TTS multilíngue", "voiceover para jogos"],
    published: "2026-09-29",
    updated: "2026-09-29",
    readingMinutes: 5,
    related: ["bulk-text-to-speech-planilha", "custo-text-to-speech-em-massa-elevenlabs"],
    body: [
      {
        type: "p",
        text: "Jogos têm mais falas do que parece: NPCs, narração, tutoriais, feedbacks de acerto e erro, instruções de cada fase. Com text-to-speech em lote, dá para localizar tudo isso em vários idiomas sem gravar fala por fala, desde que algumas decisões sejam tomadas antes de gerar.",
      },
      { type: "h2", id: "voz", text: "Escolha a voz por idioma, não só uma global" },
      {
        type: "p",
        text: "Modelos multilíngues falam vários idiomas com a mesma voz, mas nem toda voz soa natural em todos eles. Defina uma voz padrão e troque só os idiomas em que ela não convence. No ElevenLabs, a lista de idiomas verificados de cada voz ajuda nessa escolha.",
      },
      { type: "h2", id: "codigo", text: "Use o código de idioma quando o modelo aceitar" },
      {
        type: "p",
        text: "Frases curtas (“Sí”, “OK”, números) podem ser lidas no idioma errado. Enviar o código do idioma, como pt, en, es ou ar, força a pronúncia certa. Nem todo modelo aceita esse parâmetro, então teste com algumas falas antes de gerar o lote inteiro.",
      },
      { type: "h2", id: "rtl", text: "Cuide do árabe e de outros idiomas da direita para a esquerda" },
      {
        type: "ul",
        items: [
          "Revise o texto em árabe numa interface que respeite a direção da escrita, ou a pontuação aparece no lugar errado.",
          "Nomes de arquivo com texto em árabe funcionam no macOS e no Windows, mas confira como o motor do jogo lê esses nomes. Se precisar, use só o ID como nome.",
        ],
      },
      { type: "h2", id: "consistencia", text: "Mantenha os ajustes de voz iguais no lote todo" },
      {
        type: "p",
        text: "Stability e similarity mudam o caráter da fala. Trocar esses valores no meio do lote deixa personagens com voz diferente entre as fases. Fixe os ajustes antes de gerar e mude só quando for regerar tudo.",
      },
      { type: "h2", id: "licenca", text: "Confira o plano antes de usar vozes da biblioteca" },
      {
        type: "callout",
        text: "No ElevenLabs, vozes da Voice Library não funcionam pela API no plano Free, e algumas têm multiplicador de créditos. Para um jogo comercial, o mínimo é um plano pago, que também libera o uso comercial.",
      },
      { type: "h2", id: "checklist", text: "Checklist antes de gerar" },
      {
        type: "ol",
        items: [
          "IDs padronizados e únicos.",
          "Uma coluna por idioma, com o código no cabeçalho.",
          "Voz definida para cada idioma.",
          "Ajustes de voz fixados.",
          "Teste com 3 a 5 falas por idioma.",
          "Custo estimado dentro do saldo de créditos.",
        ],
      },
    ],
  },
  {
    slug: "custo-text-to-speech-em-massa-elevenlabs",
    title: "Quanto custa text-to-speech em massa na API do ElevenLabs",
    description:
      "Como calcular o custo de gerar voiceovers em lote no ElevenLabs: créditos por caractere, planos, vozes com multiplicador e um exemplo real com 512 áudios.",
    keywords: ["preço ElevenLabs API", "custo text-to-speech", "créditos ElevenLabs", "bulk text-to-speech preço", "ElevenLabs em massa"],
    published: "2026-09-29",
    updated: "2026-09-29",
    readingMinutes: 5,
    related: ["bulk-text-to-speech-planilha", "voiceovers-multilingues-para-jogos"],
    body: [
      {
        type: "callout",
        text: "Valores consultados em 29/09/2026. O ElevenLabs muda planos e promoções com frequência; confira a página oficial antes de decidir.",
      },
      {
        type: "p",
        text: "No ElevenLabs, text-to-speech é cobrado por caractere do texto enviado. Então o custo de um lote é: caracteres das falas × idiomas × takes por fala × créditos por caractere do modelo e da voz.",
      },
      { type: "code", text: "créditos = caracteres × idiomas × takes × créditos por caractere" },
      { type: "h2", id: "modelos", text: "Créditos por caractere por modelo" },
      {
        type: "table",
        head: ["Modelo", "US$ por 1.000 caracteres", "Créditos por caractere"],
        rows: [
          ["Eleven v4", "0,022 (promoção até 12/10)", "1 (medido numa conta real)"],
          ["Eleven v3", "0,08", "1"],
          ["Multilingual v2", "0,08", "1"],
          ["Flash / Turbo v2.5", "0,04", "0,5"],
        ],
      },
      {
        type: "p",
        text: "Vozes da Voice Library podem ter multiplicador: uma voz 2× consome o dobro de créditos por caractere. A forma mais segura de estimar é medir: a resposta da API informa o custo real de cada geração, e dá para usar essa taxa nas próximas estimativas.",
      },
      { type: "h2", id: "planos", text: "Planos e créditos por mês" },
      {
        type: "table",
        head: ["Plano", "Preço mensal", "Créditos/mês", "Vozes da biblioteca na API"],
        rows: [
          ["Free", "US$ 0", "10.000", "Não"],
          ["Starter", "US$ 6", "30.000", "Sim"],
          ["Creator", "US$ 22", "121.000", "Sim"],
          ["Pro", "US$ 99", "600.000", "Sim"],
          ["Scale", "US$ 299", "1.800.000", "Sim"],
        ],
      },
      { type: "h2", id: "exemplo", text: "Exemplo real: 128 falas em 4 idiomas" },
      {
        type: "p",
        text: "Uma planilha com 128 falas em português, inglês, espanhol e árabe tem 512 áudios e 10.545 caracteres no total. Com 2 takes por fala no Eleven v4, que custou 1 crédito por caractere nessa conta, o lote inteiro sai por 21.090 créditos. Cabe no plano Starter (30.000 créditos/mês), mas não no Free (10.000).",
      },
      {
        type: "ul",
        items: [
          "1 take por fala: 10.545 créditos.",
          "2 takes por fala: 21.090 créditos.",
          "3 takes por fala: 31.635 créditos (passa do Starter).",
        ],
      },
      { type: "h2", id: "economizar", text: "Como gastar menos" },
      {
        type: "ul",
        items: [
          "Gere 2 takes e peça mais só para as falas sem um take bom.",
          "Teste ajustes com poucas falas antes do lote inteiro.",
          "Para rascunhos, use Flash ou Turbo, que custam metade por caractere.",
          "Veja o custo estimado antes de gerar e divida o lote por intervalo de IDs se o saldo não cobrir.",
        ],
      },
    ],
    sources: [
      { label: "ElevenLabs — Pricing", url: "https://elevenlabs.io/pricing" },
      { label: "ElevenLabs — API Pricing", url: "https://elevenlabs.io/pricing/api" },
      { label: "ElevenLabs — Voice Library", url: "https://elevenlabs.io/docs/voice-library/overview" },
    ],
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);

export const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
