// All online reads go through Folia's public Omni API; no credentials, raw endpoints or persistent lyrics.
const qualityUrl = new URL('./lyricQuality.mjs', import.meta.url);
qualityUrl.search = new URL(import.meta.url).search;
const { songKey, lyricsKey, analyzeLyrics, chooseLyrics, matchSong } = await import(qualityUrl.href);

const DEFAULTS = Object.freeze({ requestMs: 7000, runMs: 40000, cacheMs: 600000,
    cacheSize: 8, providers: 6, requestsPerMinute: 60 });

const aborted = () => Object.assign(new Error('aborted'), { code: 'aborted' });

export function createChineseSelector(folium, getSettings, refresh, canonicalize, overrides = {}) {
    const limits = { ...DEFAULTS, ...overrides };
    const available = typeof folium.omni?.listProviders === 'function'
        && typeof folium.omni?.searchSongs === 'function' && typeof folium.omni?.getLyrics === 'function';
    const entries = new Map();
    const requests = [];
    let focus = null;
    let active = null;
    let stopped = false;
    let settingsKey = selectionSettingsKey();

    function selectionSettingsKey() {
        const settings = getSettings();
        return JSON.stringify([settings.autoSelectChinese !== false, settings.fallbackOnFailure !== false, settings.searchDepth]);
    }

    function durationOf(song) {
        const current = playbackState();
        if (songKey(current?.song) === songKey(song) && Number.isFinite(current?.duration) && current.duration > 0) return current.duration;
        try { return (folium.omni?.describeSong?.(song)?.durationMs ?? 0) / 1000; } catch { return 0; }
    }

    function playbackState() {
        try { return folium.playback?.getState?.(); } catch (error) {
            if (error?.message !== 'playback-unavailable-in-main-context') throw error;
            return null; // App actions are registered after early mod activation.
        }
    }

    function cancel() {
        if (active) {
            active.entry.status = active.entry.choice?.changed ? 'selected' : 'kept-original';
            active.controller.abort();
            active = null;
        }
    }

    function getEntry(song, base) {
        const key = songKey(song);
        if (!key) return null;
        let entry = entries.get(key);
        if (!entry) {
            entry = { key, song, base: base ?? [], baseKey: lyricsKey(base ?? []), choice: null,
                revision: 0, completed: 0, manualOriginal: false, knownComplete: false, forceSearch: false, status: 'idle', failures: 0 };
            entries.set(key, entry);
        }
        entry.song = song; // A fresh ref may replace an expired one for the same portable identity.
        if (base && base !== entry.base) {
            const nextKey = lyricsKey(base);
            if (nextKey !== entry.baseKey) {
                if (active?.entry === entry) cancel();
                entry.revision++;
                entry.choice = null;
                entry.completed = 0;
                entry.knownComplete = false;
                entry.status = 'idle';
                entry.baseKey = nextKey;
            } else if (entry.choice?.changed) {
                // Preserve new host word segmentation/ruby data when the text and timing are unchanged.
                const next = chooseLyrics(base, [{ lines: entry.choice.lines, match: 1, source: entry.choice.sources.join('、') }],
                    durationOf(song), canonicalize);
                entry.choice = { ...next, sources: entry.choice.sources };
            }
            entry.base = base;
        }
        // LRU bounded to eight songs. A pending job owns its entry even if an old cache is evicted.
        entries.delete(key);
        entries.set(key, entry);
        while (entries.size > limits.cacheSize) entries.delete(entries.keys().next().value);
        return entry;
    }

    function wanted(entry) {
        const settings = getSettings();
        return available && !stopped && !entry.manualOriginal && (!entry.knownComplete || entry.forceSearch) && (settings.autoSelectChinese !== false
            || (settings.fallbackOnFailure !== false && !analyzeLyrics(entry.base, durationOf(entry.song), canonicalize).usable));
    }

    function consumeRequest() {
        const now = Date.now();
        while (requests.length && requests[0] <= now - 60000) requests.shift();
        if (requests.length >= limits.requestsPerMinute) throw Object.assign(new Error('rate-limited'), { code: 'rate-limited' });
        requests.push(now);
    }

    // Aborting stops this plugin waiting even when a provider ignores AbortSignal. Late results never commit.
    async function request(job, action) {
        if (!isCurrent(job)) throw aborted();
        consumeRequest();
        const controller = new AbortController();
        let timeout;
        let onAbort;
        const failure = new Promise((_, reject) => {
            onAbort = () => { controller.abort(); reject(aborted()); };
            job.controller.signal.addEventListener('abort', onAbort, { once: true });
            timeout = setTimeout(() => {
                controller.abort();
                reject(Object.assign(new Error('request-timeout'), { code: 'network' }));
            }, limits.requestMs);
        });
        try {
            return await Promise.race([Promise.resolve().then(() => {
                if (controller.signal.aborted) throw aborted();
                return action(controller.signal);
            }), failure]);
        } finally {
            clearTimeout(timeout);
            job.controller.signal.removeEventListener('abort', onAbort);
        }
    }

    function isCurrent(job) {
        return !stopped && active === job && !job.controller.signal.aborted && focus === job.entry.key
            && job.revision === job.entry.revision && wanted(job.entry);
    }

    function describeDuration(song) {
        try { return (folium.omni.describeSong?.(song)?.durationMs ?? 0) / 1000; } catch { return 0; }
    }

    function updateChoice(job) {
        if (!isCurrent(job)) return;
        const choice = chooseLyrics(job.entry.base, job.candidates, job.duration, canonicalize);
        // An explicit retry must not replace a good cached answer with a partial first response.
        if (job.entry.choice?.changed && choice.metrics.score <= job.entry.choice.metrics.score + 1) return;
        // Refresh only when the visible answer changes, not after every unsuccessful attempt.
        if (lyricsKey(choice.lines) !== lyricsKey(job.entry.choice?.lines ?? job.entry.base)) {
            job.entry.choice = choice;
            refresh();
        } else if (!job.entry.choice) job.entry.choice = choice;
    }

    async function run(entry, announce = false) {
        if (stopped || focus !== entry.key || active?.entry === entry) return;
        if (entry.completed && Date.now() - entry.completed < limits.cacheMs) return;
        const baseline = analyzeLyrics(entry.base, durationOf(entry.song), canonicalize);
        entry.knownComplete = baseline.usable && baseline.coverage === 1 && baseline.quality >= 0.95;
        if (!wanted(entry)) {
            if (entry.knownComplete) entry.completed = Date.now();
            return;
        }
        cancel();
        const job = { entry, revision: entry.revision, controller: new AbortController(), candidates: [], duration: durationOf(entry.song) };
        active = job;
        entry.status = 'searching';
        entry.failures = 0;
        const deadline = setTimeout(() => job.controller.abort(), limits.runMs);
        try {
            const providers = folium.omni.listProviders().filter((provider) => provider.configured
                && provider.supports?.search && provider.supports?.lyrics).slice(0, limits.providers);
            const query = `${entry.song.title} ${entry.song.artist ?? ''}`.trim().slice(0, 200);
            const perSource = getSettings().searchDepth === 'deep' ? 4 : 2;
            const seen = new Set();
            let cursor = 0;
            const worker = async () => {
                while (isCurrent(job) && cursor < providers.length) {
                    const provider = providers[cursor++];
                    try {
                        const page = await request(job, (signal) => folium.omni.searchSongs(query, {
                            providerId: provider.providerId, limit: 8, signal,
                        }));
                        if (!isCurrent(job)) return;
                        const matches = (Array.isArray(page?.items) ? page.items : []).slice(0, 8)
                            .filter((song) => song.source === provider.providerId)
                            .map((song) => ({ song, match: matchSong(entry.song, song, job.duration, describeDuration(song), canonicalize) }))
                            .filter((item) => item.match >= 0.9).sort((a, b) => b.match - a.match).slice(0, perSource);
                        for (const item of matches) {
                            if (!isCurrent(job)) return;
                            const identity = songKey(item.song);
                            if (seen.has(identity)) continue;
                            seen.add(identity);
                            try {
                                const result = await request(job, (signal) => folium.omni.getLyrics(item.song, { signal }));
                                if (!isCurrent(job)) return;
                                const metrics = analyzeLyrics(result?.lines, job.duration, canonicalize);
                                if (result?.isPureMusic || !metrics.usable || metrics.quality < 0.6) { entry.failures++; continue; }
                                job.candidates.push({ lines: result.lines, match: item.match,
                                    source: `${provider.displayName || provider.providerId} · ${item.song.title}` });
                                updateChoice(job);
                            } catch (error) {
                                if (!isCurrent(job)) return;
                                entry.failures++;
                                if (['rate-limited', 'not-signed-in', 'session-expired', 'account-changed', 'region-restricted'].includes(error?.code)) break;
                            }
                        }
                    } catch {
                        if (!isCurrent(job)) return;
                        entry.failures++;
                    }
                }
            };
            await Promise.all([worker(), worker()]);
        } catch (error) {
            if (isCurrent(job)) {
                entry.failures++;
                folium.log?.warn?.('[OpenCC] 字幕搜尋未完成', error);
            }
        } finally {
            clearTimeout(deadline);
            if (active === job) {
                // A deadline keeps any successfully selected subtitles, and never retries in a loop.
                entry.completed = Date.now();
                entry.status = entry.choice?.changed ? 'selected' : 'kept-original';
                active = null;
                if (!stopped && focus === entry.key) folium.log?.info?.('[OpenCC] 字幕搜尋結束', {
                    status: entry.status, sources: entry.choice?.sources ?? [],
                    coverage: entry.choice?.metrics.coverage ?? baseline.coverage, failedResults: entry.failures,
                });
                if (announce && !stopped && focus === entry.key) showStatus();
            }
        }
    }

    function queue(entry, announce = false) {
        queueMicrotask(() => {
            if (!stopped && focus === entry.key && entries.get(entry.key) === entry) {
                void run(entry, announce).catch((error) => folium.log?.warn?.('[OpenCC] 無法啟動字幕搜尋', error));
            }
        });
    }

    function loaded(song, lines) {
        if (stopped) return;
        const key = songKey(song);
        if (focus !== key) cancel();
        focus = key;
        // lyrics.loaded carries transformed data; prefer the raw base captured by transform().
        const entry = entries.get(key) ?? getEntry(song, lines);
        if (!entry) return;
        entry.song = song;
        queue(entry);
    }

    function showStatus() {
        const entry = entries.get(focus);
        let message;
        if (!available) message = '此 Folia 版本未提供字幕搜尋介面，請更新 Folia；簡轉繁仍可使用。';
        else if (!entry) message = '目前沒有可搜尋的歌曲。';
        else if (entry.manualOriginal) message = '這首歌已還原原字幕，自動選字幕暫停；可用「重新尋找中文字幕」恢復。';
        else if (entry.status === 'searching') message = '正在搜尋中文字幕；失敗的來源會自動跳過。';
        else {
            const metrics = entry.choice?.metrics ?? analyzeLyrics(entry.base, durationOf(entry.song), canonicalize);
            message = `${entry.choice?.changed ? `字幕來源：${[...new Set(entry.choice.sources)].join('、')}` : '保留原字幕'}；中文覆蓋率 ${Math.round(metrics.coverage * 100)}%`;
            if (entry.failures) message += `；已跳過 ${entry.failures} 個失敗或無效結果`;
            message += '。品質評分只檢查完整度與格式，不代表語意審核。';
        }
        folium.ui?.toast?.(message, { type: 'info', durationMs: 7000 });
        return message;
    }

    return {
        start() {
            const current = playbackState();
            if (current?.song) loaded(current.song, folium.lyrics.getLines());
        },
        transform(song, lines) {
            const entry = getEntry(song, lines);
            // A failed load can leave the store null -> null, so no lyrics.loaded notification follows.
            // The empty transform is still guaranteed by the host. Start after the synchronous hook returns.
            if (entry && focus === entry.key) queue(entry);
            return entry && wanted(entry) && entry.choice?.changed ? entry.choice.lines : lines;
        },
        loaded,
        songChanged(song) {
            const key = songKey(song);
            if (focus !== key) cancel();
            focus = key;
            const entry = entries.get(key);
            if (entry) queue(entry);
        },
        settingsChanged() {
            const next = selectionSettingsKey();
            if (next === settingsKey) return;
            settingsKey = next;
            cancel();
            for (const entry of entries.values()) { entry.completed = 0; entry.choice = null; entry.revision++; }
            const entry = entries.get(focus);
            if (entry) queue(entry);
        },
        retry() {
            const entry = entries.get(focus);
            if (!entry) return showStatus();
            cancel();
            entry.manualOriginal = false;
            entry.forceSearch = true;
            entry.completed = 0;
            entry.revision++;
            if (!wanted(entry)) {
                folium.ui?.toast?.('請先啟用「自動尋找中文字幕」；載入失敗時也可啟用自動改用其他字幕。', { type: 'info' });
                return;
            }
            queue(entry, true);
        },
        restore() {
            const entry = entries.get(focus);
            if (!entry) return;
            cancel();
            entry.manualOriginal = true;
            entry.choice = null;
            entry.revision++;
            refresh();
            showStatus();
        },
        accountChanged() {
            cancel();
            entries.clear();
            refresh();
            const current = playbackState();
            if (current?.song) loaded(current.song, folium.lyrics.getLines());
        },
        showStatus,
        dispose() { stopped = true; cancel(); entries.clear(); },
    };
}
