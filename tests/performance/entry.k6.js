// k6 load test of the QR entry: many phones scanning at once and downloading everything the
// gateway needs before the intro starts. Run ONLY against a local preview (default), never
// against GitHub Pages:  k6 run tests/performance/entry.k6.js
// Optional: -e BASE=http://localhost:4174/gamers-room/
import http from 'k6/http';
import { check, group } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:4174/gamers-room/';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(BASE)) {
  throw new Error(`refusing to load-test a non-local target: ${BASE}`);
}

export const options = {
  scenarios: {
    // a crowd scanning a printed QR: ramp to 50 concurrent visitors, hold, ramp down
    scans: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 50 },
        { duration: '30s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    'http_req_duration{kind:html}': ['p(95)<150', 'p(99)<300'],
    'http_req_duration{kind:asset}': ['p(95)<400', 'p(99)<800'],
    checks: ['rate>0.999'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const assetPattern = /(?:src|href)="(\/gamers-room\/assets\/[^"]+)"/g;

export default function () {
  group('entry', () => {
    const page = http.get(BASE, { tags: { kind: 'html' } });
    check(page, {
      'entry 200': (r) => r.status === 200,
      'has CSP': (r) => String(r.body ?? '').includes('Content-Security-Policy'),
      'loading copy': (r) => String(r.body ?? '').includes('INITIALIZING THE GAMEVERSE...'),
    });
    if (page.status !== 200) return; // counted as failed above; nothing to fetch
    const origin = BASE.replace(/\/gamers-room\/.*$/, '');
    const assets = [...String(page.body).matchAll(assetPattern)].map((m) => ['GET', origin + m[1], null, { tags: { kind: 'asset' } }]);
    // the HTML lists the entry, CSS and the three/gsap chunks (modulepreload); fetch them like a browser
    const worlds = ['logic', 'memory', 'pattern', 'spatial', 'word'].map((w) => ['GET', `${BASE}media/worlds/one-brain/${w}.webp`, null, { tags: { kind: 'asset' } }]);
    const responses = http.batch([...assets, ...worlds]);
    for (const r of responses) check(r, { 'asset 200': (x) => x.status === 200 });
  });
}
