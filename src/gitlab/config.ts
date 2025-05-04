import dotenv from 'dotenv';
dotenv.config();

export const GITLAB_CONFIG = {
  API_URL: 'https://gitlab.com/api/v4',
  PROJECT_ID: process.env.GITLAB_PROJECT_ID,
  TOKEN: process.env.GITLAB_TOKEN || '',
  QA_REVIEWER_USERNAME: 'pedrol2',
  MAX_MRS_TO_DISPLAY: 4
} as const;

export const headers = {
  'PRIVATE-TOKEN': GITLAB_CONFIG.TOKEN
}; 