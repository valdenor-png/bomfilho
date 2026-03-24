'use strict';

function buildErrorPayload(message, extra = {}) {
  return {
    erro: message,
    error: message,
    ...extra
  };
}

module.exports = {
  buildErrorPayload
};
