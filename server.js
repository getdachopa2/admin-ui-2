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

// Dashboard metrics endpoint - Sadece metrikler
app.post('/api/dashboard/metrics', async (req, res) => {
  try {
    const { today, yesterday } = req.body;

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

    const metricsResult = await pool.query(metricsQuery, [today, yesterday]);

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
      }
    };

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

// Kanal kontrol metrikleri - KanalKontrolBotu için
app.post('/api/kanal/metrics', async (req, res) => {
  try {
    // Kanal kontrol için basit metrikler
    const simRunsQuery = `
      SELECT 
        COUNT(*) as total_sim_runs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_sim_runs,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_sim_runs,
        ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)) as avg_response_time
      FROM app.sim_runs 
      WHERE DATE(start_time) = CURRENT_DATE
    `;

    const simRunsResult = await pool.query(simRunsQuery);
    const stats = simRunsResult.rows[0] || {};

    const response = {
      success: true,
      metrics: {
        totalRuns: parseInt(stats.total_sim_runs || 0),
        successfulRuns: parseInt(stats.successful_sim_runs || 0),
        failedRuns: parseInt(stats.failed_sim_runs || 0),
        totalRequests: parseInt(stats.total_sim_runs || 0), // Sim runs = requests
        avgResponseTime: parseInt(stats.avg_response_time || 0),
        todayRuns: parseInt(stats.total_sim_runs || 0),
        activeFlows: 0 // Şimdilik sabit
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Kanal Metrics API Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error',
      message: error.message 
    });
  }
});

// Son 5 ödeme
app.get('/api/dashboard/recent-payments', async (req, res) => {
  try {
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
      WHERE DATE(created_at) = CURRENT_DATE
        AND cancel_date IS NULL 
        AND refund_date IS NULL
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    const result = await pool.query(paymentsQuery);

    res.json({
      success: true,
      payments: result.rows
    });

  } catch (error) {
    console.error('Recent Payments API Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error',
      message: error.message 
    });
  }
});

// Son 5 iptal
app.get('/api/dashboard/recent-cancellations', async (req, res) => {
  try {
    const cancellationsQuery = `
      SELECT 
        payment_id as id,
        order_id,
        CONCAT(amount, ' TL') as amount,
        'İptal' as type,
        TO_CHAR(cancel_date, 'HH24:MI') as time,
        'Müşteri talebi' as reason,
        amount as raw_amount,
        success_bool,
        created_at,
        cancel_date,
        issuer_bank_code,
        card_token,
        cancel_result_code
      FROM app.payment_log 
      WHERE DATE(created_at) = CURRENT_DATE
        AND cancel_date IS NOT NULL
      ORDER BY cancel_date DESC 
      LIMIT 5
    `;

    const result = await pool.query(cancellationsQuery);

    res.json({
      success: true,
      cancellations: result.rows
    });

  } catch (error) {
    console.error('Recent Cancellations API Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error',
      message: error.message 
    });
  }
});

// Son 5 iade
app.get('/api/dashboard/recent-refunds', async (req, res) => {
  try {
    const refundsQuery = `
      SELECT 
        payment_id as id,
        order_id,
        CONCAT(amount, ' TL') as amount,
        'İade' as type,
        TO_CHAR(refund_date, 'HH24:MI') as time,
        'Müşteri talebi' as reason,
        amount as raw_amount,
        success_bool,
        created_at,
        refund_date,
        issuer_bank_code,
        card_token,
        refund_result_code
      FROM app.payment_log 
      WHERE DATE(created_at) = CURRENT_DATE
        AND refund_date IS NOT NULL
      ORDER BY refund_date DESC 
      LIMIT 5
    `;

    const result = await pool.query(refundsQuery);

    res.json({
      success: true,
      refunds: result.rows
    });

  } catch (error) {
    console.error('Recent Refunds API Error:', error);
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

app.listen(port, () => {
  console.log(`API Server running on port ${port}`);
});
