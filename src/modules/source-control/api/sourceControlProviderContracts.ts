export type ProviderKind = "github" | "gitlab" | "bitbucket" | "azure-devops";

export interface ProviderCredentialSaveInput {
  kind: ProviderKind;
  account: string;
  secret: string;
}

export interface ProviderCredentialRef {
  credentialId: string;
}

export interface ProviderCredentialSaveResult {
  credentialId: string;
  kind: ProviderKind;
  account: string;
}

export interface ProviderCredentialStatus {
  credentialId: string;
  kind: ProviderKind;
  account: string;
  found: boolean;
}

export interface ProviderListRepositoriesInput {
  credentialId: string;
  page: number;
  perPage: number;
}

export interface ProviderGetRepositoryInput {
  credentialId: string;
  organization?: string | null;
  owner: string;
  repo: string;
}

export interface ProviderCreateRepositoryInput {
  credentialId: string;
  organization?: string | null;
  owner: string;
  name: string;
  description?: string | null;
  private: boolean;
}

export interface ProviderListPullRequestsInput {
  credentialId: string;
  organization?: string | null;
  owner: string;
  repo: string;
  state: string;
  page: number;
  perPage: number;
}

export interface ProviderGetPullRequestInput {
  credentialId: string;
  organization?: string | null;
  owner: string;
  repo: string;
  number: number;
}

export interface ProviderCreatePullRequestInput {
  credentialId: string;
  organization?: string | null;
  owner: string;
  repo: string;
  title: string;
  description?: string | null;
  sourceBranch: string;
  targetBranch: string;
}

export interface ProviderCreateReleaseInput {
  credentialId: string;
  organization?: string | null;
  owner: string;
  repo: string;
  tagName: string;
  name?: string | null;
  description?: string | null;
  draft: boolean;
  prerelease: boolean;
}

export interface ProviderRepository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string | null;
  private: boolean;
  cloneUrl: string;
  htmlUrl: string;
  owner: string;
  updatedAt: string | null;
}

export type ProviderPrState = "open" | "closed" | "merged";

export interface ProviderPullRequest {
  id: string;
  number: number;
  title: string;
  description: string | null;
  state: ProviderPrState;
  sourceBranch: string;
  targetBranch: string;
  htmlUrl: string;
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProviderPaginatedResult<T> {
  items: T[];
  total: number | null;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ProviderRelease {
  id: string;
  tagName: string;
  name: string | null;
  description: string | null;
  draft: boolean;
  prerelease: boolean;
  htmlUrl: string;
  createdAt: string | null;
}

export interface ProviderReleaseCapability {
  kind: ProviderKind;
  supportsNativeReleases: boolean;
  description: string;
}

export interface ProviderError {
  authFailed?: { message: string };
  notFound?: { message: string };
  rateLimited?: { message: string };
  networkError?: { message: string };
  providerError?: { message: string };
}
