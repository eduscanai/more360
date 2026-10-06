# More 360 Lite

Plataforma de gestão para loja de celulares — **Tabela de Preços, Financeiro,
Performance, Encomendas, Manutenção, Pessoas, Controle de Acesso, Estoque,
Compras, Garantias, Tarefas, Avisos, Acompanhamento e Knowledge** (14
módulos) — rodando **100% local, sem nenhuma API externa**. Cadastro de
produto, venda, estoque, tudo é feito dentro do próprio app e fica no seu
próprio Postgres.

Visual Glass Layers (fundo escuro, orbs roxos, cards translúcidos, acento
`#7C5CFC`) — é uma reconstrução enxuta do **More 360** original, mantendo o
design, mas com arquitetura própria. Ver [ROADMAP.md](ROADMAP.md) pra saber
exatamente o que ficou de fora e por quê.

## Quick start

Pré-requisitos: [Node.js 22+](https://nodejs.org) e Postgres rodando
localmente (instruções abaixo se não tiver).

```bash
git clone https://github.com/eduscanai/more360.git
cd more360
npm install
cp .env.local.example .env.local   # edite DATABASE_URL — ver abaixo
npm run db:init                     # cria o banco e aplica o schema
npm run dev                         # http://localhost:3010
```

Abra `http://localhost:3010`, clique em **"Criar conta"** e cadastre o
primeiro usuário — ele entra automaticamente como `owner`.

### Se você não tem Postgres instalado

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```
Por padrão o Homebrew configura autenticação `trust` pra conexões locais
(sem senha) — o `DATABASE_URL` do `.env.local.example` já assume isso, só
troque `seu_usuario` pelo resultado de `whoami`.

**Linux (Ubuntu/Debian):**
```bash
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE ROLE seu_usuario LOGIN PASSWORD 'uma_senha_local';"
sudo -u postgres psql -c "CREATE DATABASE more360_lite OWNER seu_usuario;"
```
Nesse caso o `DATABASE_URL` precisa da senha:
`postgresql://seu_usuario:uma_senha_local@127.0.0.1:5432/more360_lite`.

**Docker** (se preferir não instalar Postgres direto na máquina):
```bash
docker run -d --name more360-postgres -p 5432:5432 \
  -e POSTGRES_USER=seu_usuario -e POSTGRES_PASSWORD=uma_senha_local \
  -e POSTGRES_DB=more360_lite postgres:16
```

## Variáveis de ambiente

| Variável | O que é |
|---|---|
| `DATABASE_URL` | String de conexão do Postgres (ver "Quick start" acima) |
| `JWT_SECRET` | Assina os cookies de sessão e os tokens de redefinição de senha. Gere um com `openssl rand -base64 48` — **nunca reaproveite o valor de exemplo** |
| `NEXT_PUBLIC_APP_URL` | URL pública do app (usada para montar o link de "esqueci minha senha" e pra decidir se o cookie de sessão deve ser `Secure` — só vira `Secure` se essa URL começar com `https://`) |

## Diferenças em relação ao More 360 original

- **Backend 100% local, sem Docker obrigatório**: Postgres puro (`pg`, sem
  ORM), em vez do stack Supabase completo (Kong/GoTrue/Realtime/Storage).
- **Autenticação própria**: login/cadastro/senha com rotas Next.js +
  Postgres direto (`bcryptjs` pra senha, `jose` pra JWT em cookie httpOnly)
  — não usa Supabase Auth.
- **Cadastro aberto por padrão**: qualquer pessoa pode criar conta em
  `/cadastro`. O primeiro usuário cadastrado vira `owner`; os demais entram
  como `member`. Se for expor isso na internet pra outras pessoas além da
  sua equipe, considere fechar o cadastro (ver seção de deploy abaixo).
- **Escopo reduzido e sem sync de ERP/WhatsApp/Meta Ads**: os módulos que só
  existem por causa de um serviço externo real (Command Center/WhatsApp,
  Marketing/Meta Ads, Intelligence/Agentes de IA) não têm versão local com
  sentido e ficaram de fora — ver [ROADMAP.md](ROADMAP.md) pra triagem
  completa de cada módulo do original.

## Stack

Next.js 16 (App Router) + React 19 + Tailwind 4 + TypeScript, Postgres 15+,
`pg` (driver direto), `bcryptjs` + `jose` para auth, `zod` para validação.
Zero dependência de serviço externo — confira você mesmo, não tem nenhum
`fetch()` nem SDK de terceiro em lugar nenhum do código.

## Financeiro é um dashboard, não uma tabela

Essa é a decisão de arquitetura mais importante do projeto, e vale explicar
com cuidado.

No More 360 original, as abas DRE/Fluxo/A-Receber/A-Pagar do Financeiro
**não são uma tabela** — são consultas (RPCs em Postgres) que leem direto
de `sale_transactions`, `performance_service_orders` etc. O Financeiro é um
*dashboard que compila o resto do sistema*, não um lugar onde você digita a
mesma coisa de novo. Aqui é igual, só que lendo das nossas próprias tabelas:

| No Financeiro | De onde vem (leitura direta, sem cópia) |
|---|---|
| Receita | Encomendas `entregue` + Manutenção `entregue` + lançamentos manuais pagos |
| Despesa | Compras `recebido` + lançamentos manuais pagos |
| A Receber | Encomendas/OS de manutenção ainda não entregues |
| A Pagar | Compras ainda não recebidas |
| Lançamentos manuais | Só o que **não nasce de nenhum módulo** — aluguel, salários, outras receitas avulsas |

Marcar uma encomenda como entregue atualiza a receita do Financeiro **na
hora**, sem nenhum dado duplicado em lugar nenhum — excluir a encomenda
depois não deixa órfão, porque nunca existiu uma cópia pra começo.
Implementado em
[src/app/api/financeiro/route.ts](src/app/api/financeiro/route.ts).
**Performance** segue o mesmo padrão (faturamento mensal, por origem, top
produtos — tudo computado ao vivo, nenhuma tabela própria).

5 abas no Financeiro (o original tem 13 — cortamos Conciliação, Cartão,
Cartão Empresa, Banco e 4-vias/Uploads, que são 100% sobre sincronizar
banco/cartão/ERP e não existem sem API externa):

- **Visão Geral** — KPIs + fluxo de caixa dos últimos 30 dias
- **DRE** — receita bruta → despesas → resultado, formato clássico de linhas
- **A Receber** — encomendas/OS em aberto, com botão "Entregue" que já atualiza tudo
- **A Pagar** — compras em aberto, com botão "Recebido"
- **Lançamentos** — CRUD manual, só pra receita/despesa que não vem de nenhum módulo

Também existe a conexão **Manutenção ↔ Estoque por IMEI**: uma OS que entra
em andamento marca a unidade correspondente no estoque (mesmo IMEI) como
"em manutenção" automaticamente, e devolve quando termina.

## Módulos implementados

- **Tabela de Preços** (`/precos`) — produtos com custo, margem % e preço de
  venda calculado automaticamente (`custo × (1 + margem/100)`).
- **Financeiro** (`/financeiro`) — ver seção acima.
- **Performance** (`/performance`) — faturamento mensal (gráfico de barras,
  12 meses), faturamento por origem (Encomendas × Manutenção), produtos
  mais vendidos. Tudo computado de Encomendas/Manutenção, sem ERP.
- **Encomendas** (`/encomendas`) — pedidos de clientes com quantidade, valor
  unitário, sinal pago e status (aguardando → pago → chegou → entregue /
  cancelado).
- **Manutenção** (`/manutencao`) — ordens de serviço com aparelho, IMEI,
  problema relatado, custo de mão de obra + peças (total automático) e
  status (aguardando → em andamento → concluído → entregue / cancelado).
- **Pessoas** (`/pessoas`) — contatos (clientes, fornecedores, técnicos),
  com filtro por tipo.
- **Controle de Acesso** (`/usuarios`, só visível pra `owner`) — lista de
  usuários com troca de role e ativar/desativar conta, mais log dos
  últimos 20 eventos de acesso. Login bloqueia conta desativada; a API
  impede remover o último owner ativo.
- **Estoque** (`/estoque`) — itens com condição, custo, local e "dias em
  estoque" (chip amarelo/vermelho passando de 30/60 dias).
- **Compras** (`/compras`) — pedidos a fornecedor (espelha Encomendas, do
  lado da compra).
- **Garantias** (`/garantias`) — garantia por venda/aparelho, com
  "expirando"/"expirada" calculado a partir da data de vencimento.
- **Tarefas** (`/tarefas`) — lista de trabalho com prioridade, prazo e
  responsável. Tarefa "pessoal" só aparece pra quem criou.
- **Avisos** (`/avisos`) — comunicados internos com audiência (todos/só
  owner/só member) e leitura rastreada por pessoa.
- **Acompanhamento** (`/acompanhamento`) — projetos longos com entradas
  diárias de progresso (%) — histórico imutável, nunca edita o passado.
- **Knowledge** (`/knowledge`) — base de conhecimento (links, notas,
  aprendizados) com tags e busca.

Todos têm CRUD completo via API routes próprias, protegidas por sessão.

## ⚠️ Limitação conhecida: "Esqueci minha senha"

Não tem provedor de e-mail configurado. O fluxo funciona (gera token,
expira em 30min, uso único), mas o link de redefinição só é gravado no
**log do servidor** (`console.log` em
[src/app/api/auth/esqueci-senha/route.ts](src/app/api/auth/esqueci-senha/route.ts))
— quem administra a instância pega o link ali e repassa pra pessoa.

A API **nunca** devolve o link na resposta HTTP — isso viraria sequestro de
conta pra quem soubesse o e-mail de alguém, assim que o app saísse do
localhost. Pra plugar e-mail de verdade: troque esse `console.log` por uma
chamada real de envio (Resend, SMTP, etc).

## Rodando sempre em segundo plano (opcional)

Isso é só pra quem quer o app sempre no ar numa máquina dedicada (loja,
servidor caseiro, VPS), em vez de só `npm run dev` quando for usar. Pra
testar/avaliar o projeto, pule esta seção.

### macOS (launchd)

```bash
npm run build   # build de produção primeiro
```

Edite `install/com.more360lite.app.plist` e troque todo `/Users/SEU_USUARIO/more360-lite`
pelo caminho real onde você clonou o projeto, depois:

```bash
cp install/com.more360lite.app.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.more360lite.app.plist

# útil depois de instalado:
launchctl print gui/$(id -u)/com.more360lite.app | grep -E "state|pid"  # status
launchctl kickstart -k gui/$(id -u)/com.more360lite.app                  # reinicia
launchctl bootout gui/$(id -u)/com.more360lite.app                       # para e desinstala
tail -f ~/Library/Logs/more360-lite.log ~/Library/Logs/more360-lite.err.log
```

**⚠️ Importante:** o macOS bloqueia processos em background (`launchd`) de
acessar as pastas Documentos/Desktop/Downloads (proteção TCC do sistema,
não configurável por script) — confirmamos isso na prática. Clone o
projeto em qualquer outro lugar (ex: direto em `~/more360-lite`), não
dentro dessas três pastas, senão o serviço falha com `Operation not
permitted`.

### Linux (systemd)

```bash
npm run build
```

Ajuste `WorkingDirectory`/`ExecStart` em `install/more360lite.service` se
não clonar em `/opt/more360-lite`, depois:

```bash
sudo cp install/more360lite.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now more360lite.service

# útil depois de instalado:
systemctl status more360lite
systemctl restart more360lite
journalctl -u more360lite -f
```

### Publicando num servidor com IP público

Se for expor a instância na internet (não só na sua rede local):

1. **Firewall** — libere só a porta do app (3010) e SSH; nunca exponha a
   porta do Postgres (5432) publicamente.
2. **HTTPS** — sem domínio + certificado, o cookie de sessão roda em HTTP
   puro (senha trafega sem criptografia). Com um domínio apontado pro
   servidor, configure Nginx/Caddy na frente fazendo proxy pra porta 3010,
   com Let's Encrypt — e troque `NEXT_PUBLIC_APP_URL` pra `https://...`
   (o cookie de sessão vira `Secure` automaticamente, sem mexer em código).
3. **Cadastro aberto** — se não quiser que qualquer pessoa com o link crie
   conta e veja os dados do negócio, desative a rota `/cadastro` ou
   restrinja criação de conta só pelo `owner` via `/usuarios`.
4. **Segredos** — gere um `JWT_SECRET` novo pro servidor (não reaproveite o
   do seu ambiente local); troque qualquer senha padrão do Postgres.

## Estrutura

```
more360/
├── db/schema.sql              # schema completo — 17 tabelas (auth + módulos; Financeiro e Performance não têm tabela própria)
├── scripts/
│   ├── init-db.sh             # cria banco + aplica schema (idempotente)
│   └── start-prod.sh          # usado pelo launchd/systemd pra subir em produção
├── install/
│   ├── com.more360lite.app.plist   # template LaunchAgent (macOS)
│   └── more360lite.service         # template systemd (Linux)
├── ROADMAP.md                 # triagem completa dos módulos do More 360 original
├── src/
│   ├── proxy.ts               # middleware de autenticação (Next 16 renomeou de middleware.ts)
│   ├── lib/
│   │   ├── db.ts              # pool pg + withTransaction()
│   │   ├── session.ts         # JWT (jose) — edge-safe, usado no proxy e nas API routes
│   │   └── auth.ts            # bcrypt, cookie de sessão, tokens de reset de senha
│   ├── components/
│   │   ├── sidebar.tsx        # navegação — "Controle de Acesso" só aparece pro owner
│   │   └── ui.tsx             # PageHeader, StatCard, Modal, Field, EmptyState
│   └── app/
│       ├── globals.css        # design system Glass Layers
│       ├── login/ cadastro/ esqueci-senha/ redefinir-senha/
│       ├── (dashboard)/precos, financeiro, performance, encomendas, manutencao,
│       │                 pessoas, usuarios, estoque, compras, garantias,
│       │                 tarefas, avisos, acompanhamento, knowledge
│       └── api/ — uma pasta por módulo acima, route.ts + [id]/route.ts
```

## Licença

MIT — ver [LICENSE](LICENSE).
