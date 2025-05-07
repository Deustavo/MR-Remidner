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
 * Fetches related issues for a merge request
 */
async function fetchMergeRequestIssues(mergeRequestIid: number): Promise<any[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests/${mergeRequestIid}/related_issues`;
  const response = await axios.get(url, { headers });
  return response.data;
}

/**
 * Formats a merge request message for display
 */
function formatMergeRequestMessage(mergeRequest: GitLabMergeRequest, status: string): string {
  const link = `<${mergeRequest.web_url}|${mergeRequest.title}>`;
  return `> ${link}\n> *Status:*  ${status}\n`;
}

/**
 * Returns the priority of a status for sorting
 */
function getStatusPriority(status: MergeRequestStatusType): number {
  const priorities: { [key in MergeRequestStatusType]: number } = {
    [MergeRequestStatus.READY_TO_MERGE]: 1,
    [MergeRequestStatus.WAITING_REVIEW]: 2,
    [MergeRequestStatus.THREADS_PENDING]: 3,
    [MergeRequestStatus.CHANGES_REQUESTED]: 4,
    [MergeRequestStatus.WAITING_QA_REVIEW]: 5,
  };
  return priorities[status];
}

/**
 * Determines the status of a merge request based on its discussions, approvals and related issues
 */
async function determineMergeRequestStatus(
  hasPendingThreads: boolean,
  approvals: string[],
  mergeRequestIid: number
): Promise<MergeRequestStatusType> {
  if (hasPendingThreads) {
    return MergeRequestStatus.THREADS_PENDING;
  }
  
  if (approvals.length > 0) {
    // If there are more than one approval and the QA reviewer is one of them, the MR is ready to merge
    if (
      approvals.length > 1 &&
      approvals.includes(GITLAB_CONFIG.QA_REVIEWER_USERNAME)
    ) {
      return MergeRequestStatus.READY_TO_MERGE;
    }

    // Check for related issues with QA::Waiting to dev label
    const relatedIssues = await fetchMergeRequestIssues(mergeRequestIid);
    const hasQaWaitingLabel = relatedIssues.some(issue => 
      issue.labels.includes('QA::Waiting to dev')
    );

    if (hasQaWaitingLabel) {
      return MergeRequestStatus.CHANGES_REQUESTED;
    }

    return MergeRequestStatus.WAITING_QA_REVIEW;
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

  const status = await determineMergeRequestStatus(hasPendingThreads, approvals, mergeRequest.iid);

  return { mergeRequest, status };
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

  // Filter out draft merge requests and process the remaining ones
  const nonDraftMergeRequests = mergeRequests.filter(mr => !mr.title.startsWith('Draft'));
  const processedMergeRequests = await Promise.all(
    nonDraftMergeRequests.map(processMergeRequest)
  );

  // Sort MRs by status priority
  processedMergeRequests.sort((a, b) => 
    getStatusPriority(a.status) - getStatusPriority(b.status)
  );

  // Format messages for the selected MRs
  const formattedMessages = processedMergeRequests
    .map(({ mergeRequest, status }) => formatMergeRequestMessage(mergeRequest, status));

  return formattedMessages;
}