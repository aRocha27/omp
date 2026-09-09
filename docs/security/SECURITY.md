# Security and Workflow Review

## Estado do relatório

Data da revisão: 2026-08-31

Escopo revisto:

- `app/`: React, sessão no browser, permissões de UX, cache e mutações.
- `server/`: Express, autenticação, autorização, validação, email e SQL.
- `server/sql/`: migrações de auditoria.
- `docs/`, `report.md`, testes e ficheiros `.env.example`.

Fora do âmbito desta revisão: artefactos binários avulsos da raiz do workspace e os ZIPs locais de export de Docker em `docker/exports/` (esses são gitignored). A infraestrutura de mail service para Windows está fora deste repositório público e exige revisão separada antes de entrar em serviço de produção.

Este documento é uma revisão estática do código. Não substitui testes controlados contra a base de dados de produção, revisão dos exports Access, análise de infraestrutura, penetration test ou validação jurídica de dados pessoais.

## Conclusão executiva

O projeto tem boas bases: SQL parametrizado, validação Zod, passwords com `scrypt`, cookies `HttpOnly`, verificações de role no servidor e separação entre frontend e repositórios.

Ainda não está pronto para operação multiutilizador com dados financeiros. Os bloqueadores principais são:

1. Não existe optimistic concurrency control; o último utilizador a gravar pode apagar silenciosamente alterações de outro.
2. O envio de emails tem uma race condition que pode enviar o mesmo documento duas vezes.
3. A identidade usada em auditoria pode ser fornecida pelo browser e a auditoria não é atómica com a alteração.
4. CSRF, headers de segurança, rate limiting de produção e hardening de deployment não estão completos.
5. Limites financeiros de kits e algumas regras de workflow não estão protegidos no servidor.
6. Paridade com a base de dados/Access e comportamento de triggers, locks e constraints ainda não foram provados.

Prioridade recomendada:

- P0: identidade server-side na auditoria, concorrência e email idempotente.
- P1: CSRF, headers, rate limiting, sessão partilhada, auditoria transacional e invariantes financeiras.
- P2: paginação estável, sincronização de cache, observabilidade, dependências e hardening operacional.

## Evidência de arquitetura

Fluxo atual:

```text
React
  -> repository contract
  -> HTTP repository ou mock repository
  -> Express API
  -> repository SQL mssql
  -> SQL Server / base existente
```

Fontes principais:

- `AGENTS.md`
- `docs/CURRENT_STATUS.md`
- `docs/architecture/ARCHITECTURE.md`
- `server/src/app.ts`
- `server/src/auth.ts`
- `server/src/routes/`
- `server/src/repositories/`

A base de dados existente continua a ser o system of record. Não se deve criar uma nova base ou alterar objetos sem confirmar a regra Access e o schema real.

## Findings P0

Registo de decisão (2026-08-31): o finding P0-01 (takeover no primeiro acesso via `first-password`) foi revisto e aceite pelo responsável — o fluxo de primeiro acesso não é considerado um risco nesta implantação e sai da lista de bloqueadores. Os restantes IDs mantêm-se estáveis para referência cruzada.

### P0-02: ausência de controlo de concorrência nas edições

Severidade: crítica para integridade de dados

Evidência:

- `server/src/repositories/orders/orders.repository.ts:373-397`
- `server/src/repositories/clients.repository.ts:138-164`
- `server/src/repositories/kit-consumables.repository.ts:60-92`
- `server/src/repositories/reconhecimento.repository.ts:101-150`
- `server/src/repositories/facturacao.repository.ts:130-177`
- `app/src/services/http/orders.http-repository.ts:206-214`

As alterações são feitas por ID, sem exigir uma versão lida pelo utilizador. Locks existentes em alguns fluxos serializam parte da operação, mas não verificam se o conteúdo mostrado ao utilizador ainda é a versão atual.

Cenário:

1. User A e User B abrem a mesma encomenda.
2. A altera `Sell_Price` e grava.
3. B altera `Obs` usando uma versão antiga ou envia um patch que inclui valores antigos.
4. A alteração de A pode ser substituída sem aviso.

Implementação delegável:

- confirmar se `upsize_ts` é `rowversion` utilizável e se existe em todas as tabelas editáveis;
- se não for utilizável, criar/usar token de versão aprovado no schema existente;
- devolver `version` nos DTOs, sem expor o valor opaco diretamente se não for seguro;
- exigir `expectedVersion` em update/delete;
- usar a versão na cláusula `WHERE`;
- se `rowsAffected = 0`, devolver `409 Conflict` com a versão atual;
- mostrar no frontend uma mensagem de conflito com opções de recarregar e rever;
- não fazer merge automático de campos financeiros sem regra explícita.

Aceitação:

- dois updates sobre a mesma versão resultam num sucesso e num `409`;
- nenhum update perdido silenciosamente;
- testes concorrentes para Order, Client, Recognition, Invoice e Kit Consumable;
- delete concorrente também produz conflito previsível.

### P0-03: race condition no envio de email e duplicação de documentos

Severidade: crítica operacional/financeira

Evidência:

- `server/src/routes/orders.ts:594-651`
- `server/src/routes/orders.ts:668-742`
- `app/src/features/orders/components/order-detail-page.tsx:149-162`

O endpoint lê documentos elegíveis, envia email e só depois marca `Imprimiu = true`. Dois pedidos simultâneos podem observar o mesmo documento como elegível e ambos enviar.

O frontend também faz uma atualização adicional de `Imprimiu` depois do endpoint de email (`app/src/features/orders/components/order-detail-page.tsx:159-161`), embora o endpoint já atualize esse campo.

Nota de implantação atual: `/api/orders/email` envia sempre para um destinatário fixo lido de `../emailSUPPORT/test-recipient.txt` (`server/src/email.ts:60-66`) — não para o cliente. Só `/api/orders/email-all` usa destinatários fornecidos pelo request. O sistema de envio real por encomenda ainda não existe; quando o destinatário passar a ser o cliente, os requisitos de autorização do P1-06 passam a ser bloqueadores.

Impacto:

- cliente recebe a mesma fatura várias vezes;
- estado de enviado pode não refletir entrega real;
- retries após timeout podem duplicar email;
- inconsistência entre envio, marcação e auditoria.

Implementação delegável:

- remover a segunda atualização de `Imprimiu` no frontend;
- introduzir estado server-side `pending/sending/sent/failed`, se suportado pelo schema;
- reclamar o documento com update condicional e token de idempotência;
- não manter lock SQL aberto durante chamada SMTP;
- usar outbox/job worker para enviar fora do request;
- marcar `sent` apenas após sucesso confirmado pelo transport;
- guardar `idempotencyKey`, tentativa, destinatários, resultado e timestamp;
- devolver resultado por documento em envios parciais;
- definir política para timeout ambíguo do SMTP.

Aceitação:

- duas submissões simultâneas geram no máximo um envio lógico;
- retry do mesmo `idempotencyKey` não duplica;
- falha antes do SMTP permite retry;
- falha depois de SMTP é tratada como estado ambíguo e não como envio novo automático;
- existem testes com duas requests concorrentes.

Decisões pendentes: confirmar se `Imprimiu` significa enviado, impresso, ou ambos.

### P0-04: identidade de auditoria pode ser forjada

Severidade: alta

Evidência:

- `server/src/routes/orders.ts:316-333`
- `server/src/repositories/orders/orders.repository.ts:353-370`

`POST /api/orders/audit` aceita `userName` do request e passa-o para `appendOrderAudit`. Um cliente pode atribuir a entrada a outra pessoa. Noutros updates o valor usado é a role (`editor`/`admin`) e não uma identidade autenticada forte.

Implementação delegável:

- remover `userName` do body;
- obter ID e username exclusivamente de `request.authUser` ou claims validadas;
- guardar ID imutável, username snapshot, role, operação, entidade e request ID;
- não permitir ao browser escolher `ID_User`, actor ou resultado;
- distinguir actor humano, job e integração.

Aceitação:

- alterar `userName` no payload não muda o actor gravado;
- requests sem identidade válida são rejeitados;
- existe teste de spoofing com role e username alterados.

### P0-05: auditoria não é atómica e não é append-only efetiva

Severidade: alta

Evidência:

- `app/src/features/orders/components/order-detail-page.tsx:368-383`
- `server/src/repositories/orders/orders.repository.ts:353-370`
- `server/sql/001_order_audit_trail.sql`

A alteração de encomenda e o audit são requests separados. Se o segundo falhar, a alteração fica gravada sem audit. O frontend regista a falha apenas no console. A migração aprovada cria `Order_Audit_Trail`, mas o repository continua a atualizar o campo legado `Order.Audit`.

Implementação delegável:

- escrever auditoria no mesmo transaction boundary da mutação;
- usar `Order_Audit_Trail` como fonte append-only para novos eventos;
- calcular before/after no servidor, não no browser;
- auditar Order, Client, Recognition, Invoice, Kit, Utilizador e email;
- adicionar request/correlation ID, outcome, operation e entity;
- decidir se uma mutação sem audit deve fazer rollback ou ficar em estado de exceção;
- preservar `ID_User`/`DT_User` legados quando forem exigidos pela base.

Aceitação:

- não existe sucesso de mutação sem evento auditável quando a auditoria é obrigatória;
- actor e before/after são server-side;
- audit não pode ser editado pelo fluxo normal;
- falha de audit tem teste de rollback.

## Findings P1

### P1-01: CSRF e Origin não estão protegidos explicitamente

Severidade: alta

Evidência:

- `server/src/app.ts:177-200`
- `server/src/auth.ts:105-155`

Mutations usam cookie de sessão, mas não exigem CSRF token nem validam `Origin`/`Referer`. `SameSite=Lax` é defesa parcial, não uma garantia suficiente para todos os deployments, subdomínios, proxies e mudanças futuras de política de cookie.

Implementação delegável:

- escolher synchronizer token ou double-submit token;
- exigir token em todas as mutations cookie-authenticated;
- validar `Origin` contra allowlist configurada;
- manter `HttpOnly`, `SameSite` e `Secure` como defesa complementar;
- testar requests sem token, com token errado e origin não autorizado.

### P1-02: boot guard e bearer token contradizem a documentação

Severidade: alta de deployment

Evidência:

- `server/src/index.ts:3-9`
- `server/src/auth.ts:33-43`
- `server/src/app.ts:192-200`
- `.env.example` e a versão anterior desta documentação.

O servidor escuta `0.0.0.0` por default. O requisito de token para host não-loopback só é validado dentro de `NODE_ENV === 'test'`. Em runtime normal, a API usa sessão de base de dados e `ADMIN_API_TOKEN` não é aplicado como proteção geral.

Implementação delegável:

- escolher um único modelo de produção: IdP/session ou bearer service auth;
- fazer o boot falhar em non-loopback sem configuração de autenticação válida;
- separar claramente auth de utilizadores e auth de administração técnica;
- não usar `x-user-role` como fonte de autoridade fora do middleware que o substitui;
- criar testes para development, test e production em loopback e non-loopback.

### P1-03: rate limiting é local, contornável e sem limite de memória

Severidade: média/alta

Evidência:

- `server/src/auth.ts:8-12,79-89,145-149`

O mapa de tentativas é por username, vive apenas num processo e cresce com usernames arbitrários. Não há limite por IP, reverse proxy, conta e endpoint. Com múltiplas instâncias o limite não é partilhado.

Implementação delegável:

- aplicar rate limit no proxy e no servidor;
- limitar por IP, conta e combinação IP/conta;
- usar store partilhado em produção;
- adicionar TTL e tamanho máximo ao mapa se continuar a existir fallback local;
- limitar login, primeiro acesso, reset e endpoints de email;
- não permitir enumeração de usernames.

### P1-04: headers de segurança ausentes

Severidade: média

Evidência:

- `server/src/app.ts:176-216`

Não existe middleware explícito para CSP, `nosniff`, frame protection, referrer policy ou HSTS. O servidor também não desativa explicitamente headers identificadores desnecessários.

Implementação delegável:

- configurar Helmet ou equivalente revisto;
- definir CSP compatível com Vite/produção;
- `Content-Security-Policy` com `frame-ancestors`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy` restritiva;
- HSTS apenas quando HTTPS for garantido;
- testes de headers no endpoint de health/API.

### P1-05: anexos de email aceitam conteúdo arbitrário

Severidade: média/alta

Evidência:

- `server/src/app.ts:181-182`
- `server/src/validation/sub-tables.ts:67-79`
- `server/src/routes/orders.ts:624-637,710-719`

Attachments são strings grandes e são convertidos diretamente com `Buffer.from(..., 'base64')`. Não há validação forte de data URI, tamanho descodificado, magic bytes PDF, total agregado, filename ou chaves inesperadas.

Implementação delegável:

- exigir formato data URI PDF estrito, ou aceitar apenas ficheiros server-side aprovados;
- validar base64 e magic bytes `%PDF-`;
- limitar tamanho descodificado por ficheiro e por request;
- limitar número total de ficheiros;
- normalizar/restringir filename e nunca confiar no browser;
- rejeitar attachment keys não correspondentes aos documentos autorizados;
- preferir storage temporário com scanner e limpeza.

### P1-06: destinatários de email não têm autorização de negócio demonstrada

Severidade: média/alta

Evidência:

- `server/src/routes/orders.ts:586-742`
- `server/src/validation/sub-tables.ts:74-79`
- `server/src/email.ts:60-66`

Editors podem iniciar envios. `/api/orders/email-all` aceita recipients fornecidos pelo cliente; valida formato, mas não demonstra que o destinatário está aprovado para o cliente/encomenda. `/api/orders/email` usa atualmente um destinatário de teste fixo lido do filesystem, o que limita o impacto presente mas não é o fluxo final.

Implementação delegável:

- definir se editor pode enviar;
- resolver recipients server-side a partir de campos autorizados ou allowlist;
- exigir confirmação/auditoria para recipient fora da allowlist;
- não aceitar lista arbitrária sem regra explícita;
- impedir envio cruzado de documentos e encomendas;
- auditar destinatários sem guardar dados desnecessários.

### P1-07: limite financeiro de Kit só é validado na UI

Severidade: alta de integridade financeira

Evidência:

- `app/src/features/orders/components/kit-consumables-section.tsx:109-115,550-579`
- `server/src/routes/orders.ts:748-750`
- `server/src/repositories/kit-consumables.repository.ts:34-57`

O servidor declara que `Kit_Amount - sum(Total_Price)` é informativo e não aplica limite. Se o limite for regra de negócio, dois utilizadores podem ambos ver saldo disponível e ultrapassar o total.

Decisão obrigatória:

- confirmar se `Kit_Amount` é limite obrigatório ou apenas informação.

Se obrigatório:

- validar no servidor;
- bloquear o parent Order durante cálculo e insert/update/delete;
- serializar alterações do agregado;
- devolver `409` ou erro de regra quando exceder;
- testar duas adds concorrentes.

### P1-08: autorização de workflow é decidida por leitura stale

Severidade: média/alta

Evidência:

- `server/src/routes/orders.ts:261-302`
- `server/src/repositories/orders/orders.repository.ts:373-438`

O route lê a encomenda, decide se o mês está fechado e só depois chama o update. Outro processo pode alterar o estado entre a leitura e o update. A regra de autorização/lock deve estar no mesmo transaction boundary da mutação.

Implementação delegável:

- colocar predicado de mês fechado/provisória/admin no `UPDATE` ou procedure transacional;
- verificar `rowsAffected`;
- devolver erro distinto para conflito e para forbidden;
- não confiar na decisão feita apenas pelo snapshot do route;
- testar mudança de estado entre read e write.

### P1-09: updates de Recognition/Invoice não têm versão original

Severidade: média/alta

Evidência:

- `server/src/repositories/reconhecimento.repository.ts:101-150`
- `server/src/repositories/facturacao.repository.ts:130-177`
- deletes em `reconhecimento.repository.ts:165-172` e `facturacao.repository.ts:192-199`.

Alguns adds/updates usam transaction e locks de capacidade, mas não comparam a versão que o utilizador viu. Deletes são operações separadas e podem correr contra adds/updates.

Implementação delegável:

- combinar OCC com locks de agregado;
- definir ordem de locks para evitar deadlocks;
- serializar todas as alterações que afetam totais financeiros;
- revalidar capacidade depois de cada alteração relevante;
- devolver `409` em versão divergente.

### P1-10: alteração de warranty pode modificar master data global

Severidade: média/alta, intenção por confirmar

Evidência:

- `server/src/repositories/orders/orders.repository.ts:482-537`

`updateOrderWarrantyYears` pode alterar `Tp_Warranty.N_Anos`, que aparenta ser tabela de referência partilhada. Isso pode afetar outros pedidos que usam o mesmo tipo. A leitura inicial do Order também não usa lock.

Decisão obrigatória:

- confirmar se se pretende alterar o tipo global ou apenas atribuir outro `ID_Tp_Warranty` à encomenda.

Implementação delegável depois da decisão:

- impedir alteração global acidental;
- bloquear e validar Order e tipo;
- verificar affected rows;
- separar claramente manutenção master-data de alteração de encomenda;
- adicionar teste com duas encomendas que partilham o tipo.

### P1-11: invalidação de cache incompleta entre vistas

Severidade: média

Evidência:

- `app/src/features/invoicing/api/use-invoicing.ts:7-12`
- `app/src/features/orders/api/use-delete-reconhecimento.ts:20-43`
- `app/src/features/orders/api/use-delete-documento-faturacao.ts:20-43`
- `app/src/features/orders/api/use-kit-consumables.ts:85-111`
- hooks de update de Recognition/Invoice.

O snapshot de Invoice/Warranty pode permanecer cached por até 10 minutos. Mutations de sub-tabelas não invalidam consistentemente dashboard, invoicing, reports e todas as queries de detalhe/lista.

Impacto:

- utilizador A grava e continua a ver totais antigos;
- dois browsers mostram estados divergentes;
- decisões financeiras podem ser tomadas com informação stale.

Implementação delegável:

- centralizar invalidação por agregado;
- após qualquer alteração financeira invalidar Order, Dashboard, Invoicing e Reports relevantes;
- usar response server-side autoritativa;
- considerar SSE/WebSocket ou polling curto se freshness multiutilizador for requisito;
- mostrar timestamp/estado stale quando aplicável.

### P1-12: cache optimistic pode misturar snapshots

Severidade: média

Evidência:

- adds em `reconhecimentos-section.tsx` e `documentos-table.tsx`;
- hooks de update que substituem apenas uma row.

Uma atualização local assume que o resto da lista não mudou. Com outro browser a alterar outra row durante o request, o cache pode ficar parcialmente desatualizado.

Implementação delegável:

- refetch da coleção depois da mutation, ou resposta autoritativa da coleção;
- rollback completo em falha;
- associar cache a versão do agregado;
- não apresentar resultado final como confirmado antes do server response.

### P1-13: paginação offset não é estável com inserts/deletes

Severidade: média

Evidência:

- `server/src/repositories/orders/orders.repository.ts:182-208`
- `app/src/features/orders/api/use-orders.ts:19-37`

Com sorting que não é `DT_Order`, a paginação usa offset. Rows inseridas, removidas ou reordenadas entre requests provocam duplicados ou skips.

Implementação delegável:

- usar keyset/cursor para cada ordenação suportada;
- incluir todos os sort keys e um tie-breaker único no cursor;
- ou fornecer snapshot/version semantics para uma pesquisa longa;
- testar alterações entre page 1 e page 2.

## Findings P2

### P2-01: sessões process-local

Evidência:

- `server/src/auth.ts:8-10,124-129,155`

Sessões ficam num `Map` local. Expiram em 8 horas absolutas, não têm cleanup periódico, limite máximo, revogação centralizada nem sobrevivência a restart. O frontend já implementa logout por uma hora de inatividade (`app/src/app/providers/user-provider.tsx:15,25-36`), mas isso não substitui TTL/revogação server-side.

Mitigante a manter: `authenticate` revalida o utilizador na base de dados a cada request (`server/src/auth.ts:127-128`), pelo que cancelar uma conta invalida as sessões existentes na próxima request. Não cobre mudança de role ou password: `POST /api/auth/change-password` (`server/src/auth.ts:106-118`) não revoga outras sessões ativas do mesmo utilizador.

Implementação delegável:

- usar store partilhado com TTL e cleanup;
- limitar sessões por utilizador/dispositivo;
- rotacionar sessão depois de login, mudança de role e password (incluindo revogar todas as outras sessões do utilizador em `change-password`);
- revogar sessões após reset, cancelamento ou desativação;
- decidir se o TTL server-side também deve ser uma hora de idle.

### P2-02: SMTP não exige TLS por default

Evidência:

- `server/src/email.ts:35-55`
- `server/.env.example:14-20`

`SMTP_SECURE=false` por default e não há fail-fast que exija STARTTLS/TLS em produção.

Implementação delegável:

- exigir TLS/STARTTLS em produção;
- validar certificado;
- falhar startup ou desativar envio quando transporte seguro não estiver configurado;
- testar configuração insegura em `NODE_ENV=production`.

### P2-03: raw-data administration tem superfície elevada

Evidência:

- `server/src/routes/admin.ts:185-239`
- `server/src/repositories/master-data.repository.ts:48-134`

Admin pode listar e alterar tabelas de master data através de operações genéricas. A allowlist de tabelas e identifiers reduz SQL injection, mas a superfície permite exposição e alterações amplas, incluindo `Identificacao` e `Utilizador`. `GET /api/stock` e `GET /api/stock/movements` não têm verificação de role (`server/src/routes/admin.ts:100-132`); a leitura de master data de `stck_Materiais` é permitida a editors.

Agravante de configuração default: `server/.env.example` shipa `ALLOW_AD_HOC_CONNECTIONS=true` com a anotação "Development/integration only". Com ad-hoc ativo, um admin autenticado pode instruir o servidor a abrir ligações SQL a hosts arbitrários com credenciais fornecidas no request (`server/src/routes/admin.ts:364-382`). Em produção o default tem de ser `false`.

Implementação delegável:

- definir allowlist de colunas por tabela;
- separar endpoints de leitura, edição e operações destrutivas;
- exigir confirmação/auditoria por tipo de operação;
- paginar e limitar respostas;
- remover dados pessoais desnecessários das respostas;
- passar `ALLOW_AD_HOC_CONNECTIONS` a `false` no `.env.example` e documentar como ativar explicitamente em desenvolvimento;
- exigir role em todos os endpoints de stock;
- rever permissões SQL da conta `orders_app`.

### P2-04: falta de metadata de mutação em Client e Kit

Evidência:

- `server/src/repositories/clients.repository.ts:147-164`
- `server/src/repositories/kit-consumables.repository.ts:34-101`

Nem todas as mutations gravam actor/timestamp/audit equivalentes. Isso reduz accountability e torna investigação de conflitos difícil.

Implementação delegável:

- usar campos server-controlled existentes quando confirmados;
- criar evento de auditoria transacional;
- nunca aceitar actor/timestamp do browser;
- adicionar testes de atribuição.

### P2-05: processo de dependências e supply chain não está evidenciado

Os manifests e lockfiles existem, mas não foi encontrado processo automatizado de `audit`, Dependabot/Renovate, SBOM, pinning de runtime ou gate de CI.

Implementação delegável:

- `pnpm audit --prod` nos três projetos relevantes;
- scan em CI com severidade bloqueante definida;
- lockfile obrigatório e installs frozen;
- SBOM e atualização periódica;
- rever dependências com acesso a email, SQL, browser e parsing de PDF.

### P2-06: dados reais e artefactos sensíveis no workspace

Severidade: média (higiene de repositório e RGPD)

Evidência:

- `emailTEste/` contém PDFs de faturas reais (ex.: `12_323.PDF`, `15.PDF`), não rastreados pelo git mas presentes no workspace de desenvolvimento;
- `By Area-Type YTD.pdf`, `By Area-Type-Product YTD.pdf`, `Production Report.pdf`, `crosstab-explorer-2026-08-30.xlsx`, `template report.docx` na raiz do repositório;
- `server/.env` existe no disco de desenvolvimento (corretamente gitignored; confirmado por `git check-ignore`).

O git não rastreia os PDFs de teste nem os PDFs/XLSX da raiz (verificado com `git ls-files`), mas o workspace partilha documentos financeiros reais com o código-fonte, o que facilita fugas acidentais em archives, screenshots, backups ou zip de distribuição. Os artefactos Docker ficam fora do Git em `docker/exports/`.

Implementação delegável:

- mover dados reais para fora do workspace de desenvolvimento, para um diretório de amostras aprovado;
- adicionar `emailTEste/`, `*.pdf` da raiz e `*.xlsx` da raiz a `.gitignore` para prevenir commits acidentais;
- rever o conteúdo de qualquer archive de distribuição antes de o partilhar;
- confirmar a política de retenção de dados reais usados em testes.

## Controlos positivos existentes

- SQL é em geral parametrizado; identifiers dinâmicos usam allowlists (`MASTER_DATA_TABLES`) ou `IDENTIFIER_PATTERN` (`server/src/repositories/database.ts:14`).
- Passwords usam `scryptSync`, salt aleatório e comparação constant-time.
- Cookies de sessão são `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- `authenticate` revalida o utilizador na base de dados a cada request; contas canceladas perdem acesso imediatamente.
- Credenciais de base de dados ficam no servidor; `resolveConnection` omita a password antes de fazer log (`server/src/routes/admin.ts:374-375`).
- O logger redaz keys sensíveis (`password`, `token`, `authorization`) antes de escrever (`server/src/logger.ts:8`).
- Erros de base de dados são sanitizados por `toConnectError` antes de chegar ao cliente (`server/src/routes/http-errors.ts:149-154`).
- Paths de PDF usam `path.basename` em `server/src/email.ts:126`.
- Routes fazem verificações server-side de role em várias mutations, incluindo a regra de bloqueio de mês fechado para Caracterização (`server/src/routes/orders.ts:277-295`).
- Frontend usa repositórios, não acede diretamente à base de dados.
- O frontend implementa logout depois de uma hora de inatividade.
- O `.env.example` do frontend documenta explicitamente que `ADMIN_API_TOKEN` não deve ser exposto como variável `VITE_`.

Estes controlos são defesa existente, não prova de produção segura.

## Desconhecidos que bloqueiam decisões

Confirmar com metadata SQL Server, Access e operações reais:

1. Se `upsize_ts` é `rowversion`, timestamp legado ou coluna atualizada por trigger.
2. Foreign keys, cascades, triggers, computed columns, unique constraints e indexes.
3. Isolation level real e eficácia de `UPDLOCK`/`HOLDLOCK` no deployment.
4. Se Access, jobs ou outros processos alteram as mesmas tabelas.
5. Semântica real de `Imprimiu`, `E_Invoice`, `Imp_Block`, `Reconhecido` e `Facturado`.
6. Se `Kit_Amount` é hard limit ou apenas informação.
7. Se `Tp_Warranty.N_Anos` deve ser global ou por encomenda.
8. Se views são live, materializadas ou dependem de dados sincronizados.
9. Política final de identidade: Entra ID, sessão própria ou ambos.
10. Lista de recipients autorizados e política de envio por role.
11. Requisito de freshness entre browsers e tolerância a dados stale.
12. Requisitos de retenção, eliminação e acesso para dados pessoais.

Não implementar estes pontos por suposição. Cada regra deve ter fonte primária ou decisão de negócio registada.

## Plano de delegação sugerido

### SEC-01: identidade e primeiro acesso

Abrange: P0-04, P1-02, P2-01. (P0-01 aceite pelo responsável como não-bloqueador; ver registo de decisão no topo de Findings P0.)

Entrega: claims server-side nas mutações e auditoria, sessão/revogação (incluindo revogação em `change-password`), boot guard de produção e testes de spoofing e deployment.

### DATA-01: optimistic concurrency

Abrange: P0-02, P1-08, P1-09, P1-13.

Entrega: token de versão, `409 Conflict`, DTOs, UI de conflito, cursor pagination e testes de concorrência.

### FLOW-01: financial aggregate integrity

Abrange: P1-07, P1-09, P1-10, P2-04.

Entrega: regras confirmadas, transações/locks, invariantes server-side, auditoria e interleaving tests para Order/Recognition/Invoice/Kit.

### MAIL-01: reliable email delivery

Abrange: P0-03, P1-05, P1-06, P2-02.

Entrega: claim/outbox/idempotency, recipients autorizados, PDF validation, TLS obrigatório e estados/retries.

### SEC-02: web hardening

Abrange: P1-01, P1-03, P1-04, P2-03, P2-05, P2-06.

Entrega: CSRF/Origin, headers, rate limits, least privilege (ad-hoc off por default, role em stock), dependency scan, higiene de dados no workspace e testes de regressão.

### UX-01: freshness e conflitos

Abrange: P1-11, P1-12.

Entrega: invalidação centralizada, refetch autoritativo, indicação de stale data e comportamento multi-tab/multi-browser.

## Critério de produção

Não considerar o sistema pronto para dados reais enquanto os seguintes pontos não estiverem demonstrados:

1. Identidade de produção e autorização por claims/session server-side.
2. OCC ou regra equivalente para todas as entidades editáveis.
3. Invariantes financeiras protegidas no servidor e transações testadas.
4. Email idempotente, autorizado, auditado e com TLS.
5. CSRF/Origin, cookies, headers e rate limits configurados.
6. Auditoria transacional com actor real e before/after onde necessário.
7. Testes de concorrência e integração contra schema controlado.
8. Backup, rollback, monitorização, alertas e retenção de logs definidos.
9. Paridade Access/SQL e regras de negócio assinadas pelo responsável.
10. Sem dados financeiros reais avulsos no workspace de desenvolvimento e ad-hoc connections desligadas por default.

## Estado dos testes

O repositório tem testes de domínio, repositories, routes e UI, mas `docs/CURRENT_STATUS.md` regista falhas conhecidas no full suite. Não reportar a suite como verde até essas falhas serem corrigidas e executadas novamente.

Também faltam testes dedicados para:

- CSRF e Origin;
- headers e atributos de cookie;
- sessões concorrentes e revogação em mudança de password;
- dois utilizadores a editar a mesma row;
- dois envios simultâneos do mesmo documento;
- Kit capacity interleaving;
- auditoria atómica e actor spoofing;
- production non-loopback boot guard;
- dependências vulneráveis.

## Referências

- `AGENTS.md`
- `docs/CURRENT_STATUS.md`
- `server/src/auth.ts`
- `server/src/app.ts`
- `server/src/index.ts`
- `server/src/db.ts` (auth queries: `findAuthUser`, `setPassword`, `createUtilizador`)
- `server/src/errors.ts` (`toConnectError`)
- `server/src/logger.ts` (redação de keys sensíveis)
- `server/src/profiles.ts`
- `server/src/routes/orders.ts`
- `server/src/routes/clients.ts`
- `server/src/routes/admin.ts`
- `server/src/routes/http-errors.ts`
- `server/src/repositories/orders/orders.repository.ts`
- `server/src/repositories/reconhecimento.repository.ts`
- `server/src/repositories/facturacao.repository.ts`
- `server/src/repositories/kit-consumables.repository.ts`
- `server/src/repositories/clients.repository.ts`
- `server/src/repositories/master-data.repository.ts`
- `server/src/repositories/database.ts` (`IDENTIFIER_PATTERN`)
- `server/src/validation/` (incluindo `admin.ts` e `sub-tables.ts`)
- `server/src/email.ts`
- `server/sql/001_order_audit_trail.sql`
- `server/.env.example`, `app/.env.example`
- `app/src/app/providers/user-provider.tsx` (idle logout, login/first-password)
- `app/src/features/orders/components/order-detail-page.tsx`
- `app/src/features/orders/components/kit-consumables-section.tsx`
- `app/src/features/invoicing/api/use-invoicing.ts`
