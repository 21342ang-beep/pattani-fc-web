import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '2m', target: 4000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

const BASE = __ENV.BASE_URL || 'https://pattanifc.co';

export default function () {
  const paths = ['/', '/matches', '/tickets', '/matches/cmrabpvh40002qvdpwl2mpwk6'];
  const p = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${BASE}${p}`);
  check(res, {
    'status < 500': (r) => r.status < 500,
  });
}
