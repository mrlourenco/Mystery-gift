# 🎁 Amigo Secreto (PWA)

PWA para organizar um amigo secreto: cria um evento, adiciona os participantes, faz o
sorteio e envia a cada pessoa um link pessoal. Quem abre o link vê um envelope e, ao
tocar, descobre a quem vai oferecer o presente.

- Vite + React + TypeScript (strict), React Router (`HashRouter`)
- Instalável e funciona offline (`vite-plugin-pwa`)
- Dois modos, escolhidos automaticamente pelas variáveis de ambiente:
  - **Local** (por omissão): dados em IndexedDB e resultado codificado no próprio link
  - **Supabase**: dados no Postgres com RLS, login anónimo e links com tokens curtos
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
├─ config/   leitura de import.meta.env
├─ supabase/ implementações Supabase (auth, repositório, links) — carregado só se configurado
└─ ui/       páginas, componentes e estilos
supabase/migrations/  esquema SQL (tabelas, RLS, função reveal)
```

| Interface         | Modo local                   | Modo Supabase                                        |
| ----------------- | ---------------------------- | ---------------------------------------------------- |
| `EventRepository` | `LocalEventRepository`       | `CachingEventRepository(Supabase…, IndexedDB)`       |
| `AuthService`     | `NoAuthService`              | `SupabaseAuthService` (login anónimo)                |
| `LinkService`     | `LocalLinkService` (payload) | `SupabaseLinkService` (tokens; aceita links antigos) |

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
3. No **SQL Editor**, corre `supabase/migrations/20261122000000_init.sql` (ou usa
   `supabase db push` com a CLI).
4. Copia a **Project URL** e a **anon public key** (Project Settings → API):
   - Para desenvolvimento local: `cp .env.example .env.local` e preenche-as.
   - Para o GitHub Pages: em **Settings → Secrets and variables → Actions → Variables**,
     cria `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A anon key é pública por
     natureza: a proteção vem do RLS.
5. Faz push para `main`. A app passa a usar o Supabase automaticamente.

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
