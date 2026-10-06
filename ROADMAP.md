# Roadmap — more360-lite

Triagem dos módulos do More 360 original: o que faz sentido virar cadastro
manual dentro do próprio app (sem depender de nenhum serviço externo) e o
que fica de fora por depender de um serviço real pra existir.

## ✅ Implementados

| Módulo | Rota | Fase |
|---|---|---|
| Tabela de Preços | `/precos` | 0 |
| Financeiro | `/financeiro` | 0 |
| Encomendas | `/encomendas` | 0 |
| Manutenção | `/manutencao` | 0 |
| Pessoas | `/pessoas` | 1 |
| Controle de Acesso | `/usuarios` | 1 |
| Estoque | `/estoque` | 1 |
| Compras | `/compras` | 1 |
| Garantias | `/garantias` | 1 |
| Tarefas | `/tarefas` | 2 |
| Avisos | `/avisos` | 2 |
| Acompanhamento | `/acompanhamento` | 2 |
| Knowledge | `/knowledge` | 2 |
| Performance | `/performance` | 3 |

Decisões tomadas na Fase 2: **Tarefas usa tabela+modal+select** (não
Kanban de arrastar-e-soltar — mantém consistência com o resto do app em
vez de introduzir `@dnd-kit` e um layout só daquela página); **Projetos e
Pendências ficaram fora do escopo** por serem essencialmente a mesma coisa
que Tarefas no original, só se diferenciando pela integração com
WhatsApp/IA que já não faz parte deste clone.

**Performance (Fase 3)** — o original alimenta isso com sync do ERP Fone
Ninja (vendas por vendedor, metas, bônus). Sem ERP, não tem "vendedor" como
conceito em nenhum módulo daqui, então não dá pra replicar ranking/bônus
fielmente. O que ficou, com gráficos de verdade (antes só o Financeiro
tinha um gráfico simples): faturamento mensal (últimos 12 meses, barras),
faturamento por origem (Encomendas × Manutenção), produtos mais vendidos —
tudo computado ao vivo de `orders`/`maintenance_orders`, mesmo padrão
"dashboard que compila" do Financeiro. Nenhuma tabela nova.

## 🔜 Candidatos pra Fase 3

Ainda não planejados em detalhe — ficam anotados como possibilidade futura,
não como compromisso:

- **Upload de arquivo no Knowledge** — hoje é só link/texto; precisaria de
  um jeito local de guardar arquivo (pasta no disco + rota servindo o
  arquivo, provavelmente — sem storage externo).
- **"Diário da equipe" manual** (inspirado no Performance original) e
  **NPS manual** (inspirado no Pós-venda original) — pedaços desses dois
  módulos que não dependem de Fone Ninja/Z-API e poderiam virar algo
  próprio, mas ainda não foram desenhados.
- **Ligar Pessoas aos outros módulos** — hoje Encomendas/Manutenção/
  Compras/Garantias usam `customer_name`/`supplier_name` em texto livre;
  dava pra trocar por uma referência opcional a `contacts`, mas isso muda
  o padrão de "tabelas independentes" usado até aqui e não foi decidido.

## ❌ Fora de escopo (dependem de serviço externo real)

Não existem como "versão local" com sentido — ou ficam vazios, ou viram uma
simulação que não corresponde ao que o nome promete:

- **Command Center / Hub More / Conexões** — inbox de WhatsApp real (Z-API).
- **Marketing** — Meta Ads real.
- **Intelligence / Agentes / Voice Interface** — IA conversacional/proativa
  real (Anthropic/Groq) e transcrição de áudio.
- **Performance — parte de sync com Fone Ninja** (ranking de vendedor,
  metas, bônus) — a parte de faturamento/produtos já foi feita (Fase 3,
  ver tabela acima); ranking por vendedor fica de fora, não existe
  "vendedor" como conceito aqui.
- **Pós-venda** (parte de envio via Z-API) — depende do WhatsApp externo;
  um "diário da equipe" ou NPS manual *poderiam* virar módulos próprios no
  futuro, mas isso ainda não foi planejado em detalhe.

## Padrão técnico (repetir em qualquer módulo novo)

1. `db/schema.sql` — `create table if not exists`, `created_by` referenciando
   `users`, trigger `set_updated_at()` já existente. Tabelas independentes
   (sem FK obrigatória entre módulos).
2. `src/app/api/<modulo>/route.ts` + `[id]/route.ts` — zod + `requireSession()`.
3. `src/app/(dashboard)/<modulo>/page.tsx` — `PageHeader`/`StatCard`/`Modal`/
   `Field`/`EmptyState` de `@/components/ui`, modal único criar+editar.
4. `src/components/sidebar.tsx` — nova entrada no array `modules`.
5. Build limpo (`next build`) + bateria de testes via `curl` (criar/editar/
   excluir + 401 sem sessão) antes de considerar pronto.
