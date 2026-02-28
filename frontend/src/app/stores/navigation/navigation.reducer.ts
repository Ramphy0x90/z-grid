import { createReducer, on } from '@ngrx/store';
import { NavigationActions } from './navigation.actions';
import { initialNavigationState } from './navigation.state';

export const navigationReducer = createReducer(
  initialNavigationState,
  on(NavigationActions.routeSynced, (state, { pageId }) => ({
    ...state,
    selectedPageId: pageId,
  })),
  on(NavigationActions.navbarToggled, (state) => ({
    ...state,
    collapsed: !state.collapsed,
  })),
);
