import { Octokit } from 'octokit';
import { getCached, setCached } from './redis';
import { logger } from '../lib/logger';

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN not configured');
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

interface DiffInfo {
  sha: string;
  author: string;
  message: string;
  timestamp: string;
  files: Array<{
    filename: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}

export async function getRecentDiffs(
  serviceName: string,
  hoursBack: number = 24
): Promise<string[]> {
  try {
    const cacheKey = `github:diffs:${serviceName}:${hoursBack}h`;
    const cached = await getCached<string[]>(cacheKey);
    if (cached) return cached;

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!owner || !repo) {
      logger.warn('GITHUB_CONFIG_MISSING', { owner, repo });
      return [];
    }

    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const client = getOctokit();

    // Get recent commits
    const { data: commits } = await client.rest.repos.listCommits({
      owner,
      repo,
      since,
      per_page: 20
    });

    const diffs: string[] = [];

    for (const commit of commits) {
      const { data: commitDetail } = await client.rest.repos.getCommit({
        owner,
        repo,
        ref: commit.sha
      });

      // Filter files related to the service
      const relevantFiles = commitDetail.files?.filter(file => 
        file.filename.toLowerCase().includes(serviceName.toLowerCase()) ||
        file.patch?.toLowerCase().includes(serviceName.toLowerCase())
      ) || [];

      if (relevantFiles.length > 0) {
        const diffInfo: DiffInfo = {
          sha: commit.sha.substring(0, 7),
          author: commit.commit.author?.name || 'Unknown',
          message: commit.commit.message.split('\n')[0],
          timestamp: commit.commit.author?.date || '',
          files: relevantFiles.map(f => ({
            filename: f.filename,
            additions: f.additions || 0,
            deletions: f.deletions || 0,
            patch: f.patch
          }))
        };

        diffs.push(formatDiff(diffInfo));
      }
    }

    // Cache for 5 minutes
    await setCached(cacheKey, diffs, 300);

    logger.info('GITHUB_DIFFS_FETCHED', {
      serviceName,
      diffCount: diffs.length,
      hoursBack
    });

    return diffs;
  } catch (error) {
    logger.error('GITHUB_FETCH_ERROR', error as Error, { serviceName });
    return [];
  }
}

function formatDiff(diff: DiffInfo): string {
  const filesSummary = diff.files
    .map(f => `  - ${f.filename} (+${f.additions}/-${f.deletions})`)
    .join('\n');

  let result = `Commit ${diff.sha} by ${diff.author} (${diff.timestamp})
Message: ${diff.message}
Files changed:
${filesSummary}`;

  // Include patches for small changes
  const smallPatches = diff.files
    .filter(f => f.patch && (f.additions + f.deletions) < 50)
    .map(f => f.patch)
    .join('\n');

  if (smallPatches) {
    result += `\nRelevant changes:\n${smallPatches}`;
  }

  return result;
}

export async function getFileContent(
  path: string,
  ref: string = 'main'
): Promise<string | null> {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!owner || !repo) {
      return null;
    }

    const client = getOctokit();
    const { data } = await client.rest.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if ('content' in data && data.type === 'file') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch (error) {
    logger.error('GITHUB_FILE_FETCH_ERROR', error as Error, { path });
    return null;
  }
}

export async function listRecentIssues(
  labels?: string[]
): Promise<Array<{ title: string; number: number; state: string; created_at: string }>> {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!owner || !repo) {
      return [];
    }

    const client = getOctokit();
    const { data: issues } = await client.rest.issues.listForRepo({
      owner,
      repo,
      labels: labels?.join(','),
      state: 'all',
      sort: 'created',
      direction: 'desc',
      per_page: 10
    });

    return issues.map(issue => ({
      title: issue.title,
      number: issue.number,
      state: issue.state,
      created_at: issue.created_at
    }));
  } catch (error) {
    logger.error('GITHUB_ISSUES_FETCH_ERROR', error as Error);
    return [];
  }
}