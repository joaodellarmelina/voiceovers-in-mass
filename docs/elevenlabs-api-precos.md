# ElevenLabs API — preços e como funciona

Consultado em 29/09/2026. A ElevenLabs muda planos e promoções com frequência; confira as [fontes](#fontes) antes de decidir.

## Resumo

O Text to Speech do ElevenLabs é cobrado por caractere de texto enviado. Cada geração consome créditos, inclusive regenerações e variações descartadas. No Multilingual v2, 1 caractere = 1 crédito; Flash e Turbo custam metade.

Para este app, o custo real é **caracteres da frase × idiomas × takes por frase**. Gerar 2 variações dobra o consumo.

**O plano Free não serve para este projeto:** ele não libera vozes da Voice Library pela API (a Gus é uma delas) e não permite uso comercial. O mínimo prático é o **Starter (US$ 6/mês)**.

## Vozes: padrão × Voice Library

Esta seção faltava na primeira versão do documento e explica o erro `Free users cannot use library voices via the API`.

| Tipo de voz | Categoria na API | Exemplo | Funciona pela API no Free? | Custo |
| --- | --- | --- | --- | --- |
| Padrão (premade) | `premade` | as ~21 vozes que já vêm na conta | Sim | normal |
| Voice Library | `professional` (e outras) | Gus - Natural Goofy Best Friend | **Não** — exige plano pago | normal ou com **multiplicador** |

- "Voice Library voices are not available via the API to free tier users" ([Voice Library](https://elevenlabs.io/docs/voice-library/overview)).
- **Mesmo no plano pago, a voz precisa estar em "Minhas vozes".** Pela API, uma voz da Voice Library só funciona depois de adicionada à conta ("Add to My Voices"), e cada uma ocupa um espaço de voz do plano (o Starter tem 10). No app, isso é o botão **Adicionar** na aba Voice Library do seletor de voz.
- Algumas vozes da biblioteca são restritas a assinantes pelo próprio dono, mesmo fora da API ([Why can't I use some voices](https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library)).
- **Multiplicador de créditos:** algumas vozes da biblioteca têm tarifa própria. Uma voz com multiplicador 2× consome o dobro de créditos por caractere. Confira o multiplicador da voz no site antes de gerar um lote grande.

**Voz padrão do app:** projetos novos começam com a Gus nos planos pagos e com **Will - Relaxed Optimist** (voz padrão, masculina, jovem, descontraída, 10 idiomas verificados) enquanto a conta estiver no Free. O plano é consultado na hora de criar o projeto.

No app, o seletor de voz marca cada voz como **Padrão** ou **Biblioteca**. Se a API recusar a voz, a fila pausa e mostra o motivo, sem gastar créditos com os demais itens.

## Planos e preços

Valores da [página de preços](https://elevenlabs.io/pricing), em dólares.

| Plano | Preço mensal | Anual (por mês) | Créditos/mês | Vozes da biblioteca na API | Em paralelo Multilingual / Flash | Áudio | Uso comercial |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Free | US$ 0 | — | 10.000 | **Não** | 2 / 4 | MP3 128 kbps | Não |
| Starter | US$ 6 | US$ 5 | 30.000 | Sim | 3 / 6 | MP3 128 kbps | Sim |
| Creator | US$ 22 (1º mês US$ 11) | US$ 18,33 | 121.000 | Sim | 5 / 10 | MP3 128 kbps | Sim |
| Pro | US$ 99 | US$ 82,50 | 600.000 | Sim | 10 / 20 | MP3 128 e 192 kbps | Sim |
| Scale | US$ 299 | US$ 249,17 | 1.800.000 | Sim | 15 / 30 | MP3 128 e 192 kbps | Sim |
| Business | US$ 990 | US$ 825 | 6.000.000 | Sim | 15 / 30 | + PCM/WAV 44,1 kHz | Sim |
| Enterprise | Sob consulta | — | Sob consulta | Sim | Maior | Sob consulta | Sim |

"Em paralelo" é o número de requisições simultâneas ([tabela de modelos](https://elevenlabs.io/docs/overview/models)) e corresponde ao campo "Em paralelo" do app. Acima dele a API responde 429.

## Custo por modelo

Preços por 1.000 caracteres da [página de preços da API](https://elevenlabs.io/pricing/api). O Eleven v4 (padrão do app) está com 72% de desconto até 12/10.

| Modelo | ID na API | US$ / 1.000 caracteres | Créditos por caractere | Idiomas |
| --- | --- | --- | --- | --- |
| Eleven v4 | `eleven_v4` | 0,022 (promoção até 12/10) | não divulgado | 90+ |
| Eleven v4 Turbo | `eleven_v4_turbo` | 0,011 (promoção até 12/10) | não divulgado | 90+ |
| Eleven v3 | `eleven_v3` | 0,08 | 1 | 70+ |
| Multilingual v2 | `eleven_multilingual_v2` | 0,08 | 1 | 29 |
| Flash / Turbo v2.5 | `eleven_flash_v2_5` | 0,04 | 0,5 | 32 |

O Starter anuncia 272.727 caracteres de v4 por mês, que equivalem a US$ 6 ÷ US$ 0,022 por 1.000. Depois de 12/10, confira o preço normal do v4. Todos esses valores são multiplicados pelo multiplicador da voz, quando houver.

## Como a API funciona

Cada áudio é uma chamada `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` que devolve o arquivo ([referência](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)). O app usa o SDK oficial `@elevenlabs/elevenlabs-js` (`textToSpeech.convert`).

1. **Autenticação:** a chave vai no cabeçalho `xi-api-key`. No app ela fica só no servidor (`.env`/`.env.local`).
2. **Voz:** o `voice_id` vai na URL. No Free, só vozes `premade` funcionam.
3. **Corpo:** `text`, `model_id`, `voice_settings` (no v3/v4 só stability e similarity), `seed` e, opcionalmente, `language_code`.
4. **Formato:** `output_format`, por exemplo `mp3_44100_128`. 192 kbps e PCM/WAV dependem do plano.
5. **Cobrança:** os caracteres de `text` são descontados na hora. A resposta traz `character-cost` e `request-id`, que o app guarda em cada take.
6. **Erros:**
    - `429`: requisições demais ao mesmo tempo; o SDK tenta de novo sozinho.
    - Voz da biblioteca no Free, créditos esgotados (`quota_exceeded`) ou chave inválida (`401`): o app pausa a fila e mostra o motivo.

## Estimativa para o projeto

Um lote de 100 frases em 4 idiomas com 2 takes cabe no Starter usando Multilingual v2, com voz de multiplicador 1×. As frases têm em média ~35 caracteres.

```
caracteres = frases × idiomas × takes × média de caracteres
```

| Cenário | Caracteres | Multilingual v2 | Flash v2.5 | v4 na promoção | Plano que comporta (Multilingual) |
| --- | --- | --- | --- | --- | --- |
| 100 frases × 4 idiomas × 2 takes | 28.000 | 28.000 créditos · US$ 2,24 | 14.000 créditos · US$ 1,12 | US$ 0,62 | Starter (30.000) |
| 100 frases × 4 idiomas × 3 takes | 42.000 | 42.000 créditos · US$ 3,36 | 21.000 créditos · US$ 1,68 | US$ 0,92 | Creator (121.000) |
| 500 frases × 4 idiomas × 2 takes | 140.000 | 140.000 créditos · US$ 11,20 | 70.000 créditos · US$ 5,60 | US$ 3,08 | Pro (600.000) |

O Free não aparece como opção porque não libera a voz Gus pela API. Com uma voz padrão, ele cobre só testes pequenos (10.000 créditos/mês, sem uso comercial).

## Fontes

- [ElevenLabs — Pricing](https://elevenlabs.io/pricing): planos, créditos, qualidade de áudio
- [ElevenLabs — API Pricing](https://elevenlabs.io/pricing/api): preço por 1.000 caracteres por modelo
- [ElevenLabs — Models](https://elevenlabs.io/docs/overview/models): IDs, idiomas, limites de concorrência
- [ElevenLabs — Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert): endpoint e parâmetros
- [ElevenLabs — Voice Library](https://elevenlabs.io/docs/voice-library/overview): vozes da biblioteca indisponíveis na API do Free; multiplicadores
- [ElevenLabs — Why can't I use some voices from the Voice Library?](https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library): vozes restritas a assinantes
