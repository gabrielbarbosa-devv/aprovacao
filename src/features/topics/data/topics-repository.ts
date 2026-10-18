import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { TopicFields } from "@/features/topics/domain/schemas";

type TopicSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TopicInsert = Database["public"]["Tables"]["topics"]["Insert"];

export const topicsRepository = {
  getActiveSubject(supabase: TopicSupabaseClient, userId: string, subjectId: string) {
    return supabase.from("subjects").select("id, name")
      .eq("id", subjectId).eq("user_id", userId).is("archived_at", null).maybeSingle();
  },

  getSubjectTopics(supabase: TopicSupabaseClient, userId: string, subjectId: string) {
    return supabase.from("topics").select("id, subject_id, title, status, priority, sort_order, notes, source_url, estimated_minutes, archived_at")
      .eq("subject_id", subjectId).eq("user_id", userId)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  },

  getOpenBlocksForUser(supabase: TopicSupabaseClient, userId: string, topicIds: string[]) {
    if (topicIds.length === 0) return Promise.resolve({ data: [], error: null });
    return supabase.from("study_blocks").select("topic_id, status").eq("user_id", userId)
      .in("topic_id", topicIds).in("status", ["planejado", "em_andamento"]);
  },

  async create(supabase: TopicSupabaseClient, row: TopicInsert) {
    const { data: lastTopic, error: orderError } = await supabase.from("topics").select("sort_order")
      .eq("user_id", row.user_id).eq("subject_id", row.subject_id)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    if (orderError) return { error: orderError };
    return supabase.from("topics").insert({ ...row, sort_order: (lastTopic?.sort_order ?? 0) + 1 });
  },

  update(supabase: TopicSupabaseClient, userId: string, subjectId: string, id: string, fields: TopicFields) {
    return supabase.from("topics").update({
      title: fields.title,
      status: fields.status,
      priority: fields.priority,
      estimated_minutes: fields.estimatedMinutes,
      source_url: fields.sourceUrl,
      notes: fields.notes,
    }).eq("id", id).eq("user_id", userId).eq("subject_id", subjectId)
      .is("archived_at", null).select("id").maybeSingle();
  },

  changeStatus(supabase: TopicSupabaseClient, userId: string, subjectId: string, id: string, status: string) {
    return supabase.from("topics").update({ status }).eq("id", id).eq("subject_id", subjectId)
      .eq("user_id", userId).is("archived_at", null).select("id").maybeSingle();
  },

  changePriority(supabase: TopicSupabaseClient, userId: string, subjectId: string, id: string, priority: string) {
    return supabase.from("topics").update({ priority }).eq("id", id).eq("subject_id", subjectId)
      .eq("user_id", userId).is("archived_at", null).select("id").maybeSingle();
  },

  async archive(supabase: TopicSupabaseClient, userId: string, subjectId: string, id: string): Promise<string | null> {
    const { data: topic, error: topicError } = await supabase.from("topics").select("id")
      .eq("id", id).eq("subject_id", subjectId).eq("user_id", userId).is("archived_at", null).maybeSingle();
    if (topicError || !topic) return "not_found";
    const { count, error: countError } = await supabase.from("study_blocks")
      .select("id", { count: "exact", head: true }).eq("user_id", userId).eq("topic_id", id)
      .in("status", ["planejado", "em_andamento"]);
    if (countError) return null;
    const { data, error } = await supabase.rpc("archive_topic", {
      p_topic_id: id,
      p_expected_open_blocks: count ?? 0,
    });
    return error ? null : data;
  },

  restore(supabase: TopicSupabaseClient, userId: string, subjectId: string, id: string) {
    return supabase.from("topics").update({ archived_at: null })
      .eq("id", id).eq("subject_id", subjectId).eq("user_id", userId)
      .not("archived_at", "is", null).select("id").maybeSingle();
  },

  reorder(supabase: TopicSupabaseClient, subjectId: string, topicIds: string[]) {
    return supabase.rpc("reorder_topics", { p_subject_id: subjectId, p_topic_ids: topicIds });
  },
};
