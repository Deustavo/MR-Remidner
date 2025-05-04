import axios from 'axios';
import { GITLAB_CONFIG, headers } from './config';
import {
  MergeRequestStatus,
  MergeRequestStatusType,
  GitLabMergeRequest,
  GitLabDiscussion,
  MergeRequestWithStatus
} from './types';

/**
 * Fetches all discussions for a specific merge request
 */
async function fetchMergeRequestDiscussions(mergeRequestIid: number): Promise<GitLabDiscussion[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests/${mergeRequestIid}/discussions`;
  const response = await axios.get(url, { headers });
  return response.data;
}

/**
 * Fetches approvals for a specific merge request
 */
async function fetchMergeRequestApprovals(mergeRequestIid: number): Promise<string[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests/${mergeRequestIid}/approvals`;
  const response = await axios.get(url, { headers });
  return response.data.approved_by.map((approval: any) => approval.user.username);
}

/**
 * Formats a merge request message for display
 */
function formatMergeRequestMessage(mergeRequest: GitLabMergeRequest, status: string): string {
  const link = `<${mergeRequest.web_url}|${mergeRequest.title}>`;
  return `${link}\n*Status:*  ${status}\n`;
}

/**
 * Returns the priority of a status for sorting
 */
function getStatusPriority(status: MergeRequestStatusType): number {
  const priorities: { [key in MergeRequestStatusType]: number } = {
    [MergeRequestStatus.READY_TO_MERGE]: 1,
    [MergeRequestStatus.WAITING_REVIEW]: 2,
    [MergeRequestStatus.THREADS_PENDING]: 3,
    [MergeRequestStatus.WAITING_QA]: 4
  };
  return priorities[status];
}

/**
 * Determines the status of a merge request based on its discussions and approvals
 */
function determineMergeRequestStatus(
  hasPendingThreads: boolean,
  approvals: string[]
): MergeRequestStatusType {
  if (hasPendingThreads) {
    return MergeRequestStatus.THREADS_PENDING;
  }
  
  if (approvals.length > 0) {
    if (approvals.includes(GITLAB_CONFIG.QA_REVIEWER_USERNAME)) {
      return MergeRequestStatus.READY_TO_MERGE;
    }
    return MergeRequestStatus.WAITING_QA;
  }
  
  return MergeRequestStatus.WAITING_REVIEW;
}

/**
 * Processes a single merge request to determine its status
 */
async function processMergeRequest(mergeRequest: GitLabMergeRequest): Promise<MergeRequestWithStatus> {
  const [discussions, approvals] = await Promise.all([
    fetchMergeRequestDiscussions(mergeRequest.iid),
    fetchMergeRequestApprovals(mergeRequest.iid)
  ]);

  const hasPendingThreads = discussions.some(discussion =>
    discussion.notes.some(note => note.resolvable && !note.resolved)
  );

  const status = determineMergeRequestStatus(hasPendingThreads, approvals);

  return { mergeRequest, status };
}

/**
 * Creates a link to view remaining merge requests
 */
function createRemainingMergeRequestsLink(totalCount: number, displayedCount: number): string {
  const remainingCount = totalCount - displayedCount;
  const projectIdFixed = GITLAB_CONFIG.PROJECT_ID?.replace(/%2F/g, '/');
  const mrListUrl = `https://gitlab.com/${projectIdFixed}/-/merge_requests`;
  return `<${mrListUrl}|See other ${remainingCount} MRs pending>`;
}

/**
 * Fetches and formats all open merge requests
 */
export async function getOpenMergeRequests(): Promise<string[]> {
  console.log('🔍 Fetching Merge Requests...');
  
  const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests?state=opened`;
  const response = await axios.get(url, { headers });
  const mergeRequests: GitLabMergeRequest[] = response.data;

  console.log(' └─ Found', mergeRequests.length, 'merge requests');

  // Process all MRs and get their status
  const processedMergeRequests = await Promise.all(
    mergeRequests.map(processMergeRequest)
  );

  // Sort MRs by status priority
  processedMergeRequests.sort((a, b) => 
    getStatusPriority(a.status) - getStatusPriority(b.status)
  );

  // Format messages for the selected MRs
  const formattedMessages = processedMergeRequests
    .slice(0, GITLAB_CONFIG.MAX_MRS_TO_DISPLAY)
    .map(({ mergeRequest, status }) => formatMergeRequestMessage(mergeRequest, status));

  // Add link to remaining MRs if there are more than the display limit
  if (mergeRequests.length > GITLAB_CONFIG.MAX_MRS_TO_DISPLAY) {
    formattedMessages.push(
      createRemainingMergeRequestsLink(mergeRequests.length, GITLAB_CONFIG.MAX_MRS_TO_DISPLAY)
    );
  }

  return formattedMessages;
}