// server.js
import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Veritabanı bağlantısı
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'payment_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Dashboard metrics endpoint
app.post('/api/dashboard/metrics', async (req, res) => {
  try {
    const { today, yesterday } = req.body;
    console.log('Dashboard API called with:', { today, yesterday });

    // Test database connection first
    const testConnection = await pool.query('SELECT NOW() as current_time');
    console.log('Database connection test:', testConnection.rows[0]);

    // Bugünkü ve dünkü metrikler
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

      UNION ALL

      SELECT 
        'yesterday' as period,
        COUNT(*) as total_runs,
        COUNT(CASE WHEN success_bool = true THEN 1 END) as successful_payments,
        COUNT(CASE WHEN cancel_date IS NOT NULL OR refund_date IS NOT NULL THEN 1 END) as cancellations,
        ROUND(
          (COUNT(CASE WHEN success_bool = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0
        ) as success_rate
      FROM app.payment_log 
      WHERE DATE(created_at) = $2
    `;

    // Son 5 ödeme
    const paymentsQuery = `
      SELECT 
        payment_id as id,
        order_id,
        CONCAT(amount, ' TL') as amount,
        CASE WHEN success_bool = true THEN 'Başarılı' ELSE 'Hata' END as status,
        TO_CHAR(created_at, 'HH24:MI') as time,
        CASE 
          WHEN LENGTH(issuer_bank_code::text) >= 10 THEN 
            CONCAT(LEFT(issuer_bank_code::text, 6), '****', RIGHT(issuer_bank_code::text, 4))
          ELSE '****'
        END as card,
        amount as raw_amount,
        success_bool,
        created_at,
        issuer_bank_code,
        card_token,
        result_code
      FROM app.payment_log 
      WHERE DATE(created_at) = $1 
        AND cancel_date IS NULL 
        AND refund_date IS NULL
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    // Son 5 iptal/iade
    const cancellationsQuery = `
      SELECT 
        payment_id as id,
        order_id,
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
        'Müşteri talebi' as reason,
        amount as raw_amount,
        success_bool,
        created_at,
        cancel_date,
        refund_date,
        issuer_bank_code,
        card_token,
        cancel_result_code,
        refund_result_code
      FROM app.payment_log 
      WHERE DATE(created_at) = $1 
        AND (cancel_date IS NOT NULL OR refund_date IS NOT NULL)
      ORDER BY COALESCE(cancel_date, refund_date, created_at) DESC 
      LIMIT 5
    `;

    // Tüm query'leri çalıştır
    const [metricsResult, paymentsResult, cancellationsResult] = await Promise.all([
      pool.query(metricsQuery, [today, yesterday]),
      pool.query(paymentsQuery, [today]),
      pool.query(cancellationsQuery, [today])
    ]);

    console.log('Query results:');
    console.log('Metrics:', metricsResult.rows);
    console.log('Payments:', paymentsResult.rows.length, 'items');
    console.log('Cancellations:', cancellationsResult.rows.length, 'items');

    // Metrikleri parse et
    const todayStats = metricsResult.rows.find(row => row.period === 'today') || {};
    const yesterdayStats = metricsResult.rows.find(row => row.period === 'yesterday') || {};

    const response = {
      success: true,
      metrics: {
        todayRuns: parseInt(todayStats.total_runs || 0),
        successfulPayments: parseInt(todayStats.successful_payments || 0),
        cancellations: parseInt(todayStats.cancellations || 0),
        successRate: parseInt(todayStats.success_rate || 0),
        yesterdayRuns: parseInt(yesterdayStats.total_runs || 0),
        yesterdayPayments: parseInt(yesterdayStats.successful_payments || 0),
        yesterdayCancellations: parseInt(yesterdayStats.cancellations || 0),
        yesterdaySuccessRate: parseInt(yesterdayStats.success_rate || 0)
      },
      recentTransactions: paymentsResult.rows,
      recentCancellations: cancellationsResult.rows
    };

    console.log('API Response:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('Dashboard API Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error',
      message: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`API Server running on http://127.0.0.1:${port}`);
});
