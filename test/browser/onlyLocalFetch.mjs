// Test server only: prevent host build metadata/proxy fetches from reaching external services.
const originalFetch = globalThis.fetch;
globalThis.fetch = function localOnlyFetch(input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!['http:', 'https:'].includes(url.protocol)
        || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
        console.warn(`[OpenCC browser test] Blocked server fetch to ${url.origin}`);
        return Promise.reject(new Error('External network disabled in browser test server'));
    }
    return originalFetch.call(this, input, init);
};
