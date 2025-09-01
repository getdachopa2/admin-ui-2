const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'payment_db',
  password: 'password',
  port: 5432,
});

pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'sim_runs' ORDER BY ordinal_position")
  .then(result => {
    console.log('sim_runs tablosu sütunları:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    pool.end();
  })
  .catch(err => {
    console.error('Hata:', err);
    pool.end();
  });
