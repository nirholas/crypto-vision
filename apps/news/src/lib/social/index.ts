// Re-export from metrics, excluding SocialAlert to avoid duplicate with channels
export {
  getSocialMetrics,
  getSocialAlerts as getMetricsSocialAlerts,
  type SocialMetrics,
} from './metrics';

// Re-export from channels (primary SocialAlert definition)
export * from './channels';
