import dotenv from 'dotenv';
dotenv.config();

export const GITLAB_CONFIG = {
  API_URL: 'https://gitlab.com/api/v4',
  PROJECT_ID: process.env.GITLAB_PROJECT_ID,
  TOKEN: process.env.GITLAB_TOKEN || '',
  QA_REVIEWER_USERNAME: process.env.GITLAB_QA_REVIEWER_USERNAME || '',
  PROJECT_PATH: process.env.GITLAB_PROJECT_PATH || 'rico360/ricochet'
} as const;

export const headers = {
  'PRIVATE-TOKEN': GITLAB_CONFIG.TOKEN
}; 