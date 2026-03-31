'use strict';

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'senhasenha',
  'qwerty123', 'qwertyui', 'abcdefgh', 'abcd1234', '11111111',
  '22222222', '12341234', 'senha123', 'mudar123', 'trocar123'
]);

function validatePassword(senha) {
  const errors = [];
  const s = String(senha || '');

  if (s.length < MIN_LENGTH) {
    errors.push(`A senha deve ter no mínimo ${MIN_LENGTH} caracteres.`);
  }

  if (s.length > MAX_LENGTH) {
    errors.push(`A senha deve ter no máximo ${MAX_LENGTH} caracteres.`);
  }

  if (!/[A-Z]/.test(s)) {
    errors.push('Inclua pelo menos 1 letra maiúscula.');
  }

  if (!/[a-z]/.test(s)) {
    errors.push('Inclua pelo menos 1 letra minúscula.');
  }

  if (!/\d/.test(s)) {
    errors.push('Inclua pelo menos 1 número.');
  }

  if (COMMON_PASSWORDS.has(s.toLowerCase())) {
    errors.push('Essa senha é muito comum. Escolha outra.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { validatePassword };
