import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimeSegment {
  id: string;
  evaluation_id: string;
  started_at: string;
  ended_at: string | null;
}

/**
 * Computes elapsed seconds from time_segments. Server-driven: sum of completed
 * segments + (now - started_at) for an open segment. Ticks every second locally.
 */
export function computeElapsedSeconds(segments: TimeSegment[], now = Date.now()): number {
  let total = 0;
  for (const s of segments) {
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    total += Math.max(0, (end - start) / 1000);
  }
  return total;
}

export function isRunning(segments: TimeSegment[]): boolean {
  return segments.some((s) => s.ended_at === null);
}

export function useLiveElapsed(segments: TimeSegment[]) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!isRunning(segments)) return;
    const i = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(i);
  }, [segments]);
  return computeElapsedSeconds(segments);
}

export async function startTimer(evaluationId: string, userId: string) {
  // Close any open segment first (defensive)
  await supabase
    .from("time_segments")
    .update({ ended_at: new Date().toISOString() })
    .eq("evaluation_id", evaluationId)
    .is("ended_at", null);
  const { error } = await supabase
    .from("time_segments")
    .insert({ evaluation_id: evaluationId, user_id: userId });
  if (error) throw error;
  await supabase
    .from("evaluations")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", evaluationId)
    .is("started_at", null);
  await supabase.from("evaluations").update({ status: "in_progress" }).eq("id", evaluationId);
}

export async function pauseTimer(evaluationId: string) {
  const { error } = await supabase
    .from("time_segments")
    .update({ ended_at: new Date().toISOString() })
    .eq("evaluation_id", evaluationId)
    .is("ended_at", null);
  if (error) throw error;
  await supabase.from("evaluations").update({ status: "paused" }).eq("id", evaluationId);
}

export async function fetchSegments(evaluationId: string): Promise<TimeSegment[]> {
  const { data, error } = await supabase
    .from("time_segments")
    .select("id, evaluation_id, started_at, ended_at")
    .eq("evaluation_id", evaluationId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
