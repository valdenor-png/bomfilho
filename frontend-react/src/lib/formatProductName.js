/**
 * Normaliza nomes de produtos de CAIXA ALTA para Title Case legível.
 * Ex: "AGUA MIN INDAIA 20L ENTREGAR" → "Água Mineral Indaiá 20L Entregar"
 */
export default function formatProductName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    // Unidades de medida em uppercase
    .replace(/\b(Kg|Ml|Lt|Un|Und|20l|500ml|350ml|200ml|1l|5kg|800g|900ml|1kg|2kg|10kg)\b/gi, (m) => m.toUpperCase())
    // Abreviações comuns
    .replace(/\bRefrig\b/gi, 'Refrigerante')
    .replace(/\bAntart\b/gi, 'Antarctica')
    .replace(/\bMin\b/gi, 'Mineral')
    .replace(/\bGarraf\b/gi, 'Garrafão')
    .replace(/\bAchoc\b/gi, 'Achocolatado')
    .replace(/\bLiq\b/gi, 'Líquido')
    .replace(/\bAbs\b/gi, 'Absorvente')
    .replace(/\bC\/ab\b/gi, 'Com Abas')
    .replace(/\bBco\b/gi, 'Branco')
    .replace(/\bTp1\b/gi, 'Tipo 1')
    .replace(/\bCx\b/gi, 'Caixa')
    .replace(/\bPct\b/gi, 'Pacote')
    .replace(/\bGarrafao\b/gi, 'Garrafão')
    .replace(/\bEntrega Levar\b/gi, 'Entrega')
    .replace(/\bGarrafaor\b/gi, 'Garrafão')
    .replace(/\bFaor\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
