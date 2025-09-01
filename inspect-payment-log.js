// inspect-payment-log.js
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

try {
  // Tablo yapısını incele
  console.log('🔍 app.payment_log tablosunun yapısı:');
  const schema = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'payment_log' AND table_schema = 'app'
    ORDER BY ordinal_position
  `);
  
  schema.rows.forEach(row => {
    console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
  });
  
  // Örnek verileri göster
  console.log('\n📊 Örnek veriler (ilk 5 kayıt):');
  const sample = await pool.query('SELECT * FROM app.payment_log ORDER BY created_at DESC LIMIT 5');
  
  if (sample.rows.length > 0) {
    console.log(`Toplam ${sample.rows.length} kayıt örneği:`);
    sample.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Kayıt:`);
      Object.entries(row).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    });
  } else {
    console.log('Tabloda veri bulunamadı.');
  }
  
  // Toplam kayıt sayısı
  const count = await pool.query('SELECT COUNT(*) FROM app.payment_log');
  console.log(`\n📈 Toplam kayıt sayısı: ${count.rows[0].count}`);
  
} catch (error) {
  console.error('❌ Hata:', error.message);
}

pool.end();
