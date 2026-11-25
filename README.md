# 🎁 Amigo Secreto (PWA)

PWA para organizar um amigo secreto: cria um evento, adiciona os participantes, faz o
sorteio e envia a cada pessoa um link pessoal. Quem abre o link vê um envelope e, ao
tocar, descobre a quem vai oferecer o presente.

- Vite + React + TypeScript (strict), React Router (`HashRouter`)
- Instalável e funciona offline (`vite-plugin-pwa`)
- Dois modos, escolhidos automaticamente pelas variáveis de ambiente:
  - **Local** (por omissão): dados em IndexedDB e resultado codificado no próprio link
  - **Supabase**: dados no Postgres com RLS, login anónimo e links com tokens curtos
- Envio do resultado por e-mail (Resend, através de uma Edge Function do Supabase) ou,
  sem servidor, pela app de e-mail do próprio telemóvel (`mailto:`)
- Interface em português de Portugal, mobile-first, com modo claro e escuro

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173/Mystery-gift/
npm test           # Vitest
npm run lint       # ESLint + Prettier
npm run build      # gera dist/
npm run preview    # serve dist/ (testa o service worker)
npm run icons      # regenera os PNG a partir dos SVG em public/icons
```

## Publicar no GitHub Pages

1. No repositório, vai a **Settings → Pages**.
2. Em **Build and deployment → Source**, escolhe **GitHub Actions**.
3. Faz push para `main`. O workflow `.github/workflows/deploy.yml` corre o lint, os
   testes e o build, e publica em `https://<utilizador>.github.io/<repositório>/`.
4. Nos pull requests, o workflow só corre o lint, os testes e o build, sem publicar.

O `base` do Vite vem da variável `VITE_BASE`. No CI é sempre `/<nome-do-repositório>/`;
localmente, por omissão, é `/Mystery-gift/`.

## Arquitetura

```
src/
├─ domain/   tipos e lógica pura (sorteio, validações, operações do evento)
├─ data/     EventRepository + LocalEventRepository (IndexedDB) + provider React
├─ auth/     AuthService + NoAuthService (sempre "anónimo") + provider React
├─ links/    codificação do link pessoal e partilha (Web Share / wa.me)
├─ notify/   envio por e-mail: interface DrawMailer e alternativa mailto:
├─ config/   leitura de import.meta.env
├─ supabase/ implementações Supabase (auth, repositório, links) — carregado só se configurado
└─ ui/       páginas, componentes e estilos
supabase/migrations/  esquema SQL (tabelas, RLS, função reveal, registo de envios)
supabase/functions/   Edge Function send-draw-emails (Deno) + código partilhado (_shared/)
```

| Interface         | Modo local                   | Modo Supabase                                        |
| ----------------- | ---------------------------- | ---------------------------------------------------- |
| `EventRepository` | `LocalEventRepository`       | `CachingEventRepository(Supabase…, IndexedDB)`       |
| `AuthService`     | `NoAuthService`              | `SupabaseAuthService` (login anónimo)                |
| `LinkService`     | `LocalLinkService` (payload) | `SupabaseLinkService` (tokens; aceita links antigos) |
| `DrawMailer`      | `null` → botões `mailto:`    | `SupabaseDrawMailer` (Edge Function + Resend)        |

- `domain/` não depende de React nem do armazenamento. O sorteio
  (`drawAssignments`) usa backtracking com shuffle e já aceita uma lista de exclusões
  (ex.: casais), que nesta fase vai vazia.
- A UI só conhece as interfaces. As implementações concretas são escolhidas num único
  sítio: `src/main.tsx`.

## Como funcionam os links

### Modo local (payload no link)

Sem servidor, o resultado de cada pessoa vai **dentro do próprio link**:

```
https://…/Mystery-gift/#/r/<payload>
payload = base64url( XOR( UTF-8( JSON ) ) )
JSON    = { v: 1, e: evento, b: orçamento (cêntimos), d: data, g: quem dá, r: quem recebe, k: id do sorteio }
```

> ⚠️ **Isto é ofuscação, não segurança.** Serve para que o nome não se leia "de relance"
> no URL, mas qualquer pessoa com conhecimentos técnicos consegue descodificar um link.
> Quem organiza também consegue, em teoria, ver todos os pares. Para um grupo de amigos
> chega. A confidencialidade a sério exige um servidor (ver Supabase).

- O campo `v` permite migrar o formato. Os links `v: 1` continuam a funcionar mesmo
  depois de existirem tokens no servidor.
- O "código" é o próprio payload. Em **Tenho um código** pode colar-se o código ou o
  link completo.
- **Repetir o sorteio** gera um novo `k`. Os links antigos continuam a abrir, mas
  mostram o resultado antigo. Só o dispositivo de quem organizou consegue detetar isso
  (e mostra um aviso). A app avisa antes de repetir.

### Modo Supabase (tokens)

- Cada participante recebe um token de 12 caracteres em Crockford base32 (60 bits), por
  exemplo `K7Q2-M9XP-4RTA`. O link é `#/r/K7Q2M9XP4RTA`, e o código é curto o suficiente
  para se escrever à mão.
- O resultado fica no servidor. Quem abre o link não precisa de conta: a função
  `reveal(token)` (`security definer`) devolve **apenas** a linha dessa pessoa.
- Se o sorteio for repetido, os tokens antigos passam a mostrar "este link já não é
  válido". Isto funciona em qualquer dispositivo, não só no de quem organizou.
- Os links antigos (payload `v: 1`) continuam a abrir.

## Ligar o Supabase

1. Cria um projeto em [supabase.com](https://supabase.com).
2. Em **Authentication → Sign In / Providers**, ativa **Allow anonymous sign-ins**.
   Recomendado: ativa também o CAPTCHA (Turnstile/hCaptcha) para evitar a criação de
   utilizadores anónimos em massa.
3. No **SQL Editor**, corre os ficheiros de `supabase/migrations/` por ordem (ou usa
   `supabase db push` com a CLI).
4. Copia a **Project URL** e a **anon public key** (Project Settings → API):
   - Para desenvolvimento local: `cp .env.example .env.local` e preenche-as.
   - Para o GitHub Pages: em **Settings → Secrets and variables → Actions → Variables**,
     cria `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A anon key é pública por
     natureza: a proteção vem do RLS.
5. Faz push para `main`. A app passa a usar o Supabase automaticamente.

## Ligar o envio de e-mails (Resend)

Precisas de um **domínio teu** (ex.: `amigosecreto.pt`). Sem domínio verificado, o Resend
só envia para o e-mail da tua própria conta.

1. Cria uma conta em [resend.com](https://resend.com).
2. Em **Domains → Add domain**, adiciona o domínio e cria no teu fornecedor de DNS os
   registos que o Resend indicar (SPF, DKIM). Espera até o domínio ficar "Verified".
3. Em **API Keys**, cria uma chave com permissão **Sending access**.
4. Com a [CLI do Supabase](https://supabase.com/docs/guides/cli):

   ```bash
   supabase login
   supabase link --project-ref <ref-do-projeto>
   supabase secrets set \
     RESEND_API_KEY=re_xxx \
     EMAIL_FROM="Amigo Secreto <amigo@o-teu-dominio.pt>" \
     APP_URL=https://<utilizador>.github.io/Mystery-gift/ \
     ALLOWED_ORIGIN=https://<utilizador>.github.io
   supabase functions deploy send-draw-emails
   ```

5. Opcional (RGPD): ativa a extensão `pg_cron` e agenda `purge_participant_emails()`
   (o comando está no fim de `supabase/migrations/20261125000000_emails.sql`). Isto apaga
   os e-mails dos participantes 7 dias depois da data da troca.

Como funciona:

- No ecrã **Enviar o resultado**, o botão **Enviar e-mails a todos** chama a função
  `send-draw-emails`. A função lê o evento com a sessão de quem organiza (o RLS garante
  que é o dono), gera os tokens que faltarem e envia através do Resend, em lotes de até 100.
- Cada e-mail tem o valor, a data, o link do envelope, o código e, no fim, o nome de
  quem calhou. O nome fica depois do link para não aparecer na pré-visualização da
  notificação.
- O estado de cada envio (enviado ou falhou) fica em `email_deliveries`, sem guardar o
  e-mail nem o conteúdo. Não se envia duas vezes o mesmo sorteio à mesma pessoa, a não
  ser que se carregue em **Reenviar e-mail**.
- O link do e-mail usa o `APP_URL` do servidor, nunca um URL vindo do navegador.
- **Sem Supabase**, cada participante tem um botão **Enviar por e-mail**, que abre a app
  de e-mail com a mensagem pronta. Quem organiza envia e, por isso, vê o resultado.

**Notas e limitações**

- O login é anónimo e fica preso ao dispositivo/navegador. Se limpares os dados do
  site, perdes o acesso aos teus eventos. O passo seguinte natural é o OAuth: o
  `supabase.auth.linkIdentity()` liga a conta anónima a Google/GitHub sem perder dados.
- Com o Supabase ligado, a lista de eventos funciona offline em leitura (cópia em
  IndexedDB), mas criar ou alterar precisa de rede.
- Os eventos criados no modo local **não** são migrados automaticamente.
- O organizador continua a poder ler os pares na tabela `events` (coluna `draw`). Para
  esconder o resultado até do organizador, o sorteio teria de passar para uma função no
  servidor.
