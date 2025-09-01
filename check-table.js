// check-table.js
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'payment_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function checkTable() {
  try {
    console.log('Checking sim_runs table structure...');
    
    // Table structure
    const structure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'app' AND table_name = 'sim_runs'
      ORDER BY ordinal_position;
    `);
    
    console.log('Table columns:');
    structure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Sample data
    const sample = await pool.query('SELECT * FROM app.sim_runs LIMIT 3');
    console.log('\nSample data:');
    console.log(sample.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();
