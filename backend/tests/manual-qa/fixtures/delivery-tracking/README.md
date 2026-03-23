# Fixtures de entrega para QA manual

Diretorio: backend/tests/manual-qa/fixtures/delivery-tracking

Objetivo:
- Simular eventos de webhook Uber para validar experiencia de tracking no cliente e robustez de estado.

Arquivos:
- 01_pending_no_courier.json
- 02_pickup_assigned_no_location.json
- 03_in_transit_with_tracking.json
- 04_near_with_pin.json
- 05_delivered_with_proof.json
- 06_delivered_without_proof.json
- 07_canceled.json
- 08_out_of_order_regression_attempt.json
- 09_delay_update_no_tracking_url.json

Uso rapido:
1. Configure um pedido real com uber_delivery_id igual ao DeliveryId usado no script.
2. Execute backend/tests/manual-qa/run-uber-webhook-fixtures.ps1
3. Abra o painel de tracking em Meus Pedidos e valide com a matriz de QA.

Observacao:
- Os payloads usam o placeholder __DELIVERY_ID__, substituido automaticamente pelo script.
