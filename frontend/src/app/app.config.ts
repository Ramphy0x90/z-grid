import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideToastr } from 'ngx-toastr';

import { routes } from './app.routes';
import { csrfInterceptor } from './interceptors/csrf.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { navigationFeatureKey } from './stores/navigation/navigation.state';
import { navigationReducer } from './stores/navigation/navigation.reducer';
import { projectFeatureKey } from './stores/project/project.state';
import { projectReducer } from './stores/project/project.reducer';
import { gridFeatureKey } from './stores/grid/grid.state';
import { gridReducer } from './stores/grid/grid.reducer';
import { GridEffects } from './stores/grid/grid.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideToastr({
      positionClass: 'toast-bottom-right',
      timeOut: 5000,
      preventDuplicates: true,
      progressBar: true,
    }),
    provideHttpClient(withInterceptors([csrfInterceptor, errorInterceptor])),
    provideRouter(routes),
    provideStore(),
    provideState(navigationFeatureKey, navigationReducer),
    provideState(projectFeatureKey, projectReducer),
    provideState(gridFeatureKey, gridReducer),
    provideEffects(GridEffects),
  ],
};
