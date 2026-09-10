// Memory Hub 全量巡检 v4：崩溃自愈 + 断点续跑
const { chromium } = require('playwright-core');
const EXE = '/home/malizhi/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://127.0.0.1:5174/';
const SHOT = '/tmp/bt/shots'; const fs = require('fs'); fs.mkdirSync(SHOT, { recursive: true });
const RPT = '/tmp/bt/crawl4-report.txt';
const log = s => { fs.appendFileSync(RPT, s + '\n'); console.log(s); };
const ROUTES = [
  ['任务看板','/'],['项目协作','/projects'],['项目详情','/projects/prj-12d0ha4gk9'],
  ['组织','/team'],['团队详情','/team/team-6lgd8so6cn'],['成员管理','/team/members'],
  ['Agent列表','/team/agents'],['Agent详情','/team/agents/agt-6lgdknfhyc'],['API密钥','/team/api-keys'],
  ['记忆空间','/memory-spaces'],['记忆空间详情','/memory-spaces/team-6lgd8so6cn'],
  ['Wiki','/wiki'],['Code_Graph','/code'],['代码分析','/analysis'],['Skill','/skills'],
  ['Chat_Memory','/memory'],['用户管理','/admin/users'],['模型配置','/admin/model-config'],
  ['权限管理','/admin/permissions'],['审计日志','/admin/audit-log'],['使用指南','/guide'],
];
const SKIP = /删除|移除|退出|注销|停用|禁用|重置|清空|卸载|销毁|danger/i;
let b = null, p = null; const errLog = [];

async function boot() {
  if (b) { await b.close().catch(()=>{}); }
  b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox','--disable-dev-shm-usage','--memory-pressure-off'] });
  p = await b.newPage({ viewport: { width: 1440, height: 810 } });
  p.setDefaultTimeout(2500); p.setDefaultNavigationTimeout(12000);
  p.on('pageerror', e => errLog.push('PAGEERROR: ' + e.message.slice(0,140)));
  p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/')) errLog.push(`HTTP${r.status()}: ${r.url().slice(0,80)}`); });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.locator('input:visible').nth(0).fill('admin');
  await p.locator('input:visible').nth(1).fill('admin123456');
  await p.keyboard.press('Enter');
  await p.waitForSelector('[title]', { timeout: 15000 });
  await p.waitForTimeout(1500);
}
const alive = () => p.evaluate(() => 1).then(()=>true).catch(()=>false);

(async () => {
  fs.writeFileSync(RPT, `巡检v4 ${new Date().toISOString()}\n`);
  await boot(); log('登录完成');
  for (const [name, path] of ROUTES) {
    const errStart = errLog.length; const t0 = Date.now();
    let text = '', btnInfo = '无按钮', dialogs = 0;
    if (!(await alive())) { log(`↻ 浏览器已崩，重启 @「${name}」`); try { await boot(); } catch(e){ log('重启失败 '+e.message); break; } }
    try {
      await p.evaluate(h => { location.hash = h; }, path);
      await p.waitForTimeout(2200);
      if (!(await alive())) throw new Error('浏览器崩溃(导航后)');
      text = await p.evaluate(() => (document.querySelector('main,._memory-page-frame')?.innerText || document.body.innerText).replace(/\s+/g,' ').slice(0,70));
      await p.screenshot({ path: `${SHOT}/pg-${name.replace(/[()\/]/g,'')}.png`, type: 'jpeg', quality: 70 });
      const labels = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('button, [role=button]').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { const t = (el.innerText || '').trim().slice(0, 12); if (t) out.push(t); }
        });
        return [...new Set(out)].slice(0, 10);
      });
      const clicked = [];
      for (const label of labels) {
        if (SKIP.test(label) || clicked.includes(label)) continue;
        clicked.push(label);
        const urlBefore = await p.evaluate(() => location.hash);
        const btn = p.locator('button:visible', { hasText: label }).first();
        await btn.click().catch(()=>{});
        await p.waitForTimeout(600);
        if (!(await alive())) throw new Error('浏览器崩溃(点击'+label+')');
        const urlAfter = await p.evaluate(() => location.hash);
        if (urlAfter !== urlBefore) { await p.evaluate(h => { location.hash = h; }, path); await p.waitForTimeout(800); }
        const hasDlg = await p.evaluate(() => { const d = document.querySelector('.tea-dialog,[role=dialog]'); if (!d) return false; const r = d.getBoundingClientRect(); return r.width > 100; });
        if (hasDlg) {
          dialogs++;
          await p.screenshot({ path: `${SHOT}/dlg-${name}-${label}.png`, type: 'jpeg', quality: 70 });
          await p.evaluate(() => {
            const sels = ['.tea-dialog__close','[class*=modal] .tea-btn--weak','[class*=dialog] .tea-btn--weak'];
            for (const s of sels) { const el = document.querySelector(s); if (el) { el.click(); return; } }
            const btns = [...document.querySelectorAll('.tea-dialog button,[role=dialog] button')];
            const cancel = btns.find(x => /取消|关闭|确 定/i.test(x.innerText)); if (cancel) cancel.click();
          });
          await p.waitForTimeout(500);
        }
      }
      btnInfo = clicked.length ? `试点[${clicked.join('§').slice(0,80)}]` : '无安全按钮';
    } catch (e) { if (!text) text = 'ERR ' + e.message.slice(0, 44); }
    const errs = errLog.slice(errStart, errStart + 2);
    const mark = text && !text.startsWith('ERR') ? (errs.length ? '⚠' : '✓') : '✗';
    log(`${mark} ${name.padEnd(7)}|${String(Date.now()-t0).padStart(5)}ms| ${text.padEnd(38).slice(0,38)}| ${btnInfo}|弹窗${dialogs} ${errs.length ? '| ' + errs.join(';').slice(0,70) : ''}`);
  }
  log('PAGEERROR 总数: ' + errLog.filter(e => e.startsWith('PAGEERROR')).length);
  errLog.filter(e => e.startsWith('PAGEERROR')).slice(0, 8).forEach(e => log(e));
  await b.close().catch(()=>{}); log('巡检完成');
})().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
