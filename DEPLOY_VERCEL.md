# Como colocar o site no ar (Vercel — plano gratuito)

Passo a passo simples, sem precisar mexer em nada técnico.

## 1. Criar conta na Vercel
1. Acesse https://vercel.com/signup
2. Escolha **"Continue with GitHub"**
3. Faça login com a conta GitHub da organização `partiu-empreender` (a mesma de onde você deu acesso ao João)
4. Quando perguntar o tipo de plano, escolha **Hobby (gratuito)**

## 2. Importar o projeto
1. No painel da Vercel, clique em **"Add New" → "Project"**
2. A Vercel vai pedir permissão para acessar seus repositórios do GitHub — autorize
3. Encontre o repositório **PartiuPro** na lista e clique em **"Import"**
4. Em "Framework Preset" ela já deve detectar **Next.js** sozinha — não precisa mexer

## 3. Adicionar as variáveis de ambiente (obrigatório antes do primeiro deploy)
Ainda na tela de import, existe uma seção **"Environment Variables"**. Adicione cada uma dessas (nome à esquerda, valor à direita):

| Nome | Onde pegar o valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Painel do Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Painel do Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Painel do Supabase → Project Settings → API (chave secreta, não compartilhar — usada só na área administrativa) |

> Quando novas integrações (IA, mapas, WhatsApp etc.) entrarem no roadmap, essa tabela cresce junto. Por enquanto é só isso.

## 4. Deploy
1. Clique em **"Deploy"**
2. Espera ~1-2 minutos
3. Pronto — a Vercel te dá um link tipo `partiu-pro.vercel.app`

## 5. Me dar acesso pra eu continuar ajudando (opcional, mas recomendado)
Depois do deploy:
1. Vá em **Settings → Members** (dentro do projeto ou do time, na Vercel)
2. Clique em **"Invite Member"**
3. Convide o e-mail do João como **membro do time**

Assim ele consegue ver logs, redeploys e configurar variáveis de ambiente direto com o próprio login dele — sem nunca precisar da sua senha.

---
**Nota sobre o plano gratuito:** o plano Hobby da Vercel é destinado a projetos pessoais/não-comerciais pelos termos de uso. Para um projeto que gera receita, o ideal a médio prazo é o plano Pro. Para começar e validar o produto, o Hobby funciona bem — é só ter em mente que pode ser necessário migrar depois.
