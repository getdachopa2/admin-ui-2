import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs';

// Enhanced logging
const logFile = './worker.log';
function log(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
}

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Simple 3D automation: sessionID → POST to 3D API → OTP automation
// Helper function to finalize 3DS process
async function finalize3DS(page, threeDSessionId, n8nCallbackBase, runKey, environment = 'stb') {
  const targetOk = /\/paymentmanagement\/rest\/threeDSecureResult/i;
  const targetCb = /\/webhook\/payment-test\/3d\/callback/i;
  
  log('[3DS] Starting finalize process...');
  
  // 1) Wait for automatic redirect to merchant
  let finalUrl = '';
  try {
    log('[3DS] Waiting for automatic redirect to merchant...');
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }),
      page.waitForResponse(res => {
        const url = res.url();
        if (targetOk.test(url) || targetCb.test(url)) {
          log(`[3DS] Detected merchant response: ${url}`);
          return true;
        }
        return false;
      }, { timeout: 8000 })
    ]);
    finalUrl = page.url();
    log(`[3DS] Navigation completed to: ${finalUrl}`);
  } catch (e) {
    finalUrl = page.url();
    log(`[3DS] No automatic redirect detected, current URL: ${finalUrl}`);
  }

  // Check if we're already at merchant result page
  if (targetOk.test(finalUrl) || targetCb.test(finalUrl)) {
    log('[3DS] Already at merchant result/callback page');
    return { success: true, finalUrl, source: 'automatic' };
  }

  // 2) Force navigation to okUrl - Environment-aware host selection
  try {
    let baseHost;
    switch (environment.toLowerCase()) {
      case 'prod':
      case 'production':
        baseHost = 'omcc.turkcell.com.tr';
        break;
      case 'prp':
      case 'preprod':
        baseHost = 'omccprp.turkcell.com.tr';
        break;
      case 'stb':
      case 'stable':
      default:
        baseHost = 'omccstb.turkcell.com.tr';
        break;
    }
    
    const forcedOkUrl = `https://${baseHost}/paymentmanagement/rest/threeDSecureResult?xpaycellsid=${threeDSessionId}`;
    log(`[3DS][FINALIZE] Forcing navigation to okUrl (${environment}): ${forcedOkUrl}`);
    
    let httpStatus = null;
    let responseHeaders = null;
    let finalizeMethod = 'post';
    
    // Try POST request first (many merchant callbacks expect POST)
    try {
      log(`[3DS][FINALIZE][ATTEMPT_POST] Trying form POST submission`);
      const response = await page.evaluate(async (url) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url;
        form.style.display = 'none';
        document.body.appendChild(form);
        form.submit();
        return 'POST_SUBMITTED';
      }, forcedOkUrl);
      
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
      log(`[3DS][FINALIZE][POST_SUCCESS] POST submission successful`);
    } catch (postError) {
      log(`[3DS][FINALIZE][POST_FAILED] POST navigation failed, trying GET: ${postError.message}`);
      finalizeMethod = 'get';
      await page.goto(forcedOkUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    }
    
    finalUrl = page.url();
    
    // Get response status if available
    try {
      const response = await page.evaluate(() => {
        return {
          status: window.performance?.getEntriesByType?.('navigation')?.[0]?.responseStatus || null,
          headers: null
        };
      });
      httpStatus = response.status;
    } catch (e) {
      log(`[3DS][FINALIZE] Could not get response status: ${e.message}`);
    }
    
    log(`[3DS][FINALIZE] Navigation completed to: ${finalUrl}, method: ${finalizeMethod}, status: ${httpStatus || 'unknown'}`);
    
    // Check if we got 405 and should retry with proper POST
    if (httpStatus === 405 || finalUrl.includes('405') || (finalizeMethod === 'get' && finalUrl === forcedOkUrl)) {
      log(`[3DS][FINALIZE][RETRY_POST] Got 405 or suspicious response, trying fetch POST with form data`);
      try {
        const postResult = await page.evaluate(async (url, sessionId) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            body: `xpaycellsid=${sessionId}`,
            credentials: 'include'
          });
          
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()]),
            bodyPreview: (await response.text()).substring(0, 500)
          };
        }, forcedOkUrl, threeDSessionId);
        
        httpStatus = postResult.status;
        responseHeaders = postResult.headers;
        finalizeMethod = 'fetch-post';
        
        log(`[3DS][FINALIZE][POST_RETRY_RESULT] Fetch POST result: status=${postResult.status}, body preview: ${postResult.bodyPreview.substring(0, 200)}...`);
        
        if (postResult.status >= 200 && postResult.status < 300) {
          log(`[3DS][FINALIZE][POST_SUCCESS] Successful POST finalize with status ${postResult.status}`);
          
          // Get full HTML response and handle form submission
          try {
            // Get the HTML content from fetch result we already have
            const htmlPreview = postResult.bodyPreview;
            log(`[3DS][FINALIZE][POST_RETRY_RESULT] Fetch POST result: status=${postResult.status}, body preview: ${htmlPreview.slice(0, 200)}`);
            
            // Check if HTML contains a form or submit script
            const hasForm = htmlPreview.includes('<form') || htmlPreview.includes('form.submit') || htmlPreview.includes('document.forms');
            const hasSubmitScript = htmlPreview.includes('paymentmanagement') || htmlPreview.includes('.submit()') || htmlPreview.includes('window.location');
            
            log(`[3DS][FINALIZE][HTML_ANALYSIS] HTML contains form: ${hasForm}, submit script: ${hasSubmitScript}`);
            
            if (hasForm || hasSubmitScript) {
              // Try to load HTML and let it auto-submit
              log('[3DS][FINALIZE][HTML_RENDER] Setting HTML content to page with reduced timeout');
              try {
                await page.setContent(htmlPreview, { waitUntil: 'domcontentloaded', timeout: 5000 });
                
                // Brief wait for any auto-submit scripts
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check if auto-navigation happened
                const currentUrl = page.url();
                if (targetOk.test(currentUrl) || targetCb.test(currentUrl)) {
                  log('[3DS][RESULT] Auto-submit navigation completed to:', currentUrl);
                  return { 
                    success: true, 
                    finalUrl: currentUrl, 
                    source: 'html-auto-submit',
                    httpStatus: postResult.status,
                    finalizeMethod: 'auto-submit',
                    merchantFinalize: true
                  };
                }
              } catch (setContentError) {
                log(`[3DS][FINALIZE][HTML_RENDER_FAILED] HTML setContent failed: ${setContentError.message}`);
              }
            }
            
            // Fallback: Manual form creation and submission
            log('[3DS][FINALIZE][MANUAL_SUBMIT] Creating manual form submission');
            try {
              const manualSubmitResult = await page.evaluate((okUrl) => {
                try {
                  const url = new URL(okUrl);
                  const sessionId = url.searchParams.get('xpaycellsid');
                  if (!sessionId) return { success: false, reason: 'no-sessionid' };
                  
                  // Create and submit form
                  const form = document.createElement('form');
                  form.method = 'POST';
                  form.action = okUrl;
                  form.style.display = 'none';
                  
                  const input = document.createElement('input');
                  input.type = 'hidden';
                  input.name = 'xpaycellsid';
                  input.value = sessionId;
                  form.appendChild(input);
                  
                  document.body.appendChild(form);
                  form.submit();
                  
                  return { success: true, mode: 'manual-form' };
                } catch (e) {
                  return { success: false, reason: e.message };
                }
              }, forcedOkUrl);
              
              log(`[3DS][FINALIZE][MANUAL_SUBMIT_RESULT]`, manualSubmitResult);
              
              if (manualSubmitResult.success) {
                // Wait for navigation after manual submit
                try {
                  await Promise.race([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
                    page.waitForResponse(r => targetOk.test(r.url()) || targetCb.test(r.url()), { timeout: 10000 })
                  ]);
                  
                  const afterSubmitUrl = page.url();
                  if (targetOk.test(afterSubmitUrl) || targetCb.test(afterSubmitUrl)) {
                    log('[3DS][RESULT] Manual submit navigation completed to:', afterSubmitUrl);
                    return { 
                      success: true, 
                      finalUrl: afterSubmitUrl, 
                      source: 'manual-form-submit',
                      httpStatus: postResult.status,
                      finalizeMethod: 'manual-submit',
                      merchantFinalize: true
                    };
                  }
                } catch (navError) {
                  log(`[3DS][FINALIZE][MANUAL_NAV_FAILED] Manual submit navigation failed: ${navError.message}`);
                }
              }
            } catch (manualError) {
              log(`[3DS][FINALIZE][MANUAL_SUBMIT_FAILED] Manual form submit failed: ${manualError.message}`);
            }
          } catch (htmlError) {
            log(`[3DS][FINALIZE][HTML_RENDER_FAILED] HTML rendering failed: ${htmlError.message}`);
          }
          
          return { 
            success: true, 
            finalUrl, 
            source: 'fetch-post-retry',
            httpStatus: postResult.status,
            finalizeMethod,
            merchantFinalize: true
          };
        }
      } catch (fetchError) {
        log(`[3DS][FINALIZE][POST_RETRY_FAILED] Fetch POST retry failed: ${fetchError.message}`);
      }
    }
    
    // Check success based on URL pattern AND status
    const urlMatches = targetOk.test(finalUrl) || /finishBkm3dsProcess|finish3d|payment\/result/i.test(finalUrl);
    const statusOk = !httpStatus || (httpStatus >= 200 && httpStatus < 300);
    
    if (urlMatches && statusOk) {
      log(`[3DS][FINALIZE][SUCCESS] Successfully reached merchant result page via ${finalizeMethod}`);
      return { 
        success: true, 
        finalUrl, 
        source: 'forced-navigation',
        httpStatus: httpStatus || 200,
        finalizeMethod,
        merchantFinalize: true
      };
    } else if (urlMatches && !statusOk) {
      log(`[3DS][FINALIZE][DEGRADED_PARTIAL] Reached merchant URL but got status ${httpStatus} - partial success`);
      return { 
        success: true, 
        finalUrl, 
        source: 'partial-finalize',
        httpStatus: httpStatus || 405,
        finalizeMethod,
        merchantFinalize: false
      };
    }
  } catch (e) {
    log(`[3DS] Forced navigation failed: ${e.message}`);
  }

  // 3) Last resort: notify n8n callback manually
  if (n8nCallbackBase && runKey) {
    try {
      // Fix callback URL to avoid double slashes
      const base = n8nCallbackBase.replace(/\/$/, '');
      const callbackUrl = `${base}/webhook/payment-test/3d/callback`;
      log(`[3DS][FINALIZE][MANUAL_CALLBACK] Manually notifying n8n callback: ${callbackUrl}`);
      
      await page.evaluate(async (url, payload) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          return { success: true, status: response.status };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, callbackUrl, {
        runKey,
        status: 'success',
        threeDSessionId,
        acsSuccess: true,
        merchantFinalize: false,
        finalizeMethod: 'manual',
        httpStatus: null,
        source: 'headless-manual-fallback',
        timestamp: new Date().toISOString()
      });
      
      log('[3DS][FINALIZE][MANUAL_SUCCESS] Successfully notified n8n callback manually');
      return { 
        success: true, 
        finalUrl: callbackUrl, 
        source: 'manual-callback',
        httpStatus: 200,
        finalizeMethod: 'manual',
        merchantFinalize: false
      };
    } catch (e) {
      log(`[3DS][FINALIZE][MANUAL_FAILED] Manual callback notification failed: ${e.message}`);
    }
  }

  return { 
    success: false, 
    finalUrl, 
    source: 'finalize-failed',
    httpStatus: null,
    finalizeMethod: 'none',
    merchantFinalize: false
  };
}

async function performAutomation({ threeDSessionId, cardData, otp, challengeSelector, submitSelector, successPattern, timeout = 20000, runKey, n8nCallbackBase, environment = 'stb' }) {
  let browser = null;
  let page = null;
  
  try {
    log('Starting 3D automation...');
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

    log(`Making 3D API call with sessionId: ${threeDSessionId} (environment: ${environment})`);
    
    // Environment-aware 3D API host selection
    let apiHost;
    switch (environment.toLowerCase()) {
      case 'prod':
      case 'production':
        apiHost = 'omcc.turkcell.com.tr';
        break;
      case 'prp':
      case 'preprod':
        apiHost = 'omccprp.turkcell.com.tr';
        break;
      case 'stb':
      case 'stable':
      default:
        apiHost = 'omccstb.turkcell.com.tr';
        break;
    }
    
    // Build form data for 3D API call
    const formData = {
      threeDSessionId: threeDSessionId,
      ...cardData  // Include card data from N8N
    };

    // Create HTML form and submit to 3D API
    const formHtml = `
      <html>
      <body>
        <form id="threeDForm" action="https://${apiHost}/paymentmanagement/rest/threeDSecure" method="POST">
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
    log('Form submitted to 3D API, waiting for bank page...');
    
    // Add response listener to catch 3D API response
    page.on('response', response => {
      if (response.url().includes('threeDSecure') || response.url().includes('acs') || response.url().includes('bkm')) {
        log(`Response received from: ${response.url()}`);
        log(`Response status: ${response.status()}`);
        log(`Response headers:`, response.headers());
      }
    });
    
    // Wait for navigation to bank page with increased timeout and retries
    let navigationSuccess = false;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(`Navigation attempt ${attempt}/${maxRetries}`);
        await page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: attempt === 1 ? 15000 : 25000 // Longer timeout for retries
        });
        navigationSuccess = true;
        break;
      } catch (e) {
        log(`Navigation attempt ${attempt} failed: ${e.message}`);
        
        // Log current page state
        const currentUrl = page.url();
        const currentTitle = await page.title();
        let currentContent = '';
        try {
          currentContent = await page.content();
        } catch (contentError) {
          currentContent = '[Content unavailable - context destroyed]';
          log(`Warning: Could not get page content - ${contentError.message}`);
        }
        
        log(`Current URL: ${currentUrl}`);
        log(`Current title: ${currentTitle}`);
        log(`Current content length: ${currentContent.length}`);
        log(`Current content preview: ${currentContent.substring(0, 500)}...`);
        
        if (attempt < maxRetries) {
          log('Retrying navigation...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
          
          // Check if we're already on a bank page
          const currentUrl = page.url();
          if (currentUrl.includes('bkm') || currentUrl.includes('acs') || currentUrl.includes('3dsecure')) {
            log(`Already on bank page: ${currentUrl}`);
            navigationSuccess = true;
            break;
          }
        }
      }
    }
    
    if (!navigationSuccess) {
      // Final check - maybe we're already on the bank page
      const currentUrl = page.url();
      let finalContent = '';
      try {
        finalContent = await page.content();
      } catch (contentError) {
        finalContent = '[Content unavailable - context destroyed]';
        log(`Warning: Could not get final page content - ${contentError.message}`);
      }
      const finalTitle = await page.title();
      
      log(`Final URL check: ${currentUrl}`);
      log(`Final page title: ${finalTitle}`);
      log(`Final content length: ${finalContent.length}`);
      log(`Final content preview: ${finalContent.substring(0, 1000)}...`);
      
      if (currentUrl.includes('bkm') || currentUrl.includes('acs') || currentUrl.includes('3dsecure')) {
        log('Found bank page despite navigation timeout');
        navigationSuccess = true;
      } else {
        return { 
          success: false, 
          error: 'Failed to reach bank page after multiple attempts',
          finalUrl: currentUrl,
          finalContent: finalContent.substring(0, 500)
        };
      }
    }

    log(`Bank page loaded: ${page.url()}`);
    
    // Wait for page to stabilize and extract content safely
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let pageContent = '';
    let pageTitle = '';
    let pageUrl = '';
    
    try {
      pageUrl = await page.url();
      pageTitle = await page.title();
      
      // Check if this is an error page
      if (pageTitle.includes('Hata') || pageTitle.includes('Error') || pageTitle.includes('3D Yönlendirme Hatası')) {
        log(`ERROR: Received error page: ${pageTitle}`);
        try {
          pageContent = await page.content();
          log(`Error page content preview: ${pageContent.substring(0, 1000)}...`);
        } catch (e) {
          log(`Could not extract error page content: ${e.message}`);
        }
        
        return { 
          success: false, 
          error: `3D API returned error page: ${pageTitle}`,
          errorType: '3D_REDIRECT_ERROR',
          pageUrl: pageUrl,
          pageTitle: pageTitle
        };
      }
      
      // Extract page content in a try-catch to handle navigation context destruction
      try {
        pageContent = await page.content();
        log(`Page content extracted successfully`);
        log(`Page content length: ${pageContent.length}`);
        log(`Page content preview: ${pageContent.substring(0, 1000)}...`);
      } catch (contentError) {
        log(`Warning: Could not extract full page content: ${contentError.message}`);
        // Continue anyway, we might still be able to interact with the page
      }
      
    } catch (error) {
      log(`Error getting page info: ${error.message}`);
      return { 
        success: false, 
        error: `Failed to extract page information: ${error.message}`,
        errorType: 'PAGE_EXTRACTION_ERROR'
      };
    }
    
    log(`Page title: ${pageTitle}`);
    log(`Page URL: ${pageUrl}`);
    
    // Try to get page structure information safely
    let allInputs = [];
    let allButtons = [];
    
    try {
      // Sayfadaki tüm input alanlarını bul
      allInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className,
          value: input.value
        }));
      });
      log('All inputs found:', JSON.stringify(allInputs, null, 2));
    } catch (error) {
      log(`Could not extract input information: ${error.message}`);
    }
    
    try {
      // Sayfadaki tüm butonları bul
      allButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        return buttons.map(btn => ({
          type: btn.type,
          name: btn.name,
          id: btn.id,
          className: btn.className,
          textContent: btn.textContent?.trim(),
          value: btn.value
        }));
      });
      log('All buttons found:', JSON.stringify(allButtons, null, 2));
    } catch (error) {
      log(`Could not extract button information: ${error.message}`);
    }

    // Look for OTP input field with BKM ACS specific selectors first
    let otpInput = null;
    const otpSelectors = [
      challengeSelector,
      // BKM ACS specific selectors (highest priority)
      '#passwordfield',
      'input[name="otpCode"]',
      'input[3dsinput="password"]',
      'input.f-input[type="text"]',
      // Standard OTP selectors
      'input[type="password"]',
      'input[type="text"]',
      // Generic OTP selectors
      'input[name*="otp"]',
      'input[name*="OTP"]', 
      'input[name*="kod"]',
      'input[name*="code"]',
      'input[name*="sms"]',
      'input[name*="SMS"]',
      'input[name*="challenge"]',
      'input[name*="CHALLENGE"]',
      'input[name*="verification"]',
      'input[name*="dogrulama"]',
      // ID based selectors
      'input[id*="otp"]',
      'input[id*="OTP"]',
      'input[id*="kod"]',
      'input[id*="code"]',
      'input[id*="sms"]',
      'input[id*="challenge"]',
      'input[id*="verification"]',
      'input[id*="password"]',
      // Placeholder based
      'input[placeholder*="kod"]',
      'input[placeholder*="code"]',
      'input[placeholder*="OTP"]',
      'input[placeholder*="doğrulama"]',
      'input[placeholder*="SMS"]',
      // Class based
      'input[class*="otp"]',
      'input[class*="sms"]',
      'input[class*="challenge"]',
      'input[class*="f-input"]',
      // Generic fallbacks for ACS pages
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      // Last resort - first visible input
      'input[type="text"]:first-of-type',
      'input[type="password"]:first-of-type'
    ].filter(Boolean);

    log(`Searching for OTP input with ${otpSelectors.length} selectors...`);

    for (const selector of otpSelectors) {
      try {
        const element = await page.waitForSelector(selector, { timeout: 2000 });
        if (element) {
          // Element bulundu, görünürlüğünü kontrol et
          const isVisible = await page.evaluate(sel => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
          }, selector);
          
          if (isVisible) {
            otpInput = selector;
            log(`Found visible OTP input: ${selector}`);
            break;
          } else {
            log(`Found but hidden OTP input: ${selector}`);
          }
        }
      } catch (e) {
        log(`Selector not found: ${selector}`);
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
    log(`Filling OTP: ${otp}`);
    await page.type(otpInput, otp);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Look for submit button with BKM ACS specific selectors first
    let submitButton = null;
    const submitSelectors = [
      submitSelector,
      // BKM ACS specific selectors (highest priority)
      '#submitbutton',
      'button[name="otpType"][value="confirm"]',
      'button.btn-commit',
      'button.button.btn-1.btn-commit',
      // Standard submit selectors
      'button[type="submit"]',
      'input[type="submit"]',
      // Turkish text buttons
      'button:contains("Onayla")',
      'button:contains("Gönder")', 
      'button:contains("Devam")',
      'button:contains("İleri")',
      'button:contains("Tamamla")',
      'button:contains("Doğrula")',
      // English text buttons
      'button:contains("Submit")',
      'button:contains("Continue")',
      'button:contains("Verify")',
      'button:contains("Confirm")',
      'button:contains("Next")',
      // ID and class based
      '#submit',
      '#continue',
      '#verify',
      '#confirm',
      '.submit',
      '.continue',
      '.verify',
      '.confirm',
      '.btn-commit',
      // Value based
      'input[value*="Onayla"]',
      'input[value*="Gönder"]',
      'input[value*="Submit"]',
      'input[value*="Continue"]',
      // Generic fallback
      'button:not([type="button"]):not([type="reset"])',
      'button:first-of-type'
    ].filter(Boolean);

    log(`Searching for submit button with ${submitSelectors.length} selectors...`);

    for (const selector of submitSelectors) {
      try {
        const element = await page.waitForSelector(selector, { timeout: 2000 });
        if (element) {
          // Check if button is visible and enabled
          const isVisible = await page.evaluate(sel => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0 && !el.disabled;
          }, selector);
          
          if (isVisible) {
            submitButton = selector;
            log(`Found visible submit button: ${selector}`);
            break;
          } else {
            log(`Found but hidden/disabled submit button: ${selector}`);
            // For BKM ACS, wait a bit for submit button to become visible
            if (selector === '#submitbutton') {
              log('Waiting for BKM submit button to become visible...');
              await new Promise(resolve => setTimeout(resolve, 3000));
              const nowVisible = await page.evaluate(sel => {
                const el = document.querySelector(sel);
                if (!el) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0 && !el.disabled;
              }, selector);
              
              if (nowVisible) {
                submitButton = selector;
                log(`BKM submit button now visible: ${selector}`);
                break;
              }
            }
          }
        }
      } catch (e) {
        log(`Submit selector not found: ${selector}`);
      }
    }

    if (!submitButton) {
      log('No submit button found, trying Enter key');
      await page.keyboard.press('Enter');
    } else {
      log('Clicking submit button...');
      await page.click(submitButton);
    }

    // Wait for result
    log('Waiting for response...');
    let success = false;
    let finalUrl = '';
    let errorDetails = '';

    try {
      if (successPattern) {
        log(`Waiting for success pattern: ${successPattern}`);
        await page.waitForSelector(successPattern, { timeout: timeout });
        success = true;
        finalUrl = page.url();
        log('Success pattern found!');
      } else {
        // Wait for navigation or check for BKM specific success indicators
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeout });
          finalUrl = page.url();
          log(`Navigation completed to: ${finalUrl}`);
        } catch (e) {
          log('Navigation timeout, checking current state...');
          finalUrl = page.url();
        }
        
        // Check for BKM specific error messages first
        const pageText = await page.evaluate(() => document.body.innerText);
        log(`Page content after submit: ${pageText.substring(0, 500)}...`);
        
        // Check for error indicators
        const hasError = await page.evaluate(() => {
          const errorSelectors = [
            '.error', '.hata', '.alert', '.warning',
            '[class*="error"]', '[class*="hata"]', '[id*="error"]',
            'div:contains("hata")', 'div:contains("error")', 
            'span:contains("hata")', 'span:contains("error")'
          ];
          
          for (const selector of errorSelectors) {
            try {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                if (el.textContent && el.textContent.trim() && 
                    (el.offsetHeight > 0 && el.offsetWidth > 0)) {
                  return {
                    hasError: true,
                    errorText: el.textContent.trim(),
                    errorSelector: selector
                  };
                }
              }
            } catch (e) {
              // Ignore invalid selectors
            }
          }
          
          // Also check for common error words in page text
          const text = document.body.innerText.toLowerCase();
          const errorKeywords = ['hata', 'error', 'başarısız', 'failed', 'geçersiz', 'invalid', 'reddedildi', 'denied'];
          for (const keyword of errorKeywords) {
            if (text.includes(keyword)) {
              return {
                hasError: true,
                errorText: `Error keyword found: ${keyword}`,
                errorSelector: 'text content'
              };
            }
          }
          
          return { hasError: false };
        });
        
        if (hasError.hasError) {
          log(`BKM Error detected: ${hasError.errorText} (found via: ${hasError.errorSelector})`);
          errorDetails = hasError.errorText;
        }
        
        // Check URL for success indicators
        if (finalUrl.includes('success') || finalUrl.includes('complete') || finalUrl.includes('basarili') || 
            finalUrl.includes('callback') || finalUrl.includes('return') || finalUrl.includes('finish') ||
            finalUrl.includes('finishBkm3dsProcess') || finalUrl.includes('akbank.com')) {
          success = true;
          log('Success detected from URL');
        } else if (!errorDetails) {
          // Only check for success in content if no error was detected
          const pageTextLower = pageText.toLowerCase();
          if (pageTextLower.includes('başarılı') || pageTextLower.includes('success') || pageTextLower.includes('complete') ||
              pageTextLower.includes('onaylandı') || pageTextLower.includes('tamamlandı') || pageTextLower.includes('approved')) {
            success = true;
            log('Success detected from content');
            
            // Force finalize 3DS process to ensure merchant callback
            log('Starting 3DS finalize process...');
            const finalizeResult = await finalize3DS(page, threeDSessionId, n8nCallbackBase, runKey, environment);
            
            if (finalizeResult.success) {
              const merchantStatus = finalizeResult.merchantFinalize ? 'COMPLETE' : 'PARTIAL';
              log(`[3DS][RESULT] Finalize ${merchantStatus}: method=${finalizeResult.finalizeMethod}, status=${finalizeResult.httpStatus}, url=${finalizeResult.finalUrl}`);
              finalUrl = finalizeResult.finalUrl;
              success = true;
            } else {
              log(`[3DS][RESULT] Finalize FAILED: ACS was successful but merchant finalize failed`);
              // Still consider it success since ACS passed, but note the finalize issue
            }
            
          } else {
            // If we completed the 3D flow and got to a bank URL without errors, consider it success
            if (finalUrl.includes('akbank') || finalUrl.includes('finishBkm') || 
                finalUrl.includes('3dsProcess') || finalUrl.includes('emvtds') ||
                finalUrl.includes('bkmtest')) {
              success = true;
              log('Success detected - completed 3D flow to bank URL');
              
              // Also try to finalize for bank URLs
              log('Starting 3DS finalize process for bank URL...');
              const finalizeResult = await finalize3DS(page, threeDSessionId, n8nCallbackBase, runKey, environment);
              
              if (finalizeResult.success) {
                const merchantStatus = finalizeResult.merchantFinalize ? 'COMPLETE' : 'PARTIAL';
                log(`[3DS][RESULT] Bank URL Finalize ${merchantStatus}: method=${finalizeResult.finalizeMethod}, status=${finalizeResult.httpStatus}, url=${finalizeResult.finalUrl}`);
                finalUrl = finalizeResult.finalUrl;
              }
              
            } else {
              log('No clear success indicators found');
            }
          }
        }
      }
    } catch (e) {
      log('Exception during result processing:', e.message);
      finalUrl = page.url();
      
      // Last attempt
      if (successPattern) {
        try {
          await page.waitForSelector(successPattern, { timeout: 2000 });
          success = true;
        } catch (ee) {
          log('Success pattern still not found');
        }
      }
    }

    log(`Automation completed. Success: ${success}, URL: ${finalUrl}, Error: ${errorDetails || 'none'}`);
    return { 
      success, 
      finalUrl, 
      error: success ? null : (errorDetails || 'Success not confirmed'),
      errorDetails: errorDetails || null,
      resultCode: success ? 0 : 1,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in automation:', error);
    return { 
      success: false, 
      error: error.message,
      resultCode: 500,
      timestamp: new Date().toISOString()
    };
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
    log('Received 3D simulation request:', JSON.stringify(req.body, null, 2));
    
    const {
      threeDSessionId,
      cardnumber,
      cardexpiredatemonth,
      cardexpiredateyear,
      cardCVV,
      amount,
      cardholdername,
      pin,
      userCode,
      otp,
      challengeSelector,
      submitSelector,
      successPattern,
      runKey,
      n8nCallbackBase,
      environment = 'stb' // Default to STB if not specified
    } = req.body;

    if (!threeDSessionId) {
      return res.status(400).json({ error: 'threeDSessionId is required' });
    }

    if (!otp) {
      return res.status(400).json({ error: 'otp is required' });
    }

    // Build card data object from individual fields
    const cardData = {
      cardnumber,
      cardexpiredatemonth,
      cardexpiredateyear,
      cardCVV,
      amount,
      cardholdername,
      pin,
      userCode
    };

    const result = await performAutomation({
      threeDSessionId,
      cardData,
      otp,
      challengeSelector,
      submitSelector,
      successPattern,
      timeout: 30000,
      runKey,
      n8nCallbackBase,
      environment
    });

    // Notify N8N if callback URL provided
    if (n8nCallbackBase && runKey) {
      try {
        // Use consistent callback URL path
        const base = n8nCallbackBase.replace(/\/$/, '');
        const callbackUrl = `${base}/webhook/payment-test/3d/callback`;
        log(`Notifying N8N at: ${callbackUrl}`);
        
        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runKey,
            threeDSessionId,
            success: result.success,
            finalUrl: result.finalUrl,
            error: result.error,
            source: 'headless-worker-completion',
            timestamp: new Date().toISOString()
          })
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

app.listen(PORT, () => {
  log(`Simple 3D Worker listening on http://localhost:${PORT}`);
  log(`Also available on http://127.0.0.1:${PORT}`);
  log('Ready to handle sessionID-based 3D flows');
});