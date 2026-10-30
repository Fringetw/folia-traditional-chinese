import { afterEach, describe, expect, it, vi } from 'vitest';
import activate from '../../../mods/opencc-traditional-lyrics/client.mjs';
import { getConverter } from '../../../mods/opencc-traditional-lyrics/converter.mjs';
import { createChineseSelector } from '../../../mods/opencc-traditional-lyrics/selectChinese.mjs';
import { analyzeLyrics, chooseLyrics, chineseTranslation, isChineseText, lyricsKey, matchSong, mergeTranslations, songKey,
    translationQuality } from '../../../mods/opencc-traditional-lyrics/lyricQuality.mjs';
import { fromFoliumLines, toFoliumLines } from '@folia/mods/folium/dto';
import { createFoliumOmniService, registerFoliumOmniSource } from '@folia/mods/folium/omni/service';
import { resetFoliumRequestQuotasForTest } from '@folia/mods/folium/omni/requestQuota';
import { applyLyricsTransform, installLyricsTransformHook, lyricsForNoLyrics, rerunLyricsTransform } from '@folia/services/hostExtensionHooks';

// Offline tests: real host DTO/rebuild/Omni boundary, deterministic provider responses; no user accounts.
const canonicalize = getConverter();
const target = (extra: any = {}) => ({ id: 'a', source: 'local', title: '夜に駆ける', artist: 'YOASOBI', album: null, ref: 'song-local', ...extra });
const candidate = (extra: any = {}) => target({ id: 'online', source: 'netease', ref: 'song-online', ...extra });
const line = (fullText: string, index = 0, translation?: string) => ({ fullText, startTime: 10 + index * 5, endTime: 14 + index * 5,
    words: [{ text: fullText, startTime: 10 + index * 5, endTime: 14 + index * 5 }], ...(translation ? { translation } : {}) });
const originals = ['沈むように', '溶けてゆくように', '二人だけの空が広がる夜に', 'さよならだけだった'];
const translations = ['彷彿逐漸沉落', '彷彿逐漸融化', '在只屬於兩人的夜空裡', '只留下那句再見'];
const lyrics = (count = 0) => originals.map((text, index) => line(text, index, index < count ? translations[index] : undefined));
const donor = (lines: any[], source = 'test') => ({ lines: toFoliumLines(lines), source, match: 1 });
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const deferred = () => { let resolve: (value: any) => void = () => {}; const promise = new Promise<any>((r) => { resolve = r; }); return { promise, resolve }; };
const stops: Array<() => void> = [];

function harness(options: any = {}) {
    let song = options.song ?? target();
    let raw: any = options.empty ? null : { lines: options.lines ?? lyrics() };
    let shown = raw;
    let values: any = { enabled: true, target: 'tw', autoSelectChinese: true, fallbackOnFailure: true, searchDepth: 'standard', ...options.settings };
    const callbacks = new Map<string, Set<any>>();
    const changes = new Set<any>();
    const commands = new Map<string, any>();
    const emit = (name: string, payload: any) => callbacks.get(name)?.forEach((fn) => fn(payload));
    const onTransform = (source: any) => {
        const sourceLines = toFoliumLines(source.lines);
        const event = { song, lines: sourceLines };
        emit('lyrics.transform', event);
        return event.lines === sourceLines ? source : { ...source, lines: fromFoliumLines(source.lines, sourceLines, event.lines) };
    };
    installLyricsTransformHook(onTransform);
    const settings = { get: () => values, set: (patch: any) => { values = { ...values, ...patch }; changes.forEach((fn) => fn()); },
        onChange: (fn: any) => { changes.add(fn); return () => changes.delete(fn); } };
    const providers = options.providers ?? [{ providerId: 'netease', displayName: '網易雲', configured: true, supports: { search: true, lyrics: true } }];
    const api: any = {
        env: { context: 'main' },
        registries: {
            settingsSections: { register: () => ({ settings, unregister: vi.fn() }) },
            commands: { register: (definition: any) => { commands.set(definition.id, definition); return { unregister: () => commands.delete(definition.id) }; } },
        },
        playback: { getState: () => ({ song, duration: 200 }) },
        lyrics: { getLines: () => toFoliumLines(shown?.lines), refresh: vi.fn(() => { shown = rerunLyricsTransform(shown); }) },
        events: { on: (name: string, fn: any) => {
            if (!callbacks.has(name)) callbacks.set(name, new Set()); callbacks.get(name)!.add(fn);
            return () => callbacks.get(name)?.delete(fn);
        } },
        ui: { toast: vi.fn() }, log: { warn: vi.fn() },
        omni: {
            listProviders: () => providers,
            describeSong: () => ({ durationMs: 200000 }),
            searchSongs: vi.fn(async () => ({ items: [candidate()], nextCursor: null })),
            getLyrics: vi.fn(async () => ({ lines: toFoliumLines(lyrics(4)), isPureMusic: false })),
            ...options.omni,
        },
    };
    return {
        api, settings, commands, emit,
        shown: () => shown,
        raw: () => raw,
        change(next: any, lines: any[] | null = lyrics()) {
            song = next;
            raw = lines === null ? null : { lines };
            emit('playback.songChanged', { song });
            shown = raw ? applyLyricsTransform(raw) : lyricsForNoLyrics();
            emit('lyrics.loaded', { song, lines: toFoliumLines(shown?.lines) });
        },
        rebuild() { raw = { lines: raw.lines.map((item: any) => ({ ...item, wordSegments: Array.from(item.fullText) })) }; shown = applyLyricsTransform(raw); },
        failWithoutNotification() { raw = null; shown = lyricsForNoLyrics(); },
        listenCount: () => [...callbacks.values()].reduce((sum, set) => sum + set.size, 0),
        start() { const stop = activate(api); stops.push(stop); return stop; },
    };
}

afterEach(() => { stops.splice(0).reverse().forEach((stop) => stop()); installLyricsTransformHook(null);
    registerFoliumOmniSource(null); resetFoliumRequestQuotasForTest(); vi.useRealTimers(); });

describe('same song and version matching', () => {
    it('uses portable source/id keys and separates equal ids on different sources', () => {
        expect(songKey(target())).not.toBe(songKey(target({ source: 'qq' })));
        expect(songKey(target())).toBe(songKey(target({ ref: 'song-new' })));
        expect(songKey(target({ id: null, title: 'a' }))).not.toBe(songKey(target({ id: null, title: 'b' })));
        expect(songKey(null)).toBeNull();
    });
    it('accepts same title/artist with punctuation or Simplified/Traditional differences', () => {
        expect(matchSong(target({ title: '头发，发现', artist: '周杰伦' }), candidate({ title: '頭髮發現', artist: '周杰倫' }), 200, 201, canonicalize)).toBe(1);
    });
    it.each([' (Live)', ' (Remix)', ' (Acoustic)', ' (Instrumental)', ' (Cover)', ' (Sped Up)', ' (Slowed)', ' (TV Size)'])('rejects another version %s', (version) => {
        expect(matchSong(target(), candidate({ title: target().title + version }), 200, 200, canonicalize)).toBe(0);
    });
    it('rejects the same title by a different artist and a duration mismatch', () => {
        expect(matchSong(target(), candidate({ artist: 'Other' }), 200, 200)).toBe(0);
        expect(matchSong(target(), candidate(), 200, 225)).toBe(0);
        expect(matchSong(target(), candidate({ ref: null }), 200, 200)).toBe(0);
    });
    it('accepts a collaboration only with an exact shared artist token', () => {
        expect(matchSong(target(), candidate({ artist: 'YOASOBI / Other' }), 200, 200)).toBeGreaterThan(0.9);
        expect(matchSong(target(), candidate({ artist: 'YOASOBI tribute band' }), 200, 200)).toBe(0);
    });
    it('needs independent duration confirmation when the target has no artist', () => {
        expect(matchSong(target({ artist: '' }), candidate(), 200, 201)).toBe(0.9);
        expect(matchSong(target({ artist: '' }), candidate(), 0, 0)).toBe(0);
    });
    it('keeps meaningful bracketed part numbers in the title', () => {
        expect(matchSong(target({ title: 'Song (Part 1)' }), candidate({ title: 'Song (Part 2)' }), 200, 200)).toBe(0);
    });
    it('ignores presentation labels without deleting version information', () => {
        expect(matchSong(target({ title: 'Song' }), candidate({ title: 'Song (Official Audio)' }), 200, 200)).toBe(1);
        expect(matchSong(target({ title: 'Song (2024 Remaster)' }), candidate({ title: 'Song (2025 Remaster)' }), 200, 200)).toBeLessThan(0.98);
    });
    it.each(['ライブ', 'リミックス', 'アコースティック', 'カラオケ'])('rejects another version labelled in Japanese: %s', (version) => {
        expect(matchSong(target(), candidate({ title: target().title + ' (' + version + ')' }), 200, 200)).toBe(0);
    });
    it('never lets a fuzzy long title qualify as an exact whole-document replacement', () => {
        const prefix = 'A very long name that shares almost every word with a different song version '.repeat(4);
        const score = matchSong(target({ title: prefix + '(Part 1)' }), candidate({ title: prefix + '(Part 2)' }), 200, 200);
        expect(score).toBeGreaterThanOrEqual(0.9);
        expect(score).toBeLessThan(0.98);
        expect(chooseLyrics([], [{ ...donor(lyrics(4)), match: score }], 200).changed).toBe(false);
    });
});

describe('Chinese coverage and subtitle quality', () => {
    it('counts translated lines rather than rewarding long text', () => {
        expect(analyzeLyrics(lyrics(1), 200).coverage).toBe(0.25);
        expect(analyzeLyrics(lyrics(4), 200).coverage).toBe(1);
        const verbose = lyrics(1); verbose[0].translation = '非常長的中文'.repeat(80);
        expect(analyzeLyrics(verbose, 200).coverage).toBe(0);
    });
    it('recognizes a Chinese original without requiring a redundant translation', () => {
        const lines = ['我在這裡等你', '你的聲音很清晰', '我們走過那條街'].map((text, i) => line(text, i));
        expect(analyzeLyrics(lines, 200)).toMatchObject({ nativeChinese: true, coverage: 1 });
    });
    it('does not count kana, Hangul, romanization or explicitly non-Chinese alternates', () => {
        expect(isChineseText('爱してる')).toBe(false);
        expect(isChineseText('사랑漢字')).toBe(false);
        expect(isChineseText('wo ai ni', 'zh-Latn')).toBe(false);
        const item = line('hello');
        expect(chineseTranslation({ ...item, alternateTexts: [{ role: 'translation', language: 'ja', text: '世界' }] }).quality).toBe(0);
        expect(chineseTranslation({ ...item, translation: '世界', alternateTexts: [{ role: 'translation', language: 'ja', text: '世界' }] }).quality).toBe(0);
    });
    it('reads explicitly labelled Chinese alternates', () => {
        expect(chineseTranslation({ ...line('hello'), alternateTexts: [{ role: 'translation', language: 'zh-TW', text: '你好' }] }).text).toBe('你好');
    });
    it.each(['暫無翻譯', '翻译加载失败', '錯誤�字幕', '翻譯：https://example.com', '哈哈哈哈哈哈哈哈', '翻譯：作者'])('rejects broken/placeholder/credit translation %s', (text) => {
        expect(translationQuality(text, 'hello')).toBe(0);
    });
    it('does not count an unchanged original as a translation', () => {
        expect(translationQuality('头发', '頭髮', undefined, canonicalize)).toBe(0);
    });
    it('excludes credits from the coverage denominator', () => {
        expect(analyzeLyrics([...lyrics(4), line('作詞：作者', 5)], 200).coverage).toBe(1);
    });
    it('penalizes one repeated Chinese sentence over many different original lines', () => {
        const bad = Array.from({ length: 10 }, (_, i) => line('foreign original ' + i, i, '完全相同的文字'));
        expect(analyzeLyrics(bad, 200).quality).toBeLessThan(0.6);
    });
    it.each([
        [], [line('hello', 0), { ...line('world', 1), startTime: -1 }],
        [line('hello', 0), { ...line('world', 1), endTime: Infinity }],
        [line('hello', 1), line('world', 0)],
        [line('hello', 0), { ...line('world', 1), startTime: 300, endTime: 305 }],
        [line('hello', 0), { ...line('world', 1), endTime: 400 }],
    ])('rejects empty or invalid time axes %#', (lines) => {
        expect(analyzeLyrics(lines, 200).usable).toBe(false);
    });
    it('rejects untimed multi-line documents and oversized answers', () => {
        expect(analyzeLyrics([line('one'), line('two'), line('three')], 200).usable).toBe(false);
        expect(analyzeLyrics(Array.from({ length: 2501 }, (_, i) => line('hello', i)), 0).usable).toBe(false);
    });
    it('ignores word-segmentation rebuilds but detects changed translations in a cache key', () => {
        const base = lyrics();
        expect(lyricsKey(base)).toBe(lyricsKey(base.map((item) => ({ ...item, wordSegments: ['changed'] }))));
        expect(lyricsKey(base)).not.toBe(lyricsKey(lyrics(1)));
    });
});

describe('selection without breaking original timing', () => {
    it('fills matching lines from multiple sources and retains original timings and ruby', () => {
        const base = toFoliumLines(lyrics().map((item) => ({ ...item, words: item.words.map((word) => ({ ...word, syllables: [{ ...word, ruby: [{ ...word, text: 'ruby' }] }] })) })));
        const a = lyrics(2);
        const b = lyrics().map((item, i) => ({ ...item, ...(i >= 2 ? { translation: translations[i] } : {}) }));
        const answer = chooseLyrics(base, [donor(a, 'A'), donor(b, 'B')], 200, canonicalize);
        expect(answer.metrics.coverage).toBe(1);
        expect(answer.sources).toEqual(['A', 'B']);
        answer.lines.forEach((item: any, i: number) => {
            expect(item.words).toBe(base[i].words);
            expect([item.startTime, item.endTime]).toEqual([base[i].startTime, base[i].endTime]);
        });
        expect(base[0].translation).toBeUndefined();
    });
    it('uses exact original text and close timing rather than blindly zipping line numbers', () => {
        const wrong = lyrics(4).map((item) => ({ ...item, startTime: item.startTime + 20, endTime: item.endTime + 20 }));
        const base = lyrics();
        expect(mergeTranslations(base, wrong)).toBe(base);
        expect(mergeTranslations(base, [line('other song', 0, '別首歌曲')])).toBe(base);
    });
    it('matches repeat occurrences separately and never reuses one translated chorus', () => {
        const base = [line('same', 0), line('same', 4)];
        const answer = mergeTranslations(base, [line('same', 0, '第一次')]);
        expect(answer[0].translation).toBe('第一次');
        expect(answer[1].translation).toBeUndefined();
    });
    it('prefers the more complete donor and preserves a valid existing translation', () => {
        const base = lyrics(1);
        const partial = lyrics(2); partial[1].translation = '較少的版本';
        const answer = chooseLyrics(base, [donor(partial, 'partial'), donor(lyrics(4), 'complete')], 200, canonicalize);
        expect(answer.lines[0]).toBe(base[0]);
        expect(answer.lines[1].translation).toBe(translations[1]);
        expect(answer.sources).toEqual(['complete']);
    });
    it('replaces suspicious repetitive translations with a well-formed donor', () => {
        const good = Array.from({ length: 10 }, (_, i) => line('foreign ' + i, i, '這是第' + i + '行譯文'));
        const bad = good.map((item) => ({ ...item, translation: '同一行不斷重複' }));
        expect(chooseLyrics(bad, [donor(good)], 200).metrics.quality).toBe(1);
    });
    it('keeps complete Chinese originals and equally complete existing translations', () => {
        const chinese = [line('這是原詞', 0), line('另一行歌詞', 1)];
        expect(chooseLyrics(chinese, [donor(lyrics(4))], 200).changed).toBe(false);
        const base = lyrics(4);
        expect(chooseLyrics(base, [donor(lyrics(4))], 200).lines).toBe(base);
    });
    it('requires an exact match when replacing an empty document', () => {
        expect(chooseLyrics([], [{ ...donor(lyrics(4)), match: 0.9 }], 200).changed).toBe(false);
        expect(chooseLyrics([], [donor(lyrics(4))], 200).metrics.coverage).toBe(1);
    });
    it('preserves non-Chinese alternate tracks and adds a Chinese display track', () => {
        const base = [{ ...line('hello'), alternateTexts: [{ role: 'translation', language: 'ja', text: 'こんにちは' }, { role: 'romanization', text: 'hello' }] }];
        const answer = mergeTranslations(base, [line('hello', 0, '你好')]);
        expect(answer[0].alternateTexts).toHaveLength(3);
        expect(answer[0].alternateTexts[0]).toBe(base[0].alternateTexts[0]);
    });
});

describe('automatic lookup, fallback and lifecycle', () => {
    it('automatically augments and converts frozen host lyrics, and fully restores on disable', async () => {
        const h = harness(); const stop = h.start(); await flush();
        expect(h.shown().lines[0].translation).toBe(translations[0]);
        expect(h.shown().lines[0].words).toEqual(h.raw().lines[0].words);
        expect(h.commands.size).toBe(4);
        stop();
        expect(h.shown().lines[0].translation).toBeUndefined();
        expect(h.listenCount()).toBe(0); expect(h.commands.size).toBe(0);
    });
    it('recovers actual host no-lyrics output after the primary lyric load failed', async () => {
        const h = harness({ empty: true }); h.start(); await flush();
        expect(h.shown().lines).toHaveLength(4);
        expect(h.shown().lines[0].translation).toBe(translations[0]);
    });
    it('recovers null-to-null host failures even when lyrics.loaded does not fire', async () => {
        const h = harness({ settings: { autoSelectChinese: false, fallbackOnFailure: true } }); h.start(); await flush();
        expect(h.api.omni.searchSongs).not.toHaveBeenCalled();
        h.failWithoutNotification(); await flush();
        expect(h.shown().lines[0].translation).toBe(translations[0]);
    });
    it('tries the next candidate when a lyric request rejects or returns empty lines', async () => {
        const getLyrics = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce({ lines: [] })
            .mockResolvedValue({ lines: toFoliumLines(lyrics(4)) });
        const searchSongs = vi.fn(async () => ({ items: [candidate({ id: '1', ref: 'song-1' }), candidate({ id: '2', ref: 'song-2' }), candidate({ id: '3', ref: 'song-3' })] }));
        const h = harness({ empty: true, settings: { searchDepth: 'deep' }, omni: { searchSongs, getLyrics } });
        h.start(); await flush();
        expect(getLyrics).toHaveBeenCalledTimes(3); expect(h.shown().lines).toHaveLength(4);
    });
    it('tries a different source after a search failure or authentication restriction', async () => {
        const providers = ['netease', 'qq', 'kugou'].map((providerId) => ({ providerId, configured: true, supports: { search: true, lyrics: true } }));
        const searchSongs = vi.fn(async (_: any, options: any) => {
            if (options.providerId === 'netease') throw new Error('search failed');
            return { items: [candidate({ source: options.providerId, id: options.providerId, ref: 'song-' + options.providerId })] };
        });
        const getLyrics = vi.fn(async (song: any) => {
            if (song.source === 'qq') throw Object.assign(new Error('not-signed-in'), { code: 'not-signed-in' });
            return { lines: toFoliumLines(lyrics(4)) };
        });
        const h = harness({ providers, omni: { searchSongs, getLyrics } }); h.start(); await flush();
        expect(h.shown().lines[3].translation).toBe(translations[3]);
    });
    it('falls back from a provider that ignores abort and times out', async () => {
        vi.useFakeTimers(); const stuck = deferred();
        const h = harness({ omni: { searchSongs: vi.fn(async () => ({ items: [candidate({ id: '1' }), candidate({ id: '2', ref: 'song-2' })] })),
            getLyrics: vi.fn().mockImplementationOnce(() => stuck.promise).mockResolvedValue({ lines: toFoliumLines(lyrics(4)) }) } });
        h.start(); await flush(); await vi.advanceTimersByTimeAsync(7001); await flush();
        expect(h.shown().lines[0].translation).toBe(translations[0]);
        stuck.resolve({ lines: toFoliumLines([line('wrong song', 0, '錯誤內容')]) }); await flush();
        expect(h.shown().lines[0].fullText).toBe(originals[0]);
    });
    it('does not overwrite a later song with an earlier song’s late answer', async () => {
        const pending = deferred(); const getLyrics = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue({ lines: [] });
        const h = harness({ omni: { getLyrics } }); h.start(); await flush();
        h.change(target({ id: 'new', title: 'Other Song' }), [line('new original', 0)]); await flush();
        pending.resolve({ lines: toFoliumLines(lyrics(4)) }); await flush();
        expect(h.shown().lines[0].fullText).toBe('new original'); expect(h.shown().lines[0].translation).toBeUndefined();
    });
    it('aborts pending work on disable and ignores its later result', async () => {
        const pending = deferred(); const h = harness({ omni: { getLyrics: vi.fn(() => pending.promise) } }); const stop = h.start(); await flush();
        stop(); const count = h.api.lyrics.refresh.mock.calls.length;
        pending.resolve({ lines: toFoliumLines(lyrics(4)) }); await flush();
        expect(h.api.lyrics.refresh).toHaveBeenCalledTimes(count); expect(h.shown().lines[0].translation).toBeUndefined();
    });
    it('caches successes, avoids refresh loops, and allows explicit retry', async () => {
        const h = harness(); h.start(); await flush();
        h.emit('lyrics.loaded', { song: target(), lines: toFoliumLines(h.shown().lines) }); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1);
        h.commands.get('retry-chinese').run(); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(2);
    });
    it('keeps a successful result when an explicit retry only finds a worse partial answer', async () => {
        const getLyrics = vi.fn().mockResolvedValueOnce({ lines: toFoliumLines(lyrics(4)) })
            .mockResolvedValue({ lines: toFoliumLines(lyrics(1)) });
        const h = harness({ omni: { getLyrics } }); h.start(); await flush();
        h.commands.get('retry-chinese').run(); await flush();
        expect(h.shown().lines[3].translation).toBe(translations[3]);
    });
    it('avoids unnecessary online requests for already complete Chinese subtitles', async () => {
        const h = harness({ lines: lyrics(4) }); h.start(); await flush();
        expect(h.api.omni.searchSongs).not.toHaveBeenCalled();
        h.commands.get('retry-chinese').run(); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1);
        expect(h.shown().lines[0].translation).toBe(translations[0]);
    });
    it('does not loop after all sources fail and retries after cache expiry', async () => {
        vi.useFakeTimers(); const h = harness({ omni: { getLyrics: vi.fn().mockRejectedValue(new Error('offline')) } }); h.start(); await flush();
        h.emit('lyrics.loaded', { song: target(), lines: [] }); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(600001); h.emit('lyrics.loaded', { song: target(), lines: [] }); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(2);
    });
    it('keeps the original on restore until an explicit retry and cancels pending auto work', async () => {
        const h = harness(); h.start(); await flush(); h.commands.get('restore-lyrics').run();
        expect(h.shown().lines[0].translation).toBeUndefined();
        h.emit('lyrics.loaded', { song: target(), lines: [] }); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1);
        h.commands.get('retry-chinese').run(); await flush();
        expect(h.shown().lines[0].translation).toBe(translations[0]);
    });
    it('respects independent auto-selection and fallback switches', async () => {
        const h = harness({ settings: { autoSelectChinese: false, fallbackOnFailure: false } }); h.start(); await flush();
        expect(h.api.omni.searchSongs).not.toHaveBeenCalled();
        h.settings.set({ fallbackOnFailure: true }); await flush();
        expect(h.api.omni.searchSongs).not.toHaveBeenCalled();
        h.change(target({ id: 'empty' }), null); await flush();
        expect(h.shown().lines[0].translation).toBe(translations[0]);
        h.settings.set({ fallbackOnFailure: false }); await flush();
        expect(h.shown()).toBeNull();
    });
    it('does not restart a search when only the OpenCC character variant changes', async () => {
        const h = harness(); h.start(); await flush(); h.settings.set({ target: 't' }); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1);
    });
    it('retains new host segmentation while keeping selected translations', async () => {
        const h = harness(); h.start(); await flush(); h.rebuild();
        expect(h.shown().lines[0].wordSegments).toEqual(Array.from(originals[0]));
        expect(h.shown().lines[0].translation).toBe(translations[0]);
    });
    it('drops stale cached lyrics on account changes and searches again', async () => {
        const h = harness(); h.start(); await flush(); h.emit('account.changed', {}); await flush();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(2);
    });
    it('bounds candidates per provider and skips unconfigured/unsupported sources', async () => {
        const h = harness({ providers: [
            { providerId: 'qq', configured: false, supports: { search: true, lyrics: true } },
            { providerId: 'other', configured: true, supports: { search: true, lyrics: false } },
            { providerId: 'netease', configured: true, supports: { search: true, lyrics: true } },
        ], omni: { searchSongs: vi.fn(async () => ({ items: Array.from({ length: 8 }, (_, i) => candidate({ id: String(i), ref: 'song-' + i })) })) } });
        h.start(); await flush(); expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1); expect(h.api.omni.getLyrics).toHaveBeenCalledTimes(2);
    });
    it('rejects wrong songs, instrumental answers, invalid timing and garbled translations', async () => {
        const h = harness({ empty: true, settings: { searchDepth: 'deep' }, omni: {
            searchSongs: vi.fn(async () => ({ items: [candidate({ artist: 'Wrong' }), ...[1, 2, 3].map((i) => candidate({ id: String(i), ref: 'song-' + i }))] })),
            getLyrics: vi.fn().mockResolvedValueOnce({ lines: toFoliumLines(lyrics(4)), isPureMusic: true })
                .mockResolvedValueOnce({ lines: [line('invalid', 99)] })
                .mockResolvedValueOnce({ lines: toFoliumLines(lyrics(4)) }),
        } }); h.start(); await flush(); expect(h.api.omni.getLyrics).toHaveBeenCalledTimes(3); expect(h.shown().lines).toHaveLength(4);
    });
    it('works on an older API without attempting any online reads', async () => {
        const h = harness(); delete h.api.omni; h.start(); await flush(); expect(h.commands.size).toBe(1);
    });
    it('can activate before host actions are ready and search after the first load', async () => {
        const h = harness();
        const readyState = h.api.playback.getState;
        h.api.playback.getState = () => { throw new Error('playback-unavailable-in-main-context'); };
        h.start(); await flush(); expect(h.api.omni.searchSongs).not.toHaveBeenCalled();
        h.api.playback.getState = readyState;
        h.change(target(), lyrics()); await flush();
        expect(h.shown().lines[0].translation).toBe(translations[0]);
    });
    it('does not use cached translations after the underlying lyric text/timing changes', async () => {
        const h = harness(); h.start(); await flush();
        h.change(target(), [line('different original', 0)]); await flush();
        expect(h.shown().lines[0].translation).toBeUndefined();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(2);
    });
    it('restores untransformed base lyrics when the selection switches are turned off', async () => {
        const h = harness(); h.start(); await flush();
        h.settings.set({ autoSelectChinese: false, fallbackOnFailure: false }); await flush();
        expect(h.shown().lines[0].translation).toBeUndefined();
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1);
    });
    it('handles a repeated song after its cache was evicted without leaving old work running', async () => {
        const h = harness(); h.start(); await flush();
        for (let i = 0; i < 9; i++) { h.change(target({ id: String(i) }), lyrics()); await flush(); }
        h.change(target(), lyrics()); await flush();
        expect(h.shown().lines[0].translation).toBe(translations[0]);
        expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(11);
    });
    it('shows the chosen source and measurable Chinese coverage', async () => {
        const h = harness(); h.start(); await flush(); h.commands.get('subtitle-status').run();
        const text = h.api.ui.toast.mock.calls.at(-1)[0]; expect(text).toContain('網易雲'); expect(text).toContain('100%'); expect(text).toContain('不代表語意審核');
    });
    it.each([
        ['not-signed-in', '需要登入'], ['session-expired', '登入已過期'], ['rate-limited', '請求上限'],
        ['network', '連線失敗'], ['vip-required', '會員資格'], ['region-restricted', '地區'],
    ])('explains a source failure: %s', async (code, expected) => {
        const getLyrics = vi.fn().mockRejectedValue(Object.assign(new Error(code), { code }));
        const h = harness({ omni: { getLyrics } }); h.start(); await flush();
        h.commands.get('subtitle-status').run();
        expect(h.api.ui.toast.mock.calls.at(-1)[0]).toContain(expected);
        expect(h.shown().lines[0].translation).toBeUndefined();
    });
    it('explains why no configured source can be searched', async () => {
        const h = harness({ providers: [] }); h.start(); await flush(); h.commands.get('subtitle-status').run();
        expect(h.api.ui.toast.mock.calls.at(-1)[0]).toContain('沒有已設定且支援字幕搜尋的來源');
    });
    it('distinguishes no matching songs from an empty lyric result', async () => {
        const h = harness({ omni: { searchSongs: vi.fn(async () => ({ items: [] })) } });
        h.start(); await flush(); h.commands.get('subtitle-status').run();
        expect(h.api.ui.toast.mock.calls.at(-1)[0]).toContain('沒有找到匹配的歌曲');
        h.api.omni.searchSongs.mockResolvedValue({ items: [candidate()] });
        h.api.omni.getLyrics.mockResolvedValue({ lines: [] });
        h.commands.get('retry-chinese').run(); await flush();
        const message = h.api.ui.toast.mock.calls.at(-1)[0];
        expect(message).toContain('來源沒有字幕');
        expect(message).not.toContain('沒有找到匹配的歌曲');
    });
    it('explains a timed-out request without leaving a late result active', async () => {
        vi.useFakeTimers(); const h = harness({ omni: { getLyrics: vi.fn(() => new Promise(() => {})) } });
        h.start(); await flush(); await vi.advanceTimersByTimeAsync(7001); await flush();
        h.commands.get('subtitle-status').run();
        expect(h.api.ui.toast.mock.calls.at(-1)[0]).toContain('單次請求逾時');
    });
    it('reports the whole-search deadline and the disabled state accurately', async () => {
        vi.useFakeTimers(); const h = harness({ omni: { getLyrics: vi.fn(() => new Promise(() => {})) } });
        const selector = createChineseSelector(h.api, () => h.settings.get(), () => {}, canonicalize, { requestMs: 100000, runMs: 1000 });
        stops.push(() => selector.dispose()); selector.transform(target(), toFoliumLines(lyrics())); selector.loaded(target(), []); await flush();
        await vi.advanceTimersByTimeAsync(1001); await flush();
        expect(selector.showStatus()).toContain('整輪搜尋時間上限');
        h.settings.set({ autoSelectChinese: false, fallbackOnFailure: false }); selector.settingsChanged();
        expect(selector.showStatus()).toContain('目前已關閉');
    });
    it('caps requests per minute even if manual retry is repeated', async () => {
        const h = harness(); const selector = createChineseSelector(h.api, () => h.settings.get(), () => {}, canonicalize, { requestsPerMinute: 2 });
        stops.push(() => selector.dispose()); selector.transform(target(), toFoliumLines(lyrics())); selector.loaded(target(), []); await flush();
        selector.retry(); await flush(); expect(h.api.omni.searchSongs).toHaveBeenCalledTimes(1);
    });
    it('stops an entire search at its deadline and keeps the original', async () => {
        vi.useFakeTimers(); const h = harness({ omni: { getLyrics: vi.fn(() => new Promise(() => {})) } });
        const selector = createChineseSelector(h.api, () => h.settings.get(), () => {}, canonicalize, { requestMs: 100000, runMs: 1000 });
        stops.push(() => selector.dispose()); selector.transform(target(), toFoliumLines(lyrics())); selector.loaded(target(), []); await flush();
        await vi.advanceTimersByTimeAsync(1001); await flush(); expect(selector.showStatus()).toContain('保留原字幕');
    });
});

describe('real Folia public Omni contract', () => {
    it('accepts plugin queries/refs/signals through the actual host service and reconstructs subtitle DTOs', async () => {
        const h = harness();
        const searched = vi.fn(async (_query: string, provider: string, page: any) => {
            expect(provider).toBe('netease'); expect(page.limit).toBe(8);
            return { items: [candidate()], nextCursor: null, total: 1 };
        });
        const read = vi.fn(async (ref: string, call: any) => {
            expect(ref).toBe('song-online'); expect(typeof call.gate.run).toBe('function');
            return { lines: toFoliumLines(lyrics(4)), isWordByWord: false, isPureMusic: false };
        });
        registerFoliumOmniSource({ listProviders: h.api.omni.listProviders, describeSong: () => ({ durationMs: 200000 }), searchSongs: searched, getLyrics: read } as any);
        let release = () => {};
        h.api.omni = createFoliumOmniService({ id: 'opencc-traditional-lyrics', permissions: [] } as any, 'main', () => false, (off) => { release = off; });
        stops.push(release); h.start(); await flush();
        expect(searched).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1);
        expect(h.shown().lines[0].translation).toBe(translations[0]);
        expect(h.shown().lines[0].renderHints.renderEndTime).toBeGreaterThanOrEqual(14);
    });
});
