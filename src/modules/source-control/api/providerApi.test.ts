import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createTauriProviderApi } from "./providerApi";
import type {
  ProviderCredentialSaveResult,
  ProviderCredentialStatus,
  ProviderReleaseCapability,
} from "./providerContracts";

describe("createTauriProviderApi", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("invokes credential save with camelCase payload", async () => {
    const saved: ProviderCredentialSaveResult = {
      credentialId: "cred-1",
      kind: "github",
      account: "octocat",
    };
    invokeMock.mockResolvedValue(saved);

    const api = createTauriProviderApi();
    const result = await api.saveCredential({
      kind: "github",
      account: "octocat",
      secret: "ghp_secret",
    });

    expect(invokeMock).toHaveBeenCalledWith("provider_credential_save", {
      input: {
        kind: "github",
        account: "octocat",
        secret: "ghp_secret",
      },
    });
    expect(result.credentialId).toBe("cred-1");
    expect(JSON.stringify(result)).not.toContain("ghp_secret");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("invokes credential status without returning secrets", async () => {
    const status: ProviderCredentialStatus = {
      credentialId: "cred-1",
      kind: "gitlab",
      account: "dev",
      found: true,
    };
    invokeMock.mockResolvedValue(status);

    const api = createTauriProviderApi();
    const result = await api.credentialStatus({ credentialId: "cred-1" });

    expect(invokeMock).toHaveBeenCalledWith("provider_credential_status", {
      input: { credentialId: "cred-1" },
    });
    expect(result.found).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("invokes repository list with credential id", async () => {
    invokeMock.mockResolvedValue({
      items: [],
      total: null,
      hasMore: false,
      nextCursor: null,
    });

    const api = createTauriProviderApi();
    await api.listRepositories({ credentialId: "cred-1", page: 1, perPage: 30 });

    expect(invokeMock).toHaveBeenCalledWith("provider_list_repositories", {
      input: { credentialId: "cred-1", page: 1, perPage: 30 },
    });
  });

  it("invokes release capabilities", async () => {
    const capabilities: ProviderReleaseCapability[] = [
      {
        kind: "github",
        supportsNativeReleases: true,
        description: "GitHub Releases",
      },
    ];
    invokeMock.mockResolvedValue(capabilities);

    const api = createTauriProviderApi();
    const result = await api.releaseCapabilities();

    expect(invokeMock).toHaveBeenCalledWith("provider_release_capabilities");
    expect(result[0]?.kind).toBe("github");
  });

  it("invokes create release with camelCase payload and no token field", async () => {
    invokeMock.mockResolvedValue({
      id: "99",
      tagName: "v1.0.0",
      name: "v1.0.0",
      description: null,
      draft: false,
      prerelease: false,
      htmlUrl: "https://github.com/acme/app/releases/tag/v1.0.0",
      createdAt: null,
    });

    const api = createTauriProviderApi();
    await api.createRelease({
      credentialId: "cred-1",
      owner: "acme",
      repo: "app",
      tagName: "v1.0.0",
      draft: false,
      prerelease: false,
    });

    expect(invokeMock).toHaveBeenCalledWith("provider_create_release", {
      input: {
        credentialId: "cred-1",
        owner: "acme",
        repo: "app",
        tagName: "v1.0.0",
        draft: false,
        prerelease: false,
      },
    });
    const payload = JSON.stringify(invokeMock.mock.calls[0]?.[1]);
    expect(payload).not.toContain("token");
    expect(payload).not.toContain("secret");
  });
});
