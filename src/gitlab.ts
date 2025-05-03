import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export async function getOpenMergeRequests() {
  const url = `https://gitlab.com/api/v4/projects/${process.env.GITLAB_PROJECT_ID}/merge_requests?state=opened`;

  const response = await axios.get(url, {
    headers: {
      'PRIVATE-TOKEN': process.env.GITLAB_TOKEN || ''
    }
  });

  return response.data.map((mr: any) => `🔀 *${mr.title}* - ${mr.web_url}`);
}
