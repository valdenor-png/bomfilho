# 📱 Evolution API - Configuração WhatsApp

## 🚀 Instalação Rápida

### **Opção 1: Com Docker (Recomendado)**

1. Instale Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Execute: `instalar-evolution.bat`
3. Acesse: http://localhost:8080

### **Opção 2: Sem Docker (Manual)**

```bash
# Clone o repositório
git clone https://github.com/EvolutionAPI/evolution-api.git
cd evolution-api

# Instale dependências
npm install

# Configure .env
cp .env.example .env

# Inicie
npm start
```

## 🔧 Configuração

1. **Acesse:** http://localhost:8080/manager
2. **Crie uma instância** (nome: "loja" ou qualquer nome)
3. **Escaneie o QR Code** com seu WhatsApp
4. **Copie o token da instância**

## 🔗 Integração com seu Backend

Após conectar, adicione no `.env`:

```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=CHANGE_THIS_TO_RANDOM_KEY_123456
EVOLUTION_INSTANCE=loja
```

## 📡 Endpoints Principais

- **Enviar mensagem:** POST `/message/sendText/{instance}`
- **Status da instância:** GET `/instance/connectionState/{instance}`
- **QR Code:** GET `/instance/qr/{instance}`

## ✅ Teste de Conexão

```bash
curl http://localhost:8080/instance/connectionState/loja \
  -H "apikey: CHANGE_THIS_TO_RANDOM_KEY_123456"
```

## 🤖 Auto-resposta via webhook

Para responder automaticamente quando cliente mandar mensagem:

1. Configure no backend (`.env`):

```env
WHATSAPP_AUTO_REPLY_ENABLED=true
WHATSAPP_AUTO_REPLY_TEXT=Estamos com o site do Bom Filho no ar. Faca seu pedido por la.
EVOLUTION_WEBHOOK_TOKEN=troque_por_um_token_grande_e_aleatorio
```

2. No Manager da Evolution, configure o webhook para:

- URL: `https://SUA_URL_PUBLICA/api/webhooks/evolution`
- Método: `POST`
- Token: `EVOLUTION_WEBHOOK_TOKEN` (opcional, mas recomendado)

3. O backend ignora eventos sem mensagem, grupos/broadcast e mensagens do proprio bot.

## 📞 Suporte

- Documentação: https://doc.evolution-api.com/
- GitHub: https://github.com/EvolutionAPI/evolution-api
