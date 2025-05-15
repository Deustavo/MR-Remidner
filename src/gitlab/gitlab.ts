import axios, { AxiosError } from 'axios';
import { GITLAB_CONFIG, headers } from './config';
import {
  MergeRequestStatus,
  MergeRequestStatusType,
  GitLabMergeRequest,
  GitLabDiscussion,
  MergeRequestWithStatus,
  GitLabIssue
} from './types';

class GitLabError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'GitLabError';
  }
}

/**
 * Makes a GitLab API request with proper error handling
 */
async function gitlabRequest<T>(url: string): Promise<T> {
  try {
    const response = await axios.get<T>(url, { headers });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new GitLabError(
        `GitLab API request failed: ${error.message}`,
        error
      );
    }
    throw new GitLabError('Unknown error occurred during GitLab API request', error);
  }
}

/**
 * Fetches all discussions for a specific merge request
 */
async function fetchMergeRequestDiscussions(mergeRequestIid: number): Promise<GitLabDiscussion[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests/${mergeRequestIid}/discussions`;
  return gitlabRequest<GitLabDiscussion[]>(url);
}

/**
 * Fetches approvals for a specific merge request
 */
async function fetchMergeRequestApprovals(mergeRequestIid: number): Promise<string[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests/${mergeRequestIid}/approvals`;
  const response = await gitlabRequest<{ approved_by: Array<{ user: { username: string } }> }>(url);
  return response.approved_by.map(approval => approval.user.username);
}

/**
 * Fetches related issues for a merge request
 */
async function fetchMergeRequestIssues(mergeRequestIid: number): Promise<GitLabIssue[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests/${mergeRequestIid}/related_issues`;
  return gitlabRequest<GitLabIssue[]>(url);
}

/**
 * Formats a merge request message for display
 */
function formatMergeRequestMessage(
  mergeRequest: GitLabMergeRequest,
  status: string,
  relatedIssues: GitLabIssue[]
): string {
  const link = `<${mergeRequest.web_url}|${mergeRequest.title}>`;
  let message = `> ${link}\n> *Status:*  ${status}\n`;
  
  if (status === MergeRequestStatus.CHANGES_REQUESTED_BY_QA && relatedIssues.length > 0) {
    const relatedIssueLink = relatedIssues[0].web_url;
    const issueLink = `<${relatedIssueLink}#childitems|linked issue>`;
    message += `> See the subtasks listed in the ${issueLink}.\n`;
  }
  
  return message;
}

/**
 * Returns the priority of a status for sorting
 */
const STATUS_PRIORITIES: Record<MergeRequestStatusType, number> = {
  [MergeRequestStatus.READY_TO_MERGE]: 1,
  [MergeRequestStatus.WAITING_REVIEW]: 2,
  [MergeRequestStatus.THREADS_PENDING]: 3,
  [MergeRequestStatus.CHANGES_REQUESTED_BY_QA]: 4,
  [MergeRequestStatus.WAITING_QA_REVIEW]: 5,
};

function getStatusPriority(status: MergeRequestStatusType): number {
  return STATUS_PRIORITIES[status];
}

/**
 * Determines the status of a merge request based on its discussions, approvals and related issues
 */
async function determineMergeRequestStatus(
  hasPendingThreads: boolean,
  approvals: string[],
  relatedIssues: GitLabIssue[]
): Promise<MergeRequestStatusType> {
  if (hasPendingThreads) {
    return MergeRequestStatus.THREADS_PENDING;
  }

  const hasQaWaitingLabel = relatedIssues.some(issue => 
    issue.labels.includes('QA::Waiting to dev')
  );

  if (hasQaWaitingLabel) {
    return MergeRequestStatus.CHANGES_REQUESTED_BY_QA;
  }
  
  if (approvals.length > 0) {
    const hasQaApproval = approvals.includes(GITLAB_CONFIG.QA_REVIEWER_USERNAME);
    const hasMultipleApprovals = approvals.length > 1;
    
    if (hasMultipleApprovals && hasQaApproval) {
      return MergeRequestStatus.READY_TO_MERGE;
    }

    return MergeRequestStatus.WAITING_QA_REVIEW;
  }
  
  return MergeRequestStatus.WAITING_REVIEW;
}

/**
 * Processes a single merge request to determine its status
 */
async function processMergeRequest(mergeRequest: GitLabMergeRequest): Promise<MergeRequestWithStatus & { relatedIssues: GitLabIssue[] }> {
  try {
    const [discussions, approvals, relatedIssues] = await Promise.all([
      fetchMergeRequestDiscussions(mergeRequest.iid),
      fetchMergeRequestApprovals(mergeRequest.iid),
      fetchMergeRequestIssues(mergeRequest.iid)
    ]);

    const hasPendingThreads = discussions.some(discussion =>
      discussion.notes.some(note => note.resolvable && !note.resolved)
    );

    const status = await determineMergeRequestStatus(hasPendingThreads, approvals, relatedIssues);

    return { mergeRequest, status, relatedIssues };
  } catch (error) {
    console.error(`Error processing merge request #${mergeRequest.iid}:`, error);
    throw error;
  }
}

/**
 * Fetches and formats all open merge requests
 */
export async function getOpenMergeRequests(): Promise<string[]> {
  console.log('🔍 Fetching Merge Requests...');
  
  try {
    const url = `${GITLAB_CONFIG.API_URL}/projects/${GITLAB_CONFIG.PROJECT_ID}/merge_requests?state=opened`;
    const mergeRequests = await gitlabRequest<GitLabMergeRequest[]>(url);

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
    return processedMergeRequests.map(({ mergeRequest, status, relatedIssues }) => 
      formatMergeRequestMessage(mergeRequest, status, relatedIssues)
    );
  } catch (error) {
    console.error('Error fetching merge requests:', error);
    throw error;
  }
}