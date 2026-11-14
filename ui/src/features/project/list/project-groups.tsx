import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Collapse, Flex, Typography } from 'antd';
import { useEffect, useState } from 'react';

import type { Project } from '@ui/gen/api/v2/models';

import {
  ProjectGroup,
  ProjectsView,
  groupHealth,
  groupTitle,
  isUnlabeled
} from './project-grouping';
import { ProjectItem } from './project-item/project-item';
import * as styles from './projects-list.module.less';
import { ProjectsTable } from './projects-table';

// Past this many rows a group's table is paged rather than run on down the
// screen. A group of tiles is not: the reader opened it to see what is in it.
const groupPageSize = 20;

const plural = (count: number) => (count === 1 ? '' : 's');

// GroupHeader is what a collapsed group says for itself: which Projects it
// holds, how many, and whether their Stages are healthy.
const GroupHeader = ({ group, groupKey }: { group: ProjectGroup; groupKey: string }) => {
  const health = groupHealth(group.projects);
  return (
    <Flex align='center' gap={16} className='min-w-0'>
      {/* Monospace reads a label group for what it is, a key=value token. The
          unlabeled group has no token to show and is named in prose. */}
      <span
        className={`text-sm font-semibold truncate ${isUnlabeled(group) ? '' : 'font-mono'}`}
        title={groupTitle(group, groupKey)}
      >
        {groupTitle(group, groupKey)}
      </span>
      <Typography.Text type='secondary' className='text-xs shrink-0'>
        {group.projects.length} Project{plural(group.projects.length)}
      </Typography.Text>
      {health.count > 0 && (
        <Typography.Text type='secondary' className='text-xs shrink-0'>
          <Typography.Text type={health.healthy === health.count ? 'success' : 'secondary'}>
            <FontAwesomeIcon icon={faHeart} />
          </Typography.Text>{' '}
          {health.healthy}/{health.count} Stage{plural(health.count)} healthy
        </Typography.Text>
      )}
    </Flex>
  );
};

/**
 * ProjectGroups is the Projects page sliced along a label: one collapsible
 * section per value of the label, and a last one for the Projects that carry
 * no value for it. Each section holds its Projects as tiles or as rows,
 * whichever view the page is in.
 */
export const ProjectGroups = ({
  groups,
  groupKey,
  view,
  starred,
  onToggleStar,
  onLabelClick
}: {
  groups: ProjectGroup[];
  // The label key the page is grouped by.
  groupKey: string;
  view: ProjectsView;
  // UIDs of the starred Projects.
  starred: string[];
  onToggleStar: (id: string) => void;
  onLabelClick?: (key: string, value: string) => void;
}) => {
  const allKeys = groups.map((group) => group.value);

  // Which groups are shut, once the reader has shut any. Tracking the shut
  // ones rather than the open ones means a group that appears later -- a
  // filter lifted, a Project newly labeled -- starts open like the rest.
  const [closed, setClosed] = useState<string[]>([]);
  const openKeys = allKeys.filter((key) => !closed.includes(key));

  // Changing the axis builds a different set of groups, so a choice made about
  // the old ones no longer refers to anything.
  useEffect(() => setClosed([]), [groupKey]);

  const total = groups.reduce((sum, group) => sum + group.projects.length, 0);

  const renderProjects = (projects: Project[]) =>
    view === 'list' ? (
      <ProjectsTable
        projects={projects}
        starred={starred}
        onToggleStar={onToggleStar}
        onLabelClick={onLabelClick}
        groupKey={groupKey}
        pagination={
          projects.length > groupPageSize
            ? { pageSize: groupPageSize, showSizeChanger: false, size: 'small' }
            : false
        }
      />
    ) : (
      <div className={styles.groupList}>
        {projects.map((project) => (
          <ProjectItem
            key={project.metadata?.name}
            project={project}
            starred={starred.includes(project.metadata?.uid || '')}
            onToggleStar={onToggleStar}
            onLabelClick={onLabelClick}
            groupKey={groupKey}
          />
        ))}
      </div>
    );

  return (
    <Flex vertical gap={8}>
      <Flex justify='space-between' align='center' gap={12} wrap>
        <Typography.Text type='secondary' className='text-xs'>
          {total} Project{plural(total)} in {groups.length} group{plural(groups.length)} by{' '}
          <span className='font-mono'>{groupKey}</span>
        </Typography.Text>
        <Button
          type='link'
          size='small'
          className='px-0'
          onClick={() => setClosed(openKeys.length ? allKeys : [])}
        >
          {openKeys.length ? 'Collapse all' : 'Expand all'}
        </Button>
      </Flex>
      <Collapse
        activeKey={openKeys}
        onChange={(keys) => {
          const open = Array.isArray(keys) ? keys.map(String) : [String(keys)];
          setClosed(allKeys.filter((key) => !open.includes(key)));
        }}
        items={groups.map((group) => ({
          key: group.value,
          label: <GroupHeader group={group} groupKey={groupKey} />,
          children: renderProjects(group.projects)
        }))}
      />
    </Flex>
  );
};
