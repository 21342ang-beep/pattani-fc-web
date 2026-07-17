import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m',  target: 200 },
    { duration: '2m',  target: 500 },
    { duration: '1m',  target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    'group_duration{group:::browse-flow}': ['p(95)<15000'],
  },
};

const BASE = __ENV.BASE_URL || 'https://pattanifc.co';
const homeTrend = new Trend('home_ttfb', true);
const matchesTrend = new Trend('matches_ttfb', true);

export default function () {
  group('browse-flow', () => {
    let res = http.get(`${BASE}/`);
    homeTrend.add(res.timings.waiting);
    check(res, { 'home 200': (r) => r.status === 200 });
    sleep(Math.random() * 3 + 2);

    res = http.get(`${BASE}/matches`);
    matchesTrend.add(res.timings.waiting);
    check(res, { 'matches 200': (r) => r.status === 200 });
    sleep(Math.random() * 2 + 2);

    const matchIds = [
      'cmrabpvh40002qvdpwl2mpwk6',
      'cmradlzir0003qvb6oiq9i4nf',
      'cmradmqro0004qvb66avxo4nc',
    ];
    const pick = matchIds[Math.floor(Math.random() * matchIds.length)];
    res = http.get(`${BASE}/matches/${pick}`);
    check(res, { 'match detail 200': (r) => r.status === 200 });
    sleep(Math.random() * 4 + 3);

    if (Math.random() < 0.3) {
      res = http.get(`${BASE}/tickets`);
      check(res, { 'tickets 200': (r) => r.status === 200 });
      sleep(2);
    }

    if (Math.random() < 0.2) {
      res = http.get(`${BASE}/bookings/search`);
      check(res, { 'bookings search 200': (r) => r.status === 200 });
    }
  });
}
