import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PAGE_GROUPS, PAGES } from '../../app.routes';
import { navigationFeatureKey, NavigationState } from './navigation.state';
import { ProjectSelectors } from '../project/project.selectors';

const selectNavigationState = createFeatureSelector<NavigationState>(navigationFeatureKey);

export const NavigationSelectors = {
  selectedPageId: createSelector(selectNavigationState, (state) => state.selectedPageId),
  collapsed: createSelector(selectNavigationState, (state) => state.collapsed),
  pageGroups: createSelector(selectNavigationState, () => PAGE_GROUPS),
  selectedPage: createSelector(
    selectNavigationState,
    (state) => PAGES.find((page) => page.id === state.selectedPageId) ?? null,
  ),
  hasProjectSelected: createSelector(ProjectSelectors.hasProjectSelected, (selected) => selected),
  topbarTitle: createSelector(
    selectNavigationState,
    (state) => PAGES.find((page) => page.id === state.selectedPageId)?.label ?? 'Projects',
  ),
};
