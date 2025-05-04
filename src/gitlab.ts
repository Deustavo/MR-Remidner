import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GITLAB_API = 'https://gitlab.com/api/v4';
const projectId = process.env.GITLAB_PROJECT_ID;
const token = process.env.GITLAB_TOKEN || '';

const headers = {
  'PRIVATE-TOKEN': token
};

const STATUS = {
  READY_TO_MERGE: '✅ Ready to Merge',
  WAITING_REVIEW: '🕵️‍♂️ Waiting Code Review',
  THREADS_PENDING: '💬 Threads Pending',
  WAITING_QA: '🔍 Waiting QA'
} as const;

type StatusType = typeof STATUS[keyof typeof STATUS];

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

function getStatusPriority(status: StatusType): number {
  const priorities: { [key in StatusType]: number } = {
    [STATUS.READY_TO_MERGE]: 1,
    [STATUS.WAITING_REVIEW]: 2,
    [STATUS.THREADS_PENDING]: 3,
    [STATUS.WAITING_QA]: 4
  };
  return priorities[status] || 5;
}

export async function getOpenMergeRequests(): Promise<string[]> {
  console.log('🔍 Fetching Merge Requests...');
  const url = `${GITLAB_API}/projects/${projectId}/merge_requests?state=opened`;
  const res = await axios.get(url, { headers });
  const mergeRequests = res.data;

  console.log(' └─ Found', mergeRequests.length, 'merge requests');
  const formattedMessages: string[] = [];
  const MAX_MRS_TO_SHOW = 4;

  // Process all MRs first to get their status
  const mrsWithStatus = await Promise.all(
    mergeRequests.map(async (mr: any) => {
      const [discussions, approvals] = await Promise.all([
        getDiscussions(mr.iid),
        getApprovals(mr.iid)
      ]);

      const hasPendingThreads = discussions.some((d: any) =>
        d.notes.some((note: any) => note.resolvable && !note.resolved)
      );

      let status: StatusType = STATUS.WAITING_REVIEW;

      if (hasPendingThreads) {
        status = STATUS.THREADS_PENDING;
      } else if (approvals.length > 0 && !approvals.includes('pedrol2')) {
        status = STATUS.WAITING_QA;
      } else if (approvals.includes('pedrol2')) {
        status = STATUS.READY_TO_MERGE;
      }

      return { mr, status };
    })
  );

  // Sort MRs by status priority
  mrsWithStatus.sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));

  // Take only the first 4 after sorting
  const mrsToShow = mrsWithStatus.slice(0, MAX_MRS_TO_SHOW);

  // Format messages for the selected MRs
  for (const { mr, status } of mrsToShow) {
    formattedMessages.push(formatMessage(mr, status));
  }

  // Add link to remaining MRs if there are more than 4
  if (mergeRequests.length > MAX_MRS_TO_SHOW) {
    const remainingCount = mergeRequests.length - MAX_MRS_TO_SHOW;
    const projectIdFixed = projectId?.replace(/%2F/g, '/');
    const mrListUrl = `https://gitlab.com/${projectIdFixed}/-/merge_requests`;
    formattedMessages.push(`<${mrListUrl}|See other ${remainingCount} MRs pending>`);
  }

  return formattedMessages;
}