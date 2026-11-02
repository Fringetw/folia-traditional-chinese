import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { hostDirectory, root } from '../../scripts/paths.mjs';

// Real Chromium + Folia API/events/setter/renderers. Only provider answers are synthetic.
// Bounded execution, phase progress and incremental reports prevent an invisible infinite wait.
const host = hostDirectory();
const { chromium } = createRequire(path.join(host, 'package.json'))('playwright-core');
const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length);
const source = baseline ? path.resolve(baseline, 'mods/opencc-traditional-lyrics') : path.join(root, 'mods/opencc-traditional-lyrics');
const output = path.join(root, 'test-results', baseline ? 'browser-baseline' : 'browser');
const probeName = `openccRecovery${randomBytes(5).toString('hex')}`;
const probeTarget = path.join(host, `dev/probes/${probeName}.probe.tsx`);
const bridgeRelative = `test-results/opencc-browser-${probeName}`;
const bridge = path.join(host, bridgeRelative);
const port = 3193;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const started = Date.now();
let phase = 'prepare', server, browser, serverLog = '', fatal = null, agent = null;
const checks = [], pageErrors = [], consoleErrors = [], requestFailures = [], blockedRequests = [];
let writes = Promise.resolve();
await fs.mkdir(output, { recursive: true });
const summary = () => ({ startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, phase,
    baseline: Boolean(baseline), hostVersion: JSON.parse(requireHostPackage()).version,
    modVersion: JSON.parse(requireModPackage()).version, userAgent: agent,
    fixtureNotice: 'Real Folia client API, host events, setter and renderers; synthetic provider replies. No live audio or private accounts.',
    networkPolicy: 'Loopback only; external browser requests and Node fetch are blocked.',
    completed: phase === 'finished', error: fatal, checks: [...checks], pageErrors: [...pageErrors], consoleErrors: [...consoleErrors],
    requestFailures: [...requestFailures], blockedRequests: [...blockedRequests] });
let hostPackage = await fs.readFile(path.join(host, 'package.json'), 'utf8');
let modPackage = await fs.readFile(path.join(source, 'mod.json'), 'utf8');
function requireHostPackage() { return hostPackage; }
function requireModPackage() { return modPackage; }
function persist() { const text = JSON.stringify(summary(), null, 2) + '\n'; writes = writes.then(() => fs.writeFile(path.join(output, 'report.json'), text)); }
function stage(value) { phase = value; console.log(`PHASE ${value}`); persist(); }
function check(name, passed, details) {
    checks.push({ name, passed, ...(details ? { details } : {}) });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); persist();
}
const visibleWords = expected => [...document.querySelectorAll('[data-opencc-mode] .will-change-transform [style*="perspective"] span')].some(element => {
    const matches = expected ? element.textContent?.includes(expected) : /[\u3040-\u30ff]/.test(element.textContent ?? '');
    if (!matches || parseFloat(getComputedStyle(element).fontSize) < 30) return false;
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node); opacity *= Number(style.opacity);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
    }
    const rect = element.getBoundingClientRect();
    return opacity > 0.02 && rect.width > 1 && rect.height > 1
        && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
});
async function run() {
    stage('prepare');
    const stale = (await fs.readdir(path.join(host, 'dev/probes'))).filter(name => /^openccRecovery[0-9a-f]+\.probe\.tsx$/.test(name));
    if (stale.length) throw new Error(`Stale browser fixtures remain after an interrupted run. Move these to a backup before retrying: ${stale.join(', ')}`);
    const probe = await fs.readFile(fileURLToPath(new URL('./openccRecovery.probe.tsx', import.meta.url)), 'utf8');
    await fs.writeFile(probeTarget, probe.replaceAll('/test-results/opencc-browser/', `/${bridgeRelative}/`)
        .replace("id: 'openccRecovery'", `id: '${probeName}'`)
        .replace("version: '1.1.6'", `version: '${JSON.parse(modPackage).version}'`));
    await fs.cp(source, path.join(bridge, 'mod'), { recursive: true });
    const fontRoot = process.env.OPENCC_TEST_FONT_ROOT;
    if (fontRoot) await fs.cp(fontRoot, path.join(bridge, 'fonts'), { recursive: true });
    await fs.writeFile(path.join(bridge, 'fonts.css'), fontRoot
        ? '@import url("./fonts/400.css");\n@import url("./fonts/700.css");\n' : '/* Use installed system fonts. */\n');
    stage('start-vite');
    server = spawn(process.execPath, ['--import', fileURLToPath(new URL('./onlyLocalFetch.mjs', import.meta.url)),
        path.join(host, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: host, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' },
    });
    server.stdout.on('data', data => { serverLog += data; });
    server.stderr.on('data', data => { serverLog += data; });
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null) throw new Error(`Vite exited: ${serverLog.slice(-2000)}`);
        ready = await fetch(`http://127.0.0.1:${port}/dev-probe.html`, { signal: AbortSignal.timeout(1000) }).then(response => response.ok, () => false);
        if (ready) break;
        await delay(250);
    }
    if (!ready) throw new Error('Vite did not start within its deadline');
    stage('launch-chromium');
    browser = await chromium.launch({ headless: true, timeout: 20000,
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-TW', serviceWorkers: 'block' });
    const localResource = value => {
        const url = new URL(value);
        return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.port === String(port)
            && url.pathname !== '/api/lyric-proxy';
    };
    await context.route('**/*', route => {
        if (localResource(route.request().url())) return route.continue();
        blockedRequests.push(route.request().url());
        return route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', socket => {
        if (localResource(socket.url())) { socket.connectToServer(); return; }
        blockedRequests.push(socket.url());
        return socket.close({ code: 1008, reason: 'Local test resources only' });
    });
    await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('folia_app_language', 'zh-TW'); localStorage.setItem('library_suite_prompt_seen', 'true'); });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => pageErrors.push(error.stack ?? String(error)));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    stage('load-host-probe');
    await page.goto(`http://127.0.0.1:${port}/dev-probe.html?probe=${probeName}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.__openccProbe || window.__openccError, undefined, { timeout: 60000 });
    const initError = await page.evaluate(() => window.__openccError);
    if (initError) throw new Error(initError);
    agent = await page.evaluate(() => navigator.userAgent);
    const snapshot = () => page.evaluate(() => window.__openccProbe.snapshot());
    const translated = state => state.lines.length > 0 && state.lines.every(line => /[\u4e00-\u9fff]/.test(line.translation ?? ''));
    const awaitTranslation = () => page.waitForFunction(() => {
        const state = window.__openccProbe.snapshot();
        return state.lines.length > 0 && state.lines.every(line => /[\u4e00-\u9fff]/.test(line.translation ?? ''));
    }, undefined, { timeout: baseline ? 1500 : 6000 }).then(() => true, () => false);
    const sameTiming = state => JSON.stringify(state.lines.map(line => [line.fullText, line.startTime, line.endTime, line.words]))
        === JSON.stringify(state.raw.map(line => [line.fullText, line.startTime, line.endTime, line.words]));
    stage('matching-and-empty-recovery');
    for (const name of ['kaiju', 'akari', 'cover']) {
        await page.evaluate(name => window.__openccProbe.load(name), name);
        check(`${name}: Chinese translation selected`, await awaitTranslation());
        check(`${name}: original animation text and every word time preserved`, sameTiming(await snapshot()));
    }
    await page.evaluate(() => window.__openccProbe.load('cover', { empty: true, delay: 250 }));
    check('empty cover: lyrics and word timings recover asynchronously', await awaitTranslation());
    await page.evaluate(() => window.__openccProbe.seek(11.4)); await delay(800);
    await page.screenshot({ path: path.join(output, '01-empty-cover-recovered.png'), timeout: 15000 });
    const rows = await page.locator('[data-font-debug-target="visualizer-translation"]').allTextContents();
    check('Partita: actual Chinese subtitle DOM is present', rows.some(text => text.includes('紙飛機')));
    stage('reload-races-and-failures');
    await page.evaluate(() => window.__openccProbe.load('akari')); await awaitTranslation();
    await page.evaluate(() => { window.__openccProbe.rebuild(); window.__openccProbe.lateHostLoad(); }); await delay(200);
    const rebuilt = await snapshot();
    check('host reload and word segmentation rebuild retain translations and timings', translated(rebuilt) && sameTiming(rebuilt));
    check('new host word segmentation is retained', rebuilt.lines.every(line => line.wordSegments?.join('') === line.fullText));
    await page.evaluate(() => { window.__openccProbe.load('akari', { delay: 800 }); window.__openccProbe.load('cover', { noResults: true }); }); await delay(1000);
    const switched = await snapshot();
    check('late response after a track switch cannot overwrite the new track', !translated(switched) && sameTiming(switched));
    await page.evaluate(() => window.__openccProbe.load('akari', { wrong: true })); await delay(400);
    check('same title with unrelated original lyrics is rejected without hiding source', !translated(await snapshot()) && sameTiming(await snapshot()));
    await page.evaluate(() => window.__openccProbe.load('cover', { fail: true })); await delay(400);
    check('provider failure leaves original text and word animation intact', !translated(await snapshot()) && sameTiming(await snapshot()));
    stage('reported-acoustic-and-loading');
    await page.evaluate(() => window.__openccProbe.load('acoustic'));
    check('acoustic bilingual title and unknown artist spelling find Chinese', await awaitTranslation());
    check('acoustic matching keeps the original recording animation', sameTiming(await snapshot()));
    await page.evaluate(() => window.__openccProbe.load('acousticAlbum', { recordingCadence: true }));
    check('album translation transfers only after the full acoustic original sequence is verified', await awaitTranslation());
    check('album translation does not replace acoustic word times', sameTiming(await snapshot()));
    await page.evaluate(() => { window.__openccProbe.seek(16.5); window.__openccProbe.subtitle('none'); }); await delay(500);
    const hidden = await page.locator('[data-font-debug-target="visualizer-translation"]').allTextContents();
    check('subtitle preference can hide Chinese without losing translated data or the original', translated(await snapshot()) && !hidden.some(text => text.includes('地圖')) && sameTiming(await snapshot()));
    await page.evaluate(() => window.__openccProbe.subtitle('translation'));
    check('selecting translation in the style shows Chinese', await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-font-debug-target="visualizer-translation"]')].some(node => node.textContent?.includes('地圖')),
        undefined, { timeout: 4000 }).then(() => true, () => false));
    await page.screenshot({ path: path.join(output, '03-acoustic-translation.png'), timeout: 15000 });
    await page.evaluate(() => window.__openccProbe.load('acoustic', { holdLoading: true })); await delay(400);
    check('an in-progress primary load is not overwritten by refresh', !translated(await snapshot()));
    await page.evaluate(() => window.__openccProbe.finishLoading());
    check('the completed primary load receives the cached Chinese choice', await awaitTranslation());
    stage('zero-word-and-missing-line-end');
    await page.evaluate(() => window.__openccProbe.load('cover', { zeroWords: true, noResults: true })); await delay(150);
    const zero = await snapshot();
    check('zero-duration words become visible line spans', zero.lines.length === 4
        && zero.raw.every(line => line.words[0].startTime === line.words[0].endTime)
        && zero.lines.every(line => line.words[0].endTime > line.words[0].startTime));
    await page.evaluate(() => { window.__openccProbe.mode('partita'); window.__openccProbe.seek(16.5); });
    check('zero-duration repair reaches the real main animation', await page.waitForFunction(visibleWords, '机', { timeout: 4000 }).then(() => true, () => false));
    await page.evaluate(() => window.__openccProbe.load('cover', { badEnds: true, noResults: true })); await delay(150);
    const ends = await snapshot();
    check('missing line ends recover from the next cue and actual metadata', ends.lines.length === 4
        && ends.lines.every((line, i) => line.endTime === (i === 3 ? 200 : ends.raw[i + 1].startTime)));
    await page.evaluate(() => window.__openccProbe.seek(16.5));
    check('repaired line ends restore an active main lyric', await page.waitForFunction(visibleWords, '机', { timeout: 4000 }).then(() => true, () => false));
    await page.screenshot({ path: path.join(output, '04-missing-line-ends.png'), timeout: 15000 });
    stage('missing-word-animation');
    await page.evaluate(() => window.__openccProbe.load('cover', { badWords: true, noResults: true })); await delay(150);
    const repaired = await snapshot();
    check('missing word data recovers whole-line animation without a working provider', repaired.lines.length === 4
        && repaired.raw.every(line => line.words.length === 0)
        && repaired.lines.every((line, i) => line.words.length === 1 && line.words[0].text === line.fullText
            && line.startTime === repaired.raw[i].startTime && line.endTime === repaired.raw[i].endTime));
    await page.evaluate(() => { window.__openccProbe.mode('partita'); window.__openccProbe.seek(16.5); }); await delay(500);
    check('repaired missing words are visible in the actual main animation', await page.waitForFunction(visibleWords, undefined, { timeout: 4000 }).then(() => true, () => false));
    await page.screenshot({ path: path.join(output, '02-missing-words-recovered.png'), timeout: 15000 });
    await page.evaluate(() => window.__openccProbe.load('cover')); await awaitTranslation();
    for (const mode of ['partita', 'sonnet', 'diorama']) {
        stage(`renderer-${mode}`);
        await page.evaluate(mode => { window.__openccProbe.mode(mode); window.__openccProbe.seek(11); }, mode);
        await delay(mode === 'partita' ? 500 : 2500);
        const first = await page.screenshot({ path: path.join(output, `${mode}-11s.png`), timeout: 15000 });
        await page.evaluate(() => window.__openccProbe.seek(16.5)); await delay(700);
        const second = await page.screenshot({ path: path.join(output, `${mode}-16s.png`), timeout: 15000 });
        const subtitle = await page.locator('[data-font-debug-target="visualizer-translation"]').allTextContents();
        check(`${mode}: translated subtitle reaches actual renderer`, subtitle.some(text => text.includes('地圖')));
        if (mode === 'partita') check('Partita: main Japanese word animation is visibly rendered, beyond subtitle data', await page.waitForFunction(visibleWords, undefined, { timeout: 4000 }).then(() => true, () => false));
        check(`${mode}: rendered frame advances with lyric time`, createHash('sha256').update(first).digest('hex') !== createHash('sha256').update(second).digest('hex'));
    }
    stage('restore-and-disable');
    await page.evaluate(() => window.__openccProbe.command('restore-lyrics'));
    check('restore command immediately restores source lyrics without translation', !translated(await snapshot()) && sameTiming(await snapshot()));
    await page.evaluate(() => window.__openccProbe.command('retry-chinese'));
    check('manual retry recovers Chinese again', await awaitTranslation());
    await page.evaluate(() => window.__openccProbe.disable());
    check('disabling the module fully restores original lyrics and timings', !translated(await snapshot()) && sameTiming(await snapshot()));
    check('no uncaught browser or React error', pageErrors.length === 0, pageErrors);
    stage('finished');
    if (!baseline && checks.some(item => !item.passed)) process.exitCode = 1;
}
const totalMs = Number(process.env.OPENCC_BROWSER_TIMEOUT_MS || 180000);
if (!Number.isFinite(totalMs) || totalMs < 30000 || totalMs > 600000) throw new Error('Invalid browser timeout (30–600 seconds)');
let deadline;
try {
    await Promise.race([run(), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error(`Browser suite timed out in phase ${phase}`)), totalMs); })]);
} catch (error) {
    fatal = String(error.stack ?? error); process.exitCode = 1; console.error(fatal);
} finally {
    clearTimeout(deadline);
    await Promise.race([browser?.close().catch(() => {}), delay(3000)]);
    server?.kill('SIGTERM');
    persist(); await writes;
    await fs.writeFile(path.join(output, 'vite.log'), serverLog);
    await fs.rm(probeTarget, { force: true, maxRetries: 5, retryDelay: 100 });
    await fs.rm(bridge, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    console.log(`RESULT ${checks.filter(item => item.passed).length}/${checks.length}; report ${path.join(output, 'report.json')}`);
    // If a browser/server child ignores shutdown, do not leave the run open forever.
    setTimeout(() => process.exit(process.exitCode ?? 0), 5000).unref();
}
