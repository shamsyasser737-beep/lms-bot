require('dotenv').config();
const puppeteer = require('puppeteer');
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
async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
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
    fs.writeFileSync('last.txt', data);
    await sendTelegram('🔔 في تحديث جديد في الـ LMS!\n\n' + data.slice(0, 1000));
  }
  await browser.close();
}
run();
