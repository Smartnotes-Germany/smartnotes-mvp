export const ROUTE_SEGMENTS = {
  overview: 'overview',
  flowMode: 'flow-mode',
  studyCoach: 'study-coach',
  progress: 'progress',
  settings: 'settings',
} as const;

export const APP_ROUTES = {
  overview: `/${ROUTE_SEGMENTS.overview}`,
  flowMode: `/${ROUTE_SEGMENTS.flowMode}`,
  studyCoach: `/${ROUTE_SEGMENTS.studyCoach}`,
  progress: `/${ROUTE_SEGMENTS.progress}`,
  settings: `/${ROUTE_SEGMENTS.settings}`,
} as const;
