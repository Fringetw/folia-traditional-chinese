import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Isolated plugin checks, using the host's real lyric DTO and reconstruction pipeline.
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
    root,
    resolve: { alias: { '@': root + 'src' } },
    test: {
        environment: 'node',
        include: ['test/unit/mod-system/traditionalLyrics.test.ts'],
    },
});
