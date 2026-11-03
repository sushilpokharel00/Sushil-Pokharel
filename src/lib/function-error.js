export async function getFunctionErrorMessage(error, fallback) {
  const context = error?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Non-JSON function errors fall back to the SDK message.
    }
  }

  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : fallback;
}
