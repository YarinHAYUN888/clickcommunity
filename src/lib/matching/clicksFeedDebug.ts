import type { FeedExclusionReport } from '@/lib/matching/clicksFeedBuilder';

export function logFeedExclusionSummary(
  viewerId: string,
  report: FeedExclusionReport,
  opts?: { isDev?: boolean; isSuperUser?: boolean },
): void {
  const isDev = opts?.isDev ?? import.meta.env.DEV;
  if (!isDev && !opts?.isSuperUser) return;

  console.groupCollapsed(`[clicksFeed] viewer=${viewerId.slice(0, 8)} tier=${report.selectedTier ?? 'none'}`);
  console.info('included', report.includedCount, 'excluded', report.excludedCounts);
  if (report.includedSample.length > 0) {
    console.table(report.includedSample);
  }
  console.groupEnd();
}
