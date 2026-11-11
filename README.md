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

## Hub de soluções

`/inicio` mostra as soluções da Digitusul: as ativas (hoje, o **Gerador de flyers**) e as “Em breve”
(Gestão Comercial, CRM, Marketing, Relatórios). Em **Admin › Soluções** dá para renomear, reordenar,
desativar ou esconder cada uma. Novas soluções entram em `src/core/modules/registry.ts`.
Modo claro (tons da marca) e escuro: botão sol/lua no topo.

## Gerador de flyers — Lote do dia (/lote)

Entrada principal do gerador. Escolhe-se uma categoria do site (ou palavra-chave) e quantos flyers de cada tipo
(padrão: 3 flyers com 6 produtos + 3 destaques de 1 produto). O servidor busca os produtos com foto e estoque
na ordem de relevância do site, separa os destaques (maior valor entre os relevantes, tipos diferentes) e agrupa
o restante pelo que tem em comum (tipo de produto, marca, palavras do nome) — `domain/batch-plan.ts`.
Cada produto pode ser trocado por um reserva parecido ou removido. O prompt de cada flyer lista todas as
imagens de referência (logo oficial + fotos, com os links do site); “Imagens” baixa os arquivos soltos e “ZIP” junto.
Sem logo no Brand Kit, usa o logo oficial do site (`public/brand/digitusul-logo.webp`).

## Gerador de flyers — Criar avulso (/criar)

Inspirado no Digitusul Prompt Generator (Lovable): uma tela só, em passos.

1. **Adicionar produtos** — sortear do site (categoria + quantidade; só produtos com foto e estoque > 2),
   buscar por código, enviar fotos/prints ou colar com Ctrl+V. Busca com IA aparece se a IA estiver configurada.
2. **Conferir** — nome, código e valor no cartão; o valor final é calculado pelo app (cartão + 8,12%, final ,50/,75/,90/,95/,99).
3. **Gerar** — quantos flyers (1 a 8; os produtos são divididos em ordem), formato, estilo e título. “Aprovar e gerar” salva no histórico.
4. **Resultados** — por flyer: baixar imagens (ZIP), copiar o prompt e abrir o ChatGPT (site ou app), enviar a arte de volta
   e conferir produto por produto. Também: lista de produtos (copiar/TXT) e planilha CSV (Sku,Nome,Ativo,Ordem).

O servidor recusa prompts que não contenham o nome, o código e o preço exatos de cada produto.
Menu do topo: **Início · Gerador de flyers · Admin**; dentro do gerador, abas **Criar | Histórico**.
O editor manual antigo continua acessível em `/estudio/novo?modo=manual`.

## Aprovação em slides e automação do ChatGPT

- **Aprovar flyers** (`/estudio/lote/<batchId>/aprovar`): um flyer por slide (setas ou ← →), com **Aprovar**,
  **Refazer** e **Escrever alterações**. O status aparece nos cartões do lote; arte nova volta para "Aguardando aprovação".
  Campos no banco: `reviewStatus`, `reviewNote`, `reviewedAt` e `chatUrl` (conversa do ChatGPT, para pedir alterações no mesmo chat).
- **Automação pelo Claude Code + Claude in Chrome:** com este projeto aberto no Claude Code, rode `/gerar-flyers [categoria]`.
  O Claude cria o lote, leva prompt + imagens de cada flyer ao ChatGPT no seu Chrome, confere preços/códigos/logo,
  devolve a arte ao Hub e abre a aprovação. Depois da revisão, `/gerar-flyers refazer` processa os pedidos.
  Roteiro completo em `.claude/commands/gerar-flyers.md`.

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
