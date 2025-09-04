// check-payment-log.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'n8n',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'n8n',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5439,
});

async function checkPaymentLog() {
  try {
    console.log('🔍 payment_log tablosunu kontrol ediyorum...');
    
    // Table structure
    const structure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'payment_log'
      ORDER BY ordinal_position;
    `);
    
    console.log('payment_log kolonları:');
    structure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    if (structure.rows.length === 0) {
      console.log('❌ payment_log tablosu bulunamadı!');
      
      // Hangi tablolar var ona bakalım
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'app'
      `);
      
      console.log('\nMevcut tablolar:');
      tables.rows.forEach(row => {
        console.log(`  ${row.table_name}`);
      });
      
    } else {
      // Sample data
      const sample = await pool.query('SELECT * FROM app.payment_log LIMIT 3');
      console.log('\nÖrnek veri:');
      console.log(sample.rows);
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

checkPaymentLog();
