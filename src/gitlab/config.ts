import dotenv from 'dotenv';
dotenv.config();

export const GITLAB_CONFIG = {
  API_URL: 'https://gitlab.com/api/v4',
  TOKEN: process.env.GITLAB_TOKEN || '',
  // Comma-separated list of GitLab usernames to track MRs for
  AUTHOR_USERNAMES: process.env.GITLAB_AUTHOR_USERNAMES?.split(',').map(u => u.trim()) || [],
  // Comma-separated list of QA team member usernames
  QA_USERNAMES: process.env.GITLAB_QA_USERNAMES?.split(',').map(u => u.trim()) || []
} as const;

export const headers = {
  'PRIVATE-TOKEN': GITLAB_CONFIG.TOKEN
}; 