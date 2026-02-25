import {
  fetchCommits,
  fetchCommitDetail,
  fetchContributors,
  fetchBranches,
} from "@/lib/github/client";
import { isBlacklistedPath } from "@/lib/analysis/blacklist";
import { withConcurrencyLimit } from "@/lib/utils/concurrency";
import type { GitMetrics, GitCommit } from "@/types";

// ---------------------------------------------------------------------------
// Main analyzer: fetches Git history and builds aggregated metrics
// ---------------------------------------------------------------------------
export async function analyzeGit(
  owner: string,
  repo: string,
): Promise<GitMetrics> {
  const [rawCommits, branches] = await Promise.all([
    fetchCommits(owner, repo),
    fetchBranches(owner, repo),
  ]);

  const allWithDate = rawCommits.filter((c) => c.date);
  const allSortedByDate = [...allWithDate].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const boilerplateSha = allSortedByDate[0]?.sha;
  const rawWithoutBoilerplate = boilerplateSha
    ? rawCommits.filter((c) => c.sha !== boilerplateSha)
    : rawCommits;

  const commitsToDetail = rawWithoutBoilerplate.slice(0, 100);

  const commits = await withConcurrencyLimit(
    commitsToDetail,
    12,
    async (commit) => {
      const detail = await fetchCommitDetail(owner, repo, commit.sha);
      const files = detail.files.filter((f) => !isBlacklistedPath(f));
      return {
        ...commit,
        additions: detail.additions,
        deletions: detail.deletions,
        files,
      };
    },
  );

  const commitsByHour: Record<number, number> = {};
  for (const commit of rawWithoutBoilerplate) {
    if (commit.date) {
      const hour = new Date(commit.date).getUTCHours();
      commitsByHour[hour] = (commitsByHour[hour] ?? 0) + 1;
    }
  }

  let additions = 0;
  let deletions = 0;
  for (const commit of commits) {
    additions += commit.additions;
    deletions += commit.deletions;
  }

  const fileSet = new Set<string>();
  for (const commit of commits) {
    for (const file of commit.files) {
      if (!isBlacklistedPath(file)) fileSet.add(file);
    }
  }

  const authorSet = new Set<string>();
  const commitsByAuthor: Record<string, number> = {};
  for (const commit of rawWithoutBoilerplate) {
    if (commit.author) {
      authorSet.add(commit.author);
      commitsByAuthor[commit.author] =
        (commitsByAuthor[commit.author] ?? 0) + 1;
    }
  }

  let firstCommitAt: string | undefined;
  let lastCommitAt: string | undefined;

  const sortedForTimestamps = rawWithoutBoilerplate
    .filter((c) => c.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sortedForTimestamps.length > 0) {
    firstCommitAt = sortedForTimestamps[0].date;
    lastCommitAt = sortedForTimestamps[sortedForTimestamps.length - 1].date;
  }

  return {
    commits,
    totalCommits: rawWithoutBoilerplate.length,
    authors: Array.from(authorSet),
    commitsByAuthor,
    additions,
    deletions,
    filesChanged: Array.from(fileSet),
    commitsByHour,
    firstCommitAt,
    lastCommitAt,
    branchCount: branches.length,
  };
}

// ---------------------------------------------------------------------------
// Helper: Calculate commit regularity score (0-1)
// High regularity = commits spread evenly over time
// Low regularity = all commits bunched together
// ---------------------------------------------------------------------------
export function getCommitRegularity(commits: GitCommit[]): number {
  if (commits.length <= 1) return 0;

  // Sort commits by date
  const sorted = [...commits]
    .filter((c) => c.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length <= 1) return 0;

  // Calculate time gaps between consecutive commits (in ms)
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      new Date(sorted[i].date).getTime() -
      new Date(sorted[i - 1].date).getTime();
    gaps.push(gap);
  }

  // Calculate mean of gaps
  const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;

  if (mean === 0) return 0;

  // Calculate standard deviation
  const variance =
    gaps.reduce((sum, g) => sum + (g - mean) ** 2, 0) / gaps.length;
  const stddev = Math.sqrt(variance);

  // Coefficient of variation
  const cv = stddev / mean;

  // Map to 0-1 scale: lower CV = more regular = higher score
  return 1 / (1 + cv);
}

// ---------------------------------------------------------------------------
// Helper: Check if commit messages are "clean" (no wip/fix typo/oops/etc)
// ---------------------------------------------------------------------------
export function hasCleanHistory(commits: GitCommit[]): boolean {
  const dirtyPattern = /^(fix|wip|oops|typo|temp|test|asdf|TODO)/i;
  const dirtyContentPattern = /fix typo|wip|oops/i;

  for (const commit of commits) {
    // Skip merge commits
    if (commit.message.startsWith("Merge ")) continue;

    if (
      dirtyPattern.test(commit.message) ||
      dirtyContentPattern.test(commit.message)
    ) {
      return false;
    }
  }

  return true;
}

const EMOJI_PATTERN =
  /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|:[a-zA-Z0-9_+-]+:)/u;

export function allCommitsHaveEmoji(commits: GitCommit[]): boolean {
  if (commits.length === 0) return false;
  return commits.every((commit) => EMOJI_PATTERN.test(commit.message));
}

export function countCommitsWithEmoji(commits: GitCommit[]): number {
  return commits.filter((commit) => EMOJI_PATTERN.test(commit.message)).length;
}

// ---------------------------------------------------------------------------
// Helper: Find the longest meaningful commit message
// ---------------------------------------------------------------------------
export function getLongestCommitMessage(
  commits: GitCommit[],
): { sha: string; message: string; length: number } | null {
  if (commits.length === 0) return null;

  let longest: { sha: string; message: string; length: number } | null = null;

  for (const commit of commits) {
    // Skip merge commits as they are auto-generated
    if (commit.message.startsWith("Merge ")) continue;

    const length = commit.message.length;
    if (longest === null || length > longest.length) {
      longest = { sha: commit.sha, message: commit.message, length };
    }
  }

  return longest;
}

// ---------------------------------------------------------------------------
// Helper: Find commits with large diffs (additions + deletions > threshold)
// ---------------------------------------------------------------------------
export function getLargeCommits(
  commits: GitCommit[],
  threshold: number,
): GitCommit[] {
  return commits.filter(
    (commit) => commit.additions + commit.deletions > threshold,
  );
}

// ---------------------------------------------------------------------------
// Helper: Count max consecutive hours with at least one commit
// ---------------------------------------------------------------------------
export function getMaxConsecutiveHours(commits: GitCommit[]): number {
  if (commits.length === 0) return 0;

  // Collect unique hours (as absolute hour offsets from epoch) that have commits
  const hoursWithCommits = new Set<number>();

  for (const commit of commits) {
    if (!commit.date) continue;
    const ts = new Date(commit.date).getTime();
    // Floor to the hour
    const hourKey = Math.floor(ts / (1000 * 60 * 60));
    hoursWithCommits.add(hourKey);
  }

  if (hoursWithCommits.size === 0) return 0;

  // Sort the hours
  const sortedHours = Array.from(hoursWithCommits).sort((a, b) => a - b);

  let maxConsecutive = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedHours.length; i++) {
    if (sortedHours[i] === sortedHours[i - 1] + 1) {
      currentStreak++;
      maxConsecutive = Math.max(maxConsecutive, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxConsecutive;
}
