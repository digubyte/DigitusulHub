# Digitusul Hub

Plataforma interna modular da Digitusul. Núcleo (login, perfis, permissões, módulos, Brand Kit, auditoria) + primeiro módulo funcional: **Estúdio de Flyers**.

## Publicar grátis (Vercel + Neon + Vercel Blob)

Tudo no plano gratuito. Cada `git push` na branch `main` publica uma nova versão.

1. **Vercel:** entre em [vercel.com](https://vercel.com) com a conta do GitHub → **Add New… › Project** → importe `digubyte/DigitusulHub` → **Deploy**. O primeiro deploy vai falhar por falta do banco; é esperado.
2. **Banco:** no projeto da Vercel, aba **Storage** → crie um **Prisma Postgres** ou **Neon** (ambos gratuitos) e conecte ao projeto. Isso preenche `DATABASE_URL`.
3. **Imagens (Blob):** na mesma aba **Storage › Create › Blob** → conecte ao projeto. Isso preenche `BLOB_READ_WRITE_TOKEN`.
4. **Variáveis:** em **Settings › Environment Variables**, adicione `SEED_ADMIN_EMAIL` com o e-mail do administrador (opcional: `ANTHROPIC_API_KEY` para IA e `REMOVE_BG_API_KEY` para remoção de fundo).
5. **Deployments › ⋯ › Redeploy.** O build (`npm run vercel-build`) aplica as migrações do banco e publica.
6. Acesse `https://<projeto>.vercel.app`: enquanto não houver administrador, abre a tela de **Primeiro acesso**, onde a pessoa com o e-mail de `SEED_ADMIN_EMAIL` escolhe a própria senha. Depois disso a tela deixa de existir.

Limites do plano gratuito que importam aqui: uploads de até 4 MB por imagem (fotos maiores são reduzidas automaticamente no navegador, mantendo a proporção) e banco/armazenamento com cota gratuita do Neon e da Vercel.

## Rodar localmente

Requisitos: Node.js 20+.

```bash
npm install
cp .env.example .env        # cole as URLs do Neon (pode usar um branch "dev" do banco) e defina SEED_ADMIN_PASSWORD
npm run setup               # aplica as migrações e cria o primeiro administrador
npm run dev                 # http://localhost:3000
```

No Windows também dá para usar `start-dev.cmd`. Sem `BLOB_READ_WRITE_TOKEN`, as imagens ficam na pasta `storage/` local.

Outros comandos: `npm test` (testes), `npm run typecheck`, `npm run build && npm start`.

## Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| App | Next.js 15 (App Router) + React 19 + TypeScript | Front e back no mesmo projeto, rotas de servidor tipadas, SSR para checar sessão antes de renderizar |
| UI | Tailwind CSS + componentes próprios + lucide-react | Design system leve, tokens da marca em um só lugar |
| Banco | Prisma ORM + PostgreSQL (Neon) | Gratuito, gerenciado, com migrações versionadas em `prisma/migrations` |
| Autenticação | Sessões próprias no banco (cookie httpOnly) + bcrypt | Controle total de perfis/permissões e revogação imediata de sessões |
| Editor | Konva (react-konva) | Canvas performático com seleção/transformação; textos e preços continuam objetos editáveis |
| Validação | Zod no servidor | Todo payload validado antes de tocar o banco |
| IA | SDK oficial Anthropic (Claude), opcional | Saída estruturada; chave só no servidor |
| Exportação | Canvas → PNG/JPG; jsPDF → PDF | Resolução exata do formato, sem marca d'água |

## Arquitetura

```
src/
  core/                  Núcleo da plataforma (independente dos módulos)
    auth/                sessões, senhas, login, bloqueio por tentativas, redefinição
    modules/registry.ts  ← manifesto dos módulos (menu, rota, permissão)
    permissions.ts       catálogo de permissões e perfis padrão
    storage/             armazenamento privado + validação de uploads
    http.ts              wrapper de API: autenticação, permissão, CSRF, erros
    audit.ts             histórico de atividades
  components/            design system (UI) e shell (menu lateral)
  modules/flyer-studio/  Módulo 01
    domain/              regras puras e testadas: tipos, formatos, preço, layout, validação
    ai/                  Claude + interpretador por regras + proteção de dados comerciais
    catalog/             catálogo do site Digitusul
    services/            persistência (com escopo de permissão)
    components/          assistente, editor, canvas, exportação
  app/                   rotas (páginas e API)
prisma/                  schema e seed
tests/                   testes das regras críticas
```

### Adicionar um novo módulo
1. Adicione o manifesto em `src/core/modules/registry.ts` (nome, ícone, rota, permissão).
2. Crie as permissões em `src/core/permissions.ts` e rode `npm run db:seed`.
3. Crie a rota em `src/app/(hub)/<rota>/page.tsx` usando `requirePageUser("<permissão>")`.
4. O módulo aparece no menu, no Dashboard e em **Administração › Módulos** sem mexer no núcleo.

Os módulos futuros (Gestão Comercial, CRM, Marketing, Relatórios) já estão registrados como "Em desenvolvimento" e só exibem uma página informativa — não há funcionalidades simuladas.

## Segurança
- Permissões verificadas **no servidor** em toda página e rota de API; consultas de flyers sempre filtradas pelo escopo do usuário (projetos alheios respondem 404).
- Sessões no banco (12 h, renovação por uso), cookie `httpOnly`/`SameSite=Lax`, verificação de origem (CSRF) em requisições que alteram dados.
- Bloqueio de 15 min após 5 senhas erradas; limitador por IP; resposta idêntica para e-mail inexistente.
- Uploads validados pelo **conteúdo** (assinatura binária), limite de 4 MB e 12.000 px; SVG só no Brand Kit e sem scripts/referências externas; arquivos fora de `/public` (disco local ou Vercel Blob com endereço aleatório guardado só no banco), servidos apenas com sessão e cabeçalhos que impedem execução.
- Chaves de API apenas em `.env` no servidor; a tela de Integrações mostra só se estão configuradas.
- Sempre resta ao menos um administrador ativo; administradores não podem rebaixar a si mesmos.

## Estúdio de Flyers — regras críticas
- **Dados comerciais são a fonte da verdade.** Código, nome e preço no flyer são textos *vinculados* ao cadastro; a validação bloqueia exportação se divergirem, se faltarem, se estiverem fora da área ou cobertos por outro elemento.
- **A IA nunca escreve dados comerciais.** Ela só devolve parâmetros visuais (categoria, formato, chamadas, fundo, ênfase); textos com valores, percentuais ou códigos são descartados. Sem chave de IA, um interpretador por regras assume e a interface avisa.
- **Logotipo protegido:** proporção travada, sem rotação/recorte, bloqueado por padrão; a exportação confere se é o arquivo oficial do Brand Kit e se não foi distorcido.
- **Exportação com resolução exata:** o arquivo é renderizado 1:1 e suas dimensões são conferidas no navegador e no servidor.
- **Histórico:** cada salvamento cria uma versão (até 30 por projeto); exclusão é lógica.

### Herdado do Digitusul Prompt Genie (Lovable)
O projeto anterior foi reescrito e integrado ao Estúdio:
- Importação do **catálogo do site** (sorteio por categoria com estoque > 2, busca por códigos, busca com IA). Na importação, os dados são buscados de novo no servidor — o navegador não define preços.
- **Regra de preço**: valor no cartão + 8,12%, arredondado para ,50/,75/,90/,95/,99 (como no código anterior). Configurável em **Administração › Integrações e regras**. O valor PIX nunca é usado; preço incerto na leitura de imagem bloqueia a exportação até ser confirmado. Cálculo em centavos inteiros, coberto por testes.
- **Leitura de print/foto por IA** (preenche só campos vazios).
- **Lista** "Código - Nome - Valor" e **CSV** no modelo `Sku,Nome,Ativo,Ordem`.
- Removido: gateway de IA do Lovable, dezenas de componentes não usados, código duplicado entre as funções de catálogo.

## Criar flyers com o ChatGPT (um flyer ou lote)

Fluxo padrão em **Estúdio › Novo flyer ou lote**:

1. **Configuração** — lote (2 a 8 flyers, padrão 6) ou flyer único, segmento (Gamer, Limpeza, Escritório…), tipo e formato.
2. **Produtos** — catálogo do site, digitados ou por print. No lote, são divididos em ordem entre os flyers.
3. **Estilo** — título, subtítulo, rodapé, destaque, mascote e instruções extras.
4. **Aprovação** — resumo de cada flyer (produtos e preços) e o prompt completo, editável. Nada é salvo antes de aprovar.

Depois de aprovar, cada flyer tem: **Baixar ZIP** (fotos com os nomes citados no prompt + logo + mascote),
**Copiar e abrir** (copia o prompt e abre o chatgpt.com; também dá para colar no app do ChatGPT) e **Enviar a arte gerada**.
Ao enviar a arte, o usuário marca produto por produto que nome, código e preço conferem — só então ela é salva.
O download sai no tamanho exato do formato (recorte centralizado) ou no original.

Proteções: o prompt é montado pelo aplicativo com os dados do cadastro; o servidor recusa prompts (mesmo editados)
que não contenham o nome, o código e o preço exatos de cada produto. A montagem manual no editor continua em
**Montar manualmente** (`/estudio/novo?modo=manual`) para quando o preço precisa sair garantido ao centavo.

## Integrações opcionais (`.env`)
- `ANTHROPIC_API_KEY` (+ `AI_MODEL`, padrão `claude-opus-5-5`): Criar com IA, leitura de imagens, busca inteligente no catálogo. Usa fallback de servidor da Anthropic em caso de recusa.
- `REMOVE_BG_API_KEY`: remoção de fundo (a original é preservada).
- E-mail: não implementado — links de redefinição são gerados pelo administrador em **Usuários**. Ponto de extensão: `sendResetEmail` em `src/core/auth/auth-service.ts`.

## Próximos passos de infraestrutura
- Provedor de e-mail para redefinição de senha (`sendResetEmail` em `src/core/auth/auth-service.ts`).
- Limitador de tentativas de login em Redis (hoje é por instância).
- Domínio próprio na Vercel (Settings › Domains).

## Testes
`npm test` cobre: regra de preço, parse de valores, motor de layout (6 categorias × 8 formatos × 1/2/4/6 produtos, todos validados), preservação de código/nome/preço, logotipo, cobertura de preço, omissão de produto, área útil, dimensões, perfis e permissões, validação de uploads e SVG, e a proteção contra a IA inserir valores comerciais.
