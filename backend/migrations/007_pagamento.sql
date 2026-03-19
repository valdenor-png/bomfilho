-- Migracao para adicionar forma de pagamento aos pedidos
-- Compativel com MySQL 5.7 (sem ADD COLUMN IF NOT EXISTS)
USE railway;

SET @db := DATABASE();

SET @sql := (
	SELECT IF(
		COUNT(*) = 0,
		'ALTER TABLE pedidos ADD COLUMN forma_pagamento VARCHAR(20) DEFAULT ''pix'' AFTER status',
		'SELECT "SKIP: forma_pagamento ja existe"'
	)
	FROM information_schema.COLUMNS
	WHERE TABLE_SCHEMA = @db
		AND TABLE_NAME = 'pedidos'
		AND COLUMN_NAME = 'forma_pagamento'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Atualizar pedidos existentes para o valor padrao
UPDATE pedidos
SET forma_pagamento = 'pix'
WHERE forma_pagamento IS NULL OR TRIM(forma_pagamento) = '';

