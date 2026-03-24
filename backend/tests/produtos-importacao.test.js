'use strict';

const { importarProdutosPlanilha } = require('../services/produtosImportacao');

describe('produtosImportacao - cenário representativo controlado', () => {
  test('simulação com CSV simples processa sem transação e gera resumo rastreável', async () => {
    const queryMock = jest.fn(async (sql, params = []) => {
      const texto = String(sql || '').toLowerCase();

      if (texto.includes('information_schema.columns') && String(params[0] || '') === 'produtos') {
        return [[
          { column_name: 'id' },
          { column_name: 'nome' },
          { column_name: 'preco' },
          { column_name: 'codigo_interno' },
          { column_name: 'codigo_barras' },
          { column_name: 'descricao' },
          { column_name: 'unidade' },
          { column_name: 'categoria' },
          { column_name: 'estoque' },
          { column_name: 'ativo' }
        ]];
      }

      if (texto.includes('count(*)') && texto.includes('information_schema.columns')) {
        return [[{ total: 1 }]];
      }

      if (texto.includes('count(*)') && texto.includes('pg_indexes')) {
        return [[{ total: 1 }]];
      }

      if (texto.includes('from produtos') && texto.includes('where codigo_interno =')) return [[]];
      if (texto.includes('from produtos') && texto.includes('where codigo_barras =')) return [[]];
      if (texto.includes('from produtos') && texto.includes('where lower(nome) =')) return [[]];
      if (texto.includes('from produtos') && texto.includes('where codigo_interno in')) return [[]];
      if (texto.includes('from produtos') && texto.includes('where codigo_barras in')) return [[]];

      return [[], null];
    });

    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      query: queryMock
    };

    const pool = {
      query: queryMock,
      getConnection: jest.fn().mockResolvedValue(connection)
    };

    const csv = [
      'codigo_interno,nome,preco',
      'SKU-1,Arroz Tipo 1,24.90'
    ].join('\n');

    const resultado = await importarProdutosPlanilha({
      pool,
      fileBuffer: Buffer.from(csv, 'utf8'),
      originalName: 'catalogo.csv',
      createMissing: false,
      updateStock: false,
      simulate: true,
      adminUser: 'qa'
    });

    expect(resultado).toHaveProperty('importacao_id');
    expect(resultado).toHaveProperty('simulacao', true);
    expect(resultado).toHaveProperty('status', 'simulado');
    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});
