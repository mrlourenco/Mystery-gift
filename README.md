# 🎁 Amigo Secreto (PWA)

PWA para organizar um amigo secreto: cria um evento, adiciona os participantes, faz o
sorteio e envia a cada pessoa um link pessoal. Quem abre o link vê um envelope e, ao
tocar, descobre a quem vai oferecer o presente.

- Vite + React + TypeScript (strict), React Router (`HashRouter`)
- Instalável e funciona offline (`vite-plugin-pwa`)
- Dados guardados localmente em IndexedDB (`idb`)
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
└─ ui/       páginas, componentes e estilos
```

- `domain/` não depende de React nem do armazenamento. O sorteio
  (`drawAssignments`) usa backtracking com shuffle e já aceita uma lista de exclusões
  (ex.: casais), que nesta fase vai vazia.
- A UI só conhece a interface `EventRepository`. A implementação concreta é escolhida
  num único sítio: `src/main.tsx`.

## Como funcionam os links

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
