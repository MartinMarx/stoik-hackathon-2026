import { Octokit } from "octokit";
import type { GitCommit } from "@/types";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md", ".mdc",
]);

const IGNORED_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", ".turbo", ".cache",
]);

// ---------------------------------------------------------------------------
// Fetch file content from a repo (returns decoded string or null if not found)
// ---------------------------------------------------------------------------
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });

    if ("content" in data && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    return null;
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    console.error(`[github] fetchFileContent error (${owner}/${repo}/${path}):`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch directory listing
// ---------------------------------------------------------------------------
export async function fetchDirectory(
  owner: string,
  repo: string,
  path: string,
): Promise<{ name: string; path: string; type: string }[]> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });

    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type,
    }));
  } catch (error: unknown) {
    if (isNotFound(error)) return [];
    console.error(`[github] fetchDirectory error (${owner}/${repo}/${path}):`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch all commits with pagination
// ---------------------------------------------------------------------------
export async function fetchCommits(
  owner: string,
  repo: string,
): Promise<GitCommit[]> {
  try {
    const rawCommits = await octokit.paginate(
      octokit.rest.repos.listCommits,
      { owner, repo, per_page: 100 },
    );

    return rawCommits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name ?? "unknown",
      email: c.commit.author?.email ?? "",
      date: c.commit.author?.date ?? "",
      additions: 0,
      deletions: 0,
      files: [],
    }));
  } catch (error: unknown) {
    console.error(`[github] fetchCommits error (${owner}/${repo}):`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch a single commit's stats
// ---------------------------------------------------------------------------
export async function fetchCommitDetail(
  owner: string,
  repo: string,
  sha: string,
): Promise<{ additions: number; deletions: number; files: string[] }> {
  try {
    const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });

    return {
      additions: data.stats?.additions ?? 0,
      deletions: data.stats?.deletions ?? 0,
      files: data.files?.map((f) => f.filename) ?? [],
    };
  } catch (error: unknown) {
    console.error(`[github] fetchCommitDetail error (${owner}/${repo}@${sha}):`, error);
    return { additions: 0, deletions: 0, files: [] };
  }
}

// ---------------------------------------------------------------------------
// Fetch contributors
// ---------------------------------------------------------------------------
export async function fetchContributors(
  owner: string,
  repo: string,
): Promise<{ login: string; contributions: number; avatarUrl: string }[]> {
  try {
    const { data } = await octokit.rest.repos.listContributors({
      owner,
      repo,
      per_page: 100,
    });

    return data.map((c) => ({
      login: c.login ?? "unknown",
      contributions: c.contributions,
      avatarUrl: c.avatar_url ?? "",
    }));
  } catch (error: unknown) {
    console.error(`[github] fetchContributors error (${owner}/${repo}):`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch package.json dependencies
// ---------------------------------------------------------------------------
export async function fetchPackageJson(
  owner: string,
  repo: string,
): Promise<{
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} | null> {
  const content = await fetchFileContent(owner, repo, "package.json");
  if (!content) return null;

  try {
    const pkg = JSON.parse(content);
    return {
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
    };
  } catch {
    console.error(`[github] Failed to parse package.json for ${owner}/${repo}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch all source files content (for AI analysis)
// Recursively fetches src/ and app/ directories, filtering for code files.
// ---------------------------------------------------------------------------
export async function fetchSourceCode(
  owner: string,
  repo: string,
): Promise<{ path: string; content: string }[]> {
  const results: { path: string; content: string }[] = [];

  async function crawl(dirPath: string): Promise<void> {
    const entries = await fetchDirectory(owner, repo, dirPath);

    await Promise.all(
      entries.map(async (entry) => {
        // Skip ignored directories
        if (entry.type === "dir") {
          if (IGNORED_DIRS.has(entry.name)) return;
          await crawl(entry.path);
          return;
        }

        // Only process code files
        const ext = getExtension(entry.name);
        if (!CODE_EXTENSIONS.has(ext)) return;

        const content = await fetchFileContent(owner, repo, entry.path);
        if (content !== null) {
          results.push({ path: entry.path, content });
        }
      }),
    );
  }

  // Crawl both src/ and app/ in parallel
  await Promise.all([crawl("src"), crawl("app")]);

  return results;
}

// ---------------------------------------------------------------------------
// Fetch branches list
// ---------------------------------------------------------------------------
export async function fetchBranches(
  owner: string,
  repo: string,
): Promise<string[]> {
  try {
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    return data.map((b) => b.name);
  } catch (error: unknown) {
    console.error(`[github] fetchBranches error (${owner}/${repo}):`, error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 404
  );
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot);
}
