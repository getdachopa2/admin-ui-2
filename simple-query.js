// simple-query.js
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

async function checkSimRuns() {
  try {
    console.log('🔍 sim_runs tablosunu kontrol ediyorum...');
    
    const client = await pool.connect();
    
    // Toplam kayıt sayısı
    const countResult = await client.query('SELECT COUNT(*) as total FROM app.sim_runs');
    console.log(`📊 Toplam sim_runs kayıt sayısı: ${countResult.rows[0].total}`);
    
    if (parseInt(countResult.rows[0].total) > 0) {
      // Son 3 kayıt
      const recentResult = await client.query(`
        SELECT run_id, workflow_name, status, start_time, end_time
        FROM app.sim_runs 
        ORDER BY start_time DESC 
        LIMIT 3
      `);
      
      console.log('\n📋 Son 3 kayıt:');
      recentResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ID: ${row.run_id}`);
        console.log(`   Workflow: ${row.workflow_name}`);
        console.log(`   Status: ${row.status}`);
        console.log(`   Start: ${row.start_time}`);
        console.log(`   End: ${row.end_time}`);
        console.log('   ---');
      });
      
      // Bugünkü kayıtlar
      const today = '2025-09-02';
      const todayResult = await client.query(`
        SELECT COUNT(*) as today_count 
        FROM app.sim_runs 
        WHERE DATE(start_time) = $1
      `, [today]);
      
      console.log(`\n📅 Bugünkü (${today}) kayıt sayısı: ${todayResult.rows[0].today_count}`);
      
    } else {
      console.log('📭 sim_runs tablosu boş!');
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Hata:', error);
    await pool.end();
  }
}

checkSimRuns();
