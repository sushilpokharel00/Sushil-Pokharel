export const DEGRADED_RESPONSE_THRESHOLD_MS = 2000;

export function getServiceStatus(settings, settingsError, responseMs) {
  if (settingsError || typeof settings?.is_maintenance !== 'boolean') return 'degraded';
  if (settings.is_maintenance) return 'maintenance';
  if (!Number.isFinite(responseMs) || responseMs > DEGRADED_RESPONSE_THRESHOLD_MS) {
    return 'degraded';
  }
  return 'operational';
}
