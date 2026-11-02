export function getPersonalMetrics(posts, activity) {
  return {
    totalPosts: posts.length,
    publishedPosts: posts.filter((post) => post.status === 'approved').length,
    inReviewPosts: posts.filter((post) => post.status === 'pending').length,
    drafts: posts.filter((post) => post.status === 'draft' || post.status === 'rejected').length,
    recentActivity: activity.length,
  };
}

export function getActivityWeek(activity, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      count: activity.filter((item) => item.created_at.slice(0, 10) === key).length,
    };
  });
}
