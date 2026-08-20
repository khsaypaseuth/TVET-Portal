/** System branding — matches refdocs/TVED-Development-Plan.md */
export const APP_NAME = "TVED";
export const APP_FULL_NAME = "TVED Activity & Task Tracking System";
export const APP_TAGLINE =
  "Department of Technical and Vocational Education and Training";

export const pageTitle = (page: string) => `${page} | ${APP_NAME}`;
export const pageDescription = (detail: string) =>
  `${detail} — ${APP_FULL_NAME}`;
