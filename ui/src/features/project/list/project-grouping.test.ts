import { describe, expect, test } from 'vitest';

import type { Project } from '@ui/gen/api/v2/models';

import { NO_GROUPING, UNLABELED } from '../targets/model/target-grouping';

import {
  groupHealth,
  groupProjects,
  groupTitle,
  isUnlabeled,
  projectLabelKeys,
  resolveGroupBy,
  resolveView
} from './project-grouping';

const project = (
  name: string,
  labels?: Record<string, string>,
  stages?: { healthy?: number; count?: number }
): Project => ({
  metadata: { name, labels },
  status: stages
    ? { stats: { stages: { count: stages.count, health: { healthy: stages.healthy } } } }
    : undefined
});

const names = (projects: Project[]) => projects.map((p) => p.metadata?.name);

describe('resolveView()', () => {
  test('list is kept', () => {
    expect(resolveView('list')).toBe('list');
  });

  test('anything else is cards', () => {
    expect(resolveView('cards')).toBe('cards');
    expect(resolveView(undefined)).toBe('cards');
    expect(resolveView('table')).toBe('cards');
    expect(resolveView(42)).toBe('cards');
  });
});

describe('projectLabelKeys()', () => {
  test('every user-facing key once, sorted', () => {
    expect(
      projectLabelKeys([
        project('checkout', { team: 'payments', tier: 'frontend' }),
        project('ledger', { team: 'payments', 'example.com/domain': 'finance' }),
        project('sandbox')
      ])
    ).toEqual(['example.com/domain', 'team', 'tier']);
  });

  test('system keys are not grouping axes', () => {
    expect(
      projectLabelKeys([
        project('checkout', {
          team: 'payments',
          'app.kubernetes.io/managed-by': 'Helm',
          'kargo.akuity.io/shard': 'a',
          'argocd.argoproj.io/instance': 'projects'
        })
      ])
    ).toEqual(['team']);
  });

  test('no Projects, no keys', () => {
    expect(projectLabelKeys([])).toEqual([]);
  });
});

describe('resolveGroupBy()', () => {
  test('a remembered key some Project carries is kept', () => {
    expect(resolveGroupBy('team', ['team', 'tier'])).toBe('team');
  });

  test('a remembered key no Project carries falls back to no grouping', () => {
    expect(resolveGroupBy('region', ['team', 'tier'])).toBe(NO_GROUPING);
  });

  test('nothing remembered, or something that is not a key, is no grouping', () => {
    expect(resolveGroupBy(undefined, ['team'])).toBe(NO_GROUPING);
    expect(resolveGroupBy(NO_GROUPING, ['team'])).toBe(NO_GROUPING);
    expect(resolveGroupBy(7, ['team'])).toBe(NO_GROUPING);
  });
});

describe('groupProjects()', () => {
  const projects = [
    project('checkout', { team: 'payments' }),
    project('docs'),
    project('gateway', { team: 'platform' }),
    project('ledger', { team: 'payments' }),
    project('search', { tier: 'backend' })
  ];

  test('by label value, sorted, unlabeled last', () => {
    const groups = groupProjects(projects, 'team');
    expect(groups.map((g) => g.value)).toEqual(['payments', 'platform', UNLABELED]);
  });

  test('Projects keep their order within a group', () => {
    const groups = groupProjects(projects, 'team');
    expect(names(groups[0].projects)).toEqual(['checkout', 'ledger']);
    expect(names(groups[1].projects)).toEqual(['gateway']);
    expect(names(groups[2].projects)).toEqual(['docs', 'search']);
  });

  test('every Project lands in exactly one group', () => {
    const groups = groupProjects(projects, 'team');
    expect(groups.flatMap((g) => g.projects)).toHaveLength(projects.length);
  });

  test('an empty label value groups with the unlabeled, not into a blank group', () => {
    const groups = groupProjects(
      [project('a', { team: '' }), project('b', { team: 'payments' }), project('c')],
      'team'
    );
    expect(groups.map((g) => g.value)).toEqual(['payments', UNLABELED]);
    expect(names(groups[1].projects)).toEqual(['a', 'c']);
  });

  test('a key no Project carries yields the unlabeled group alone', () => {
    const groups = groupProjects(projects, 'region');
    expect(groups).toHaveLength(1);
    expect(isUnlabeled(groups[0])).toBe(true);
  });

  test('no Projects yields no groups', () => {
    expect(groupProjects([], 'team')).toEqual([]);
  });
});

describe('groupTitle()', () => {
  test('a labeled group reads as its key=value token', () => {
    expect(groupTitle({ value: 'payments', projects: [] }, 'team')).toBe('team=payments');
  });

  test('the unlabeled group says what its Projects lack', () => {
    expect(groupTitle({ value: UNLABELED, projects: [] }, 'team')).toBe('no team label');
  });
});

describe('groupHealth()', () => {
  test('adds up Stage health across the group', () => {
    expect(
      groupHealth([
        project('checkout', { team: 'payments' }, { healthy: 3, count: 3 }),
        project('ledger', { team: 'payments' }, { healthy: 1, count: 4 })
      ])
    ).toEqual({ healthy: 4, count: 7 });
  });

  test('a Project with no stats yet counts for nothing', () => {
    expect(
      groupHealth([project('checkout', undefined, { healthy: 2, count: 2 }), project('new')])
    ).toEqual({ healthy: 2, count: 2 });
    expect(groupHealth([project('new', undefined, { count: 2 })])).toEqual({
      healthy: 0,
      count: 2
    });
  });

  test('no Projects', () => {
    expect(groupHealth([])).toEqual({ healthy: 0, count: 0 });
  });
});
