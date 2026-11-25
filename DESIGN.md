# DESIGN.md

Guia visual e de interação do Sistema de Agendamento Tech Resolute. Fonte única de verdade para cores,
tipografia, espaçamento, componentes, movimento e acessibilidade. Os tokens daqui existem em código em
`app/theme.css` (Tailwind v4, bloco `@theme`). Se um valor mudar, muda nos dois lugares.

Base: identidade roxa da Tech Resolute, conforme o mockup aprovado.

---

## 1. Princípios

1. **Calma e precisão.** Agendar é uma tarefa curta. A interface some e deixa a data e o horário em primeiro plano.
2. **Um destaque por tela.** O roxo da marca marca a próxima ação ou a seleção atual. Nunca decoração.
3. **Superfícies planas.** Cards brancos sobre fundo lilás muito claro, separados por borda fina e sombra mínima.
   Sem gradiente, sem glassmorphism, sem blur de fundo, sem emoji.
4. **Mobile first.** Cada tela nasce em 360 px e ganha colunas no desktop. Nada depende de hover.
5. **Movimento com propósito.** Animação só para explicar mudança de estado (seleção, entrada, troca de passo).
6. **Acessível por padrão.** AA em contraste, teclado completo, foco sempre visível.

### O que evitar
- Cara de template: hero genérico, ilustrações de banco, cards com ícone colorido em círculo.
- Bootstrap: botões azuis padrão, sombras pesadas, bordas cinza puras.
- Cinza neutro puro (`#999`, `#ccc`). Todos os neutros da paleta são levemente arroxeados.
- Texto em roxo para parágrafos. Roxo em texto só em links e rótulos de ação.
- Travessão em textos. Use ponto, vírgula, dois pontos ou o separador `·`.

---

## 2. Cores

### 2.1 Tokens

| Token (Tailwind) | Hex | Uso |
| --- | --- | --- |
| `bg` | `#F6F4FB` | fundo da página |
| `surface` | `#FFFFFF` | cards, modais, menus |
| `surface-soft` | `#FCFBFE` | áreas internas de card, linhas zebradas, rodapé de card |
| `border` | `#E7E3F1` | borda de card e de componentes |
| `divider` | `#EEEAF5` | divisória interna |
| `border-input` | `#8B85A1` | borda de input, select, textarea (3.52:1 sobre branco) |
| `ink` | `#16131F` | texto principal, títulos |
| `ink-secondary` | `#3D3850` | texto secundário, rótulos |
| `ink-muted` | `#5B5670` | texto apagado, metadados, placeholders |
| `ink-disabled` | `#A39FB5` | dias e itens indisponíveis (não interativos) |
| `brand` | `#6D28D9` | ação principal, seleção, link, foco |
| `brand-hover` | `#5B21B6` | hover e pressed da ação principal |
| `brand-soft` | `#EDE7FB` | dias disponíveis, chips |
| `brand-soft-ink` | `#3B1A86` | texto sobre `brand-soft` |
| `slot-selected` | `#F3EEFF` | fundo do horário selecionado (borda 2 px `brand`) |
| `sidebar` | `#16131F` | fundo da sidebar do painel |
| `sidebar-active` | `#2A2438` | item ativo da sidebar |
| `sidebar-ink` | `#C9C3DA` | texto inativo da sidebar |
| `sidebar-border` | `#3A3348` | divisórias e barra do logo no escuro |
| `focus-on-dark` | `#A78BFA` | anel de foco sobre a sidebar |
| `success-soft` / `success-ink` | `#E6F4EA` / `#1E6B34` | status confirmada |
| `warning-soft` / `warning-ink` | `#FFF1DC` / `#8A4B00` | status remarcada |
| `neutral-soft` / `neutral-ink` | `#F1EEF6` / `#5B5670` | status cancelada, passada |
| `danger` | `#B42318` | erro de campo, ação destrutiva |
| `danger-soft` | `#FEF3F2` | fundo de alerta de erro |

`success`, `warning`, `neutral` e `danger` não vieram do mockup com todos os valores. Os que faltavam foram
escolhidos para manter o mesmo tom e passar no AA (tabela 2.3).

### 2.2 Cores de tipo de evento
Paleta fixa. O anfitrião escolhe uma; não há seletor livre. Usada na barra lateral da reunião, no ponto do
tipo de evento e no topo do card do evento. Todas têm contraste de pelo menos 4.5:1 sobre branco.

| Nome | Hex |
| --- | --- |
| `violet` (padrão) | `#6D28D9` |
| `blue` | `#2563EB` |
| `teal` | `#0F766E` |
| `green` | `#15803D` |
| `amber` | `#B45309` |
| `rose` | `#BE123C` |
| `fuchsia` | `#C026D3` |
| `slate` | `#475569` |

A cor nunca é a única forma de identificar o evento: o nome sempre aparece em texto.

### 2.3 Contraste medido (WCAG 2.x)

| Texto sobre fundo | Razão | Resultado |
| --- | --- | --- |
| `ink` sobre `bg` | 16.78 | AAA |
| `ink-secondary` sobre `surface` | 11.17 | AAA |
| `ink-muted` sobre `surface` | 6.98 | AA |
| `ink-muted` sobre `bg` | 6.40 | AA |
| `brand` sobre `surface` | 7.10 | AAA |
| branco sobre `brand` | 7.10 | AAA |
| branco sobre `brand-hover` | 8.98 | AAA |
| `brand` sobre `slot-selected` | 6.25 | AA |
| `brand-soft-ink` sobre `brand-soft` | 10.38 | AAA |
| `success-ink` sobre `success-soft` | 5.76 | AA |
| `warning-ink` sobre `warning-soft` | 6.11 | AA |
| `neutral-ink` sobre `neutral-soft` | 6.08 | AA |
| `danger` sobre `surface` | 6.57 | AA |
| `sidebar-ink` sobre `sidebar` | 10.72 | AAA |
| `sidebar-ink` sobre `sidebar-active` | 8.74 | AAA |
| `focus-on-dark` sobre `sidebar` | 6.73 | AA (não texto: 3:1 exigido) |

Pontos de atenção:
- `brand` sobre `sidebar` tem só 2.58:1. Por isso o foco e os destaques na sidebar usam `focus-on-dark`.
- `border-input` foi escurecido de `#DCD6EA` (mockup, 1.41:1) para `#8B85A1` (3.52:1) para cumprir o 3:1 de
  limite de componente (WCAG 1.4.11). Bordas de card (`border`) continuam claras porque não delimitam controles.
- `ink-disabled` (2.57:1) só pode ser usado em itens não interativos e marcados com `aria-disabled`.

---

## 3. Tipografia

Fontes carregadas com `next/font/google`, `display: swap`, subconjunto `latin`.

| Família | Token | Pesos | Uso |
| --- | --- | --- | --- |
| Space Grotesk | `font-display` | 600, 700 | títulos, números grandes, nome do mês, "Resolute" no logo |
| Inter | `font-sans` | 400, 500, 600 | todo o resto |

### Escala

| Token | Tamanho / altura de linha | Peso | Uso |
| --- | --- | --- | --- |
| `text-display` | 32 / 38 (mobile 26 / 32) | 700 display | título da página pública do anfitrião |
| `text-title` | 22 / 28 (mobile 20 / 26) | 600 display | título de página do painel, nome do evento |
| `text-heading` | 17 / 24 | 600 display | título de card, nome do mês |
| `text-body` | 15 / 22 | 400 | texto corrido |
| `text-label` | 14 / 20 | 500 | labels, itens de menu, chips |
| `text-caption` | 13 / 18 | 400 ou 500 | metadados, ajuda de campo, "Tech" no logo |

Regras:
- Inputs usam 16 px no mobile para o iOS não dar zoom no foco.
- Horários usam `tabular-nums` para alinhar colunas.
- Títulos com `text-wrap: balance`; parágrafos com `text-wrap: pretty`.
- Letter-spacing: `-0.01em` nos títulos em Space Grotesk; padrão no Inter.
- Nunca usar caixa alta em frases. Caixa alta só em rótulos curtos de seção, 12 px, `tracking-wide`, `ink-muted`.

---

## 4. Espaçamento, raio, sombra

### Espaçamento
Base de 4 px (padrão do Tailwind). Ritmo mais usado: 8, 12, 16, 24, 32.
- Padding de card: 20 px no mobile, 24 a 28 px no desktop.
- Gap entre cards: 16 px no mobile, 24 px no desktop.
- Margem lateral da página: 16 px no mobile, 24 px no tablet, centralizado com largura máxima no desktop.

### Larguras máximas
| Tela | Largura |
| --- | --- |
| Agendamento (3 colunas) | 1080 px |
| Página pública do anfitrião | 720 px |
| Painel (conteúdo) | 1200 px |
| Formulários isolados (login, booking/[token]) | 480 px |

### Alturas
| Token | Valor | Uso |
| --- | --- | --- |
| `h-touch` | 44 px | mínimo de qualquer alvo de toque (dias, ícones, itens de menu) |
| `h-control` | 48 px | inputs, selects, botões secundários |
| `h-control-lg` | 52 px | botão principal do fluxo ("Continuar", "Confirmar agendamento") |

### Raios
| Token | Valor | Uso |
| --- | --- | --- |
| `rounded-card` | 20 px | cards principais, modais |
| `rounded-card-sm` | 18 px | cards internos, itens da lista de reuniões |
| `rounded-control` | 12 px | botões, inputs, slots, dias do calendário |
| `rounded-full` | 999 px | chips, badges de status, avatar |

### Sombras
Discretas, com tom do `ink`.
| Token | Valor | Uso |
| --- | --- | --- |
| `shadow-card` | `0 1px 2px rgb(22 19 31 / 0.04), 0 8px 24px -12px rgb(22 19 31 / 0.08)` | cards |
| `shadow-pop` | `0 2px 4px rgb(22 19 31 / 0.06), 0 16px 40px -16px rgb(22 19 31 / 0.18)` | menus, popovers, modais |

---

## 5. Logo

O vetor oficial está em `public/logo-r.svg`. **Nunca redesenhar, simplificar ou substituir o R.** Os componentes
usam exatamente o mesmo `path`.

### `<LogoR className />`
- SVG inline com `viewBox="0 0 39 32"` e `fill="currentColor"`.
- A cor vem da classe de texto (`text-brand`, `text-white`).
- `aria-hidden="true"` quando estiver dentro do lockup ou ao lado de texto; `role="img"` com
  `aria-label="Tech Resolute"` quando estiver sozinho.

### `<Logo variant="light" | "dark" />`
Lockup: R, barra vertical de 1 px, bloco de texto em duas linhas. 12 px de espaço entre os três elementos.

```
[R]  |  Tech
     |  Resolute
```

| Parte | Estilo | light | dark |
| --- | --- | --- | --- |
| R | altura 28 px | `#6D28D9` | `#FFFFFF` |
| Barra | 1 px, altura do bloco de texto | `#CFC8E0` | `#3A3348` |
| "Tech" | Inter 13 px, 400 | `#3D3850` | `#C9C3DA` |
| "Resolute" | Space Grotesk 19 px, 700, linha 1 | `#16131F` | `#FFFFFF` |

- O elemento raiz tem `aria-label="Tech Resolute"` (e `role="img"` se não for link); o SVG e os textos internos
  ficam `aria-hidden`.
- A barra é decorativa e pode ter contraste baixo.
- `light` em fundos claros (header do agendamento); `dark` na sidebar do painel.
- Favicon: `app/icon.svg` com o mesmo path e `fill="#6D28D9"`.

---

## 6. Ícones

- `lucide-react`, traço 1.75, tamanho 18 px em texto e 20 px em botões só de ícone.
- Cor herdada do texto (`currentColor`).
- Botão só de ícone: área de 44 x 44 px e `aria-label` obrigatório.
- Ícones de local: Google Meet `Video`, Zoom `Video`, telefone `Phone`, presencial `MapPin`, link `Link2`.
  Duração `Clock`. Fuso `Globe`.

---

## 7. Componentes

### 7.1 Botões
| Variante | Visual | Uso |
| --- | --- | --- |
| `primary` | fundo `brand`, texto branco, hover `brand-hover` | uma ação principal por tela |
| `secondary` | fundo `surface`, borda `border`, texto `ink`, hover `surface-soft` | ações de apoio |
| `ghost` | sem fundo, texto `ink-secondary`, hover `brand-soft` | ações em listas e menus |
| `danger` | fundo `surface`, borda `border`, texto `danger`; confirmação com fundo `danger` | cancelar reunião |

- Altura 48 px (52 px no CTA do fluxo), raio 12 px, `text-label` 600, padding horizontal 18 a 20 px.
- Pressed: `scale(0.98)` em 100 ms.
- Carregando: texto mantido, spinner de 16 px à esquerda, botão desabilitado e `aria-busy="true"`.
  A largura não muda.
- Desabilitado: opacidade 0.5, `cursor-not-allowed`. Preferir explicar o motivo a desabilitar.

### 7.2 Campos
- Label visível acima (`text-label`, `ink-secondary`), nunca só placeholder.
- Input: altura 48 px, raio 12 px, borda 1 px `border-input`, fundo `surface`, texto 16 px no mobile e 15 px no desktop.
- Hover: borda `ink-secondary`. Foco: borda `brand` + anel de foco (7.11).
- Erro: borda `danger`, mensagem abaixo em `text-caption` `danger` com ícone `CircleAlert`, ligada por
  `aria-describedby`, e `aria-invalid="true"`.
- Ajuda: abaixo do campo, `text-caption` `ink-muted`.
- Campo opcional: "(opcional)" no label, em `ink-muted`. Campos obrigatórios não levam asterisco.

### 7.3 Chips
- Altura 28 px (área de toque de 44 px quando clicável), raio 999 px, fundo `brand-soft`, texto `brand-soft-ink`,
  `text-caption` 500, ícone opcional de 14 px.
- Uso: duração, local, fuso no resumo do evento.

### 7.4 Badges de status
Mesmo formato do chip, com ponto de 6 px à esquerda.
| Status | Fundo | Texto | Rótulo |
| --- | --- | --- | --- |
| confirmada | `success-soft` | `success-ink` | Confirmada |
| remarcada | `warning-soft` | `warning-ink` | Remarcada |
| cancelada | `neutral-soft` | `neutral-ink` | Cancelada |
| passada | `neutral-soft` | `neutral-ink` | Concluída |

### 7.5 Calendário mensal
- Cabeçalho: nome do mês e ano em `text-heading` display, à esquerda; botões "Mês anterior" e "Próximo mês"
  (só ícone, 44 px, `aria-label`) à direita. Mês anterior ao atual fica desabilitado.
- Grade 7 colunas, semana começando no domingo. Rótulos D S T Q Q S S em `text-caption` `ink-muted`, com nome
  completo em `abbr title` para leitores de tela.
- Célula: quadrada, mínimo 44 px, raio 12 px, `text-label` `tabular-nums`.

| Estado | Visual |
| --- | --- |
| disponível | fundo `brand-soft`, texto `brand-soft-ink` 600, hover borda 1 px `brand` |
| selecionado | fundo `brand`, texto branco 600 |
| hoje | ponto de 4 px abaixo do número (cor do texto atual) |
| indisponível | sem fundo, texto `ink-disabled`, `aria-disabled`, não focável pelo clique |
| fora do mês | não renderizado (célula vazia) |

- Teclado: padrão de grade ARIA (`role="grid"`). Setas movem um dia, Home e End vão ao início e fim da semana,
  PageUp e PageDown trocam o mês, Enter ou Espaço seleciona. Foco cai no dia selecionado ou no primeiro disponível.
- Cada botão de dia tem `aria-label` completo: "quarta-feira, 3 de dezembro, horários disponíveis".

### 7.6 Lista de horários
- Coluna com rolagem própria no desktop; no mobile, grade de 2 ou 3 colunas abaixo do calendário.
- Título: dia selecionado por extenso ("Quarta, 3 de dezembro").
- Slot: botão de 48 px, raio 12 px, borda 1 px `border`, texto `ink` 500 `tabular-nums`, hover borda `brand`.
- Selecionado: borda 2 px `brand`, fundo `slot-selected`, texto `brand` 600, `aria-pressed="true"`.
  A borda de 2 px não pode deslocar o layout (compensar padding ou usar `box-shadow inset`).
- Botão fixo no rodapé da coluna: "Continuar · 14:30" (`primary`, 52 px). Sem slot escolhido, mostra
  "Escolha um horário" e fica desabilitado.
- Grupo de slots com `role="radiogroup"` e rótulo do dia é uma alternativa aceitável; escolher uma e manter.

### 7.7 Seletor de fuso
- No header do agendamento: ícone `Globe` + nome do fuso ("Horário de Brasília") + hora atual, como botão.
- Abre um combobox pesquisável (por cidade, país e sigla) com a lista de fusos IANA, agrupada por região.
- Ao trocar, a lista de horários atualiza com transição curta (7.12) e um aviso `aria-live="polite"`.

### 7.8 Barra de progresso (mobile)
- 3 segmentos iguais (Horário, Seus dados, Confirmação), 4 px de altura, raio 999 px, gap 6 px.
- Concluído e atual em `brand`; futuro em `brand-soft`. Texto "Passo 2 de 3" acima, `text-caption`.
- `role="progressbar"` com `aria-valuenow`, `aria-valuemin`, `aria-valuemax` e `aria-valuetext`.

### 7.9 Abas (Próximas, Passadas, Canceladas)
- Linha de abas com borda inferior `divider`. Ativa: texto `ink` 600 e sublinhado de 2 px `brand`.
  Inativa: texto `ink-muted`, hover `ink`.
- Contador opcional ao lado do rótulo, em chip neutro.
- Padrão ARIA `tablist`, setas para navegar. O sublinhado desliza entre abas (7.12).

### 7.10 Item de reunião (painel)
Linha em card `rounded-card-sm`, altura mínima 72 px:
1. Horário (`text-label` 600 `tabular-nums`) e duração abaixo (`text-caption` `ink-muted`).
2. Barra vertical de 3 px com a cor do evento, raio 999 px.
3. Nome do convidado (`text-body` 600) e, abaixo, evento · local (`text-caption` `ink-muted`).
4. Badge de status.
5. Menu (botão só de ícone `Ellipsis`, `aria-label="Ações da reunião com {nome}"`): Ver detalhes, Remarcar,
   Cancelar, Copiar link de gestão.

Agrupado por dia com cabeçalho "Hoje", "Amanhã" ou data por extenso. No mobile, horário e status ficam
na mesma linha e o restante quebra embaixo.

### 7.11 Foco
- Anel de 2 px `brand` com offset de 2 px, via `:focus-visible` (não aparece em clique de mouse).
- Na sidebar escura: anel `focus-on-dark`.
- Nunca remover `outline` sem substituto.

### 7.12 Feedback
- **Toast**: canto inferior (centro no mobile, direita no desktop), card `surface` com `shadow-pop`, ícone e texto,
  some em 4 s, pausa no hover, `role="status"`. Erros persistem até fechar.
- **Alerta inline**: card `danger-soft` com borda `danger` a 20%, ícone e ação "Tentar de novo".
- **Confirmação destrutiva**: diálogo modal com título que diz a consequência ("Cancelar reunião com Ana?"),
  campo opcional de motivo, botões "Voltar" e "Cancelar reunião".

---

## 8. Estados obrigatórios em toda tela

| Estado | Regra |
| --- | --- |
| Carregando | skeleton com a mesma forma do conteúdo final (blocos `divider` em `rounded-control`), pulso suave de opacidade 0.6 a 1 em 1.2 s. Nunca spinner de página inteira. |
| Vazio | ícone lucide de 24 px em `ink-muted`, título curto, uma frase e, quando fizer sentido, uma ação. Sem ilustração. |
| Erro | o que aconteceu em linguagem simples + o que fazer + botão "Tentar de novo". Erros de campo aparecem no campo. |
| 404 | "Página não encontrada" com link para a página anterior ou para o perfil do anfitrião. |

Exemplos de texto:
- Dia sem horários: "Nenhum horário livre neste dia. Tente outra data."
- Mês sem horários: "Sem horários disponíveis em dezembro." + botão "Ver próximo mês".
- Painel sem reuniões: "Nenhuma reunião marcada ainda." + botão "Copiar link da página".
- Horário tomado: "Esse horário acabou de ser reservado. Escolha outro."

---

## 9. Movimento

Biblioteca: Motion (`motion/react`). CSS puro quando bastar (hover, pressed).

| Token | Valor | Uso |
| --- | --- | --- |
| `duration-fast` | 120 ms | hover, pressed, cor |
| `duration-base` | 200 ms | seleção de dia e slot, abas, toasts |
| `duration-slow` | 320 ms | troca de passo, entrada de painel lateral, modal |
| `ease-out-soft` | `cubic-bezier(0.23, 1, 0.32, 1)` | entradas e a maioria das transições |
| `ease-in-out-soft` | `cubic-bezier(0.77, 0, 0.175, 1)` | elementos que já estão na tela e mudam de lugar |

Onde usar:
- Seleção de dia: o fundo `brand` aparece com `scale` de 0.96 para 1.
- Troca de mês: deslocamento de 8 px na direção da navegação + fade, 200 ms.
- Lista de horários ao trocar dia ou fuso: fade com escalonamento de 15 ms por item, no máximo 12 itens animados.
- Passos do fluxo: deslocamento de 12 px + fade.
- Sublinhado das abas: `layoutId` do Motion.
- Toasts: entram de baixo 8 px, saem com fade.

Regras:
- Nunca animar a partir de `scale(0)`. Começar em 0.95 ou mais.
- Animar só `transform` e `opacity`.
- Nada passa de 320 ms. Interações repetidas (teclado no calendário) não animam deslocamento.
- `prefers-reduced-motion: reduce`: remove deslocamentos e escalas, mantém só fades de até 120 ms.

---

## 10. Layout das telas

### 10.1 Página pública do anfitrião `/[username]`
- Header com `<Logo variant="light" />` (link para o site da agência no perfil Tech Resolute; nos outros perfis,
  rodapé discreto "Feito com Tech Resolute").
- Card central: avatar 72 px, nome em `text-display`, mensagem de boas-vindas.
- Lista de eventos ativos: um card por evento com barra superior de 3 px na cor do evento, título, chips de duração
  e local, descrição em até 2 linhas e seta. O card inteiro é o link.

### 10.2 Agendamento desktop `/[username]/[evento]` (a partir de 1024 px)
- Header: `<Logo variant="light" />` à esquerda; seletor de fuso à direita.
- Card branco `rounded-card` com 3 colunas separadas por `divider`:
  1. **Resumo** (280 px): avatar 40 px e nome do anfitrião, nome do evento em `text-title`, linhas com ícone de
     duração e local, descrição, chips.
  2. **Calendário** (flexível, mínimo 340 px).
  3. **Horários** (260 px): lista com rolagem e botão "Continuar · HH:MM" fixo embaixo.
- Ao continuar, as colunas 2 e 3 são substituídas pelo formulário; a coluna 1 continua, agora com data e horário.

### 10.3 Agendamento tablet (640 a 1023 px)
- 2 colunas: resumo em cima ocupando a largura; calendário e horários lado a lado embaixo.

### 10.4 Agendamento mobile (até 639 px)
- Barra de progresso de 3 passos no topo.
- **Passo 1**: card de resumo compacto (evento, duração, local), calendário, horários em grade abaixo do dia,
  botão "Continuar · HH:MM" fixo no rodapé com `safe-area-inset-bottom`.
- **Passo 2**: card de resumo com data e horário escolhidos e link "Alterar"; formulário em uma coluna;
  botão "Confirmar agendamento" fixo no rodapé.
- **Passo 3**: confirmação.

### 10.5 Confirmação
- Ícone `CircleCheck` em `success-ink`, título "Reunião confirmada", frase "Enviamos os detalhes para {e-mail}."
- Resumo: evento, data por extenso, horário com fuso, local (link clicável quando for online), anfitrião.
- Botões: "Adicionar ao calendário" (`primary`, baixa o `.ics`) e "Agendar outro horário" (`ghost`).
- Link discreto: "Precisa mudar? Cancelar ou remarcar".

### 10.6 Gestão pelo convidado `/booking/[token]`
- Card de 480 px com o resumo da reunião e o status.
- Ações "Remarcar" (`secondary`) e "Cancelar reunião" (`danger`).
- Remarcar reutiliza o calendário e a lista de horários do 10.2, com o horário atual indicado.
- Fora do prazo: mensagem explicando e o e-mail do anfitrião.

### 10.7 Painel
- **Sidebar** (240 px, `sidebar`, fixa no desktop): `<Logo variant="dark" />` no topo; navegação Reuniões,
  Tipos de evento, Disponibilidade, Perfil (ícone + texto, 44 px, item ativo com fundo `sidebar-active` e texto
  branco); no rodapé, o link público com botão "Copiar link".
- **Mobile**: a sidebar vira header com logo e botão de menu que abre a navegação como gaveta (`dialog`).
- **Conteúdo de Reuniões**: título "Reuniões" + data de hoje por extenso; abas Próximas, Passadas, Canceladas;
  lista agrupada por dia.
- **Coluna lateral** (320 px, a partir de 1280 px; abaixo disso, vai para o fim da página): card "Tipos de evento"
  com nome, ponto de cor, duração e botão "Copiar link"; card do modo demo quando aplicável.
- **Card de modo demo**: `surface` com borda `border`, ícone `FlaskConical`, título "Modo demonstração",
  frase "Os dados são fictícios e voltam ao original todo dia." Discreto, sem cor de alerta.

---

## 11. Acessibilidade (AA)

- Contraste conforme 2.3. Texto nunca abaixo de 4.5:1; componentes e foco nunca abaixo de 3:1.
- Teclado: toda ação alcançável por Tab na ordem visual. Calendário com setas (7.5). Diálogos prendem o foco e
  devolvem ao elemento de origem ao fechar. Esc fecha menus e diálogos.
- Link "Pular para o conteúdo" como primeiro elemento focável.
- Labels em todos os campos; erros com `aria-invalid` e `aria-describedby`; resumo de erros focado ao enviar.
- `aria-live="polite"` para mudanças de horários, toasts e confirmação de cópia ("Link copiado").
- Landmarks: `header`, `nav`, `main`, `footer`. Um único `h1` por página.
- Alvos de toque de no mínimo 44 x 44 px.
- `lang="pt-BR"` no `html`; datas lidas por extenso nos `aria-label`.
- Zoom de 200% sem perda de conteúdo; layout funcionando a partir de 320 px.

---

## 12. Texto e tom

- Português do Brasil, frases curtas, voz ativa, segunda pessoa ("Escolha um horário").
- Botões dizem a ação ("Confirmar agendamento"), nunca "OK" ou "Enviar".
- Datas: "quarta-feira, 3 de dezembro de 2026" por extenso; curto "qua., 3 dez.". Hora "14:30".
- Fuso por nome legível ("Horário de Brasília", "Horário de Lisboa") e sigla UTC entre parênteses quando ajudar.
- Sem travessão, sem exclamação em excesso, sem emoji.

---

## 13. Tokens em código

Arquivo `app/theme.css`, importado pelo `app/globals.css` na etapa 2:

```css
@import "tailwindcss";
@import "./theme.css";
```

As fontes entram como variáveis CSS do `next/font` (`--font-inter` e `--font-space-grotesk`) e são mapeadas no
bloco `@theme inline`.
