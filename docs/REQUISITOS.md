# Requisitos: Sistema de Agendamento Tech Resolute

Documento de regras de negócio e requisitos do sistema de agendamento de reuniões (estilo Calendly).
Projeto de portfólio da Tech Resolute, também usado em produção no site da agência para agendar calls
com clientes. O sistema é genérico: qualquer pessoa ou empresa pode criar conta e receber agendamentos.

Convenções:
- Código, nomes de tabelas, colunas e rotas em inglês.
- Interface em português do Brasil, com estrutura pronta para inglês.
- Todas as datas e horas são salvas em `timestamptz` (UTC). A conversão de fuso acontece só na exibição
  e na geração de slots.

---

## 1. Glossário

| Termo | Definição |
| --- | --- |
| Anfitrião (host) | Usuário autenticado que recebe agendamentos. Tem página pública em `/[username]`. |
| Convidado (guest) | Pessoa que agenda uma reunião. Não precisa de login. |
| Tipo de evento (event type) | Modelo de reunião oferecido pelo anfitrião (ex.: "Call de diagnóstico, 30 min"). |
| Disponibilidade (availability) | Horários semanais em que o anfitrião aceita reuniões. |
| Exceção (date override) | Regra para uma data específica: folga ou horário especial. |
| Slot | Horário de início livre que pode ser reservado. |
| Reserva (booking) | Reunião agendada. |
| Buffer | Tempo livre obrigatório antes ou depois de uma reunião. |
| Token de gestão | Código aleatório que permite ao convidado cancelar ou remarcar sem login. |

---

## 2. Escopo

### 2.1 Dentro do MVP
- Cadastro aberto de anfitriões, login com e-mail e senha ou magic link.
- Página pública do anfitrião e página de agendamento por tipo de evento.
- Geração de slots respeitando todas as regras da seção 5.
- Reserva com confirmação automática, cancelamento e remarcação pelo convidado e pelo anfitrião.
- E-mails de confirmação, cancelamento e remarcação com arquivo `.ics`.
- Painel do anfitrião: reuniões, tipos de evento, disponibilidade, perfil.
- Modo demo com reset.
- Embed (botão com modal e inline) para o site da Tech Resolute.

### 2.2 Fora do MVP (melhorias futuras)
- Equipes, round robin e eventos com vários anfitriões.
- Convidados adicionais na mesma reserva.
- Lembretes automáticos antes da reunião.
- Vários conjuntos de disponibilidade por anfitrião.
- Duração escolhida pelo convidado.
- Integração com Google Calendar via OAuth (etapa 12, opcional).
- Pagamentos.

---

## 3. Anfitrião e perfil

### 3.1 Conta
- RN-01: O cadastro é aberto. Qualquer pessoa cria conta com e-mail e senha ou magic link (Supabase Auth).
- RN-02: Cada conta tem exatamente um perfil (`profiles`), criado automaticamente no primeiro acesso.

### 3.2 Username
- RN-03: Entre 3 e 30 caracteres, apenas `a-z`, `0-9` e `-`. Não pode começar nem terminar com `-`.
- RN-04: Único e sem diferenciar maiúsculas (salvo sempre em minúsculas).
- RN-05: Palavras reservadas são bloqueadas: `dashboard`, `booking`, `api`, `login`, `logout`, `signup`,
  `auth`, `demo`, `settings`, `embed`, `admin`, `app`, `static`, `public`, `_next`, `privacy`, `privacidade`,
  `terms`, `termos`, `help`, `ajuda`.
- RN-06: Ao trocar o username, o link antigo deixa de funcionar. A interface avisa antes de salvar.

### 3.3 Dados do perfil
- Nome de exibição, foto, username, fuso horário (IANA, ex.: `America/Sao_Paulo`), mensagem de boas-vindas.
- RN-07: A foto é enviada ao Supabase Storage (bucket `avatars`), até 2 MB, formatos jpg, png ou webp.
  Sem foto, o avatar mostra as iniciais.
- RN-08: Flag `is_public`. Perfil oculto retorna 404 na página pública e em todos os seus eventos.
- RN-09: O fuso padrão do perfil é o fuso detectado no navegador no cadastro.

---

## 4. Tipos de evento

### 4.1 Campos

| Campo | Regra | Padrão |
| --- | --- | --- |
| Título | 1 a 80 caracteres | obrigatório |
| Slug | mesmas regras de formato do username, único por anfitrião | gerado do título |
| Descrição | até 1000 caracteres, texto simples com quebras de linha | vazio |
| Duração | fixa, entre 5 e 480 min | 30 min |
| Intervalo entre inícios | 5, 10, 15, 20, 30 ou 60 min | 30 min |
| Local | ver 4.2 | Google Meet |
| Buffer antes | 0 a 120 min | 0 |
| Buffer depois | 0 a 120 min | 0 |
| Antecedência mínima | em horas, 0 a 720 | 4 h |
| Janela máxima | em dias, 1 a 365 | 60 dias |
| Limite por dia | 1 a 50 ou sem limite | sem limite |
| Perguntas customizadas | ver 4.3 | nenhuma |
| Cor | uma cor de uma paleta fixa com contraste AA | roxo da marca |
| Ativo | sim ou não | sim |

### 4.2 Local
- RN-10: Tipos de local: `google_meet`, `zoom`, `phone`, `in_person`, `custom_link`.
- RN-11: Google Meet, Zoom e link custom usam um link fixo cadastrado pelo anfitrião (sem integração).
  O link só aparece para o convidado depois da reserva (tela de confirmação, e-mail e `.ics`).
- RN-12: Telefone tem dois modos:
  - `host_calls` ("eu ligo"): o telefone do convidado passa a ser obrigatório no formulário.
  - `guest_calls` ("convidado liga"): o número do anfitrião aparece depois da reserva.
- RN-13: Presencial exige endereço, exibido na página do evento e na confirmação.

### 4.3 Perguntas customizadas
- RN-14: Tipos: texto curto, texto longo, escolha única, múltipla escolha.
- RN-15: Cada pergunta tem rótulo, obrigatória (sim ou não) e, nos tipos de escolha, de 2 a 10 opções.
- RN-16: Máximo de 10 perguntas por evento.
- RN-17: As respostas são salvas na reserva junto com uma cópia do rótulo da pergunta. Se o anfitrião
  editar ou apagar a pergunta depois, as reservas antigas continuam legíveis.

### 4.4 Regras gerais
- RN-18: Evento inativo não aparece na página pública e sua URL retorna 404. Reservas existentes continuam válidas.
- RN-19: Apagar um tipo de evento com reservas futuras exige confirmação. As reservas futuras continuam
  válidas (o evento é arquivado, não removido do banco).

---

## 5. Disponibilidade e geração de slots

### 5.1 Disponibilidade semanal
- RN-20: Um único conjunto de disponibilidade por anfitrião, usado por todos os seus eventos.
- RN-21: Cada dia da semana pode ter zero ou mais intervalos (ex.: 09:00 a 12:00 e 14:00 a 18:00).
  Intervalos do mesmo dia não podem se sobrepor.
- RN-22: Os horários são interpretados no fuso do perfil do anfitrião.
- RN-23: Se o anfitrião troca o fuso do perfil, os horários mantêm a mesma hora local no novo fuso.
  A interface mostra um aviso antes de salvar.
- RN-24: Padrão de novo anfitrião: segunda a sexta, 09:00 a 18:00.

### 5.2 Exceções por data
- RN-25: Uma exceção vale para uma data no fuso do anfitrião e tem um de dois tipos:
  - folga: o dia inteiro fica indisponível;
  - horário especial: um ou mais intervalos que substituem a disponibilidade semanal daquele dia.
- RN-26: A interface permite escolher um intervalo de datas (férias) e gera uma exceção por dia.

### 5.3 Função de slots
Implementada como função pura em TypeScript, sem acesso a banco, coberta por testes Vitest.

Entradas:
- disponibilidade semanal e exceções;
- fuso do anfitrião;
- configuração do evento (duração, intervalo, buffers, antecedência, janela, limite diário);
- reservas ativas do anfitrião no período (de todos os seus eventos), com seus buffers;
- instante atual (`now`), injetado para permitir testes;
- intervalo de datas pedido e fuso do convidado (só para agrupar por dia na saída).

Regras:
- RN-27: Os slots começam no início de cada intervalo disponível e avançam pelo intervalo entre inícios.
- RN-28: Um slot só é válido se `[início, início + duração]` cabe inteiro dentro de um intervalo disponível.
- RN-29: Um slot é inválido se `[início - buffer antes, fim + buffer depois]` se sobrepõe a qualquer reserva
  ativa expandida pelos próprios buffers dela.
- RN-30: Um slot é inválido se começa antes de `now + antecedência mínima`. Nunca há slots no passado.
- RN-31: Um slot é inválido se começa depois de `now + janela máxima`.
- RN-32: O limite diário conta apenas reservas ativas daquele tipo de evento, no dia do fuso do anfitrião.
  Atingido o limite, o dia inteiro fica indisponível para aquele evento.
- RN-33: O conflito de horário considera todos os eventos do anfitrião.
- RN-34: Horário de verão: os intervalos são convertidos para UTC dia a dia com o fuso IANA. Em dia de
  transição, horários locais que não existem são ignorados e horários duplicados geram slots distintos em UTC.
- RN-35: A saída é uma lista de instantes UTC. O agrupamento por dia e a exibição usam o fuso do convidado,
  então um slot pode cair em outro dia para o convidado do que para o anfitrião.

### 5.4 Fuso do convidado
- RN-36: Detectado automaticamente pelo navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- RN-37: O convidado pode trocar o fuso numa lista pesquisável. A troca recalcula a exibição sem recarregar.
- RN-38: O fuso do convidado é salvo na reserva e usado nos e-mails enviados a ele.

---

## 6. Reservas

### 6.1 Formulário do convidado
| Campo | Regra |
| --- | --- |
| Nome | obrigatório, 2 a 100 caracteres |
| E-mail | obrigatório, formato válido |
| WhatsApp | opcional (obrigatório se o local for telefone `host_calls`), formato E.164, DDI +55 como padrão |
| Perguntas do evento | conforme 4.3 |
| Aviso de privacidade | texto curto com link para a política, exibido acima do botão |
| Honeypot | campo oculto. Se preenchido, a reserva é descartada em silêncio |

### 6.2 Criação
- RN-39: Confirmação automática. Não há aprovação do anfitrião.
- RN-40: A reserva é criada via Server Action com validação Zod e, no banco, por uma função segura
  (`security definer`) que revalida o slot antes de inserir.
- RN-41: Conflitos são impedidos no banco por `EXCLUDE USING gist` (extensão `btree_gist`) sobre
  `host_id` e `tstzrange(start_at - buffer_before, end_at + buffer_after)`, ignorando reservas canceladas.
  Se dois convidados tentam o mesmo horário, só um consegue. O outro vê "Esse horário acabou de ser
  reservado" e a lista de horários é atualizada.
- RN-42: O mesmo e-mail pode ter várias reservas ativas, inclusive no mesmo evento.
- RN-43: Os buffers e a duração são copiados para a reserva no momento da criação. Editar o evento depois
  não altera reservas existentes.

### 6.3 Status
| Status | Significado |
| --- | --- |
| `confirmed` | reserva ativa |
| `rescheduled` | reserva ativa que já teve o horário alterado |
| `cancelled` | cancelada, não bloqueia horário |

- RN-44: Uma reserva é "passada" quando `end_at < now`. Isso é calculado, não é um status.

### 6.4 Token de gestão
- RN-45: Gerado com pelo menos 32 bytes aleatórios (base64url), não sequencial e único.
- RN-46: Salvo no banco apenas como hash (SHA-256). O valor original só existe no link enviado ao convidado.
- RN-47: Dá acesso a `/booking/[token]` para ver, cancelar ou remarcar. Continua o mesmo após remarcação.

### 6.5 Cancelamento
- RN-48: O convidado pode cancelar até a antecedência mínima do evento antes do início. Depois disso,
  a página mostra os dados da reunião e a orientação para falar com o anfitrião.
- RN-49: O anfitrião pode cancelar a qualquer momento antes do fim da reunião.
- RN-50: Motivo do cancelamento é opcional (até 500 caracteres) e aparece no e-mail para a outra parte.
- RN-51: Reserva cancelada não pode ser reativada nem remarcada.

### 6.6 Remarcação
- RN-52: Remarcar atualiza a mesma reserva: novo `start_at` e `end_at`, status `rescheduled`,
  horário anterior guardado em `previous_start_at` e `rescheduled_at` registrado.
- RN-53: O novo horário passa pela mesma geração de slots e pela mesma constraint. O horário atual da
  própria reserva não conta como conflito.
- RN-54: O convidado pode remarcar dentro do mesmo prazo do cancelamento (RN-48). O anfitrião pode
  remarcar a qualquer momento antes do início.
- RN-55: Não há limite de remarcações. O rate limit da seção 8 se aplica.

---

## 7. Notificações por e-mail

Enviadas pelo Resend, com arquivo `.ics` anexado quando fizer sentido.

| Evento | Convidado | Anfitrião |
| --- | --- | --- |
| Reserva criada | confirmação + `.ics` + link de gestão | aviso de nova reserva + `.ics` |
| Cancelada pelo convidado | confirmação do cancelamento | aviso + motivo |
| Cancelada pelo anfitrião | aviso + motivo + link para agendar de novo | sem e-mail |
| Remarcada pelo convidado | novo horário + `.ics` atualizado | aviso com horário antigo e novo |
| Remarcada pelo anfitrião | aviso com horário antigo e novo + `.ics` atualizado | sem e-mail |

- RN-56: O `.ics` usa o mesmo `UID` durante toda a vida da reserva e incrementa `SEQUENCE`, para que
  calendários atualizem o evento em vez de duplicar. Cancelamento usa `METHOD:CANCEL`.
- RN-57: Horários nos e-mails aparecem no fuso de quem recebe (convidado no fuso da reserva,
  anfitrião no fuso do perfil), com o nome do fuso por extenso.
- RN-58: Falha no envio de e-mail não desfaz a reserva. O erro é registrado no log.

---

## 8. Segurança

- RN-59: Toda entrada é validada no servidor com Zod (Server Actions), mesmo que já validada no cliente.
- RN-60: Rate limit na criação, cancelamento e remarcação: tabela no Postgres com hash de IP e e-mail,
  no máximo 5 ações a cada 10 minutos por IP e por e-mail. Sem captcha e sem serviço externo.
- RN-61: RLS ativo em todas as tabelas:
  - público (anon): lê apenas perfis com `is_public = true`, eventos ativos desses perfis e slots
    calculados por função segura. Não lê reservas nem dados de convidados;
  - público cria, cancela e remarca reservas somente via funções `security definer` com validação interna;
  - anfitrião autenticado lê e altera apenas os próprios perfil, eventos, disponibilidade, exceções e reservas.
- RN-62: A função pública de slots retorna só instantes livres, nunca dados das reservas existentes.
- RN-63: Chaves secretas (service role, Resend) existem só no servidor.

---

## 9. Privacidade (LGPD)

- RN-64: Aviso curto no formulário de reserva com link para a política de privacidade.
- RN-65: Dados pessoais de convidados (nome, e-mail, telefone, respostas) de reuniões terminadas há mais de
  12 meses são anonimizados por um script. A reserva permanece para histórico.

---

## 10. Modo demo

- RN-66: Existe um anfitrião demo (usuário real) com perfil, tipos de evento, disponibilidade e reuniões
  fictícias (próximas, passadas, canceladas e remarcadas), com datas relativas ao dia do seed.
- RN-67: O botão "Entrar como anfitrião demo" faz login em um clique, sem expor senha na interface.
- RN-68: Os registros base têm `is_seed = true` e são protegidos por trigger no banco: não podem ser alterados
  nem excluídos. Na interface, ações destrutivas sobre eles aparecem como simuladas
  ("No modo demonstração esta ação é simulada").
- RN-69: O que o visitante cria no demo (eventos, reservas, exceções) funciona normalmente e é apagado no reset.
- RN-70: O perfil do demo não pode trocar username, e-mail nem senha.
- RN-71: Visitantes podem agendar na página pública do demo. A reserva é criada de verdade e removida no reset.
  O e-mail vai apenas para o próprio convidado. O anfitrião demo nunca recebe e-mail.
- RN-72: Reset por script (`npm run demo:reset`) e por cron diário (Vercel Cron), que recria o seed com datas
  relativas ao dia.
- RN-73: Um card discreto "Modo demonstração" aparece no painel enquanto a sessão for do anfitrião demo.

---

## 11. Uso real na Tech Resolute

- RN-74: Embed para o site da agência em três formas:
  - script leve com botão que abre um modal com iframe;
  - iframe inline;
  - link direto.
- RN-75: A página de agendamento funciona dentro de iframe (layout sem header quando `?embed=1`) e
  comunica a conclusão da reserva ao site pai via `postMessage`.

### Domínio (ainda não existe)
- RN-75a: Enquanto não houver domínio próprio, o app roda no subdomínio padrão da Vercel (`*.vercel.app`).
  A URL base vem sempre da variável `NEXT_PUBLIC_APP_URL`, então a troca para um domínio próprio é só configuração.
- RN-75b: O remetente dos e-mails vem da variável `EMAIL_FROM`. Sem domínio verificado, usa o remetente de testes
  do Resend (`onboarding@resend.dev`).
- **Limitação conhecida:** sem domínio verificado, o Resend só entrega e-mails para o endereço dono da conta Resend.
  Convidados reais só recebem e-mail depois que um domínio for verificado. Até lá, o envio para outros endereços
  falha sem desfazer a reserva (RN-58), e a tela de confirmação com o `.ics` continua funcionando.
- **Pendência P-02:** username da agência e eventos reais. Proposta inicial: username `techresolute` e o evento
  "Call de diagnóstico" (30 min, Google Meet), criados pelo próprio painel, fora do seed do demo.

---

## 12. Interface

- RN-76: Interface em português do Brasil. Textos centralizados num dicionário tipado (`pt-BR` e `en`),
  sem biblioteca externa e sem prefixo de idioma na rota por enquanto.
- RN-77: Hora no formato 24 h e semana começando no domingo em pt-BR. Em inglês, o formato segue o idioma.
- RN-78: Mobile first. O fluxo do convidado tem 3 passos: data e horário, dados, confirmação.
- RN-79: Toda tela tem estados de carregamento (skeleton), vazio e erro.
- RN-80: Acessibilidade AA: contraste, navegação por teclado, foco visível, labels em todos os campos,
  `aria-label` em botões só de ícone, alvos de toque com no mínimo 44 px.
- RN-81: Sem travessão nos textos da interface e da documentação.

---

## 13. Requisitos não funcionais

- Next.js (App Router), TypeScript strict, Tailwind.
- Supabase (Postgres, Auth, Storage, RLS) com `@supabase/ssr`.
- Zod e React Hook Form; date-fns e date-fns-tz; Motion; lucide-react.
- Resend e geração própria de `.ics`.
- Vitest para a função de slots e utilitários; Playwright para os fluxos de agendar, cancelar e remarcar.
- Deploy na Vercel.
- A página de agendamento deve carregar os slots do mês em até 1 s em condições normais.

---

## 14. Resumo das decisões (etapa 0)

| # | Decisão |
| --- | --- |
| 1 | Cadastro aberto, e-mail e senha ou magic link |
| 2 | Um anfitrião por evento |
| 3 | Username de 3 a 30, `a-z 0-9 -`, palavras reservadas |
| 4 | Flag `is_public` no perfil |
| 5 | Duração fixa |
| 6 | Intervalo entre inícios configurável, padrão 30 min |
| 7 | Limite diário por tipo de evento; conflito entre todos os eventos |
| 8 | Links fixos para Meet e Zoom; telefone com "eu ligo" ou "convidado liga" |
| 9 | 4 tipos de pergunta, até 10 por evento |
| 10 | Padrões: 4 h, 60 dias, buffers 0, sem limite |
| 11 | Vários intervalos por dia |
| 12 | Uma disponibilidade por anfitrião |
| 13 | Exceção de folga ou horário especial; intervalo de datas na interface |
| 14 | Disponibilidade no fuso do perfil, mantém hora local ao trocar |
| 15 | Confirmação automática |
| 16 | Remarcar atualiza a mesma reserva |
| 17 | Convidado cancela ou remarca até a antecedência mínima |
| 18 | Mesmo e-mail pode ter várias reservas |
| 19 | Sem convidados adicionais |
| 20 | WhatsApp E.164, +55 padrão |
| 21 | Anfitrião recebe e-mails das ações do convidado |
| 22 | Sem lembretes no MVP |
| 23 | Rate limit em tabela Postgres + honeypot |
| 24 | Sem domínio: remetente de testes do Resend via `EMAIL_FROM`, troca por configuração |
| 25 | Aviso de privacidade e anonimização após 12 meses |
| 26 | Seed protegido por trigger, ações simuladas, reset |
| 27 | Reservas no demo são reais e somem no reset; e-mail só para o convidado |
| 28 | Subdomínio da Vercel por enquanto; username e eventos reais pendentes (P-02) |
| 29 | Embed com botão e modal, inline e link direto |
| 30 | 24 h, semana começando no domingo |
| 31 | Dicionário i18n próprio |
| 32 | Foto no Supabase Storage, fallback de iniciais |
