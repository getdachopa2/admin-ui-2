const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Simple 3D automation: sessionID → POST to 3D API → OTP automation
async function performAutomation({ threeDSessionId, cardData, otp, challengeSelector, submitSelector, successPattern, timeout = 20000 }) {
  let browser = null;
  let page = null;
  
  try {
    console.log('Starting 3D automation...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    page = await browser.newPage();
    
    // Set realistic headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    if (!threeDSessionId) {
      return { success: false, error: 'No sessionId provided' };
    }

    console.log(`Making 3D API call with sessionId: ${threeDSessionId}`);
    
    // Build form data for 3D API call
    const formData = {
      threeDSessionId: threeDSessionId,
      ...cardData  // Include card data from N8N
    };

    // Create HTML form and submit to 3D API
    const formHtml = `
      <html>
      <body>
        <form id="threeDForm" action="https://omccstb.turkcell.com.tr/paymentmanagement/rest/threeDSecure" method="POST">
          ${Object.entries(formData).map(([key, value]) => 
            `<input type="hidden" name="${key}" value="${value || ''}">`
          ).join('\n')}
        </form>
        <script>
          document.getElementById('threeDForm').submit();
        </script>
      </body>
      </html>
    `;

    await page.setContent(formHtml);
    console.log('Form submitted to 3D API, waiting for bank page...');
    
    // Wait for navigation to bank page
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

    console.log('Bank page loaded:', page.url());
    
    // Wait a bit for page to stabilize
    await page.waitForTimeout(2000);

    // Look for OTP input field with multiple selectors
    let otpInput = null;
    const otpSelectors = [
      challengeSelector,
      'input[type="password"]',
      'input[name*="otp"]',
      'input[name*="kod"]',
      'input[name*="code"]',
      'input[name*="sms"]',
      'input[id*="otp"]',
      'input[id*="kod"]',
      'input[placeholder*="kod"]',
      'input[placeholder*="code"]'
    ].filter(Boolean);

    for (const selector of otpSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        otpInput = selector;
        console.log(`Found OTP input: ${selector}`);
        break;
      } catch (e) {
        console.log(`Selector ${selector} not found, trying next...`);
      }
    }

    if (!otpInput) {
      // Check if already on success page
      if (successPattern) {
        try {
          await page.waitForSelector(successPattern, { timeout: 5000 });
          console.log('Success pattern found without OTP');
          return { success: true, finalUrl: page.url() };
        } catch (e) {
          console.log('Success pattern not found');
        }
      }
      return { success: false, error: 'No OTP input found and no success pattern' };
    }

    // Fill OTP
    console.log(`Filling OTP: ${otp}`);
    await page.type(otpInput, otp);
    await page.waitForTimeout(1000);

    // Look for submit button
    let submitButton = null;
    const submitSelectors = [
      submitSelector,
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Onayla")',
      'button:contains("Gönder")',
      'button:contains("Submit")',
      '#submit',
      '.submit'
    ].filter(Boolean);

    for (const selector of submitSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        submitButton = selector;
        console.log(`Found submit button: ${selector}`);
        break;
      } catch (e) {
        console.log(`Submit selector ${selector} not found`);
      }
    }

    if (!submitButton) {
      console.log('No submit button found, trying Enter key');
      await page.keyboard.press('Enter');
    } else {
      console.log('Clicking submit button...');
      await page.click(submitButton);
    }

    // Wait for result
    console.log('Waiting for response...');
    let success = false;
    let finalUrl = '';

    try {
      if (successPattern) {
        console.log(`Waiting for success pattern: ${successPattern}`);
        await page.waitForSelector(successPattern, { timeout: timeout });
        success = true;
        finalUrl = page.url();
        console.log('Success pattern found!');
      } else {
        // Wait for navigation
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeout });
        finalUrl = page.url();
        
        // Check URL for success indicators
        if (finalUrl.includes('success') || finalUrl.includes('complete') || finalUrl.includes('basarili')) {
          success = true;
          console.log('Success detected from URL');
        } else {
          // Check page content
          const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
          if (pageText.includes('başarılı') || pageText.includes('success') || pageText.includes('complete')) {
            success = true;
            console.log('Success detected from content');
          }
        }
      }
    } catch (e) {
      console.log('Timeout, checking current state...');
      finalUrl = page.url();
      
      // Last attempt
      if (successPattern) {
        try {
          await page.waitForSelector(successPattern, { timeout: 2000 });
          success = true;
        } catch (ee) {
          console.log('Success pattern still not found');
        }
      }
    }

    console.log(`Automation completed. Success: ${success}, URL: ${finalUrl}`);
    return { success, finalUrl, error: success ? null : 'Success not confirmed' };

  } catch (error) {
    console.error('Error in automation:', error);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Main 3D automation endpoint
app.post('/simulate-3d', async (req, res) => {
  try {
    console.log('Received 3D simulation request:', req.body);
    
    const {
      threeDSessionId,
      cardData,
      otp,
      challengeSelector,
      submitSelector,
      successPattern,
      runKey,
      n8nCallbackBase
    } = req.body;

    if (!threeDSessionId) {
      return res.status(400).json({ error: 'threeDSessionId is required' });
    }

    if (!otp) {
      return res.status(400).json({ error: 'otp is required' });
    }

    const result = await performAutomation({
      threeDSessionId,
      cardData,
      otp,
      challengeSelector,
      submitSelector,
      successPattern,
      timeout: 30000
    });

    // Notify N8N if callback URL provided
    if (n8nCallbackBase && runKey) {
      try {
        const callbackUrl = `${n8nCallbackBase}/webhook-test/3d-result/${runKey}`;
        console.log(`Notifying N8N at: ${callbackUrl}`);
        
        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        });
        
        console.log('N8N notification sent successfully');
      } catch (error) {
        console.error('Failed to notify N8N:', error);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /simulate-3d:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple 3D Worker listening on http://localhost:${PORT}`);
  console.log('Ready to handle sessionID-based 3D flows');
});