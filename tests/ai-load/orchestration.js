import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

import { buildUrl, jsonParams, maybeJson, uniqueId } from './common.js';

export const orchestrationSuccess = new Rate('orchestration_success');
export const orchestrationDuration = new Trend('orchestration_duration');

export const options = {
  scenarios: {
    orchestration: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: __ENV.WARMUP_DURATION || '30s', target: Number(__ENV.TARGET_VUS || '3') },
        { duration: __ENV.SUSTAIN_DURATION || '2m', target: Number(__ENV.TARGET_VUS || '3') },
        { duration: __ENV.COOLDOWN_DURATION || '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    orchestration_success: ['rate>0.98'],
    orchestration_duration: ['p(95)<2500'],
  },
};

export default function () {
  const payload = {
    message: `Synthetic orchestration probe ${uniqueId('message')}`,
    user_id: uniqueId('user'),
    session_id: uniqueId('session'),
    orchestration_type: __ENV.ORCHESTRATION_TYPE || 'conversational',
    context: {
      source: 'k6',
      suite: 'ai-load',
      scenario: 'orchestration',
    },
  };

  const response = http.post(
    buildUrl('/orchestrate'),
    JSON.stringify(payload),
    jsonParams(),
  );
  orchestrationDuration.add(response.timings.duration);

  const body = maybeJson(response);
  const ok = check(response, {
    'orchestration returns HTTP 200': (res) => res.status === 200,
    'orchestration returns a request id': () => Boolean(body && body.request_id),
    'orchestration returns a duration metric': () => Boolean(body && body.duration_ms !== undefined),
  });

  orchestrationSuccess.add(ok);
  sleep(Number(__ENV.SLEEP_SECONDS || '1'));
}
