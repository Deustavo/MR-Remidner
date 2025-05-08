export const MergeRequestStatus = {
  READY_TO_MERGE: '✅ Ready to Merge',
  WAITING_REVIEW: '🕵️‍♂️ Waiting Code Review',
  THREADS_PENDING: '💬 Threads Pending',
  WAITING_QA_REVIEW: '🔍 Waiting QA Review',
  CHANGES_REQUESTED_BY_QA: '🛠️ Changes Requested by QA',
} as const;

export type MergeRequestStatusType = typeof MergeRequestStatus[keyof typeof MergeRequestStatus];

export interface GitLabUser {
  username: string;
}

export interface GitLabApproval {
  user: GitLabUser;
}

export interface GitLabNote {
  resolvable: boolean;
  resolved: boolean;
}

export interface GitLabDiscussion {
  notes: GitLabNote[];
}

export interface GitLabMergeRequest {
  iid: number;
  title: string;
  web_url: string;
  labels: string[];
}

export interface GitLabIssue {
  web_url: string;
  labels: string[];
}

export interface MergeRequestWithStatus {
  mergeRequest: GitLabMergeRequest;
  status: MergeRequestStatusType;
} 