'use strict';

const {
  criarErroHttp,
  toLowerTrim,
  parsePositiveInt,
  toMoney,
  parseBooleanInput,
  parseJsonObjectInput,
  parseOverwriteImageModeInput,
  escapeLike,
  montarPaginacao,
  compararTextoSegura
} = require('../lib/helpers');

describe('helpers', () => {
  // --- criarErroHttp ---
  describe('criarErroHttp', () => {
    it('returns Error with httpStatus', () => {
      const err = criarErroHttp(404, 'Não encontrado');
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Não encontrado');
      expect(err.httpStatus).toBe(404);
    });
  });

  // --- toLowerTrim ---
  describe('toLowerTrim', () => {
    it('trims and lowercases string', () => {
      expect(toLowerTrim('  Hello World  ')).toBe('hello world');
    });
    it('handles null/undefined', () => {
      expect(toLowerTrim(null)).toBe('');
      expect(toLowerTrim(undefined)).toBe('');
    });
  });

  // --- parsePositiveInt ---
  describe('parsePositiveInt', () => {
    it('parses valid integer', () => {
      expect(parsePositiveInt('42', 10)).toBe(42);
    });
    it('returns fallback for NaN', () => {
      expect(parsePositiveInt('abc', 10)).toBe(10);
    });
    it('clamps to min/max', () => {
      expect(parsePositiveInt('0', 5, { min: 1, max: 100 })).toBe(1);
      expect(parsePositiveInt('999', 5, { min: 1, max: 100 })).toBe(100);
    });
    it('handles empty string', () => {
      expect(parsePositiveInt('', 7)).toBe(7);
    });
  });

  // --- toMoney ---
  describe('toMoney', () => {
    it('rounds to 2 decimal places', () => {
      expect(toMoney(10.005)).toBe(10.01);
      expect(toMoney(10.004)).toBe(10);
    });
    it('handles typical currency multiplication', () => {
      expect(toMoney(19.99 * 3)).toBe(59.97);
    });
    it('handles null/undefined', () => {
      expect(toMoney(null)).toBe(0);
      expect(toMoney(undefined)).toBe(0);
    });
  });

  // --- parseBooleanInput ---
  describe('parseBooleanInput', () => {
    it('recognizes truthy values', () => {
      for (const val of ['true', '1', 'sim', 'yes', 'on', 'TRUE', 'SIM']) {
        expect(parseBooleanInput(val)).toBe(true);
      }
    });
    it('recognizes falsy values', () => {
      for (const val of ['false', '0', 'nao', 'não', 'no', 'off']) {
        expect(parseBooleanInput(val)).toBe(false);
      }
    });
    it('returns fallback for unknown', () => {
      expect(parseBooleanInput('maybe', true)).toBe(true);
      expect(parseBooleanInput('', false)).toBe(false);
    });
  });

  // --- parseJsonObjectInput ---
  describe('parseJsonObjectInput', () => {
    it('parses valid JSON object', () => {
      expect(parseJsonObjectInput('{"a":1}')).toEqual({ a: 1 });
    });
    it('returns object as-is', () => {
      const obj = { x: 2 };
      expect(parseJsonObjectInput(obj)).toBe(obj);
    });
    it('rejects arrays', () => {
      expect(parseJsonObjectInput('[1,2]', null)).toBeNull();
    });
    it('returns fallback for invalid', () => {
      expect(parseJsonObjectInput('not json', 'fb')).toBe('fb');
      expect(parseJsonObjectInput(null, 'fb')).toBe('fb');
    });
  });

  // --- parseOverwriteImageModeInput ---
  describe('parseOverwriteImageModeInput', () => {
    it('maps synonyms to if_empty', () => {
      expect(parseOverwriteImageModeInput('if_empty')).toBe('if_empty');
      expect(parseOverwriteImageModeInput('preserve_existing')).toBe('if_empty');
    });
    it('maps synonyms to always', () => {
      expect(parseOverwriteImageModeInput('overwrite')).toBe('always');
      expect(parseOverwriteImageModeInput('sobrescrever')).toBe('always');
    });
    it('maps synonyms to never', () => {
      expect(parseOverwriteImageModeInput('keep')).toBe('never');
      expect(parseOverwriteImageModeInput('manter')).toBe('never');
    });
    it('returns fallback for empty/unknown', () => {
      expect(parseOverwriteImageModeInput('')).toBe('if_empty');
      expect(parseOverwriteImageModeInput('xyz', 'always')).toBe('always');
    });
  });

  // --- escapeLike ---
  describe('escapeLike', () => {
    it('escapes % _ and backslash', () => {
      expect(escapeLike('10%_off\\test')).toBe('10\\%\\_off\\\\test');
    });
    it('handles normal strings unchanged', () => {
      expect(escapeLike('hello')).toBe('hello');
    });
  });

  // --- montarPaginacao ---
  describe('montarPaginacao', () => {
    it('computes pages correctly', () => {
      const p = montarPaginacao(95, 2, 20);
      expect(p.total).toBe(95);
      expect(p.pagina).toBe(2);
      expect(p.limite).toBe(20);
      expect(p.total_paginas).toBe(5);
      expect(p.tem_mais).toBe(true);
    });
    it('clamps page to max', () => {
      const p = montarPaginacao(10, 999, 10);
      expect(p.pagina).toBe(1);
      expect(p.tem_mais).toBe(false);
    });
    it('handles zero total', () => {
      const p = montarPaginacao(0, 1, 20);
      expect(p.total).toBe(0);
      expect(p.total_paginas).toBe(1);
      expect(p.tem_mais).toBe(false);
    });
  });

  // --- compararTextoSegura ---
  describe('compararTextoSegura', () => {
    it('returns true for equal strings', () => {
      expect(compararTextoSegura('abc123', 'abc123')).toBe(true);
    });
    it('returns false for different strings', () => {
      expect(compararTextoSegura('abc', 'xyz')).toBe(false);
    });
    it('returns false for different lengths', () => {
      expect(compararTextoSegura('short', 'longer_string')).toBe(false);
    });
    it('handles empty strings', () => {
      expect(compararTextoSegura('', '')).toBe(true);
    });
  });
});
