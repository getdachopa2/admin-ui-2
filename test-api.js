// test-api.js

async function testAPI() {
  try {
    console.log('🧪 API testini başlatıyorum...');
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Today: ${today}, Yesterday: ${yesterday}`);
    
    const response = await fetch('http://localhost:3001/api/dashboard/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        today,
        yesterday
      })
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ API Response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ API Test Hatası:', error.message);
  }
}

testAPI();
