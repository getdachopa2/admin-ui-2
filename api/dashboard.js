// api/dashboard.js
import { Pool } from 'pg';

// Veritabanı bağlantısı
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'payment_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { today, yesterday } = req.body;

    // Bugünkü ve dünkü metrikler
    const metricsQuery = `
      SELECT 
        'today' as period,
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN operation_type IN ('cancel', 'refund') THEN 1 END) as cancellations,
        ROUND(
          (COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0
        ) as success_rate
      FROM app.payment_log 
      WHERE DATE(created_at) = $1

      UNION ALL

      SELECT 
        'yesterday' as period,
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN operation_type IN ('cancel', 'refund') THEN 1 END) as cancellations,
        ROUND(
          (COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0
        ) as success_rate
      FROM app.payment_log 
      WHERE DATE(created_at) = $2
    `;

    // Son 5 ödeme
    const paymentsQuery = `
      SELECT 
        payment_id as id,
        CONCAT(amount, ' TL') as amount,
        CASE WHEN status = 'success' THEN 'Başarılı' ELSE 'Hata' END as status,
        TO_CHAR(created_at, 'HH24:MI') as time,
        CASE 
          WHEN LENGTH(card_number::text) >= 10 THEN 
            CONCAT(LEFT(card_number::text, 6), '****', RIGHT(card_number::text, 4))
          ELSE '****'
        END as card
      FROM app.payment_log 
      WHERE DATE(created_at) = $1 
        AND operation_type = 'payment'
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    // Son 5 iptal/iade
    const cancellationsQuery = `
      SELECT 
        payment_id as id,
        CONCAT(amount, ' TL') as amount,
        CASE WHEN operation_type = 'cancel' THEN 'İptal' ELSE 'İade' END as type,
        TO_CHAR(created_at, 'HH24:MI') as time,
        COALESCE(reason, 'Belirtilmemiş') as reason
      FROM app.payment_log 
      WHERE DATE(created_at) = $1 
        AND operation_type IN ('cancel', 'refund')
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    // Tüm query'leri çalıştır
    const [metricsResult, paymentsResult, cancellationsResult] = await Promise.all([
      pool.query(metricsQuery, [today, yesterday]),
      pool.query(paymentsQuery, [today]),
      pool.query(cancellationsQuery, [today])
    ]);

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

    res.status(200).json(response);

  } catch (error) {
    console.error('Dashboard API Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error',
      message: error.message 
    });
  }
}
