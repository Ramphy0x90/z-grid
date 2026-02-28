import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideState, provideStore } from '@ngrx/store';

import { routes } from './app.routes';
import { navigationFeatureKey } from './stores/navigation/navigation.state';
import { navigationReducer } from './stores/navigation/navigation.reducer';
import { projectFeatureKey } from './stores/project/project.state';
import { projectReducer } from './stores/project/project.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideStore(),
    provideState(navigationFeatureKey, navigationReducer),
    provideState(projectFeatureKey, projectReducer),
  ],
};
