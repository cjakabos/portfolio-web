import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

import {
  buildUrl,
  formParams,
  maxPollAttempts,
  maybeJson,
  pollSleep,
  uniqueId,
} from './common.js';

const sampleDocument = open('./fixtures/rag-sample.txt');

export const ragUploadSuccess = new Rate('rag_upload_success');
export const ragUploadDuration = new Trend('rag_upload_duration');

export const options = {
  scenarios: {
    ragUpload: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: __ENV.WARMUP_DURATION || '20s', target: Number(__ENV.TARGET_VUS || '1') },
        { duration: __ENV.SUSTAIN_DURATION || '60s', target: Number(__ENV.TARGET_VUS || '1') },
        { duration: __ENV.COOLDOWN_DURATION || '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    rag_upload_success: ['rate>0.95'],
    rag_upload_duration: ['p(95)<180000'],
  },
};

export default function () {
  const uploadStartedAt = Date.now();
  const filename = `${uniqueId('rag-sample')}.txt`;

  const uploadResponse = http.post(
    buildUrl('/rag/documents/upload'),
    {
      file: http.file(sampleDocument, filename, 'text/plain'),
      user_id: String(__VU),
      tags: 'synthetic,load-test',
      category: 'synthetic-load',
    },
    formParams(),
  );

  const uploadBody = maybeJson(uploadResponse);
  const uploadAccepted = check(uploadResponse, {
    'rag upload accepted with HTTP 200': (res) => res.status === 200,
    'rag upload returns a job id': () => Boolean(uploadBody && uploadBody.job_id),
  });

  if (!uploadAccepted) {
    ragUploadSuccess.add(false);
    return;
  }

  let completed = false;
  let finalStatus = null;
  let finalBody = null;

  for (let attempt = 0; attempt < maxPollAttempts(); attempt += 1) {
    const statusResponse = http.get(
      buildUrl(`/rag/documents/upload/status/${uploadBody.job_id}`),
      formParams(),
    );
    finalBody = maybeJson(statusResponse);
    finalStatus = finalBody && finalBody.status;

    if (finalStatus === 'completed' || finalStatus === 'failed') {
      completed = finalStatus === 'completed';
      break;
    }

    pollSleep();
  }

  if (completed) {
    ragUploadDuration.add(Date.now() - uploadStartedAt);
  }
  ragUploadSuccess.add(completed);

  if (completed && finalBody && finalBody.doc_id) {
    http.del(buildUrl(`/rag/documents/${finalBody.doc_id}`), null, formParams());
  }
}
