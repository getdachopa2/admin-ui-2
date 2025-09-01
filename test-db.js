// test-db.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'n8n',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'n8n',
  password: process.env.DB_PASSWORD || 'n8npass',
  port: process.env.DB_PORT || 5439,
});

console.log('Veritabanı bağlantısı test ediliyor...');
console.log('DB Config:', {
  user: process.env.DB_USER || 'n8n',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'n8n',
  port: process.env.DB_PORT || 5439,
});

try {
  const result = await pool.query('SELECT NOW()');
  console.log('✅ Veritabanı bağlantısı başarılı!');
  console.log('Zaman:', result.rows[0].now);
  
  // Tabloları listele
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' OR table_schema = 'app'
    ORDER BY table_schema, table_name
  `);
  
  console.log('\n📋 Mevcut tablolar:');
  tables.rows.forEach(row => {
    console.log(`  - ${row.table_name}`);
  });
  
} catch (error) {
  console.error('❌ Veritabanı bağlantı hatası:', error.message);
  console.error('Error details:', error);
}

pool.end();
