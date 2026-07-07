import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  scenarios: {
    ticket_rush: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 3000,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '20s', target: 2000 },
        { duration: '1m',  target: 2000 },
        { duration: '30s', target: 500 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
  },
};

const BASE = __ENV.BASE_URL || 'https://pattanifc.co';
const MATCH_ID = __ENV.MATCH_ID || 'cmrabpvh40002qvdpwl2mpwk6';

const soldOut = new Counter('sold_out_or_error');

export default function () {
  const flow = Math.random();

  if (flow < 0.6) {
    const res = http.get(`${BASE}/matches/${MATCH_ID}`);
    check(res, {
      'match detail 200': (r) => r.status === 200,
      'not 5xx': (r) => r.status < 500,
    });
    if (res.status >= 500) soldOut.add(1);
  } else if (flow < 0.9) {
    const res = http.get(`${BASE}/matches`);
    check(res, { 'matches 200': (r) => r.status === 200 });
    if (res.status >= 500) soldOut.add(1);
  } else {
    const res = http.get(`${BASE}/`);
    check(res, { 'home 200': (r) => r.status === 200 });
    if (res.status >= 500) soldOut.add(1);
  }
}
