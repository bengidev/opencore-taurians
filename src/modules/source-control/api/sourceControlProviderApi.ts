import { invoke } from "@tauri-apps/api/core";
import type {
  ProviderCreatePullRequestInput,
  ProviderCreateReleaseInput,
  ProviderCreateRepositoryInput,
  ProviderCredentialRef,
  ProviderCredentialSaveInput,
  ProviderCredentialSaveResult,
  ProviderCredentialStatus,
  ProviderGetPullRequestInput,
  ProviderGetRepositoryInput,
  ProviderListPullRequestsInput,
  ProviderListRepositoriesInput,
  ProviderPaginatedResult,
  ProviderPullRequest,
  ProviderRelease,
  ProviderReleaseCapability,
  ProviderRepository,
} from "./sourceControlProviderContracts";

export interface ProviderApi {
  saveCredential(input: ProviderCredentialSaveInput): Promise<ProviderCredentialSaveResult>;
  credentialStatus(input: ProviderCredentialRef): Promise<ProviderCredentialStatus>;
  deleteCredential(input: ProviderCredentialRef): Promise<void>;
  listRepositories(input: ProviderListRepositoriesInput): Promise<ProviderPaginatedResult<ProviderRepository>>;
  getRepository(input: ProviderGetRepositoryInput): Promise<ProviderRepository>;
  createRepository(input: ProviderCreateRepositoryInput): Promise<ProviderRepository>;
  listPullRequests(input: ProviderListPullRequestsInput): Promise<ProviderPaginatedResult<ProviderPullRequest>>;
  getPullRequest(input: ProviderGetPullRequestInput): Promise<ProviderPullRequest>;
  createPullRequest(input: ProviderCreatePullRequestInput): Promise<ProviderPullRequest>;
  createRelease(input: ProviderCreateReleaseInput): Promise<ProviderRelease>;
  releaseCapabilities(): Promise<ProviderReleaseCapability[]>;
}

export function createTauriProviderApi(): ProviderApi {
  return {
    saveCredential: (input) => invoke("provider_credential_save", { input }),
    credentialStatus: (input) => invoke("provider_credential_status", { input }),
    deleteCredential: (input) => invoke("provider_credential_delete", { input }),
    listRepositories: (input) => invoke("provider_list_repositories", { input }),
    getRepository: (input) => invoke("provider_get_repository", { input }),
    createRepository: (input) => invoke("provider_create_repository", { input }),
    listPullRequests: (input) => invoke("provider_list_pull_requests", { input }),
    getPullRequest: (input) => invoke("provider_get_pull_request", { input }),
    createPullRequest: (input) => invoke("provider_create_pull_request", { input }),
    createRelease: (input) => invoke("provider_create_release", { input }),
    releaseCapabilities: () => invoke("provider_release_capabilities"),
  };
}
