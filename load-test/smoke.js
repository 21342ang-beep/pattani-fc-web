import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE = __ENV.BASE_URL || 'https://pattanifc.co';

export default function () {
  const paths = ['/', '/matches', '/tickets', '/bookings/check', '/faq'];
  for (const p of paths) {
    const res = http.get(`${BASE}${p}`);
    check(res, {
      [`${p} status is 200`]: (r) => r.status === 200,
    });
    sleep(1);
  }
}
