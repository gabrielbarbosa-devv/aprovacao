export type TopicAttempt = {
  topicId: string;
  topic: string;
  subject: string;
  questions: number;
  correct: number;
};

export type ReinforcementRecommendation = TopicAttempt & {
  accuracy: number | null;
  sampleSufficient: boolean;
  flaggedForReview: boolean;
  signal: "high" | "monitor" | "insufficient";
};

export function recommendReinforcement(
  attempts: TopicAttempt[],
  flaggedTopicIds: ReadonlySet<string>,
  minimumSample = 10,
  threshold = 70,
): ReinforcementRecommendation[] {
  return attempts.map((attempt) => {
    const sampleSufficient = attempt.questions >= minimumSample;
    const accuracy = attempt.questions > 0 ? Math.round(attempt.correct / attempt.questions * 1000) / 10 : null;
    const flaggedForReview = flaggedTopicIds.has(attempt.topicId);
    const signal: ReinforcementRecommendation["signal"] = !sampleSufficient ? "insufficient" : (accuracy ?? 100) < threshold ? "high" : "monitor";
    return { ...attempt, accuracy, sampleSufficient, flaggedForReview, signal };
  }).sort((a, b) => {
    const severity = { high: 0, insufficient: 1, monitor: 2 } as const;
    return severity[a.signal] - severity[b.signal] || (a.accuracy ?? 101) - (b.accuracy ?? 101) || a.topic.localeCompare(b.topic, "pt-BR");
  });
}

export type ReplanBlock = {
  id: string;
  topicId: string;
  subject: string;
  topic: string;
  date: string;
  minutes: number;
  startTime: string | null;
  status: "planejado" | "em_andamento" | "concluido" | "ignorado";
  pinned: boolean;
  updatedAt: string;
  protectedByExam: boolean;
};

export type ProposedBlockChange = {
  blockId: string;
  before: ReplanBlock;
  after: ReplanBlock;
};

/** Swaps a future unpinned topic block into reinforcement and relocates its displaced topic. */
export function buildReplanPreview(input: {
  blocks: ReplanBlock[];
  selected: ReinforcementRecommendation[];
  displaceableTopicIds: ReadonlySet<string>;
  today: string;
  dailyGoalMinutes: number;
}): ProposedBlockChange[] {
  const { blocks, selected, displaceableTopicIds, today, dailyGoalMinutes } = input;
  const alreadySelected = new Set(selected.map(({ topicId }) => topicId));
  const allocations = new Map<string, number>();
  for (const block of blocks) {
    if (block.status !== "ignorado") allocations.set(block.date, (allocations.get(block.date) ?? 0) + block.minutes);
  }
  const futureEligible = blocks.filter((block) => block.date >= today && block.status === "planejado" && !block.pinned && !block.protectedByExam);
  const changed = new Set<string>();
  const output: ProposedBlockChange[] = [];

  for (const recommendation of selected) {
    if (recommendation.signal !== "high") continue;
    const source = futureEligible.find((block) => !changed.has(block.id) && !alreadySelected.has(block.topicId)
      && block.topicId !== recommendation.topicId && displaceableTopicIds.has(block.topicId));
    if (!source || dailyGoalMinutes <= 0) continue;
    const displaced = futureEligible.find((block) => block.id !== source.id && !changed.has(block.id)
      && block.date === source.date && !alreadySelected.has(block.topicId) && displaceableTopicIds.has(block.topicId));
    if (!displaced) continue;
    let destination = "";
    for (let offset = 1; offset <= 365; offset += 1) {
      const candidate = addDays(source.date, offset);
      const overlaps = blocks.some((block) => block.date === candidate && block.status !== "ignorado"
        && hasTimeOverlap(block.startTime, block.minutes, displaced.startTime, displaced.minutes));
      if ((allocations.get(candidate) ?? 0) + displaced.minutes <= dailyGoalMinutes && !overlaps) {
        destination = candidate;
        break;
      }
    }
    if (!destination) continue;

    const afterSource = { ...source, topicId: recommendation.topicId, subject: recommendation.subject, topic: recommendation.topic };
    output.push({ blockId: source.id, before: source, after: afterSource });
    output.push({ blockId: displaced.id, before: displaced, after: { ...displaced, date: destination } });
    changed.add(source.id);
    changed.add(displaced.id);
    allocations.set(source.date, (allocations.get(source.date) ?? 0) - displaced.minutes);
    allocations.set(destination, (allocations.get(destination) ?? 0) + displaced.minutes);
  }
  return output;
}

function hasTimeOverlap(leftStart: string | null, leftMinutes: number, rightStart: string | null, rightMinutes: number): boolean {
  if (leftStart === null || rightStart === null) return false;
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const left = toMinutes(leftStart);
  const right = toMinutes(rightStart);
  return left < right + rightMinutes && right < left + leftMinutes;
}

function addDays(value: string, amount: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}
