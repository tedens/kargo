import type { Project } from '@ui/gen/api/v2/models';

import { NO_GROUPING, UNLABELED } from '../targets/model/target-grouping';

import { visibleLabels } from './project-item/visible-labels';

// The two ways to read the Projects page. Cards are the tiles it has always
// had; the list is one row per Project, for scanning many of them at once.
export type ProjectsView = 'cards' | 'list';

// resolveView reads a remembered view. Anything may be in storage, including a
// view that no longer exists, so everything but 'list' is the default.
export const resolveView = (stored: unknown): ProjectsView =>
  stored === 'list' ? 'list' : 'cards';

export type ProjectGroup = { value: string; projects: Project[] };

// projectLabelKeys returns every user-facing label key the Projects carry,
// sorted, so the page can offer them as grouping axes without anyone declaring
// them. Keys owned by Kubernetes, Kargo and common tooling say how a Project
// got deployed rather than what it is, and are left out.
export const projectLabelKeys = (projects: Project[]): string[] => {
  const keys = new Set<string>();
  for (const project of projects) {
    for (const [key] of visibleLabels(project.metadata?.labels)) {
      keys.add(key);
    }
  }
  return [...keys].sort((lhs, rhs) => lhs.localeCompare(rhs));
};

// resolveGroupBy reads a remembered grouping key. A key that no Project carries
// (any more) would put every Project into the one unlabeled group, which says
// less than not grouping at all, so it falls back to that.
export const resolveGroupBy = (stored: unknown, keys: string[]): string =>
  typeof stored === 'string' && keys.includes(stored) ? stored : NO_GROUPING;

// groupProjects buckets Projects by the value they carry for a label key.
// Groups sort by value with the unlabeled group last; Projects keep the order
// they came in within a group.
export const groupProjects = (projects: Project[], key: string): ProjectGroup[] => {
  const groups = new Map<string, Project[]>();
  for (const project of projects) {
    // `||`, not `??`: an empty label value is legal in Kubernetes but names no
    // group, so it belongs with the Projects that carry no value at all rather
    // than forming a group with a blank heading.
    const value = project.metadata?.labels?.[key] || UNLABELED;
    const group = groups.get(value);
    if (group) {
      group.push(project);
    } else {
      groups.set(value, [project]);
    }
  }
  return [...groups.entries()]
    .sort(([lhs], [rhs]) => {
      if (lhs === UNLABELED) {
        return 1;
      }
      if (rhs === UNLABELED) {
        return -1;
      }
      return lhs.localeCompare(rhs);
    })
    .map(([value, grouped]) => ({ value, projects: grouped }));
};

// isUnlabeled reports whether a group is the one holding the Projects with no
// value for the grouping key. Parentheses are not legal in a label value, so
// the sentinel cannot be mistaken for a real one.
export const isUnlabeled = (group: ProjectGroup): boolean => group.value === UNLABELED;

// groupTitle names a group in one line: the key=value token its Projects share,
// or, for the unlabeled group, what they lack.
export const groupTitle = (group: ProjectGroup, key: string): string =>
  isUnlabeled(group) ? `no ${key} label` : `${key}=${group.value}`;

export type HealthTally = { healthy: number; count: number };

// groupHealth adds up the Stage health of a group's Projects, so a collapsed
// group can still say whether anything inside it needs attention.
export const groupHealth = (projects: Project[]): HealthTally =>
  projects.reduce<HealthTally>(
    (tally, project) => {
      const stages = project.status?.stats?.stages;
      return {
        healthy: tally.healthy + (stages?.health?.healthy ?? 0),
        count: tally.count + (stages?.count ?? 0)
      };
    },
    { healthy: 0, count: 0 }
  );
