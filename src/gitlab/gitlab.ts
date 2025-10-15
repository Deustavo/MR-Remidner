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

// Board labels in order
const BOARD_LABELS = [
  'WIP::Dev',
  'WIP::Waiting Code Review',
  'WIP::Waiting QA',
  'WIP::QA',
  'WIP::Tested',
  'WIP::CSM',
  'WIP::Waiting Deploy'
] as const;

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
async function fetchMergeRequestDiscussions(projectId: number, mergeRequestIid: number): Promise<GitLabDiscussion[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${projectId}/merge_requests/${mergeRequestIid}/discussions`;
  return gitlabRequest<GitLabDiscussion[]>(url);
}

/**
 * Fetches approvals for a specific merge request
 */
async function fetchMergeRequestApprovals(projectId: number, mergeRequestIid: number): Promise<string[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${projectId}/merge_requests/${mergeRequestIid}/approvals`;
  const response = await gitlabRequest<{ approved_by: Array<{ user: { username: string } }> }>(url);
  return response.approved_by.map(approval => approval.user.username);
}

/**
 * Fetches related issues for a merge request
 */
async function fetchMergeRequestIssues(projectId: number, mergeRequestIid: number): Promise<GitLabIssue[]> {
  const url = `${GITLAB_CONFIG.API_URL}/projects/${projectId}/merge_requests/${mergeRequestIid}/related_issues`;
  return gitlabRequest<GitLabIssue[]>(url);
}

/**
 * Checks if an issue has open child items created by QA team members, excluding test cases
 */
async function hasOpenChildItems(issue: GitLabIssue): Promise<boolean> {
  try {
    const url = `${GITLAB_CONFIG.API_URL}/projects/${issue.project_id}/issues/${issue.iid}/links`;
    const response = await gitlabRequest<Array<{ 
      link_type?: string;
      state?: string;
      title?: string;
      author?: {
        username: string;
      };
    }>>(url);

    // Filter for child items opened by QA:
    // 1. Only open items (state === 'opened')
    // 2. Exclude items with "[Test Cases]" in the title
    // 3. Author must be in the QA team list
    const qaOpenChildren = response.filter(link => 
      link.state === 'opened' && 
      !link.title?.includes('[Test Cases]') &&
      link.author?.username && 
      GITLAB_CONFIG.QA_USERNAMES.includes(link.author.username)
    );
    
    if (qaOpenChildren.length > 0) {
      console.log(` └─ Issue #${issue.iid} has ${qaOpenChildren.length} open item(s) created by QA (excluding test cases)`);
    }
    
    return qaOpenChildren.length > 0;
  } catch (error) {
    // If we can't fetch links (e.g., no permission or 404), assume no open child items
    return false;
  }
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
    const issueLink = `<${relatedIssueLink}|linked issue>`;
    message += `> Check the ${issueLink} for pending subtasks or requested changes.\n`;
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
  [MergeRequestStatus.WAITING_CSM]: 6,
};

function getStatusPriority(status: MergeRequestStatusType): number {
  return STATUS_PRIORITIES[status];
}

/**
 * Checks if an issue has been approved by QA based on its labels
 */
function hasQaApprovalByLabels(issueLabels: string[]): boolean {
  const qaApprovedIndex = BOARD_LABELS.indexOf('WIP::Tested');
  
  return issueLabels.some(label => {
    const labelIndex = BOARD_LABELS.indexOf(label as any);
    return labelIndex >= qaApprovedIndex && labelIndex !== -1;
  });
}

/**
 * Checks if any related issue has a label containing "Blocked"
 */
function hasBlockedLabel(relatedIssues: GitLabIssue[]): boolean {
  return relatedIssues.some(issue => 
    issue.labels.some(label => 
      label.toLowerCase().includes('blocked')
    )
  );
}

/**
 * Checks if any related issue is in Waiting QA stage or beyond
 */
function isInQaStageOrBeyond(relatedIssues: GitLabIssue[]): boolean {
  const waitingQaIndex = BOARD_LABELS.indexOf('WIP::Waiting QA');
  
  return relatedIssues.some(issue => 
    issue.labels.some(label => {
      const labelIndex = BOARD_LABELS.indexOf(label as any);
      return labelIndex >= waitingQaIndex && labelIndex !== -1;
    })
  );
}

/**
 * Checks if any related issue is in CSM stage
 */
function isInCsmStage(relatedIssues: GitLabIssue[]): boolean {
  return relatedIssues.some(issue => 
    issue.labels.includes('WIP::CSM')
  );
}

/**
 * Checks if any related issue is ready to deploy (Tested or Waiting Deploy)
 */
function isReadyToDeploy(relatedIssues: GitLabIssue[]): boolean {
  return relatedIssues.some(issue => 
    issue.labels.includes('WIP::Tested') || 
    issue.labels.includes('WIP::Waiting Deploy')
  );
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

  // Check if QA requested changes by:
  // 1. Label "QA::Waiting to dev" OR
  // 2. Has open child items (subtasks)
  const hasQaWaitingLabel = relatedIssues.some(issue => 
    issue.labels.includes('QA::Waiting to dev')
  );

  if (hasQaWaitingLabel) {
    return MergeRequestStatus.CHANGES_REQUESTED_BY_QA;
  }

  // Check if any related issue has open child items
  const hasOpenChildItemsResults = await Promise.all(
    relatedIssues.map(issue => hasOpenChildItems(issue))
  );
  
  if (hasOpenChildItemsResults.some(hasOpen => hasOpen)) {
    return MergeRequestStatus.CHANGES_REQUESTED_BY_QA;
  }
  
  const readyToDeploy = isReadyToDeploy(relatedIssues);
  if (readyToDeploy) {
    return MergeRequestStatus.READY_TO_MERGE;
  }
  
  const isInCsm = isInCsmStage(relatedIssues);
  if (isInCsm) {
    return MergeRequestStatus.WAITING_CSM;
  }

  if (approvals.length > 0) {
    const hasQaApproval = relatedIssues.some(issue => hasQaApprovalByLabels(issue.labels));
    const hasMultipleApprovals = approvals.length > 1;
    
    if (hasMultipleApprovals && hasQaApproval) {
      return MergeRequestStatus.READY_TO_MERGE;
    }

    return MergeRequestStatus.WAITING_QA_REVIEW;
  }
  
  const isInQaStage = isInQaStageOrBeyond(relatedIssues);
  if (isInQaStage) {
    return MergeRequestStatus.WAITING_QA_REVIEW;
  }
  
  return MergeRequestStatus.WAITING_REVIEW;
}

/**
 * Processes a single merge request to determine its status
 */
async function processMergeRequest(mergeRequest: GitLabMergeRequest): Promise<MergeRequestWithStatus & { relatedIssues: GitLabIssue[] }> {
  try {
    const projectId = mergeRequest.project_id;
    const [discussions, approvals, relatedIssues] = await Promise.all([
      fetchMergeRequestDiscussions(projectId, mergeRequest.iid),
      fetchMergeRequestApprovals(projectId, mergeRequest.iid),
      fetchMergeRequestIssues(projectId, mergeRequest.iid)
    ]);

    const hasPendingThreads = discussions.some(discussion =>
      discussion.notes.some(note => note.resolvable && !note.resolved)
    );

    const status = await determineMergeRequestStatus(hasPendingThreads, approvals, relatedIssues);

    return { mergeRequest, status, relatedIssues };
  } catch (error) {
    console.error(`Error processing merge request #${mergeRequest.iid} (project ${mergeRequest.project_id}):`, error);
    throw error;
  }
}

/**
 * Fetches and formats open merge requests created by specific authors across all accessible projects
 */
export async function getMergeRequestsByAuthors(authorUsernames?: string[]): Promise<string[]> {
  const authors = authorUsernames || GITLAB_CONFIG.AUTHOR_USERNAMES;
  
  if (authors.length === 0) {
    console.log('⚠️  No author usernames configured. Set GITLAB_AUTHOR_USERNAMES in .env');
    return [];
  }

  console.log('🔍 Fetching Merge Requests by authors:', authors.join(', '));
  
  try {
    // Fetch MRs for all authors in parallel
    const allMergeRequestsArrays = await Promise.all(
      authors.map(async (username) => {
        const url = `${GITLAB_CONFIG.API_URL}/merge_requests?scope=all&state=opened&author_username=${username}`;
        const mergeRequests = await gitlabRequest<GitLabMergeRequest[]>(url);
        console.log(` └─ Found ${mergeRequests.length} merge requests for @${username}`);
        return mergeRequests;
      })
    );

    // Flatten and deduplicate merge requests (by project_id + iid combination)
    const allMergeRequests = allMergeRequestsArrays.flat();
    const uniqueMergeRequests = Array.from(
      new Map(allMergeRequests.map(mr => [`${mr.project_id}-${mr.iid}`, mr])).values()
    );

    console.log(` └─ Total: ${uniqueMergeRequests.length} unique merge requests`);

    // Filter out draft merge requests
    const nonDraftMergeRequests = uniqueMergeRequests.filter(mr => !mr.title.startsWith('Draft'));

    // Process MRs with their specific project IDs
    const processedMergeRequests = await Promise.all(
      nonDraftMergeRequests.map(async (mr) => {
        try {
          return await processMergeRequest(mr);
        } catch (error) {
          // If processing fails (e.g., insufficient permissions), return basic info
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`Could not fetch detailed info for MR !${mr.iid} (project ${mr.project_id}): ${errorMsg}. Using basic info.`);
          return {
            mergeRequest: mr,
            status: MergeRequestStatus.WAITING_REVIEW,
            relatedIssues: []
          };
        }
      })
    );

    // Filter out MRs with related issues that have "Blocked" labels
    const nonBlockedMergeRequests = processedMergeRequests.filter(({ relatedIssues }) => {
      const isBlocked = hasBlockedLabel(relatedIssues);
      if (isBlocked) {
        console.log(` └─ Filtering out MR: related issue has a "Blocked" label`);
      }
      return !isBlocked;
    });

    // Sort MRs by status priority
    nonBlockedMergeRequests.sort((a, b) => 
      getStatusPriority(a.status) - getStatusPriority(b.status)
    );

    // Format messages for the selected MRs
    return nonBlockedMergeRequests.map(({ mergeRequest, status, relatedIssues }) => 
      formatMergeRequestMessage(mergeRequest, status, relatedIssues)
    );
  } catch (error) {
    console.error('Error fetching merge requests by authors:', error);
    throw error;
  }
}