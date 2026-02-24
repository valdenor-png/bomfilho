-- Migração de limpeza
-- Remove tabelas de funcionalidades removidas do projeto (Favoritos e Pontos/Fidelidade)
-- Pode ser executada com segurança mesmo se as tabelas não existirem.

USE bom_filho_db;

DROP TABLE IF EXISTS historico_pontos;
DROP TABLE IF EXISTS pontos_fidelidade;
DROP TABLE IF EXISTS favoritos;
