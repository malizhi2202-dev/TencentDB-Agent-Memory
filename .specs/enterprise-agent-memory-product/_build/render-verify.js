#!/usr/bin/env node
/**
 * 真实浏览器渲染验证（可选，需要 playwright + chromium）。
 *
 * 用法：
 *   node _build/render-verify.js [文件路径] [截图输出目录]
 *
 * 它验证 check.sh 无法覆盖的三件事：
 *   1. 原型侧栏 20 项在真实布局下是否被裁切（.app 固定高度回归）
 *   2. 点击左侧目录后，目标标题是否被 sticky 顶栏遮挡、目录高亮是否落在目标上
 *   3. 页签作用域、主题切换与 localStorage、打印媒体查询是否真的生效
 *
 * 依赖解析顺序：环境变量 PLAYWRIGHT_PATH → DSH checkout 内的 pnpm store → 裸 require('playwright')
 * 浏览器：环境变量 CHROME_PATH → ~/.cache/ms-playwright 下第一个 chromium 可执行文件
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_PATH) return require(process.env.PLAYWRIGHT_PATH);
  const store = '/home/malizhi/project/deepseek-harness-v0/node_modules/.pnpm';
  try {
    const dir = fs.readdirSync(store).filter(d => /^playwright@/.test(d)).sort().pop();
    if (dir) return require(path.join(store, dir, 'node_modules', 'playwright'));
  } catch (e) { /* fallthrough */ }
  return require('playwright');
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  for (const d of fs.readdirSync(base).filter(x => x.startsWith('chromium-')).sort()) {
    for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(base, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined; // 交给 playwright 自己解析
}

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'PRODUCT-DESIGN.html'));
const SHOT = process.argv[3] ? path.resolve(process.argv[3]) : null;
const { chromium } = loadPlaywright();

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push('console: ' + m.text()); });
  const external = [];
  page.on('request', r => { if (!r.url().startsWith('file:')) external.push(r.url()); });

  await page.goto('file://' + FILE, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  record('无 JS 错误', jsErrors.length === 0, jsErrors.slice(0, 3).join('; ') || '0');
  record('无外部网络请求', external.length === 0, external.slice(0, 3).join('; ') || '0');

  // 1. 原型侧栏不被裁切
  const side = await page.evaluate(() => [...document.querySelectorAll('.app')].map(app => {
    const s = app.querySelector('.app-side');
    if (!s) return null;
    const links = [...s.querySelectorAll('a')];
    const last = links[links.length - 1].getBoundingClientRect();
    const box = s.getBoundingClientRect();
    return {
      items: links.length,
      clipped: s.scrollHeight > s.clientHeight + 1,
      lastVisible: last.bottom <= box.bottom + 1 && last.top >= box.top - 1,
      lastText: links[links.length - 1].textContent.trim(),
    };
  }).filter(Boolean));
  const sideBad = side.filter(s => s.clipped || !s.lastVisible || s.items !== 20);
  record(`原型侧栏 20 项可达（${side.length} 个壳）`, sideBad.length === 0,
    sideBad.length ? JSON.stringify(sideBad[0]) : '全部未裁切，末项为「退出登录」');

  // 2. 目录锚点：不遮挡 + 高亮正确
  const navHrefs = await page.evaluate(() => [...document.querySelectorAll('.doc-nav a')].map(a => a.getAttribute('href')));
  const samples = ['#s0', '#s2-3', '#s5-1', '#s8', '#s9', '#s10', '#p5', '#p12'].filter(h => navHrefs.includes(h));
  const anchorBad = [];
  for (const t of samples) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.click(`.doc-nav a[href="${t}"]`);
    let prev = -1;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(150);
      const y = await page.evaluate(() => Math.round(window.scrollY));
      if (y === prev) break;
      prev = y;
    }
    const r = await page.evaluate(sel => {
      const el = document.querySelector(sel);
      const top = el.getBoundingClientRect().top;
      const tb = document.querySelector('.doc-top').getBoundingClientRect().height;
      const a = document.querySelector('.doc-nav a.active');
      return { hidden: top < tb, active: a ? a.getAttribute('href') : null };
    }, t);
    if (r.hidden || r.active !== t) anchorBad.push(`${t}(hidden=${r.hidden},active=${r.active})`);
  }
  record(`目录跳转不遮挡且高亮正确（${samples.length} 个）`, anchorBad.length === 0,
    anchorBad.join(' ') || '全部 OK');

  // 3. 页签作用域
  const tabs = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('[data-tabs]')];
    return bars.map(b => {
      const ids = [...b.querySelectorAll('button[data-tab]')].map(x => x.dataset.tab);
      const panels = [...b.parentElement.querySelectorAll('[data-panel]')].map(x => x.dataset.panel);
      const barsInParent = [...b.parentElement.querySelectorAll('[data-tabs]')].length;
      const vis = [...b.parentElement.querySelectorAll('[data-panel]')].filter(x => !x.hidden).length;
      return { ok: barsInParent === 1 && ids.join() === panels.join() && vis === 1, n: ids.length };
    });
  });
  record(`页签作用域隔离（${tabs.length} 组）`, tabs.every(t => t.ok), tabs.map(t => `${t.n}${t.ok ? '✓' : '✗'}`).join(' '));

  // 4. 主题切换 + 持久化
  const theme = await page.evaluate(() => {
    const before = document.documentElement.getAttribute('data-theme');
    document.getElementById('theme-toggle').click();
    return { before, after: document.documentElement.getAttribute('data-theme'), stored: localStorage.getItem('eam-theme') };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const afterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  record('主题切换与刷新保持', theme.before !== theme.after && afterReload === theme.after,
    `${theme.before} -> ${theme.after} (刷新后 ${afterReload}, stored=${theme.stored})`);

  // 5. 窄屏无横向溢出
  const overflow = [];
  for (const w of [1440, 1000, 900, 700, 480]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    overflow.push(`${w}px:${o > 0 ? '+' + o : '0'}`);
  }
  record('各宽度无横向溢出', overflow.every(x => x.endsWith(':0')), overflow.join(' '));

  // 6. 打印媒体查询
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  const pr = await page.evaluate(() => ({
    top: getComputedStyle(document.querySelector('.doc-top')).display === 'none',
    nav: getComputedStyle(document.querySelector('.doc-nav')).display === 'none',
  }));
  record('打印时隐藏顶栏与目录', pr.top && pr.nav, `topbar=${pr.top} nav=${pr.nav}`);

  // 截图（可选）
  if (SHOT) {
    fs.mkdirSync(SHOT, { recursive: true });
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => localStorage.setItem('eam-theme', 'light'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    for (const [name, sel] of [['top', null], ['concepts', '#s2-1'], ['p2', '#p2'], ['matrix', '#s7-1']]) {
      if (sel) {
        await page.evaluate(s => {
          const el = document.querySelector(s);
          const off = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off - 12, behavior: 'instant' });
        }, sel);
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: path.join(SHOT, `${name}.png`) });
    }
    for (const id of ['p2', 'p12']) {
      const loc = page.locator(`#${id} ~ .proto`).first();
      if (await loc.count()) await loc.screenshot({ path: path.join(SHOT, `el-${id}.png`) });
    }
  }

  await browser.close();

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n渲染验证（真实 Chromium）');
  console.log('─'.repeat(78));
  for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${pad(r.name, 34)} ${r.detail}`);
  const failed = results.filter(r => !r.ok).length;
  console.log('─'.repeat(78));
  console.log(failed === 0 ? '== 渲染验证通过 ==' : `== 渲染验证未通过（${failed} 项）==`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
