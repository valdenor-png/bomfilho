# Plano de Contingencia — BomFilho Delivery

## Cenario 1: Site fora do ar (Vercel down)
- Verificar status da Vercel: https://www.vercel-status.com
- Comunicar clientes via WhatsApp que o site esta temporariamente indisponivel
- Ativar recebimento de pedidos manual via WhatsApp: (91) 99965-2790
- Monitorar ate a Vercel restabelecer o servico

## Cenario 2: Banco de dados inacessivel (Render)
- Verificar status do Render no painel: https://status.render.com
- Se down: ativar pedidos via WhatsApp
- Se dados corrompidos: restaurar ultimo backup
- Contato suporte Render: via Dashboard

## Cenario 3: Pagamento PIX nao funciona
- Verificar status do gateway de pagamento (Mercado Pago)
- Oferecer pagamento na entrega/retirada como alternativa
- Comunicar clientes pelo WhatsApp

## Cenario 4: Deploy quebrou o site
- Acessar Vercel Dashboard > Deployments
- Clicar nos 3 pontinhos do deploy anterior (que funcionava)
- Selecionar "Promote to Production" para reverter
- Investigar o que quebrou no deploy novo

## Cenario 5: Pico de demanda (site lento)
- Vercel escala automaticamente (serverless)
- Se o banco for o gargalo: verificar conexoes ativas no Render
- Considerar ativar cache de produtos (nao mudam frequentemente)

## Contatos de emergencia:
- WhatsApp da loja: (91) 99965-2790
- Telefone fixo: (91) 3721-9780
- Suporte Vercel: via Dashboard
- Suporte Render: via Dashboard

## Protocolo de comunicacao:
1. Identificar o problema (max 5 min)
2. Ativar alternativa manual (WhatsApp) se necessario
3. Comunicar clientes com pedidos em andamento
4. Corrigir o problema
5. Confirmar que voltou ao normal
6. Documentar o que aconteceu para prevenir recorrencia
