# Estrutura do projeto em árvore (ordem de criação)

- Critério: `CreationTime` do Windows/OneDrive.
- Escopo: todos os arquivos do workspace, exceto `node_modules` e `.git`.

> Observação (27/02/2026): os arquivos legados de admin (`js/admin*.js` e `css/admin-*.css`) foram removidos na migração para React. As páginas `admin.html`, `admin-pedidos.html` e `painel-admin.html` foram mantidas como redirecionamento para `/#/admin`.

site/
├── [001] index.html  (2026-01-08 20:07:36)
├── [002] styles.css  (2026-01-08 20:07:54)
├── backend/
│   ├── [003] package.json  (2026-01-08 21:16:47)
│   ├── [004] .env.example  (2026-01-08 21:16:47)
│   ├── [005] .env  (2026-01-08 21:16:57)
│   ├── [006] database.sql  (2026-01-08 21:17:26)
│   ├── [007] server.js  (2026-01-08 21:18:11)
│   ├── [008] README.md  (2026-01-08 21:18:40)
│   ├── [009] .gitignore  (2026-01-08 21:18:40)
│   ├── [012] package-lock.json  (2026-01-08 21:54:49)
│   ├── [029] migrate_pagamento.sql  (2026-01-09 08:12:02)
│   ├── [032] migrate_favoritos_cupons.sql  (2026-01-09 08:53:38)
│   ├── [034] migrate_produtos_detalhes.sql  (2026-01-09 08:59:04)
│   ├── [037] update_produtos_existentes.sql  (2026-01-09 09:17:49)
│   ├── [040] migrate_ofertas_avaliacoes_pontos.sql  (2026-01-09 18:27:23)
│   ├── [041] migrate_ofertas_v2.sql  (2026-01-09 18:33:55)
│   ├── [047] va.sql  (2026-01-10 02:45:20)
│   ├── [048] migrate_pix.sql  (2026-01-10 10:04:46)
│   ├── [058] start-server.bat  (2026-01-11 09:32:51)
│   ├── [059] instalar-evolution.bat  (2026-01-11 20:11:24)
│   ├── [060] EVOLUTION_API.md  (2026-01-11 20:13:05)
│   ├── [061] docker-compose-evolution.yml  (2026-01-11 21:11:15)
│   ├── [062] whatsapp-qrcode.html  (2026-01-11 21:18:04)
│   ├── [071] cloudflared.exe  (2026-01-12 21:55:18)
│   ├── [073] migrate_remover_favoritos_fidelidade.sql  (2026-01-19 21:18:27)
│   └── logs/
│       ├── [074] server.out.log  (2026-01-19 22:33:39)
│       └── [075] server.err.log  (2026-01-19 22:33:39)
├── [010] api-config.js  (2026-01-08 21:18:49)
├── [011] README.md  (2026-01-08 21:24:46)
├── [013] .gitignore  (2026-01-09 07:05:33)
├── js/
│   ├── [014] auth.js  (2026-01-09 07:20:40)
│   ├── [015] cart.js  (2026-01-09 07:20:40)
│   ├── [016] products.js  (2026-01-09 07:20:40)
│   ├── [017] main.js  (2026-01-09 07:20:40)
│   ├── [018] carousel.js  (2026-01-09 07:34:59)
│   ├── [020] admin.js  (2026-01-09 07:38:18)
│   ├── poo/
│   │   ├── [022] ApiClient.js  (2026-01-09 08:00:37)
│   │   ├── [023] AuthManager.js  (2026-01-09 08:00:37)
│   │   ├── [024] CartManager.js  (2026-01-09 08:00:37)
│   │   ├── [025] ProductManager.js  (2026-01-09 08:00:37)
│   │   ├── [026] CarouselManager.js  (2026-01-09 08:00:38)
│   │   ├── [027] App.js  (2026-01-09 08:00:38)
│   │   └── [028] index-poo.html  (2026-01-09 08:00:38)
│   ├── [031] historico-cupons.js  (2026-01-09 08:41:45)
│   ├── [035] rastreamento.js  (2026-01-09 08:59:54)
│   ├── [038] busca.js  (2026-01-09 18:21:39)
│   ├── [039] listas.js  (2026-01-09 18:24:46)
│   ├── [045] checkout.js  (2026-01-09 22:06:14)
│   ├── [065] admin-pedidos.js  (2026-01-11 21:58:42)
│   ├── [068] admin-novo.js  (2026-01-11 22:13:24)
│   ├── [070] ads.js  (2026-01-12 19:23:33)
│   └── [072] ofertas-avaliacoes.js  (2026-01-19 21:11:18)
├── [019] admin.html  (2026-01-09 07:38:18)
├── docs/
│   ├── [021] EXEMPLOS_API.md  (2026-01-09 07:48:07)
│   ├── [030] ATUALIZAR_BD.md  (2026-01-09 08:12:45)
│   ├── [033] MELHORIAS_1-2-3.md  (2026-01-09 08:54:09)
│   ├── [036] GUIA_TESTES.md  (2026-01-09 09:06:06)
│   ├── [042] FUNCIONALIDADES.md  (2026-01-09 21:37:04)
│   ├── [043] TESTES.md  (2026-01-09 21:37:50)
│   ├── [044] SOLUCAO-PROBLEMAS.md  (2026-01-09 21:42:26)
│   ├── [050] GUIA_GITHUB.md  (2026-01-10 20:32:47)
│   ├── [053] TRANSFERIR.md  (2026-01-10 20:33:49)
│   └── [055] CONTEXTO_PROJETO.md  (2026-01-10 20:39:22)
├── css/
│   ├── [046] checkout.css  (2026-01-09 22:07:03)
│   ├── [064] admin-pedidos.css  (2026-01-11 21:57:35)
│   └── [067] admin-novo.css  (2026-01-11 22:10:25)
├── img/
│   ├── [049] logo-cupom.png  (2026-01-10 11:15:22)
│   ├── ads/
│   │   └── [069] coca-cola-placeholder.svg  (2026-01-12 19:23:32)
│   └── [079] logo-oficial.png  (2026-02-26 09:15:04)
├── scripts/
│   ├── [051] setup-git.ps1  (2026-01-10 20:33:10)
│   ├── [052] setup-git.bat  (2026-01-10 20:33:10)
│   ├── [054] verificar-projeto.ps1  (2026-01-10 20:34:19)
│   ├── [056] limpar-projeto.ps1  (2026-01-10 20:41:00)
│   ├── [095] start-servicos.ps1  (2026-02-26 09:50:38)
│   └── [096] start-servicos.bat  (2026-02-26 09:55:06)
├── [057] ROADMAP-REUNIAO.html  (2026-01-10 20:50:31)
├── [063] admin-pedidos.html  (2026-01-11 21:57:34)
├── [066] painel-admin.html  (2026-01-11 22:09:33)
├── bot-whatsapp/
│   ├── [076] package.json  (2026-02-25 17:56:58)
│   └── [077] package-lock.json  (2026-02-25 17:57:13)
├── .vscode/
│   └── [078] settings.json  (2026-02-25 23:04:07)
└── frontend-react/
    ├── [080] index.html  (2026-02-26 09:33:41)
    ├── [081] package.json  (2026-02-26 09:33:41)
    ├── [082] vite.config.js  (2026-02-26 09:33:41)
    ├── src/
    │   ├── [083] main.jsx  (2026-02-26 09:33:41)
    │   ├── [084] App.jsx  (2026-02-26 09:33:41)
    │   ├── pages/
    │   │   ├── [085] HomePage.jsx  (2026-02-26 09:33:41)
    │   │   ├── [086] SobrePage.jsx  (2026-02-26 09:33:41)
    │   │   ├── [087] PagamentoPage.jsx  (2026-02-26 09:33:41)
    │   │   └── [088] ContaPage.jsx  (2026-02-26 09:33:41)
    │   ├── [089] styles.css  (2026-02-26 09:33:41)
    │   └── lib/
    │       └── [092] api.js  (2026-02-26 09:36:43)
    ├── [090] package-lock.json  (2026-02-26 09:34:39)
    └── dist/
        ├── [091] index.html  (2026-02-26 09:34:42)
        └── assets/
            ├── [093] index-BYoLbu0g.css  (2026-02-26 09:45:24)
            └── [094] index-CDl9xg-B.js  (2026-02-26 09:45:24)
