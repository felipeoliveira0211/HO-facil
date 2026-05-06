# Plano: HO fácil offline-first (PWA)

## Visão geral
Transformar o app em PWA instalável que funciona 100% offline (criar, editar, cronometrar, assinar e finalizar avaliações sem internet) e sincroniza automaticamente com o servidor quando a conexão volta. Estratégia de conflito: última edição vence.

---

## 1. PWA instalável

- Adicionar `vite-plugin-pwa` com `registerType: "autoUpdate"`
- Manifest com nome "HO fácil", ícones (192/512), `display: standalone`, theme color SESI
- Service Worker com estratégia:
  - **App shell** (HTML/JS/CSS/fontes): `CacheFirst` — abre offline
  - **Navegação HTML**: `NetworkFirst` com fallback (evita lock em build velho)
  - **Logo e assets**: `CacheFirst`
- **Guarda obrigatória**: SW só registra fora de iframe e fora de domínios `id-preview--*` / `lovableproject.com` (preview do editor não suporta SW)
- Banner discreto "Instalar app" usando evento `beforeinstallprompt`

⚠️ **Aviso ao usuário**: offline e instalação só funcionam no app **publicado** (`ho-facil.lovable.app`), não dentro do editor Lovable.

## 2. Camada de dados local (IndexedDB via Dexie)

Criar `src/lib/db/local.ts` com tabelas espelhando o Supabase:
- `evaluations` (mesmos campos)
- `time_segments`
- `equipments`, `responsibles` (cache de leitura)
- `signatures` (blobs PNG aguardando upload)
- `outbox` — fila de operações pendentes: `{ id, table, op: 'insert'|'update'|'delete', payload, createdAt, retries }`
- `meta` — última sincronização por tabela

## 3. UUIDs gerados no cliente

- Avaliações novas usam `crypto.randomUUID()` em vez de deixar o banco gerar
- Mesmo para `time_segments`
- Permite criar offline e sincronizar depois sem precisar trocar IDs

## 4. Repositório unificado (`src/lib/repo/`)

Camada de abstração entre as telas e o "banco" — todas as telas chamam `repo.evaluations.list()`, `repo.evaluations.update(...)` etc. Por baixo:
- **Lê**: sempre do IndexedDB (instantâneo, funciona offline)
- **Escreve**: grava no IndexedDB e enfileira no `outbox`
- Refatorar `avaliacao.$id.tsx`, `historico.tsx`, `index.tsx`, `nova.tsx`, `equipamentos.tsx`, `responsaveis.tsx` para usar o repo

## 5. Motor de sincronização (`src/lib/sync.ts`)

- **Pull** (servidor → local): ao logar e quando voltar online, busca registros do usuário com `updated_at > last_sync` e mescla no Dexie (última edição vence por timestamp)
- **Push** (local → servidor): processa `outbox` em ordem; em sucesso, remove da fila; em erro de rede, mantém para retry; em erro permanente (RLS, validação), marca como falha e mostra ao usuário
- **Triggers**: ao logar, ao detectar `online`, e a cada 30s quando online
- **Assinaturas**: blob fica no Dexie até upload OK; só então grava `worker_signature_url` no servidor

## 6. Indicador de status (UI)

- Badge no `AppShell`:
  - 🟢 "Sincronizado"
  - 🟡 "Sincronizando… (N pendentes)"
  - 🔴 "Offline — N alterações na fila"
- Toast quando voltar online: "Conexão restaurada — sincronizando 3 alterações"
- Ícone por avaliação no painel: pequeno indicador "pendente" quando ainda não foi para o servidor

## 7. Sessão offline

- Sessão Supabase já fica em `localStorage` → login persiste
- Tela de login mostra aviso se estiver offline e usuário ainda não tiver logado uma vez
- Token expirado offline: continua funcionando localmente; refresh acontece quando voltar a rede

## 8. PDF offline

- Já funciona (jsPDF é client-side); só garantir que o `logo-sesi.png` esteja no cache do SW
- Assinatura: ler do Dexie se ainda não foi sincronizada

---

## Detalhes técnicos

**Dependências novas**: `vite-plugin-pwa`, `dexie`, `dexie-react-hooks`

**Arquivos novos**:
- `vite.config.ts` (atualizar com VitePWA)
- `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`
- `src/lib/db/local.ts` (schema Dexie)
- `src/lib/repo/evaluations.ts`, `repo/segments.ts`, `repo/equipments.ts`, `repo/responsibles.ts`, `repo/signatures.ts`
- `src/lib/sync.ts` (push/pull engine)
- `src/hooks/useOnlineStatus.ts`
- `src/hooks/useSyncStatus.ts`
- `src/components/SyncBadge.tsx`
- `src/components/InstallPrompt.tsx`
- `src/lib/pwa-register.ts` (com guarda iframe/preview)

**Arquivos alterados**:
- `src/router.tsx` (registrar SW + boot da sync)
- `src/lib/auth.tsx` (disparar pull ao logar)
- `src/components/AppShell.tsx` (badge + install prompt)
- Todas as rotas que hoje chamam `supabase.from(...)` direto → passam pelo repo
- `src/components/SignaturePad.tsx` (salvar blob local primeiro)

**Sem alteração de schema do banco** — sincronização funciona com as tabelas atuais. Único ajuste: garantir que `updated_at` está sendo atualizado em todas as tabelas (já está, via `touch_updated_at`/defaults).

---

## Plano de entrega (sugiro fazer em 2 etapas para validar)

**Etapa 1 — Fundação offline (essencial)**
1. PWA instalável + Service Worker com guarda de iframe
2. Dexie + repositório + UUID no cliente
3. Sync engine (pull + push + outbox)
4. Badge de status + indicador por card

**Etapa 2 — Polimento**
5. Install prompt customizado
6. Tratamento de conflitos visíveis (alertas em casos raros)
7. Tela de "alterações pendentes" para o usuário inspecionar

Confirma se posso seguir com **Etapa 1 inteira** numa primeira leva, ou prefere quebrar em pedaços menores?