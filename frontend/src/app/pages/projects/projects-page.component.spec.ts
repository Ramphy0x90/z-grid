import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideState, provideStore, Store } from '@ngrx/store';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectsPageComponent } from './projects-page.component';
import { ProjectService } from '../../services/project.service';
import { projectFeatureKey } from '../../stores/project/project.state';
import { projectReducer } from '../../stores/project/project.reducer';
import { ProjectActions } from '../../stores/project/project.actions';

describe('ProjectsPageComponent', () => {
	it('should install selected example and refresh project store', () => {
		const projectServiceMock = {
			installExampleProject$: vi.fn().mockReturnValue(
				of({
					id: 'project-1',
					teamId: 'team-1',
					name: 'Zurich Example Project',
					description: 'Static grid example',
				}),
			),
			projects: signal([
				{
					id: 'project-1',
					teamId: 'team-1',
					name: 'Zurich Example Project',
					description: 'Static grid example',
				},
			]).asReadonly(),
		};

		TestBed.configureTestingModule({
			imports: [ProjectsPageComponent],
			providers: [
				provideRouter([]),
				provideStore(),
				provideState(projectFeatureKey, projectReducer),
				{ provide: ProjectService, useValue: projectServiceMock },
			],
		});

		const fixture = TestBed.createComponent(ProjectsPageComponent);
		const component = fixture.componentInstance;
		const store = TestBed.inject(Store);
		const dispatchSpy = vi.spyOn(store, 'dispatch');

		(
			component as unknown as { installExampleProject: (key: 'zurich') => void }
		).installExampleProject('zurich');

		expect(projectServiceMock.installExampleProject$).toHaveBeenCalledWith({
			exampleKey: 'zurich',
		});
		expect(dispatchSpy).toHaveBeenCalledWith(
			ProjectActions.projectsLoaded({
				projects: [
					{
						id: 'project-1',
						teamId: 'team-1',
						name: 'Zurich Example Project',
						description: 'Static grid example',
					},
				],
			}),
		);
	});
});
