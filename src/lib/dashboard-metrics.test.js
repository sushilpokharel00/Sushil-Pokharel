import assert from 'node:assert/strict';
import test from 'node:test';
import { getActivityWeek, getPersonalMetrics } from './dashboard-metrics.js';

test('personal metrics count published, review, and draft submissions', () => {
  const posts = [
    { status: 'approved' },
    { status: 'pending' },
    { status: 'draft' },
    { status: 'rejected' },
  ];
  assert.deepEqual(getPersonalMetrics(posts, [{}, {}]), {
    totalPosts: 4,
    publishedPosts: 1,
    inReviewPosts: 1,
    drafts: 2,
    recentActivity: 2,
  });
});

test('weekly activity is a UTC seven-day series with actual event counts', () => {
  const now = new Date('2026-11-02T12:00:00.000Z');
  const activity = [
    { created_at: '2026-10-27T23:59:00.000Z' },
    { created_at: '2026-11-02T00:01:00.000Z' },
    { created_at: '2026-11-02T10:00:00.000Z' },
  ];
  const week = getActivityWeek(activity, now);
  assert.equal(week.length, 7);
  assert.equal(week[0].date, '2026-10-27');
  assert.equal(week[6].date, '2026-11-02');
  assert.deepEqual(week.map(({ count }) => count), [1, 0, 0, 0, 0, 0, 2]);
});
