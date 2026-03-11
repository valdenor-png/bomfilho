# Logs Sandbox PagBank - 2026-03-09

Evidencias geradas em ambiente `sandbox` com logs de request/response.

## Prova principal solicitada pelo PagBank
- `POST https://sandbox.api.pagseguro.com/orders`: `201 Created`
- `order_id`: `ORDE_FF00D645-98F9-4227-8A2F-7D742F15A214`
- `reference_id`: `pedido-modelo-1773095403`

## Arquivos para enviar na homologacao
- `05_pagbank_sandbox_post_orders_modelo.request.json`
- `05_pagbank_sandbox_post_orders_modelo.response.json`

## Arquivos adicionais de diagnostico
- `00_summary.json`
- `01_local_pagbank_status.request.json`
- `01_local_pagbank_status.response.json`
- `02_local_pagbank_test_pix.request.json`
- `02_local_pagbank_test_pix.response.json`
- `03_pagbank_sandbox_get_orders.request.json`
- `03_pagbank_sandbox_get_orders.response.json`
- `04_pagbank_sandbox_post_orders.request.json`
- `04_pagbank_sandbox_post_orders.response.json`

Todos os tokens foram mascarados (`***REDACTED***`).
