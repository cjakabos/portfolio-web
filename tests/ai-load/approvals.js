import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

import {
  buildUrl,
  jsonParams,
  maxPollAttempts,
  maybeJson,
  pollSleep,
  uniqueId,
} from './common.js';

export const approvalVisibility = new Rate('approval_visibility_success');
export const approvalDecisionSuccess = new Rate('approval_decision_success');
export const approvalVisibilityLatency = new Trend('approval_visibility_latency');

export const options = {
  scenarios: {
    approvals: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: __ENV.WARMUP_DURATION || '20s', target: Number(__ENV.TARGET_VUS || '2') },
        { duration: __ENV.SUSTAIN_DURATION || '90s', target: Number(__ENV.TARGET_VUS || '2') },
        { duration: __ENV.COOLDOWN_DURATION || '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    approval_visibility_success: ['rate>0.99'],
    approval_decision_success: ['rate>0.99'],
    approval_visibility_latency: ['p(95)<5000'],
  },
};

export default function () {
  const orchestrationId = uniqueId('approval-orchestration');
  const createStartedAt = Date.now();

  const createResponse = http.post(
    buildUrl('/approvals/request'),
    JSON.stringify({
      orchestration_id: orchestrationId,
      approval_type: 'agent_action',
      proposed_action: 'Synthetic approval check from k6',
      risk_level: 'medium',
      risk_score: 0.55,
      risk_factors: ['synthetic-load-check'],
      context: {
        state_summary: {
          source: 'k6',
          scenario: 'approvals',
        },
        risk_score: 0.55,
        additional_info: {
          suite: 'ai-load',
        },
      },
      execution_context: {
        next_capability: 'agent_execution',
        planned_tool_calls: [],
        planned_workflow_steps: ['synthetic-check'],
        risk_score: 0.55,
        risk_factors: ['synthetic-load-check'],
      },
      expires_in_seconds: 300,
    }),
    jsonParams(),
  );

  const created = maybeJson(createResponse);
  const createOk = check(createResponse, {
    'approval created with HTTP 200': (res) => res.status === 200,
    'approval create returns request id': () => Boolean(created && created.request_id),
  });

  if (!createOk) {
    approvalVisibility.add(false);
    approvalDecisionSuccess.add(false);
    return;
  }

  let visible = false;
  for (let attempt = 0; attempt < maxPollAttempts(); attempt += 1) {
    const pendingResponse = http.get(buildUrl('/approvals/pending'), jsonParams());
    const pending = maybeJson(pendingResponse) || [];

    if (Array.isArray(pending) && pending.some((entry) => entry.request_id === created.request_id)) {
      visible = true;
      approvalVisibilityLatency.add(Date.now() - createStartedAt);
      break;
    }

    pollSleep();
  }

  approvalVisibility.add(visible);

  if (!visible) {
    approvalDecisionSuccess.add(false);
    return;
  }

  const decideResponse = http.post(
    buildUrl(`/approvals/pending/${created.request_id}/decide`),
    JSON.stringify({
      approved: true,
      approval_notes: 'Synthetic approval resolution from k6',
    }),
    jsonParams(),
  );
  const decided = maybeJson(decideResponse);
  const decisionOk = check(decideResponse, {
    'approval decision returns HTTP 200': (res) => res.status === 200,
    'approval decision returns approved status': () => Boolean(decided && decided.status === 'approved'),
  });

  approvalDecisionSuccess.add(decisionOk);
}
