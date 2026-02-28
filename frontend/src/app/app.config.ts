import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideState, provideStore } from '@ngrx/store';

import { routes } from './app.routes';
import { csrfInterceptor } from './interceptors/csrf.interceptor';
import { navigationFeatureKey } from './stores/navigation/navigation.state';
import { navigationReducer } from './stores/navigation/navigation.reducer';
import { projectFeatureKey } from './stores/project/project.state';
import { projectReducer } from './stores/project/project.reducer';
import { gridFeatureKey } from './stores/grid/grid.state';
import { gridReducer } from './stores/grid/grid.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([csrfInterceptor])),
    provideRouter(routes),
    provideStore(),
    provideState(navigationFeatureKey, navigationReducer),
    provideState(projectFeatureKey, projectReducer),
    provideState(gridFeatureKey, gridReducer),
  ],
};
