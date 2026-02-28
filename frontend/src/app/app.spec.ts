import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideState, provideStore } from '@ngrx/store';
import { App } from './app';
import { routes } from './app.routes';
import { gridFeatureKey } from './stores/grid/grid.state';
import { gridReducer } from './stores/grid/grid.reducer';
import { navigationFeatureKey } from './stores/navigation/navigation.state';
import { navigationReducer } from './stores/navigation/navigation.reducer';
import { projectFeatureKey } from './stores/project/project.state';
import { projectReducer } from './stores/project/project.reducer';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        provideStore(),
        provideState(navigationFeatureKey, navigationReducer),
        provideState(projectFeatureKey, projectReducer),
        provideState(gridFeatureKey, gridReducer),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Projects');
  });

  it('should lock page navigation before project selection', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Select a project to unlock navigation.');
  });
});
