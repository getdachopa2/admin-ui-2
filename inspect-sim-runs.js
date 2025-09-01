// inspect-sim-runs.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'n8n',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'n8n',
  password: process.env.DB_PASSWORD || '123456',
  port: process.env.DB_PORT || 5439,
});

async function inspectSimRuns() {
  try {
    console.log('🔍 app.sim_runs tablosunun yapısı:');
    
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'sim_runs'
      ORDER BY ordinal_position;
    `;
    
    const schemaResult = await pool.query(schemaQuery);
    
    if (schemaResult.rows.length === 0) {
      console.log('❌ app.sim_runs tablosu bulunamadı!');
      return;
    }
    
    console.table(schemaResult.rows);
    
    console.log('\n📊 Örnek veriler (ilk 5 kayıt):');
    const dataQuery = `
      SELECT * FROM app.sim_runs 
      ORDER BY created_at DESC 
      LIMIT 5;
    `;
    
    const dataResult = await pool.query(dataQuery);
    
    if (dataResult.rows.length > 0) {
      console.table(dataResult.rows);
    } else {
      console.log('📝 Henüz veri yok.');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
}

inspectSimRuns();
