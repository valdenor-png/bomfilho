SELECT
  CASE
    WHEN COALESCE(TRIM(imagem_url), '') <> '' THEN 'enriquecido_com_imagem'
    ELSE 'enriquecido_sem_imagem'
  END AS tipo,
  COUNT(*) AS total
FROM produtos
WHERE enrichment_status = 'enriquecido'
GROUP BY tipo;