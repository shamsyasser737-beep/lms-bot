require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LMS_URL = process.env.LMS_URL;
const LMS_EMAIL = process.env.LMS_EMAIL;
const LMS_PASSWORD = process.env.LMS_PASSWORD;

async function sendTelegram(msg) {
  console.log('Sending to Telegram...');
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
  });
  const data = await res.json();
  console.log('Telegram result:', data);
  if (!data.ok) console.log('Telegram FAILED:', data);
}

async function run() {
  console.log('Starting bot...');
  console.log('LMS_URL exists?', !!LMS_URL);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  // خلي البوت يستنى 90 ثانية بدل 30
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);

  try {
    console.log('Opening LMS...');
    // domcontentloaded اسرع بكتير من networkidle2 ومش بيستنى الموقع يحمل كله
    await page.goto(LMS_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('Page opened, title:', await page.title());

    // استنى شوية لو الموقع تقيل
    await new Promise(r => setTimeout(r, 5000));

    // حاول تدخل الايميل والباسورد - لو شكل صفحة الدخول مختلف عندك قولي
    // بنجرب كذا شكل للخانات
    const emailSelector = 'input[type="email"], input[name="email"], input[name="username"], #username, #email';
    const passSelector = 'input[type="password"], input[name="password"], #password';

    const emailInput = await page.$(emailSelector);
    if (emailInput) {
      console.log('Found login form, logging in...');
      await page.type(emailSelector, LMS_EMAIL, { delay: 50 });
      await page.type(passSelector, LMS_PASSWORD, { delay: 50 });
      await Promise.all([
        page.click('button[type="submit"], input[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => console.log('No navigation after login, continuing...'))
      ]);
      await new Promise(r => setTimeout(r, 5000));
      console.log('Logged in, current URL:', page.url());
    } else {
      console.log('No login form found, maybe already logged in or different page');
    }

    // هات نص الصفحة كله عشان ندور على الواجبات
    const text = await page.evaluate(() => document.body.innerText);
    console.log('Page text length:', text.length);
    console.log(text.slice(0, 1000));

    // احفظ النص في ملف عشان نقارن
    let lastText = '';
    if (fs.existsSync('last.txt')) {
      lastText = fs.readFileSync('last.txt', 'utf8');
    }

    // اول مرة: احفظ بس وابعت رسالة تأكيد ان البوت اشتغل
    if (!lastText) {
      fs.writeFileSync('last.txt', text);
      console.log('First run - saved baseline');
      await sendTelegram('✅ البوت اشتغل بنجاح! أول تشغيل تم، ومن دلوقتي هبعتلك أي واجب جديد.');
      return;
    }

    if (text !== lastText) {
      fs.writeFileSync('last.txt', text);
      console.log('Change detected!');
      await sendTelegram('📚 في حاجة جديدة على LMS! ادخل شوفها بسرعة: ' + LMS_URL);
    } else {
      console.log('No changes');
    }

  } catch (e) {
    console.log('ERROR:', e.message);
    // لو الموقع وقع خالص، ابعتلك ان في مشكلة عشان تعرف
    await sendTelegram('⚠️ البوت حاول يفتح LMS بس الموقع مردش / تقيل. هحاول تاني كمان شوية.');
    throw e;
  } finally {
    await browser.close();
  }
}

run();
