-- Migração de limpeza
-- Remove tabelas de funcionalidades removidas do projeto (Favoritos e Pontos/Fidelidade)
-- Pode ser executada com segurança mesmo se as tabelas não existirem.

USE railway;

DROP TABLE IF EXISTS historico_pontos;
DROP TABLE IF EXISTS pontos_fidelidade;
DROP TABLE IF EXISTS favoritos;

