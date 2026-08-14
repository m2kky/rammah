export type LegacyOfferingSource = {
  offeringId: string;
  hasRules: boolean;
  hasSessions: boolean;
};

export type LegacyRuleTruth = {
  offeringId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  slotDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export type LegacySchedulingDecision = {
  offeringId: string;
  schedulingMode: "appointment" | "scheduled_program" | null;
  blocked: boolean;
};

export type SchedulingMigrationReport = {
  ok: boolean;
  decisions: LegacySchedulingDecision[];
  mixedSourceOfferingIds: string[];
  inconsistentRuleOfferingIds: string[];
  incompatibleGlobalScheduleOfferingIds: string[];
};

type QueryResult<TRow> = { rows: TRow[] };

export type SchedulingPreflightQueryable = {
  query<TRow extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<TRow>>;
};

export const classifyLegacyOfferingSources = (
  rows: LegacyOfferingSource[],
): LegacySchedulingDecision[] =>
  rows
    .map((row): LegacySchedulingDecision => {
      if (row.hasRules && row.hasSessions) {
        return {
          offeringId: row.offeringId,
          schedulingMode: null,
          blocked: true,
        };
      }

      return {
        offeringId: row.offeringId,
        schedulingMode: row.hasSessions ? "scheduled_program" : "appointment",
        blocked: false,
      };
    })
    .sort((left, right) => left.offeringId.localeCompare(right.offeringId));

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

const ruleTruthKey = (row: LegacyRuleTruth) =>
  [
    row.timezone,
    row.slotDurationMinutes,
    row.bufferBeforeMinutes,
    row.bufferAfterMinutes,
  ].join("|");

const windowKey = (row: LegacyRuleTruth) =>
  [row.weekday, row.startTime, row.endTime, row.timezone].join("|");

export const summarizeLegacyRuleTruth = (rows: LegacyRuleTruth[]) => {
  const rowsByOffering = new Map<string, LegacyRuleTruth[]>();

  for (const row of rows) {
    const offeringRows = rowsByOffering.get(row.offeringId) ?? [];
    offeringRows.push(row);
    rowsByOffering.set(row.offeringId, offeringRows);
  }

  const inconsistentRuleOfferingIds = [...rowsByOffering]
    .filter(([, offeringRows]) => new Set(offeringRows.map(ruleTruthKey)).size > 1)
    .map(([offeringId]) => offeringId)
    .sort();
  const globalScheduleEntries = [...rowsByOffering]
    .map(([offeringId, offeringRows]) => ({
      offeringId,
      signature: uniqueSorted(offeringRows.map(windowKey)).join(","),
    }))
    .sort((left, right) => left.offeringId.localeCompare(right.offeringId));
  const incompatibleGlobalScheduleOfferingIds =
    new Set(globalScheduleEntries.map(({ signature }) => signature)).size > 1
      ? globalScheduleEntries.map(({ offeringId }) => offeringId)
      : [];

  return {
    inconsistentRuleOfferingIds,
    incompatibleGlobalScheduleOfferingIds,
  };
};

export const inspectLegacySchedulingMigration = async (
  queryable: SchedulingPreflightQueryable,
  now = new Date(),
): Promise<SchedulingMigrationReport> => {
  const [sourceResult, ruleResult] = await Promise.all([
    queryable.query<{
      offering_id: string;
      has_rules: boolean;
      has_sessions: boolean;
    }>(
      `
        SELECT
          o.id::text AS offering_id,
          EXISTS (
            SELECT 1
            FROM availability_rules ar
            WHERE ar.offering_id = o.id AND ar.status = 'published'
          ) AS has_rules,
          EXISTS (
            SELECT 1
            FROM offering_sessions os
            WHERE os.offering_id = o.id
              AND os.status = 'published'
              AND os.ends_at > $1
          ) AS has_sessions
        FROM offerings o
        ORDER BY o.id
      `,
      [now],
    ),
    queryable.query<{
      offering_id: string;
      weekday: number;
      start_time: string;
      end_time: string;
      timezone: string;
      slot_duration_minutes: number;
      buffer_before_minutes: number;
      buffer_after_minutes: number;
    }>(`
      SELECT
        offering_id::text,
        weekday,
        start_time,
        end_time,
        timezone,
        slot_duration_minutes,
        buffer_before_minutes,
        buffer_after_minutes
      FROM availability_rules
      WHERE status = 'published'
      ORDER BY offering_id, weekday, start_time, end_time, id
    `),
  ]);
  const decisions = classifyLegacyOfferingSources(
    sourceResult.rows.map((row) => ({
      offeringId: row.offering_id,
      hasRules: row.has_rules,
      hasSessions: row.has_sessions,
    })),
  );
  const ruleSummary = summarizeLegacyRuleTruth(
    ruleResult.rows.map((row) => ({
      offeringId: row.offering_id,
      weekday: row.weekday,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      slotDurationMinutes: row.slot_duration_minutes,
      bufferBeforeMinutes: row.buffer_before_minutes,
      bufferAfterMinutes: row.buffer_after_minutes,
    })),
  );
  const mixedSourceOfferingIds = decisions
    .filter(({ blocked }) => blocked)
    .map(({ offeringId }) => offeringId);
  const ok =
    mixedSourceOfferingIds.length === 0 &&
    ruleSummary.inconsistentRuleOfferingIds.length === 0 &&
    ruleSummary.incompatibleGlobalScheduleOfferingIds.length === 0;

  return {
    ok,
    decisions,
    mixedSourceOfferingIds,
    ...ruleSummary,
  };
};
