import { Octokit } from "octokit";
import type { GitCommit } from "@/types";
import { isBlacklistedPath } from "@/lib/analysis/blacklist";
import { withConcurrencyLimit } from "@/lib/utils/concurrency";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const MAX_COMMITS = 100;
const MAX_FILE_CONTENT_CHARS = 300_000;
const FETCH_SOURCE_CONCURRENCY = 28;

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".cache",
]);

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".json",
  ".md",
  ".mdc",
]);

const MAX_JSONL_LINES = 200_000;
const MAX_JSONL_BYTES = 15 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Fetch file content from a repo (returns decoded string or null if not found).
// For files over 1MB, getContent returns content: null; we then fetch via git blob.
// ---------------------------------------------------------------------------
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ...(ref && { ref }),
    });

    if (Array.isArray(data)) return null;

    if (
      "content" in data &&
      data.content != null &&
      data.encoding === "base64"
    ) {
      let text = Buffer.from(data.content, "base64").toString("utf-8");
      if (text.length > MAX_FILE_CONTENT_CHARS) {
        text =
          text.slice(0, MAX_FILE_CONTENT_CHARS) +
          "\n[file truncated for analysis]";
      }
      return text;
    }

    if ("sha" in data && data.sha) {
      const { data: blob } = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: data.sha,
      });
      if (blob.encoding === "base64" && blob.content) {
        let text = Buffer.from(blob.content, "base64").toString("utf-8");
        if (text.length > MAX_FILE_CONTENT_CHARS) {
          text =
            text.slice(0, MAX_FILE_CONTENT_CHARS) +
            "\n[file truncated for analysis]";
        }
        return text;
      }
    }

    return null;
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    console.error(
      `[github] fetchFileContent error (${owner}/${repo}/${path}):`,
      error,
    );
    return null;
  }
}

/**
 * Fetch a JSONL file using raw content format.
 * Unlike fetchFileContent (limited to 300K chars and base64), this requests
 * raw content directly — works for files up to 100 MB without base64 overhead.
 */
export async function fetchJsonlContent(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner,
        repo,
        path,
        mediaType: { format: "raw" },
      },
    );

    if (typeof response.data !== "string") return null;
    if (!response.data) return null;
    return capJsonlForParsing(response.data);
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    console.error(
      `[github] fetchJsonlContent error (${owner}/${repo}/${path}):`,
      error,
    );
    return null;
  }
}

/** Cap string to at most MAX_JSONL_LINES lines and MAX_JSONL_BYTES UTF-8 bytes for safe parsing. */
export function capJsonlForParsing(raw: string): string {
  const maxBytes = MAX_JSONL_BYTES;
  if (raw.length <= maxBytes) {
    const lines = raw.split("\n");
    if (lines.length <= MAX_JSONL_LINES) return raw;
    return lines.slice(0, MAX_JSONL_LINES).join("\n");
  }
  let bytes = 0;
  let lineCount = 0;
  const lineEnd = "\n";
  let i = 0;
  while (i < raw.length && lineCount < MAX_JSONL_LINES && bytes < maxBytes) {
    const next = raw.indexOf(lineEnd, i);
    const end = next === -1 ? raw.length : next + 1;
    const chunk = raw.slice(i, end);
    bytes += Buffer.byteLength(chunk, "utf8");
    lineCount++;
    i = end;
  }
  return raw.slice(0, i);
}

// ---------------------------------------------------------------------------
// Fetch directory listing
// ---------------------------------------------------------------------------
export async function fetchDirectory(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<{ name: string; path: string; type: string }[]> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ...(ref && { ref }),
    });

    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type,
    }));
  } catch (error: unknown) {
    if (isNotFound(error)) return [];
    console.error(
      `[github] fetchDirectory error (${owner}/${repo}/${path}):`,
      error,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch commits with a cap to avoid excessive API use on large repos.
// ---------------------------------------------------------------------------
export async function fetchCommits(
  owner: string,
  repo: string,
): Promise<GitCommit[]> {
  try {
    const rawCommits: Awaited<
      ReturnType<typeof octokit.rest.repos.listCommits>
    >["data"] = [];
    let page = 1;
    const perPage = 100;

    while (rawCommits.length < MAX_COMMITS) {
      const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page,
      });
      if (data.length === 0) break;
      for (const c of data) {
        rawCommits.push(c);
        if (rawCommits.length >= MAX_COMMITS) break;
      }
      if (data.length < perPage) break;
      page++;
    }

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
    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });

    return {
      additions: data.stats?.additions ?? 0,
      deletions: data.stats?.deletions ?? 0,
      files: data.files?.map((f) => f.filename) ?? [],
    };
  } catch (error: unknown) {
    console.error(
      `[github] fetchCommitDetail error (${owner}/${repo}@${sha}):`,
      error,
    );
    return { additions: 0, deletions: 0, files: [] };
  }
}

// ---------------------------------------------------------------------------
// Compare two commits and return list of changed file paths
// ---------------------------------------------------------------------------
export async function fetchChangedFiles(
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
): Promise<string[]> {
  try {
    const { data } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseSha,
      head: headSha,
    });

    return (data.files ?? []).map((f) => f.filename);
  } catch (error: unknown) {
    console.error(
      `[github] fetchChangedFiles error (${owner}/${repo} ${baseSha}..${headSha}):`,
      error,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch specific files by path (for incremental analysis)
// ---------------------------------------------------------------------------
export async function fetchFilesByPaths(
  owner: string,
  repo: string,
  paths: string[],
  ref?: string,
): Promise<{ path: string; content: string }[]> {
  const results = await Promise.all(
    paths.map(async (path) => {
      const content = await fetchFileContent(owner, repo, path, ref);
      if (content === null) return null;
      return { path, content };
    }),
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
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
    console.error(
      `[github] fetchContributors error (${owner}/${repo}):`,
      error,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch package.json dependencies
// ---------------------------------------------------------------------------
export async function fetchPackageJson(
  owner: string,
  repo: string,
  ref?: string,
): Promise<{
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} | null> {
  const content = await fetchFileContent(owner, repo, "package.json", ref);
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
// Collect code file paths under a directory (no content).
// ---------------------------------------------------------------------------
async function collectSourcePaths(
  owner: string,
  repo: string,
  dirPath: string,
  paths: string[],
  ref?: string,
): Promise<void> {
  const entries = await fetchDirectory(owner, repo, dirPath, ref);

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.type === "dir") {
        if (IGNORED_DIRS.has(entry.name)) return;
        await collectSourcePaths(owner, repo, entry.path, paths, ref);
        return;
      }
      const ext = getExtension(entry.name);
      if (!CODE_EXTENSIONS.has(ext) || isBlacklistedPath(entry.path)) return;
      paths.push(entry.path);
    }),
  );
}

// ---------------------------------------------------------------------------
// Fetch all source files content (for AI analysis).
// Uses bounded concurrency to avoid rate limits on large repos.
// ---------------------------------------------------------------------------
export async function fetchSourceCode(
  owner: string,
  repo: string,
  ref?: string,
): Promise<{ path: string; content: string }[]> {
  const paths: string[] = [];
  await collectSourcePaths(owner, repo, "", paths, ref);

  const results = await withConcurrencyLimit(
    paths,
    FETCH_SOURCE_CONCURRENCY,
    async (path) => {
      const content = await fetchFileContent(owner, repo, path, ref);
      if (content === null) return null;
      return { path, content };
    },
  );

  return results.filter(
    (r): r is { path: string; content: string } => r !== null,
  );
}

// ---------------------------------------------------------------------------
// Fetch branches list
// ---------------------------------------------------------------------------
export async function fetchBranches(
  owner: string,
  repo: string,
): Promise<{ name: string; sha: string }[]> {
  try {
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    return data.map((b) => ({ name: b.name, sha: b.commit.sha }));
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

export function isSourcePath(path: string): boolean {
  return CODE_EXTENSIONS.has(getExtension(path)) && !isBlacklistedPath(path);
}
