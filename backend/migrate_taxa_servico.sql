-- Adiciona coluna taxa_servico na tabela pedidos para armazenar a taxa de serviço cobrada.
-- Compatível com MySQL 5.7+ (não usa IF NOT EXISTS que é exclusivo do MariaDB).
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'taxa_servico');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE pedidos ADD COLUMN taxa_servico DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER tipo_entrega', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
