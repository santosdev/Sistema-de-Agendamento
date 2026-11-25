# E-mails de login (Supabase Auth)

Os e-mails de confirmação de cadastro, link de acesso, recuperação de senha e troca de e-mail são enviados pelo
Supabase, não pelo Resend. Os modelos em português ficam em `supabase/templates/`.

- **Local** (`supabase start`): já são usados, pelo `supabase/config.jsonc`.
- **Projeto hospedado**: copie cada modelo no painel, como descrito abaixo. Não use `supabase config push`, porque ele
  também enviaria o `site_url` local.

## Passo a passo no painel

1. Em **Authentication > URL Configuration**:
   - **Site URL**: a URL do sistema (`NEXT_PUBLIC_APP_URL`, por exemplo `https://<projeto>.vercel.app`). Os modelos
     montam o link com `{{ .SiteURL }}`, então ela precisa estar certa.
   - **Redirect URLs**: inclua `<NEXT_PUBLIC_APP_URL>/auth/callback` (e `http://localhost:3000/auth/callback` para
     testar localmente).
2. Em **Authentication > Emails > Templates**, para cada modelo, troque o assunto e cole o HTML do arquivo:

| Modelo no painel | Assunto | Arquivo |
| --- | --- | --- |
| Confirm sign up | Confirme seu e-mail | `supabase/templates/confirmation.html` |
| Magic link | Seu link de acesso | `supabase/templates/magic_link.html` |
| Reset password | Crie uma nova senha | `supabase/templates/recovery.html` |
| Change email address | Confirme a troca de e-mail | `supabase/templates/email_change.html` |

3. Salve cada um e faça um teste: em `/forgot-password`, peça um link para o seu e-mail.

## Como os links funcionam

Todos apontam para `/auth/callback` com `token_hash` e `type`. A rota valida o token no servidor e redireciona:

| Tipo | Destino |
| --- | --- |
| `email` (cadastro e link de acesso) | `/dashboard` |
| `recovery` | `/reset-password`, onde a pessoa escolhe a senha nova |
| `email_change` | `/dashboard/profile` com o aviso "Link confirmado" |

Esse formato funciona mesmo quando o link é aberto em outro navegador ou no celular, ao contrário do fluxo padrão
(PKCE), que exige o mesmo navegador.

**Troca de e-mail:** com "Secure email change" ligado (padrão do Supabase), os dois endereços recebem um link e a troca
só vale depois que os dois forem confirmados.

**Limite de envio:** o SMTP padrão do Supabase envia poucos e-mails por hora. Para uso real, configure um SMTP próprio
em **Authentication > Emails > SMTP Settings** (o Resend oferece SMTP: `smtp.resend.com`, porta 465, usuário `resend`,
senha = a chave da API).
