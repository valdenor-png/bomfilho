const FONT_SCALE_STORAGE_KEY = 'bomfilho_font_scale';
const HIGH_CONTRAST_STORAGE_KEY = 'bomfilho_high_contrast';
const REDUCE_MOTION_STORAGE_KEY = 'bomfilho_reduce_motion';

export const FONT_SCALE_OPTIONS = [
  { value: 0.9, label: 'A-' },
  { value: 1, label: 'A' },
  { value: 1.15, label: 'A+' }
];

function normalizeFontScale(value) {
  const numericValue = Number(value);
  const foundOption = FONT_SCALE_OPTIONS.find((option) => option.value === numericValue);
  return foundOption ? foundOption.value : 1;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

function getSystemReduceMotionPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readStoredBoolean(key, fallback = false) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return normalizeBoolean(storedValue, fallback);
  } catch {
    return fallback;
  }
}

function writeStoredValue(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, String(value));
  } catch {
  }
}

function setRootFlag(flagName, enabled) {
  if (typeof document === 'undefined') {
    return;
  }

  if (enabled) {
    document.documentElement.setAttribute(flagName, 'true');
    return;
  }

  document.documentElement.removeAttribute(flagName);
}

export function applyFontScale(scale) {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedScale = normalizeFontScale(scale);
  document.documentElement.style.setProperty('--font-scale', String(normalizedScale));
}

export function getStoredFontScale() {
  if (typeof window === 'undefined') {
    return 1;
  }

  try {
    const storedValue = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    return normalizeFontScale(storedValue);
  } catch {
    return 1;
  }
}

export function setStoredFontScale(scale) {
  const normalizedScale = normalizeFontScale(scale);

  writeStoredValue(FONT_SCALE_STORAGE_KEY, normalizedScale);

  applyFontScale(normalizedScale);
  return normalizedScale;
}

export function applyHighContrast(enabled) {
  const normalizedEnabled = normalizeBoolean(enabled, false);
  setRootFlag('data-high-contrast', normalizedEnabled);
}

export function getStoredHighContrast() {
  return readStoredBoolean(HIGH_CONTRAST_STORAGE_KEY, false);
}

export function setStoredHighContrast(enabled) {
  const normalizedEnabled = normalizeBoolean(enabled, false);
  writeStoredValue(HIGH_CONTRAST_STORAGE_KEY, normalizedEnabled);
  applyHighContrast(normalizedEnabled);
  return normalizedEnabled;
}

export function applyReducedMotion(enabled) {
  const normalizedEnabled = normalizeBoolean(enabled, false);
  setRootFlag('data-reduce-motion', normalizedEnabled);
}

export function getStoredReducedMotion() {
  return readStoredBoolean(REDUCE_MOTION_STORAGE_KEY, getSystemReduceMotionPreference());
}

export function setStoredReducedMotion(enabled) {
  const normalizedEnabled = normalizeBoolean(enabled, false);
  writeStoredValue(REDUCE_MOTION_STORAGE_KEY, normalizedEnabled);
  applyReducedMotion(normalizedEnabled);
  return normalizedEnabled;
}