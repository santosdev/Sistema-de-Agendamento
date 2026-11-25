# Agenda Tech Resolute

Sistema de agendamento de reuniões (estilo Calendly) da Tech Resolute. README completo, com prints e decisões
técnicas, na etapa 11.

- Requisitos: [docs/REQUISITOS.md](docs/REQUISITOS.md)
- Design: [DESIGN.md](DESIGN.md)

## Rodando localmente

Requer Node 24 ou superior.

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint (inclui a regra que proíbe travessão em textos) |
| `npm run typecheck` | gera os tipos de rota e roda o TypeScript |
| `npm run test` | testes unitários (Vitest) |
| `npm run test:e2e` | testes E2E (Playwright) |
| `npm run format` | Prettier com ordenação de classes do Tailwind |
| `npm run check` | lint + typecheck + testes |
| `npm run logo:sync` | gera o componente do R e o favicon a partir de `public/logo-r.svg` |

## Estrutura

```
app/                 rotas (App Router), globals.css, theme.css (tokens), icon.svg
components/brand/    <LogoR /> e <Logo />
lib/env/             variáveis de ambiente validadas com Zod (public e server)
lib/i18n/            dicionários pt-BR e en
lib/supabase/        clientes browser, server, admin e refresh de sessão
lib/design/          tokens usados em JS (cores de evento, animação)
proxy.ts             refresh da sessão do Supabase e proteção de /dashboard
scripts/             utilitários (sync do logo)
tests/unit/          Vitest
e2e/                 Playwright
docs/                requisitos e documentação
```
