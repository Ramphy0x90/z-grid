export const navigationFeatureKey = 'navigation';

export type NavigationState = {
  selectedPageId: string | null;
  collapsed: boolean;
};

export const initialNavigationState: NavigationState = {
  selectedPageId: null,
  collapsed: false,
};
