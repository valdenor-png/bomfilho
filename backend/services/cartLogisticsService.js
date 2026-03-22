'use strict';

const { toMoney } = require('../lib/helpers');

const KEYWORDS = Object.freeze({
  xlarge: ['botijao', 'galao', 'agua 20', 'fardo pesado', 'caixa grande', 'saco 25kg', 'saco 50kg'],
  large: ['fardo', 'caixa', 'pack', 'engradado', 'pet 2l', 'detergente 5l'],
  medium: ['bebida', 'refrigerante', 'suco', 'leite', 'amaciante', 'arroz', 'feijao', 'oleo'],
  small: ['biscoito', 'tempero', 'massa', 'fruta', 'verdura', 'higiene', 'snack']
});

const SIZE_TO_WEIGHT_KG = Object.freeze({
  small: 0.35,
  medium: 1.0,
  large: 4.0,
  xlarge: 12.0
});

const SIZE_TO_VOLUME_POINTS = Object.freeze({
  small: 1,
  medium: 2,
  large: 4,
  xlarge: 7
});

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inferItemSize({ nome = '', categoria = '' } = {}) {
  const text = `${normalizeText(nome)} ${normalizeText(categoria)}`;

  for (const token of KEYWORDS.xlarge) {
    if (text.includes(token)) return 'xlarge';
  }
  for (const token of KEYWORDS.large) {
    if (text.includes(token)) return 'large';
  }
  for (const token of KEYWORDS.medium) {
    if (text.includes(token)) return 'medium';
  }
  return 'small';
}

function resolveWeightKg({ item = {}, size = 'small' } = {}) {
  const explicit = Number(item?.peso_kg || item?.pesoKg || item?.peso || 0);
  if (Number.isFinite(explicit) && explicit > 0) {
    return toMoney(Math.max(0.05, explicit));
  }

  return toMoney(SIZE_TO_WEIGHT_KG[size] || SIZE_TO_WEIGHT_KG.small);
}

function buildManifestItem(item = {}, idx = 0) {
  const nome = String(item?.nome || item?.name || `Item ${idx + 1}`).trim() || `Item ${idx + 1}`;
  const quantidadeRaw = Number(item?.quantidade || item?.quantity || 0);
  const quantity = Number.isInteger(quantidadeRaw) && quantidadeRaw > 0 ? quantidadeRaw : 1;
  const size = inferItemSize(item);
  const weightKg = resolveWeightKg({ item, size });
  const totalWeightKg = toMoney(weightKg * quantity);

  return {
    name: nome.slice(0, 120),
    quantity,
    size,
    weight: totalWeightKg,
    unit_weight: weightKg,
    volume_points: Number(SIZE_TO_VOLUME_POINTS[size] || 1) * quantity
  };
}

function calculateCartLogistics(cart = []) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return {
      manifest_items: [],
      total_weight_kg: 0,
      total_volume_points: 0,
      total_items: 0
    };
  }

  const manifest = cart.map((item, idx) => buildManifestItem(item, idx));
  const totalWeightKg = toMoney(manifest.reduce((acc, item) => acc + Number(item.weight || 0), 0));
  const totalVolumePoints = manifest.reduce((acc, item) => acc + Number(item.volume_points || 0), 0);
  const totalItems = manifest.reduce((acc, item) => acc + Number(item.quantity || 0), 0);

  return {
    manifest_items: manifest.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      size: item.size,
      weight: item.weight
    })),
    total_weight_kg: totalWeightKg,
    total_volume_points: totalVolumePoints,
    total_items: totalItems
  };
}

module.exports = {
  calculateCartLogistics,
  inferItemSize,
  resolveWeightKg
};
