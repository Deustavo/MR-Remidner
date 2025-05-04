import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GITLAB_API = 'https://gitlab.com/api/v4';
const projectId = process.env.GITLAB_PROJECT_ID;
const token = process.env.GITLAB_TOKEN || '';

const headers = {
  'PRIVATE-TOKEN': token
};

async function getDiscussions(iid: number) {
  const url = `${GITLAB_API}/projects/${projectId}/merge_requests/${iid}/discussions`;
  const res = await axios.get(url, { headers });
  return res.data;
}

async function getApprovals(iid: number) {
  const url = `${GITLAB_API}/projects/${projectId}/merge_requests/${iid}/approvals`;
  const res = await axios.get(url, { headers });
  return res.data.approved_by.map((a: any) => a.user.username);
}

function formatMessage(mr: any, status: string): string {
  const link = `<${mr.web_url}|${mr.title}>`;
  return `${link}\n*Status:*  ${status}\n`;
}

export async function getOpenMergeRequests(): Promise<string[]> {
  console.log('🔍 Fetching Merge Requests...');
  const url = `${GITLAB_API}/projects/${projectId}/merge_requests?state=opened`;
  const res = await axios.get(url, { headers });
  const mergeRequests = res.data;

  const formattedMessages: string[] = [];

  for (const mr of mergeRequests) {
    const [discussions, approvals] = await Promise.all([
      getDiscussions(mr.iid),
      getApprovals(mr.iid)
    ]);

    const hasPendingThreads = discussions.some((d: any) =>
      d.notes.some((note: any) => note.resolvable && !note.resolved)
    );

    let status = '🕵️‍♂️ Waiting Code Review';

    if (hasPendingThreads) {
      status = '💬 Threads Pending';
    } else if (approvals.length > 0 && !approvals.includes('pedrol2')) {
      status = '🔍 Waiting QA';
    } else if (approvals.includes('pedrol2')) {
      status = '✅ Ready to Merge';
    }

    formattedMessages.push(formatMessage(mr, status));
  }

  return formattedMessages;
}