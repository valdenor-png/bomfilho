require('dotenv').config({ path: '.env' });
const { queryWithRetry } = require('./lib/db');
(async () => {
  const [rows] = await queryWithRetry("SELECT column_name FROM information_schema.columns WHERE table_name = 'produtos' AND table_schema NOT IN ('pg_catalog','information_schema') LIMIT 5");
  console.log('ok', rows.length);
  process.exit(0);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
