// test-api.js
async function testAPI() {
  try {
    const response = await fetch('http://localhost:3001/api/dashboard/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        today: '2025-09-01',
        yesterday: '2025-08-31'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ API Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ API Test Error:', error.message);
  }
}

testAPI();
