import { describe, expect, it } from 'vitest';

import {
  SEV1_KEYWORDS,
  TEAMS,
  classifySeverity,
  escalateForZoneRisk,
  matchKeywords,
  maxSeverity,
} from '@/lib/engine/severity';
import type { IncidentType } from '@/lib/engine/types';

const FIRST_AID = 'fa-east';

describe('maxSeverity', () => {
  it.each([
    ['SEV1', 'SEV3', 'SEV1'],
    ['SEV3', 'SEV1', 'SEV1'],
    ['SEV2', 'SEV3', 'SEV2'],
    ['SEV2', 'SEV2', 'SEV2'],
  ] as const)('max(%s, %s) is %s', (a, b, expected) => {
    expect(maxSeverity(a, b)).toBe(expected);
  });
});

describe('matchKeywords', () => {
  it('matches case-insensitively', () => {
    expect(matchKeywords('Person is UNCONSCIOUS', SEV1_KEYWORDS)).toContain('unconscious');
  });

  it('returns an empty list when nothing matches', () => {
    expect(matchKeywords('all quiet', SEV1_KEYWORDS)).toEqual([]);
  });
});

describe('classifySeverity — type floors', () => {
  it.each([
    ['medical', 'SEV2'],
    ['crowd', 'SEV2'],
    ['security', 'SEV2'],
    ['lost_person', 'SEV2'],
    ['transport', 'SEV3'],
    ['facilities', 'SEV3'],
  ] as const)('%s with no keywords floors at %s', (type, expected) => {
    const result = classifySeverity(type, ['routine report'], FIRST_AID);
    expect(result.severity).toBe(expected);
  });

  it('routes each type to its owning team', () => {
    const cases: [IncidentType, string][] = [
      ['medical', TEAMS.medical],
      ['crowd', TEAMS.crowdSafety],
      ['security', TEAMS.security],
      ['facilities', TEAMS.facilities],
      ['lost_person', TEAMS.guestServices],
      ['transport', TEAMS.transport],
    ];
    for (const [type, team] of cases) {
      expect(classifySeverity(type, ['routine'], FIRST_AID).team).toBe(team);
    }
  });

  it('carries the nearest first-aid point through unchanged', () => {
    expect(classifySeverity('medical', ['x'], 'fa-west').nearestFirstAidZoneId).toBe('fa-west');
  });
});

/**
 * The core safety guarantee of the product. These tests are the reason an
 * operator can trust an AI-triaged incident.
 */
describe('classifySeverity — the LLM cannot under-triage', () => {
  it('returns SEV1 for an unconscious person even when the LLM proposed "facilities"', () => {
    const result = classifySeverity('facilities', ['person unconscious in section 114'], FIRST_AID);

    expect(result.severity).toBe('SEV1');
    expect(result.matchedRule).toContain('life-safety keyword');
    expect(result.matchedRule).toContain('overrides proposed type');
  });

  it('returns SEV1 for an untranslated Spanish faint report', () => {
    // The interlock must fire on the raw text, before any translation exists.
    const result = classifySeverity('lost_person', ['hay una persona desmayada'], FIRST_AID);
    expect(result.severity).toBe('SEV1');
  });

  it('returns SEV1 for an untranslated Bengali unconscious report', () => {
    expect(classifySeverity('facilities', ['গেট বি-তে একজন অজ্ঞান'], FIRST_AID).severity).toBe(
      'SEV1',
    );
  });

  it('returns SEV1 for a Hindi fire report', () => {
    expect(classifySeverity('lost_person', ['जोन 3 में आग'], FIRST_AID).severity).toBe('SEV1');
  });

  it.each([
    'not breathing',
    'no pulse',
    'cardiac arrest suspected',
    'severe bleeding from the arm',
    'crush at the barrier',
    'stampede beginning',
    'fire in the kitchen',
    'someone has a weapon',
    'anaphylactic shock',
    'choking on food',
  ])('escalates "%s" to SEV1 regardless of proposed type', (text) => {
    expect(classifySeverity('facilities', [text], FIRST_AID).severity).toBe('SEV1');
  });

  it('scans every provided text, not just the first', () => {
    const result = classifySeverity(
      'facilities',
      ['nothing here', 'actually, unconscious'],
      FIRST_AID,
    );
    expect(result.severity).toBe('SEV1');
  });

  it('adds medical to the responding team for a non-medical SEV1', () => {
    const result = classifySeverity('security', ['person collapsed during the scuffle'], FIRST_AID);
    expect(result.severity).toBe('SEV1');
    expect(result.team).toBe(`${TEAMS.security} + ${TEAMS.medical}`);
  });

  it('does not double up the team for a medical SEV1', () => {
    const result = classifySeverity('medical', ['unconscious'], FIRST_AID);
    expect(result.team).toBe(TEAMS.medical);
  });
});

describe('classifySeverity — vulnerable persons', () => {
  it('floors a lost child at SEV2 and names the rule', () => {
    const result = classifySeverity('lost_person', ['lost child near gate B'], FIRST_AID);
    expect(result.severity).toBe('SEV2');
    expect(result.matchedRule).toContain('vulnerable-person keyword');
  });

  it('raises a facilities report about a wheelchair user above its SEV3 floor', () => {
    const result = classifySeverity('facilities', ['wheelchair lift is stuck'], FIRST_AID);
    expect(result.severity).toBe('SEV2');
  });

  it('lets a life-safety keyword win over a vulnerable-person match', () => {
    const result = classifySeverity('lost_person', ['child is unconscious'], FIRST_AID);
    expect(result.severity).toBe('SEV1');
    expect(result.matchedRule).toContain('life-safety');
  });
});

describe('escalateForZoneRisk', () => {
  it('escalates a minor incident in a critical zone to SEV1', () => {
    const base = classifySeverity('facilities', ['spilled drink'], FIRST_AID);
    expect(base.severity).toBe('SEV3');

    const escalated = escalateForZoneRisk(base, true);
    expect(escalated.severity).toBe('SEV1');
    expect(escalated.matchedRule).toContain('critical density');
  });

  it('leaves the decision untouched when the zone is not critical', () => {
    const base = classifySeverity('facilities', ['spilled drink'], FIRST_AID);
    expect(escalateForZoneRisk(base, false)).toBe(base);
  });

  it('is a no-op for an incident already at SEV1', () => {
    const base = classifySeverity('medical', ['unconscious'], FIRST_AID);
    expect(escalateForZoneRisk(base, true)).toBe(base);
  });
});
