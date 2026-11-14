import { faStar, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { keepPreviousData } from '@tanstack/react-query';
import { Empty, Flex, Pagination, Segmented, Space, Tag, Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { LoadingState } from '@ui/features/common';
import { NO_GROUPING } from '@ui/features/project/targets/model/target-grouping';
import { GroupByFilter } from '@ui/features/project/targets/shared/group-by-filter';
import { useListProjects } from '@ui/gen/api/v2/core/core';

import { useLocalStorage } from '../../../utils/use-local-storage';

import { buildLabelSelector } from './label-selector';
import {
  ProjectsView,
  groupProjects,
  projectLabelKeys,
  resolveGroupBy,
  resolveView
} from './project-grouping';
import { ProjectGroups } from './project-groups';
import { ProjectItem } from './project-item/project-item';
import { ProjectLabelFilter } from './project-label-filter';
import { ProjectListFilter } from './project-list-filter';
import * as styles from './projects-list.module.less';
import { ProjectsTable } from './projects-table';
import { useStarProjects } from './use-star-projects';

const PAGE_SIZE_KEY = 'projects-page-size';
const PAGE_NUMBER_KEY = 'projects-page-number';
// Where a reader's choice of view and grouping is kept between visits. Unlike
// the label filter, which lives in the URL so a filtered page can be shared,
// these are how one reader likes the page laid out.
const VIEW_KEY = 'projects-view';
const GROUP_BY_KEY = 'projects-group-by';

const views = [
  { value: 'cards', label: 'Cards' },
  { value: 'list', label: 'List' }
];

export const ProjectsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageSize, setPageSize] = useLocalStorage(PAGE_SIZE_KEY, 10);
  const [page, setPage] = useLocalStorage(PAGE_NUMBER_KEY, 1);
  const [filter, setFilter] = useState('');

  // The selected "key=value" label pairs are stored in the URL (one `label`
  // query param per pair) so the filter is shareable and applied on load.
  const selectedLabels = useMemo(() => searchParams.getAll('label'), [searchParams]);
  const [starredProjectsView, setStarredProjectsView] = useLocalStorage(
    'starred-projects-view',
    false
  );
  const [myProjectsView, setMyProjectsView] = useLocalStorage('my-projects-view', false);

  const [storedView, setView] = useLocalStorage<ProjectsView>(VIEW_KEY, 'cards');
  const view = resolveView(storedView);
  const [storedGroupBy, setGroupBy] = useLocalStorage<string>(GROUP_BY_KEY, NO_GROUPING);

  const [starred, toggleStar] = useStarProjects();

  // Every Project, whatever is searched or filtered, for the label keys the
  // page can be grouped by: the axes on offer should not come and go with the
  // filters. The name search and the label filter read this same query, so it
  // costs no request of its own.
  const allProjectsQuery = useListProjects();
  const groupKeys = useMemo(
    () => projectLabelKeys(allProjectsQuery.data?.data?.items ?? []),
    [allProjectsQuery.data]
  );
  // Until the keys are known the remembered choice is taken at its word, so
  // that a grouped page does not first load ungrouped and then regroup.
  const groupBy = allProjectsQuery.isSuccess
    ? resolveGroupBy(storedGroupBy, groupKeys)
    : storedGroupBy || NO_GROUPING;
  const isGrouped = groupBy !== NO_GROUPING;

  const labelSelector = buildLabelSelector(selectedLabels);

  // Keep the current list on screen while a changed filter, search or page
  // loads, instead of swapping the whole page (filters included) for a spinner.
  const { data, isLoading, isPlaceholderData } = useListProjects(
    {
      // A group is only whole if every matching Project is in it, so a grouped
      // page asks for all of them and folds groups shut instead of paging.
      ...(isGrouped ? {} : { pageSize, page: page - 1 }),
      filter,
      labelSelector: labelSelector || undefined,
      uid: starredProjectsView ? starred : undefined,
      mine: myProjectsView || undefined
    },
    { query: { placeholderData: keepPreviousData } }
  );

  const projects = useMemo(() => data?.data?.items ?? [], [data]);
  const total = data?.data?.total ?? 0;

  const groups = useMemo(
    () => (isGrouped ? groupProjects(projects, groupBy) : []),
    [isGrouped, projects, groupBy]
  );

  useEffect(() => {
    if (!isGrouped && total > 0 && page > Math.ceil(total / pageSize)) {
      setPage(Math.ceil(total / pageSize) || 1);
    }
  }, [isGrouped, total, page, pageSize, setPage]);

  const handlePaginationChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleLabelChange = (pairs: string[]) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('label');
    for (const pair of pairs) {
      nextParams.append('label', pair);
    }
    setSearchParams(nextParams);
    setPage(1);
  };

  // Adds the label to the filter (OR'd with other values of its key).
  const handleLabelClick = (key: string, value: string) => {
    const pair = `${key}=${value}`;
    if (!selectedLabels.includes(pair)) {
      handleLabelChange([...selectedLabels, pair]);
    }
  };

  const handleGroupByChange = (key: string) => {
    setGroupBy(key);
    setPage(1);
  };

  if (isLoading) return <LoadingState />;

  const isEmpty = projects.length === 0;

  const toolbar = (
    <Flex vertical gap={12} className={isEmpty ? 'mb-20' : 'mb-6'}>
      <Flex align='center' gap={8}>
        <ProjectListFilter onChange={handleFilterChange} init={filter} />
        <ProjectLabelFilter value={selectedLabels} onChange={handleLabelChange} />
        <Space className='ml-auto'>
          <Tooltip title='Shows projects you have been explicitly granted access to. Broad system-level permissions (e.g. kargo-admin) do not qualify.'>
            <Tag.CheckableTag
              checked={myProjectsView}
              onChange={(checked) => {
                setMyProjectsView(checked);
                setPage(1);
              }}
            >
              <FontAwesomeIcon icon={faUser} className='mr-1' />
              My Projects
            </Tag.CheckableTag>
          </Tooltip>
          <Tag.CheckableTag
            checked={starredProjectsView}
            onChange={(checked) => {
              setStarredProjectsView(checked);
              setPage(1);
            }}
          >
            <FontAwesomeIcon icon={faStar} className='mr-1' />
            Starred Projects
          </Tag.CheckableTag>
        </Space>
      </Flex>
      <Flex align='center' justify='space-between' gap={8} wrap>
        {/* With no labels on any Project there is nothing to group by, and
            the control would be a caption over nothing. */}
        {groupKeys.length > 0 ? (
          <GroupByFilter keys={groupKeys} value={groupBy} onChange={handleGroupByChange} />
        ) : (
          <span />
        )}
        <Segmented
          aria-label='View'
          value={view}
          onChange={(value) => setView(resolveView(value))}
          options={views}
        />
      </Flex>
    </Flex>
  );

  if (isEmpty) {
    return (
      <>
        {toolbar}
        <Empty
          description={
            myProjectsView
              ? 'No projects are directly assigned to your account. Disable this filter to see all projects.'
              : undefined
          }
        />
      </>
    );
  }

  return (
    <>
      {toolbar}
      <div style={{ opacity: isPlaceholderData ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {isGrouped ? (
          <ProjectGroups
            groups={groups}
            groupKey={groupBy}
            view={view}
            starred={starred}
            onToggleStar={toggleStar}
            onLabelClick={handleLabelClick}
          />
        ) : view === 'list' ? (
          <ProjectsTable
            projects={projects}
            starred={starred}
            onToggleStar={toggleStar}
            onLabelClick={handleLabelClick}
          />
        ) : (
          <div className={styles.list}>
            {projects.map((proj) => (
              <ProjectItem
                key={proj?.metadata?.name}
                project={proj}
                starred={starred.includes(proj?.metadata?.uid || '')}
                onToggleStar={toggleStar}
                onLabelClick={handleLabelClick}
              />
            ))}
          </div>
        )}
      </div>
      {!isGrouped && (
        <Flex justify='flex-end' className='mt-8'>
          <Pagination
            total={total}
            className='ml-auto flex-shrink-0'
            pageSize={pageSize}
            current={page}
            onChange={handlePaginationChange}
            showSizeChanger
            hideOnSinglePage
          />
        </Flex>
      )}
    </>
  );
};
