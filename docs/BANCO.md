# Banco de dados

Postgres do Supabase. Migrations em `supabase/migrations`, aplicadas em ordem.

## Aplicando no projeto do supabase.com

```bash
npm run supabase -- login
npm run supabase -- link --project-ref <ref do projeto>
npm run db:push
npm run db:types        # gera lib/supabase/database.types.ts
npm run demo:reset      # cria o anfitrião demo e os dados fictícios
```

`npm run supabase` é um wrapper do CLI que remove a variável `BUN_INSPECT` exportada pelo terminal do VS Code
(sem isso o CLI falha com "Failed to start inspector").

## Tabelas

| Tabela | Conteúdo |
| --- | --- |
| `profiles` | um por usuário do Auth: username, nome, foto, fuso, mensagem, `is_public` |
| `event_types` | tipos de evento do anfitrião (duração, local, buffers, antecedência, janela, limite diário, perguntas) |
| `availability_rules` | horários semanais (dia da semana + intervalo), no fuso do perfil |
| `availability_overrides` | exceções por data: folga (sem horário) ou horário especial |
| `bookings` | reservas, com cópia dos dados do evento, respostas e hash do token |
| `rate_limit_hits` | registros do rate limit (só o servidor acessa) |

Todos os instantes são `timestamptz`. Horários semanais e exceções são hora de parede no fuso do anfitrião.

## Regras garantidas pelo banco

- **Sem conflito de horário:** `EXCLUDE USING gist` em `bookings` sobre `host_id` e
  `tstzrange(início - buffer antes, fim + buffer depois)`, ignorando canceladas. Vale entre todos os eventos
  do anfitrião e também para inserts diretos.
- **Disponibilidade sem sobreposição:** exclusões também em `availability_rules` (mesmo dia da semana) e
  `availability_overrides` (mesma data; folga conflita com qualquer intervalo).
- **Revalidação no servidor:** `create_booking` e as funções de remarcação conferem passado, antecedência,
  janela máxima, disponibilidade (com exceções e horário de verão), alinhamento ao intervalo, limite diário,
  dados do convidado e respostas.
- **Token de gestão:** 32 bytes aleatórios (43 caracteres base64url). Só o SHA-256 fica salvo.
- **Limite diário sem corrida:** escritas de reserva de um mesmo anfitrião são serializadas com advisory lock.
- **Demo protegido:** linhas com `is_seed = true` não podem ser criadas, alteradas nem apagadas, exceto pelo
  `seed_demo`, que libera a escrita só dentro da própria transação.

## Quem pode o quê (RLS e grants)

Projetos novos do Supabase não dão permissão automática nas tabelas para os papéis da API. Por isso há duas
camadas: os `GRANT` (migration `table_grants`) dizem quais operações cada papel pode tentar, e o RLS diz em
quais linhas. O anfitrião só pode alterar colunas editáveis do perfil (nunca `id` nem `is_seed`).

| Papel | Pode |
| --- | --- |
| `anon` | ler perfis públicos, eventos ativos e disponibilidade de anfitriões públicos; `get_busy_ranges` |
| `authenticated` | o mesmo, mais ler e alterar os próprios dados; ler as próprias reservas; `host_cancel_booking` e `host_reschedule_booking` |
| `service_role` (servidor) | `create_booking`, fluxos por token, `consume_rate_limit`, `seed_demo`, `run_maintenance` |

Ninguém escreve em `bookings` diretamente pela API. O público nunca lê reservas nem dados de convidados:
`get_busy_ranges` devolve só horários ocupados.

## Funções

| Função | Uso |
| --- | --- |
| `get_busy_ranges(host, de, até)` | horários ocupados de um anfitrião público (máx. 100 dias) |
| `create_booking(...)` | cria a reserva e devolve o token uma única vez |
| `get_booking_by_token(token)` | dados da reserva para `/booking/[token]`, com prazo e `can_modify` |
| `cancel_booking_by_token(token, motivo)` | cancelamento pelo convidado |
| `reschedule_booking_by_token(token, novo início)` | remarcação pelo convidado (mesma linha, mesmo token) |
| `host_cancel_booking(id, motivo)` | cancelamento pelo anfitrião |
| `host_reschedule_booking(id, novo início)` | remarcação pelo anfitrião (pode ignorar a antecedência) |
| `consume_rate_limit(bucket, máx, janela)` | `true` se a ação é permitida |
| `seed_demo(host)` | recria os dados do anfitrião demo com datas relativas a hoje |
| `run_maintenance()` | anonimiza convidados de reuniões com mais de 12 meses e limpa o rate limit |

### Códigos de erro

As funções levantam `P0001` com uma destas mensagens, que o app traduz para a interface:

`event_not_found`, `booking_not_found`, `not_authenticated`, `invalid_guest`, `invalid_answers`,
`invalid_input`, `slot_in_past`, `outside_notice`, `outside_booking_window`, `outside_availability`,
`daily_limit_reached`, `slot_taken`, `booking_already_cancelled`, `modification_deadline_passed`,
`demo_seed_protected`.

## Testes

`npm run test:db` sobe um Postgres em memória (PGlite) que imita os papéis, o schema `auth` e o `storage` do
Supabase, aplica as migrations e testa constraint, funções, RLS, demo e manutenção.
