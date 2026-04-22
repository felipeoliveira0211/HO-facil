import type { TimeSegment } from "@/lib/timer";

/**
 * Derive start / pause-resume intervals / end times from time_segments.
 * - startedAt: started_at of the first segment
 * - endedAt: ended_at of the last segment if not running
 * - intervals: gaps between segments (pause periods) -> [pauseStart, resumeAt]
 */
export interface DerivedTimes {
  startedAt: string | null;
  endedAt: string | null;
  intervals: Array<{ from: string; to: string }>;
}

export function deriveTimes(segments: TimeSegment[]): DerivedTimes {
  if (!segments.length) return { startedAt: null, endedAt: null, intervals: [] };
  const sorted = [...segments].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );
  const startedAt = sorted[0].started_at;
  const last = sorted[sorted.length - 1];
  const endedAt = last.ended_at;
  const intervals: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (cur.ended_at) intervals.push({ from: cur.ended_at, to: next.started_at });
  }
  return { startedAt, endedAt, intervals };
}

export function toLocalTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
