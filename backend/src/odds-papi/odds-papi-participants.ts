import { OddsPapiFixture } from './odds-papi.types';

export type OddsPapiParticipantRef = {
  externalParticipantId: string;
  externalName: string;
};

/**
 * Unique OddsPapi participants from a fixture list.
 * Identity is externalParticipantId (stringified participant id), not name.
 */
export function uniqueParticipantsFromFixtures(
  fixtures: Pick<
    OddsPapiFixture,
    'participant1Id' | 'participant2Id' | 'participant1Name' | 'participant2Name'
  >[],
): OddsPapiParticipantRef[] {
  const map = new Map<string, string>();
  for (const f of fixtures) {
    const id1 = String(f.participant1Id);
    const id2 = String(f.participant2Id);
    if (!map.has(id1)) map.set(id1, (f.participant1Name ?? '').trim() || id1);
    if (!map.has(id2)) map.set(id2, (f.participant2Name ?? '').trim() || id2);
  }
  return [...map.entries()]
    .map(([externalParticipantId, externalName]) => ({
      externalParticipantId,
      externalName,
    }))
    .sort((a, b) => a.externalName.localeCompare(b.externalName));
}
