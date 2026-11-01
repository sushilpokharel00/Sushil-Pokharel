import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEGRADED_RESPONSE_THRESHOLD_MS,
  getServiceStatus,
} from './status-health.js';

test('reports operational when the live settings check is healthy', () => {
  assert.equal(getServiceStatus({ is_maintenance: false }, null, 250), 'operational');
});

test('reports maintenance when the administrator enables maintenance mode', () => {
  assert.equal(getServiceStatus({ is_maintenance: true }, null, 250), 'maintenance');
});

test('reports degraded when the health check fails or has no settings', () => {
  assert.equal(getServiceStatus(null, new Error('Unavailable'), null), 'degraded');
  assert.equal(getServiceStatus(null, null, null), 'degraded');
});

test('reports degraded when the health check exceeds the response threshold', () => {
  assert.equal(
    getServiceStatus({ is_maintenance: false }, null, DEGRADED_RESPONSE_THRESHOLD_MS),
    'operational',
  );
  assert.equal(
    getServiceStatus({ is_maintenance: false }, null, DEGRADED_RESPONSE_THRESHOLD_MS + 1),
    'degraded',
  );
});
