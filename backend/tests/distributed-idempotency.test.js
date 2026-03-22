'use strict';

const {
  hashFingerprint,
  iniciarOperacaoDistribuida,
  concluirOperacaoDistribuida,
  falharOperacaoDistribuida
} = require('../services/distributedIdempotencyService');

function addSeconds(base, sec) {
  return new Date(base.getTime() + sec * 1000);
}

function criarPoolFake() {
  const tabela = new Map();

  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn(async (sql, params = []) => {
      const texto = String(sql || '').trim().toLowerCase();
      const agora = new Date();

      if (texto.startsWith('select id, request_fingerprint')) {
        const [scope, key, userId] = params;
        const row = tabela.get(`${scope}:${key}:${userId}`);
        return [row ? [{ ...row }] : []];
      }

      if (texto.startsWith('insert into idempotency_operations')) {
        const [scope, key, userId, pedidoId, fingerprint, status, lockTtl, opTtl] = params;
        const id = tabela.size + 1;
        tabela.set(`${scope}:${key}:${userId}`, {
          id,
          scope,
          idempotency_key: key,
          user_id: userId,
          pedido_id: pedidoId,
          request_fingerprint: fingerprint,
          status,
          http_status: null,
          response_payload_json: null,
          last_error: null,
          lock_until: addSeconds(agora, Number(lockTtl || 0)),
          expires_at: addSeconds(agora, Number(opTtl || 0)),
          updated_at: agora
        });
        return [{ insertId: id }];
      }

      if (texto.startsWith('update idempotency_operations') && texto.includes('where id = ?')) {
        const [status, pedidoId, fingerprint, lockTtl, opTtl, id] = params;
        for (const [key, row] of tabela.entries()) {
          if (Number(row.id) === Number(id)) {
            tabela.set(key, {
              ...row,
              status,
              pedido_id: pedidoId ?? row.pedido_id,
              request_fingerprint: fingerprint,
              http_status: null,
              response_payload_json: null,
              last_error: null,
              lock_until: addSeconds(agora, Number(lockTtl || 0)),
              expires_at: addSeconds(agora, Number(opTtl || 0)),
              updated_at: agora
            });
            break;
          }
        }
        return [{ affectedRows: 1 }];
      }

      if (texto.startsWith('update idempotency_operations') && texto.includes('where scope = ? and idempotency_key = ? and user_id = ?')) {
        const [status, a, b, c, d, scope, idemKey, userId] = params;
        const mapKey = `${scope}:${idemKey}:${userId}`;
        const row = tabela.get(mapKey);
        if (!row) {
          return [{ affectedRows: 0 }];
        }

        if (status === 'completed') {
          tabela.set(mapKey, {
            ...row,
            status,
            pedido_id: a ?? row.pedido_id,
            http_status: b,
            response_payload_json: c,
            lock_until: agora,
            expires_at: addSeconds(agora, Number(d || 0)),
            updated_at: agora
          });
        } else {
          tabela.set(mapKey, {
            ...row,
            status,
            http_status: a,
            last_error: b,
            lock_until: agora,
            expires_at: addSeconds(agora, Number(c || 0)),
            updated_at: agora
          });
        }

        return [{ affectedRows: 1 }];
      }

      throw new Error(`SQL não suportado no fake: ${sql}`);
    })
  };

  return {
    getConnection: jest.fn().mockResolvedValue(connection),
    _connection: connection,
    _tabela: tabela
  };
}

describe('distributedIdempotencyService', () => {
  test('replay com mesma chave e payload concluído', async () => {
    const pool = criarPoolFake();
    const key = 'pedido_key_abc123';
    const fp = hashFingerprint({ itens: [{ id: 1, q: 2 }] });

    const start = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pedido_criacao',
      idempotencyKey: key,
      userId: 10,
      requestFingerprint: fp
    });

    expect(start.state).toBe('acquired');

    await concluirOperacaoDistribuida({
      pool,
      scope: 'pedido_criacao',
      idempotencyKey: key,
      userId: 10,
      pedidoId: 55,
      httpStatus: 201,
      responsePayload: { pedido_id: 55, status: 'aguardando_revisao' }
    });

    const replay = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pedido_criacao',
      idempotencyKey: key,
      userId: 10,
      requestFingerprint: fp
    });

    expect(replay.state).toBe('replay');
    expect(replay.httpStatus).toBe(201);
    expect(replay.responsePayload).toMatchObject({ pedido_id: 55 });
  });

  test('mesma chave com payload diferente retorna mismatch', async () => {
    const pool = criarPoolFake();
    const key = 'pedido_key_diff123';

    await iniciarOperacaoDistribuida({
      pool,
      scope: 'pedido_criacao',
      idempotencyKey: key,
      userId: 11,
      requestFingerprint: hashFingerprint({ a: 1 })
    });

    const mismatch = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pedido_criacao',
      idempotencyKey: key,
      userId: 11,
      requestFingerprint: hashFingerprint({ a: 2 })
    });

    expect(mismatch.state).toBe('fingerprint_mismatch');
    expect(mismatch.httpStatus).toBe(409);
  });

  test('concorrência simulada em pagamento pix: segunda chamada fica in_progress', async () => {
    const pool = criarPoolFake();
    const key = 'pix_key_001';
    const fp = hashFingerprint({ pedido_id: 77, modo: 'pix' });

    const r1 = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_pix',
      idempotencyKey: key,
      userId: 20,
      pedidoId: 77,
      requestFingerprint: fp,
      lockTtlSeconds: 60
    });

    const r2 = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_pix',
      idempotencyKey: key,
      userId: 20,
      pedidoId: 77,
      requestFingerprint: fp,
      lockTtlSeconds: 60
    });

    expect(r1.state).toBe('acquired');
    expect(r2.state).toBe('in_progress');
  });

  test('concorrência simulada em pagamento cartão: segunda chamada fica in_progress', async () => {
    const pool = criarPoolFake();
    const key = 'cartao_key_001';
    const fp = hashFingerprint({ pedido_id: 88, modo: 'cartao' });

    const r1 = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_cartao',
      idempotencyKey: key,
      userId: 21,
      pedidoId: 88,
      requestFingerprint: fp,
      lockTtlSeconds: 60
    });

    const r2 = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_cartao',
      idempotencyKey: key,
      userId: 21,
      pedidoId: 88,
      requestFingerprint: fp,
      lockTtlSeconds: 60
    });

    expect(r1.state).toBe('acquired');
    expect(r2.state).toBe('in_progress');
  });

  test('recupera operação após lock expirado', async () => {
    const pool = criarPoolFake();
    const key = 'expired_lock_key_01';
    const fp = hashFingerprint({ pedido_id: 90 });

    await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_pix',
      idempotencyKey: key,
      userId: 22,
      pedidoId: 90,
      requestFingerprint: fp,
      lockTtlSeconds: 1,
      operationTtlSeconds: 2
    });

    const registro = pool._tabela.get(`pagamento_pix:${key}:22`);
    registro.lock_until = new Date(Date.now() - 15_000);
    pool._tabela.set(`pagamento_pix:${key}:22`, registro);

    const retry = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_pix',
      idempotencyKey: key,
      userId: 22,
      pedidoId: 90,
      requestFingerprint: fp,
      lockTtlSeconds: 30,
      operationTtlSeconds: 120
    });

    expect(retry.state).toBe('acquired');
  });

  test('registra falha e permite nova aquisição após lock expirado', async () => {
    const pool = criarPoolFake();
    const key = 'failed_key_01';
    const fp = hashFingerprint({ pedido_id: 91 });

    await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_cartao',
      idempotencyKey: key,
      userId: 23,
      pedidoId: 91,
      requestFingerprint: fp,
      lockTtlSeconds: 30,
      operationTtlSeconds: 120
    });

    await falharOperacaoDistribuida({
      pool,
      scope: 'pagamento_cartao',
      idempotencyKey: key,
      userId: 23,
      httpStatus: 502,
      errorMessage: 'gateway timeout',
      failureTtlSeconds: 1
    });

    const registro = pool._tabela.get(`pagamento_cartao:${key}:23`);
    registro.expires_at = new Date(Date.now() - 10_000);
    registro.lock_until = new Date(Date.now() - 10_000);
    pool._tabela.set(`pagamento_cartao:${key}:23`, registro);

    const reacquire = await iniciarOperacaoDistribuida({
      pool,
      scope: 'pagamento_cartao',
      idempotencyKey: key,
      userId: 23,
      pedidoId: 91,
      requestFingerprint: fp,
      lockTtlSeconds: 30,
      operationTtlSeconds: 120
    });

    expect(reacquire.state).toBe('acquired');
  });
});
