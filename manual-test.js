// manual-test.js
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

async function testQueries() {
  try {
    const today = '2025-09-01';
    const yesterday = '2025-08-31';
    
    console.log('🧪 Dashboard metriklerini test ediyorum...\n');
    
    // Bugünkü metrikler
    const metricsQuery = `
      SELECT 
        'today' as period,
        COUNT(*) as total_runs,
        COUNT(CASE WHEN success_bool = true THEN 1 END) as successful_payments,
        COUNT(CASE WHEN cancel_date IS NOT NULL OR refund_date IS NOT NULL THEN 1 END) as cancellations,
        ROUND(
          (COUNT(CASE WHEN success_bool = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0
        ) as success_rate
      FROM app.payment_log 
      WHERE DATE(created_at) = $1
    `;
    
    const metricsResult = await pool.query(metricsQuery, [today]);
    console.log('📊 Bugünkü metrikler:', metricsResult.rows[0]);
    
    // Son ödemeler
    const paymentsQuery = `
      SELECT 
        payment_id as id,
        CONCAT(amount, ' TL') as amount,
        CASE WHEN success_bool = true THEN 'Başarılı' ELSE 'Hata' END as status,
        TO_CHAR(created_at, 'HH24:MI') as time,
        CASE 
          WHEN LENGTH(issuer_bank_code::text) >= 10 THEN 
            CONCAT(LEFT(issuer_bank_code::text, 6), '****', RIGHT(issuer_bank_code::text, 4))
          ELSE '****'
        END as card
      FROM app.payment_log 
      WHERE DATE(created_at) = $1 
        AND cancel_date IS NULL 
        AND refund_date IS NULL
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    const paymentsResult = await pool.query(paymentsQuery, [today]);
    console.log('\n💳 Son ödemeler:');
    paymentsResult.rows.forEach((payment, index) => {
      console.log(`${index + 1}. ${payment.amount} - ${payment.status} (${payment.time})`);
    });
    
    // Son iptal/iadeler
    const cancellationsQuery = `
      SELECT 
        payment_id as id,
        CONCAT(amount, ' TL') as amount,
        CASE 
          WHEN cancel_date IS NOT NULL THEN 'İptal' 
          WHEN refund_date IS NOT NULL THEN 'İade'
          ELSE 'Bilinmeyen'
        END as type,
        TO_CHAR(
          COALESCE(cancel_date, refund_date, created_at), 
          'HH24:MI'
        ) as time,
        'Müşteri talebi' as reason
      FROM app.payment_log 
      WHERE DATE(created_at) = $1 
        AND (cancel_date IS NOT NULL OR refund_date IS NOT NULL)
      ORDER BY COALESCE(cancel_date, refund_date, created_at) DESC 
      LIMIT 5
    `;
    
    const cancellationsResult = await pool.query(cancellationsQuery, [today]);
    console.log('\n🚫 Son iptal/iadeler:');
    if (cancellationsResult.rows.length > 0) {
      cancellationsResult.rows.forEach((cancellation, index) => {
        console.log(`${index + 1}. ${cancellation.amount} - ${cancellation.type} (${cancellation.time})`);
      });
    } else {
      console.log('Bugün iptal/iade işlemi yok.');
    }
    
  } catch (error) {
    console.error('❌ Query hatası:', error.message);
  }
}

testQueries().then(() => pool.end());
