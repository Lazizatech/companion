/**
 * Real-World Handoff Test
 * Tests actual websites and scenarios where CAPTCHAs might appear
 */

const { chromium } = require('playwright');

async function testRealWorldScenarios() {
  console.log('🌍 REAL-WORLD HANDOFF TESTING\n');
  console.log('=' .repeat(60));
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  const page = await context.newPage();
  
  const scenarios = [
    {
      name: 'GitHub Login (might trigger verification)',
      url: 'https://github.com/login',
      actions: async () => {
        // Try to login with fake credentials
        await page.fill('#login_field', 'testuser' + Math.random());
        await page.fill('#password', 'wrongpassword');
        await page.click('[type="submit"]');
        await page.waitForTimeout(2000);
      }
    },
    {
      name: 'Google Search (usually no CAPTCHA)',
      url: 'https://www.google.com',
      actions: async () => {
        await page.fill('[name="q"]', 'test search query');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }
    },
    {
      name: 'OpenAI Signup (might have CAPTCHA)',
      url: 'https://platform.openai.com/signup',
      actions: async () => {
        await page.waitForTimeout(3000);
      }
    },
    {
      name: 'Discord Login Page',
      url: 'https://discord.com/login',
      actions: async () => {
        await page.waitForTimeout(3000);
      }
    },
    {
      name: 'LinkedIn (rate limiting detection)',
      url: 'https://www.linkedin.com',
      actions: async () => {
        await page.waitForTimeout(2000);
      }
    }
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n📍 Testing: ${scenario.name}`);
    console.log(`   URL: ${scenario.url}`);
    
    try {
      await page.goto(scenario.url, { waitUntil: 'networkidle' });
      
      // Perform scenario actions
      if (scenario.actions) {
        await scenario.actions();
      }
      
      // Check for various handoff triggers
      const handoffNeeded = await page.evaluate(() => {
        const body = document.body?.innerHTML?.toLowerCase() || '';
        const triggers = {
          captcha: false,
          twoFactor: false,
          rateLimit: false,
          loginError: false,
          verification: false,
          blocked: false
        };
        
        // CAPTCHA detection
        if (body.includes('captcha') || 
            body.includes('recaptcha') ||
            body.includes('hcaptcha') ||
            body.includes('funcaptcha') ||
            body.includes('verify you are human') ||
            body.includes("i'm not a robot") ||
            document.querySelector('[class*="captcha"]') ||
            document.querySelector('[id*="captcha"]') ||
            document.querySelector('.g-recaptcha') ||
            document.querySelector('[data-hcaptcha-widget]') ||
            window.grecaptcha || 
            window.hcaptcha) {
          triggers.captcha = true;
        }
        
        // 2FA detection
        if (body.includes('two-factor') ||
            body.includes('2fa') ||
            body.includes('verification code') ||
            body.includes('authenticator app') ||
            body.includes('enter the code')) {
          triggers.twoFactor = true;
        }
        
        // Rate limiting
        if (body.includes('rate limit') ||
            body.includes('too many requests') ||
            body.includes('try again later') ||
            body.includes('suspicious activity')) {
          triggers.rateLimit = true;
        }
        
        // Login errors
        if (body.includes('incorrect password') ||
            body.includes('invalid credentials') ||
            body.includes('login failed')) {
          triggers.loginError = true;
        }
        
        // Verification required
        if (body.includes('verify your identity') ||
            body.includes('confirm your account') ||
            body.includes('verification required')) {
          triggers.verification = true;
        }
        
        // Blocked/banned
        if (body.includes('access denied') ||
            body.includes('blocked') ||
            body.includes('forbidden')) {
          triggers.blocked = true;
        }
        
        return triggers;
      });
      
      // Check current URL for changes (redirects to CAPTCHA pages)
      const currentUrl = page.url();
      const wasRedirected = !currentUrl.includes(new URL(scenario.url).hostname);
      
      // Analyze results
      const needsHandoff = Object.values(handoffNeeded).some(v => v);
      
      results.push({
        scenario: scenario.name,
        url: scenario.url,
        finalUrl: currentUrl,
        redirected: wasRedirected,
        triggers: handoffNeeded,
        handoffNeeded: needsHandoff
      });
      
      // Report findings
      if (needsHandoff) {
        console.log('   🚨 HANDOFF TRIGGERS DETECTED:');
        for (const [trigger, detected] of Object.entries(handoffNeeded)) {
          if (detected) {
            console.log(`      • ${trigger.toUpperCase()}`);
          }
        }
      } else {
        console.log('   ✅ No handoff needed - automation can continue');
      }
      
      if (wasRedirected) {
        console.log(`   🔄 Redirected to: ${currentUrl}`);
      }
      
      // Take screenshot for evidence
      const screenshotName = `screenshot-${scenario.name.replace(/[^a-z0-9]/gi, '-')}.png`;
      await page.screenshot({ path: screenshotName });
      console.log(`   📸 Screenshot saved: ${screenshotName}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        scenario: scenario.name,
        error: error.message,
        handoffNeeded: false
      });
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY\n');
  
  const handoffScenarios = results.filter(r => r.handoffNeeded);
  console.log(`Total scenarios tested: ${results.length}`);
  console.log(`Scenarios needing handoff: ${handoffScenarios.length}`);
  
  if (handoffScenarios.length > 0) {
    console.log('\nScenarios that would trigger handoff:');
    for (const scenario of handoffScenarios) {
      console.log(`  • ${scenario.scenario}`);
      if (scenario.triggers) {
        const triggers = Object.entries(scenario.triggers)
          .filter(([k, v]) => v)
          .map(([k]) => k);
        console.log(`    Triggers: ${triggers.join(', ')}`);
      }
    }
  }
  
  console.log('\n💡 INSIGHTS:');
  console.log('- Most sites don\'t show CAPTCHAs on first visit');
  console.log('- CAPTCHAs appear after suspicious behavior:');
  console.log('  • Multiple failed login attempts');
  console.log('  • Rapid navigation/clicking');
  console.log('  • Known bot user agents');
  console.log('  • VPN/proxy IP addresses');
  console.log('  • Missing browser fingerprints');
  
  console.log('\n🎯 Your handoff system would activate when:');
  console.log('  1. CAPTCHA actually appears (not just demo pages)');
  console.log('  2. 2FA code is needed');
  console.log('  3. Rate limiting kicks in');
  console.log('  4. Account verification required');
  
  await browser.close();
}

// Run the test
testRealWorldScenarios().catch(console.error);