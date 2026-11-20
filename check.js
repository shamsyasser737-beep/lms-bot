require('dotenv').config();
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const fs = require('fs');

const EMAIL = process.env.LMS_EMAIL;
const PASS = process.env.LMS_PASS;
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(msg) {
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg })
  });
}

async function checkOnce() {
  console.log('بشيك دلوقتي...', new Date().toLocaleTimeString('ar-EG'));
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://lmscis.com/login/index.php', { waitUntil: 'networkidle2' });
    await page.evaluate((e, p) => {
      document.querySelector('#username').value = e;
      document.querySelector('#password').value = p;
    }, EMAIL, PASS);
    await page.click('#loginbtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => document.body.innerText);
    
    let last = '';
    if (fs.existsSync('last.txt')) last = fs.readFileSync('last.txt', 'utf8');

    if (data !== last) {
      console.log('في حاجة جديدة! ببعت تليجرام...');
      fs.writeFileSync('last.txt', data);
      await sendTelegram('🔔 في تحديث جديد في الـ LMS!\n\n' + data.slice(0, 1000));
    } else {
      console.log('مفيش جديد، هكمل للساعة الجاية...');
    }
  } catch (e) {
    console.log('حصل مشكلة:', e.message);
  }
  await browser.close();
}

// شغل مرة اول ما تفتحه
checkOnce();

// وبعدين كل ساعة بالظبط
cron.schedule('0 * * * *', () => {
  checkOnce();
});

console.log('البوت شغال... هيشيك كل ساعة لوحده ✅');