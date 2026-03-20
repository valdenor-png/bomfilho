// Configuração central da loja — dados que estavam hardcoded em vários arquivos.
// Use VITE_STORE_* para sobrescrever via env quando necessário.

const STORE_NAME = String(import.meta.env.VITE_STORE_NAME || 'BomFilho Supermercado').trim();
const STORE_CNPJ = String(import.meta.env.VITE_STORE_CNPJ || '09.175.211/0001-30').trim();
const STORE_CEP = String(import.meta.env.VITE_STORE_CEP || '68740-180').trim();
const STORE_NUMERO = String(import.meta.env.VITE_STORE_NUMERO || '70').trim();
const STORE_ENDERECO = String(
  import.meta.env.VITE_STORE_ENDERECO || `Travessa 07 de Setembro, nº ${STORE_NUMERO} - CEP ${STORE_CEP}`
).trim();
const STORE_HORARIO = String(
  import.meta.env.VITE_STORE_HORARIO || 'Segunda a sábado, das 07h às 22h'
).trim();
const STORE_HORARIO_CURTO = String(
  import.meta.env.VITE_STORE_HORARIO_CURTO || 'Segunda a sabado: 7h30 as 13h e 15h as 19h30 | Domingos e feriados: 8h as 12h30'
).trim();
const STORE_TEMPO_RETIRADA = String(import.meta.env.VITE_STORE_TEMPO_RETIRADA || '20-40 min').trim();

const STORE_WHATSAPP = String(import.meta.env.VITE_STORE_WHATSAPP || '5591999652790').trim();
const STORE_WHATSAPP_DISPLAY = String(import.meta.env.VITE_STORE_WHATSAPP_DISPLAY || '(91) 99965-2790').trim();
const STORE_WHATSAPP_URL = String(
  import.meta.env.VITE_STORE_WHATSAPP_URL
  || `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent('Olá! Quero fazer um pedido.')}`
).trim();

const STORE_TELEFONE = String(import.meta.env.VITE_STORE_TELEFONE || '+559137219780').trim();
const STORE_TELEFONE_DISPLAY = String(import.meta.env.VITE_STORE_TELEFONE_DISPLAY || '(91) 3721-9780').trim();
const STORE_TELEFONE_URL = `tel:${STORE_TELEFONE}`;

const STORE_LIMITE_BIKE_KM = Number(import.meta.env.VITE_STORE_LIMITE_BIKE_KM) || 1;

const RETIRADA_LOJA_INFO = Object.freeze({
  nome: STORE_NAME,
  endereco: STORE_ENDERECO,
  horario: STORE_HORARIO,
  tempo_estimado: STORE_TEMPO_RETIRADA
});

export {
  STORE_NAME,
  STORE_CNPJ,
  STORE_CEP,
  STORE_NUMERO,
  STORE_ENDERECO,
  STORE_HORARIO,
  STORE_HORARIO_CURTO,
  STORE_TEMPO_RETIRADA,
  STORE_WHATSAPP,
  STORE_WHATSAPP_DISPLAY,
  STORE_WHATSAPP_URL,
  STORE_TELEFONE,
  STORE_TELEFONE_DISPLAY,
  STORE_TELEFONE_URL,
  STORE_LIMITE_BIKE_KM,
  RETIRADA_LOJA_INFO
};
