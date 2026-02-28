import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const NavigationActions = createActionGroup({
  source: 'Navigation',
  events: {
    'Route Synced': props<{ pageId: string | null }>(),
    'Navbar Toggled': emptyProps(),
  },
});
