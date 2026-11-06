# Digitusul Hub

Plataforma interna modular da Digitusul. Núcleo (login, perfis, permissões, módulos, Brand Kit, auditoria) + primeiro módulo funcional: **Estúdio de Flyers**.

## Como rodar (desenvolvimento)

Requisitos: Node.js 22+ (instalado em `C:\Program Files\nodejs`).

```bash
npm install
cp .env.example .env        # defina SEED_ADMIN_PASSWORD (mín. 10 caracteres, letras e números)
npm run setup               # cria o banco e o primeiro administrador
npm run dev                 # http://localhost:3000
```

No Windows também dá para usar `start-dev.cmd`. As credenciais do primeiro administrador ficam em `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) — troque a senha após o primeiro acesso em **Configurações**.

Outros comandos: `npm test` (testes), `npm run typecheck`, `npm run build && npm start` (produção).

## Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| App | Next.js 15 (App Router) + React 19 + TypeScript | Front e back no mesmo projeto, rotas de servidor tipadas, SSR para checar sessão antes de renderizar |
| UI | Tailwind CSS + componentes próprios + lucide-react | Design system leve, tokens da marca em um só lugar |
| Banco | Prisma ORM — SQLite em dev, PostgreSQL em produção | Zero configuração local; mesmo schema nos dois (JSON salvo como texto) |
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
- Uploads validados pelo **conteúdo** (assinatura binária), limite de 10 MB e 12.000 px; SVG só no Brand Kit e sem scripts/referências externas; arquivos fora de `/public`, servidos apenas com sessão e cabeçalhos que impedem execução.
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

## Integrações opcionais (`.env`)
- `ANTHROPIC_API_KEY` (+ `AI_MODEL`, padrão `claude-opus-5-5`): Criar com IA, leitura de imagens, busca inteligente no catálogo. Usa fallback de servidor da Anthropic em caso de recusa.
- `REMOVE_BG_API_KEY`: remoção de fundo (a original é preservada).
- E-mail: não implementado — links de redefinição são gerados pelo administrador em **Usuários**. Ponto de extensão: `sendResetEmail` em `src/core/auth/auth-service.ts`.

## Produção — checklist
1. `provider = "postgresql"` em `prisma/schema.prisma` e `DATABASE_URL` do Postgres; `npx prisma migrate deploy` (gere as migrações com `prisma migrate dev`).
2. Driver de armazenamento S3/R2 em `src/core/storage/storage.ts` (interface `StorageDriver`).
3. `APP_URL` com HTTPS; limitador de tentativas em Redis se houver mais de uma instância.
4. Provedor de e-mail para redefinição de senha.

## Testes
`npm test` cobre: regra de preço, parse de valores, motor de layout (6 categorias × 8 formatos × 1/2/4/6 produtos, todos validados), preservação de código/nome/preço, logotipo, cobertura de preço, omissão de produto, área útil, dimensões, perfis e permissões, validação de uploads e SVG, e a proteção contra a IA inserir valores comerciais.
