import { IconDefinition, faBullseye, faHeart, faStar } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Flex, Grid, Table, Tag, Tooltip, Typography, theme } from 'antd';
import { Breakpoint } from 'antd/es/_util/responsiveObserver';
import { ColumnsType } from 'antd/es/table';
import { TablePaginationConfig } from 'antd/es/table/interface';
import { Link, generatePath } from 'react-router-dom';

import { paths } from '@ui/config/paths';
import { DESCRIPTION_ANNOTATION_KEY } from '@ui/features/common/utils';
import type { HealthStats, Project } from '@ui/gen/api/v2/models';

import { LabelTag } from './project-item/project-labels';
import { visibleLabels } from './project-item/visible-labels';

// A Project may carry any number of labels; past this many the rest fold into
// a "+N" tag that lists them on hover. A wider screen has room for more.
const labelTagLimit = (screens: Partial<Record<Breakpoint, boolean>>): number => {
  if (screens.xxl) {
    return 4;
  }
  if (screens.lg) {
    return 3;
  }
  return 2;
};

// HealthCount is one of a Project's health figures, drawn as the tiles draw
// it: an icon that turns green once everything counted is healthy.
const HealthCount = ({
  stats,
  icon = faHeart
}: {
  stats?: { count?: number; health?: HealthStats };
  icon?: IconDefinition;
}) => {
  const count = stats?.count ?? 0;
  const healthy = stats?.health?.healthy ?? 0;
  return (
    <span className='whitespace-nowrap'>
      <Typography.Text type={count > 0 && healthy === count ? 'success' : 'secondary'}>
        <FontAwesomeIcon icon={icon} />
      </Typography.Text>{' '}
      {healthy}/{count}
    </span>
  );
};

/**
 * ProjectsTable is the Projects page read as a list rather than as tiles: one
 * row per Project, carrying what a tile carries. It is used both for the plain
 * list and inside each group of a grouped one, so a Project reads the same
 * either way.
 */
export const ProjectsTable = ({
  projects,
  starred,
  onToggleStar,
  onLabelClick,
  groupKey,
  pagination = false
}: {
  projects: Project[];
  // UIDs of the starred Projects.
  starred: string[];
  onToggleStar: (id: string) => void;
  onLabelClick?: (key: string, value: string) => void;
  // The label key the list is grouped by. Its tag says the same thing on every
  // row of a group, so the Labels column leaves it out.
  groupKey?: string;
  pagination?: TablePaginationConfig | false;
}) => {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const maxLabelTags = labelTagLimit(screens);

  // The controller leaves Target stats off a Project with no Targets, and most
  // installations have none at all, so the column only appears when some row
  // has something to put in it.
  const anyTargets = projects.some((project) => !!project.status?.stats?.targets?.count);

  const columns: ColumnsType<Project> = [
    {
      key: 'star',
      width: 40,
      render: (_, project) => {
        const isStarred = starred.includes(project.metadata?.uid || '');
        return (
          <Button
            type='text'
            size='small'
            aria-label={isStarred ? 'Unstar Project' : 'Star Project'}
            aria-pressed={isStarred}
            icon={
              <FontAwesomeIcon
                icon={faStar}
                style={{
                  color: isStarred ? token.colorPrimary : '',
                  opacity: isStarred ? 1 : 0.3
                }}
              />
            }
            onClick={() => onToggleStar(project.metadata?.uid || '')}
          />
        );
      }
    },
    {
      title: 'Project',
      key: 'name',
      width: 240,
      render: (_, project) => (
        <Link
          className='block font-semibold truncate'
          title={project.metadata?.name}
          to={generatePath(paths.project, { name: project.metadata?.name || '' })}
        >
          {project.metadata?.name}
        </Link>
      )
    },
    {
      title: 'Description',
      key: 'description',
      // The one column with no width of its own: it takes what the others
      // leave, and a description longer than that is cut short. Hovering reads
      // the whole of it.
      render: (_, project) => {
        const description = project.metadata?.annotations?.[DESCRIPTION_ANNOTATION_KEY];
        return (
          <Typography.Text type='secondary' ellipsis={{ tooltip: description }}>
            {description}
          </Typography.Text>
        );
      }
    },
    {
      title: 'Labels',
      key: 'labels',
      width: '30%',
      render: (_, project) => {
        const labels = visibleLabels(project.metadata?.labels).filter(([key]) => key !== groupKey);
        return (
          <Flex gap={4} wrap>
            {labels.slice(0, maxLabelTags).map((label) => (
              // A long label is cut short rather than pushing the column
              // wider; its title reads the whole of it.
              <span key={label[0]} className='inline-flex min-w-0 max-w-[200px]'>
                <LabelTag label={label} onClick={onLabelClick} />
              </span>
            ))}
            {labels.length > maxLabelTags && (
              <Tooltip
                title={labels
                  .slice(maxLabelTags)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')}
              >
                <Tag variant='filled' className='!m-0' tabIndex={0}>
                  +{labels.length - maxLabelTags}
                </Tag>
              </Tooltip>
            )}
          </Flex>
        );
      }
    },
    {
      title: 'Stages',
      key: 'stages',
      width: 110,
      render: (_, project) => <HealthCount stats={project.status?.stats?.stages} />
    },
    {
      title: 'Warehouses',
      key: 'warehouses',
      width: 110,
      render: (_, project) => <HealthCount stats={project.status?.stats?.warehouses} />
    },
    ...(anyTargets
      ? [
          {
            title: 'Targets',
            key: 'targets',
            width: 110,
            render: (_: unknown, project: Project) =>
              project.status?.stats?.targets?.count ? (
                <HealthCount stats={project.status.stats.targets} icon={faBullseye} />
              ) : null
          }
        ]
      : [])
  ];

  return (
    <Table
      dataSource={projects}
      columns={columns}
      size='small'
      pagination={pagination}
      rowKey={(project) => project.metadata?.name || ''}
      // Fixed, so that every column is as wide as it is told to be rather than
      // as wide as its content: grouped, the page stacks one table per group,
      // and their columns have to line up from one group to the next.
      tableLayout='fixed'
      // Narrower than this the table scrolls sideways instead of crushing its
      // columns.
      scroll={{ x: 900 }}
    />
  );
};
