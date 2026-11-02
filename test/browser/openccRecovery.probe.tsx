import React, { useEffect, useState, Suspense } from 'react';
import { useMotionValue } from 'framer-motion';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import { getVisualizerRegistryEntry } from '../../src/components/visualizer/registry';
import { createLyricsSetter, supplyLyricsAfterEmptyLoad } from '../../src/components/app/playback/createLyricsSetter';
import { rerunLyricsTransform } from '../../src/services/hostExtensionHooks';
import { usePlaybackStore, setCurrentSong, setLyricsState } from '../../src/stores/usePlaybackStore';
import { installFoliumHostEvents, showRefreshedLyrics } from '../../src/mods/runtime/hostEvents';
import { createFoliumClientApi } from '../../src/mods/folium/api';
import { registerFoliumHostActions } from '../../src/mods/folium/services';
import { registerFoliumOmniSource } from '../../src/mods/folium/omni/service';
import { toFoliumLines, toFoliumSong } from '../../src/mods/folium/dto';
import { commandsRegistry, runFoliumCommand } from '../../src/mods/folium/registries/commands';
import { settingsSectionsRegistry } from '../../src/mods/folium/registries/settingsSections';
import type { LyricData, Line, SongResult } from '../../src/types';
import type { ProbeDefinition } from './definition';
import '/test-results/opencc-browser/fonts.css';

// Copied to an isolated external Folia checkout. Real API/events/setter/renderers; fixture provider replies.
// These original sentences are synthetic, not lyrics extracted from the named songs.
const originals = ['青い紙飛行機を折る', '机の上で地図を広げる', '窓際の小さな鉢に水を注ぐ', '新しい駅の名前を覚える'];
const translations = ['折一架蓝色纸飞机', '在桌面上展开地图', '给窗边的小盆栽浇水', '记住新车站的名字'];
const cases = {
    kaiju: ['怪獸 - Kaiju', 'sakanaction', '怪獣', 'サカナクション'],
    akari: ['燈 - Akari', 'Soushi Sakiyama', '燈', '崎山蒼志'],
    cover: ['睨めっ娘 (友成空) / ダズビー COVER', 'DAZBEE', '睨めっ娘 (cover)', 'DAZBEE'],
    acoustic: ['青のすみか (Acoustic ver.) - Where Our Blue Is (Acoustic version)', 'Tatsuya Kitani', '青のすみか (Acoustic Version)', 'キタニタツヤ'],
    acousticAlbum: ['青のすみか (Acoustic ver.) - Where Our Blue Is (Acoustic version)', 'Tatsuya Kitani', '青のすみか', 'キタニタツヤ'],
};
const modId = 'opencc-traditional-lyrics';
let sequence = 0;
const buildLines = (translated = false): Line[] => originals.map((fullText, index) => {
    const startTime = 10 + index * 5;
    const chars = Array.from(fullText);
    return { fullText, startTime, endTime: startTime + 4,
        words: chars.map((text, i) => ({ text, startTime: startTime + 4 * i / chars.length, endTime: startTime + 4 * (i + 1) / chars.length })),
        ...(translated ? { translation: translations[index] } : {}) };
});

function OpenccRecoveryProbe() {
    const [lines, setLines] = useState<Line[]>([]);
    const [index, setIndex] = useState(-1);
    const [mode, setMode] = useState('partita');
    const [songName, setSongName] = useState('');
    const [subtitleMode, setSubtitleMode] = useState('translation');
    const currentTime = useMotionValue(11);
    const audioPower = useMotionValue(0.3);
    const band = useMotionValue(0.2);
    useEffect(() => {
        let alive = true;
        let dispose = () => {};
        const releases: Array<() => void> = [];
        const pending = new Map<string, { lines: Line[]; delay: number; fail: boolean }>();
        const messages: string[] = [];
        let candidates: ReturnType<typeof toFoliumSong>[] = [];
        let loading = false;
        let playing = true;
        let captureTime = 11;
        let ticks = 0;
        let requests = 0;
        let stopped = false;
        let raw: LyricData | null = null;
        const songRef = { current: null as SongResult | null };
        const setter = createLyricsSetter(setLyricsState, [], songRef);
        const update = () => {
            const state = usePlaybackStore.getState();
            setLines(state.lyrics?.lines ?? []);
            setSongName(state.currentSong?.name ?? '');
            setIndex(state.lyrics?.lines.findIndex(line => line.startTime <= currentTime.get() && line.endTime > currentTime.get()) ?? -1);
        };
        const unsubscribe = usePlaybackStore.subscribe(update);
        const clock = window.setInterval(() => {
            // Keep a tiny audio heartbeat at a pinned capture time, including after a late mount.
            // The real playing clock keeps notifying subscribers; one frozen pre-mount value does not.
            currentTime.set(playing ? currentTime.get() + 0.08 : captureTime + (++ticks % 2 ? 0.001 : 0.002));
            update();
        }, 80);
        installFoliumHostEvents();
        registerFoliumHostActions({
            getPlaybackState: () => ({ song: toFoliumSong(usePlaybackStore.getState().currentSong), duration: 200, position: currentTime.get(), state: 'playing', liked: false, canLike: false }),
            getLyricLines: () => toFoliumLines(usePlaybackStore.getState().lyrics?.lines),
            refreshLyrics: () => { if (!loading) showRefreshedLyrics(rerunLyricsTransform(usePlaybackStore.getState().lyrics)); },
            toast: (message: string) => messages.push(message),
        } as never);
        registerFoliumOmniSource({
            listProviders: () => [{ providerId: 'netease', displayName: 'NetEase fixture', configured: true, supports: { search: true, lyrics: true } }],
            describeSong: () => ({ durationMs: 200000 }),
            searchSongs: async (_query: string, _provider: string, _page: unknown, call: any) => call.gate.run('netease', async () => {
                requests++; return { items: candidates, nextCursor: null };
            }),
            getLyrics: async (ref: string, call: any) => call.gate.run('netease', async () => {
                requests++;
                const item = pending.get(ref)!;
                await new Promise(resolve => setTimeout(resolve, item.delay));
                if (item.fail) throw Object.assign(new Error('fixture-network'), { code: 'network' });
                return { lines: toFoliumLines(item.lines), isPureMusic: false };
            }),
        } as never);
        let startupStage = 'fonts';
        const start = async () => {
            await document.fonts.load('700 48px "Noto Sans JP"', originals.join(''));
            await document.fonts.load('400 24px "Noto Sans JP"', '折一架藍色紙飛機在桌面上展開地圖給窗邊的小盆栽澆水記住新車站的名字');
            startupStage = 'plugin import';
            const pluginUrl = '/test-results/opencc-browser/mod/client.mjs';
            const { default: activate } = await import(/* @vite-ignore */ pluginUrl);
            if (!alive) return;
            const api = createFoliumClientApi({ id: modId, permissions: [], experimental: [], embedOrigins: [], version: '1.1.6' } as never,
                { context: 'main', experimental: {}, stopped: () => stopped, onRelease: release => releases.push(release) });
            dispose = activate(api) ?? (() => {});
            (window as any).__openccProbe = {
                load(name: keyof typeof cases, options: any = {}) {
                    playing = true;
                    const [title, artist, nativeTitle, nativeArtist] = cases[name];
                    sequence++;
                    const song: SongResult = { id: `probe-${sequence}`, name: title, artists: [{ id: 1, name: artist }],
                        album: { id: 1, name: 'probe' }, durationMs: 200000,
                        sourceRef: { kind: 'online', providerId: 'ytm', mediaId: `probe-${sequence}` } } as SongResult;
                    const native = { ...song, id: `native-${sequence}`, name: nativeTitle, artists: [{ id: 2, name: nativeArtist }],
                        sourceRef: { kind: 'online', providerId: 'netease', mediaId: `native-${sequence}` } } as SongResult;
                    const candidate = toFoliumSong(native)!;
                    const translated = buildLines(true);
                    if (options.recordingCadence) translated.forEach((line, i) => {
                        const shift = 15 + i * 9 - line.startTime;
                        line.startTime += shift; line.endTime += shift;
                        line.words = line.words.map(word => ({ ...word, startTime: word.startTime + shift, endTime: word.endTime + shift }));
                    });
                    if (options.wrong) translated.forEach((line, i) => { line.fullText = `別の歌詞がここにあります${i}`; });
                    candidates = options.noResults ? [] : [candidate];
                    pending.set(candidate.ref!, { lines: translated, delay: options.delay ?? 60, fail: Boolean(options.fail) });
                    raw = options.empty ? null : { lines: buildLines(), isWordByWord: true };
                    if (raw && options.badWords) raw.lines.forEach(line => { line.words = []; });
                    if (raw && options.zeroWords) raw.lines.forEach(line => {
                        line.words = [{ text: line.fullText, startTime: line.startTime, endTime: line.startTime }];
                    });
                    if (raw && options.badEnds) raw.lines.forEach(line => { line.endTime = line.startTime; line.words = []; });
                    loading = true; songRef.current = song; setCurrentSong(song); setLyricsState(null); currentTime.set(11);
                    if (raw) setter(raw);
                    loading = Boolean(options.holdLoading);
                    if (!loading) supplyLyricsAfterEmptyLoad(); update();
                },
                finishLoading() { loading = false; if (raw) setter(raw); else supplyLyricsAfterEmptyLoad(); update(); },
                rebuild() { if (raw) { raw = { ...raw, lines: raw.lines.map(line => ({ ...line, wordSegments: Array.from(line.fullText) })) }; setter(raw); } },
                lateHostLoad() { if (raw) setter(raw); },
                command(name: string) {
                    const entry = commandsRegistry.list().find(item => item.modId === modId && item.name === name)!;
                    return runFoliumCommand(entry, {});
                },
                settings(patch: Record<string, unknown>) { settingsSectionsRegistry.list().find(item => item.modId === modId)!.def.access.set(patch); },
                seek(time: number) {
                    // Deterministic capture after two post-commit audio ticks. No wall-clock drift into another line.
                    playing = false; captureTime = time; currentTime.set(time); update();
                    requestAnimationFrame(() => requestAnimationFrame(() => { currentTime.set(time + 0.001); update(); }));
                },
                mode(value: string) { setMode(value); },
                subtitle(value: string) { setSubtitleMode(value); },
                snapshot() { return { lines: usePlaybackStore.getState().lyrics?.lines ?? [], raw: raw?.lines ?? [], requests, messages }; },
                disable() { dispose(); dispose = () => {}; },
            };
        };
        void start().catch(error => { (window as any).__openccError = `${startupStage}: ${String(error.stack ?? error)}`; });
        return () => {
            alive = false; clearInterval(clock); dispose(); stopped = true; releases.reverse().forEach(release => release()); unsubscribe();
            registerFoliumHostActions(null); registerFoliumOmniSource(null); delete (window as any).__openccProbe;
        };
    }, []);
    const entry = getVisualizerRegistryEntry(mode as never);
    return <div className="fixed inset-0 bg-black" data-opencc-mode={mode}>
        <Suspense fallback={<span>Loading renderer…</span>}>{entry.render({ currentTime, currentLineIndex: index, lines, theme: DEFAULT_THEME,
            audioPower, audioBands: { bass: band, lowMid: band, mid: band, vocal: band, treble: band },
            showText: true, paused: false, seed: 'opencc-recovery', subtitleContentMode: subtitleMode,
            // Folia 0.7.24+ gives the bottom overlay its own rows; older hosts use subtitleContentMode.
            subtitleOverlayLayout: subtitleMode === 'none' ? 'current+next'
                : subtitleMode === 'both' ? 'current+romanization+translation' : subtitleMode,
            songTitle: songName, songArtist: 'Regression fixture', songAlbum: 'Synthetic test sentences' } as never)}</Suspense>
    </div>;
}

export default { id: 'openccRecovery', title: 'OpenCC regression', description: 'Real host pipeline with synthetic provider replies', Component: OpenccRecoveryProbe } satisfies ProbeDefinition;
