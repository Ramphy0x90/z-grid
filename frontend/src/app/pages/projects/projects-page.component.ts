import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';
import { DEFAULT_PROJECT_PAGE, toProjectPageCommands } from '../../app.routes';
import { ProjectService } from '../../services/project.service';
import { ProjectActions } from '../../stores/project/project.actions';
import { ProjectSelectors } from '../../stores/project/project.selectors';
import type { Project } from '../../types/project.types';
import type { ExampleProjectKey } from '../../types/project.types';

@Component({
	selector: 'app-projects-page',
	imports: [ReactiveFormsModule],
	templateUrl: './projects-page.component.html',
	styleUrl: './projects-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
	private static readonly EXAMPLE_PROJECT_OPTIONS: ReadonlyArray<{
		key: ExampleProjectKey;
		label: string;
	}> = [
		{ key: 'zurich', label: 'Zurich' },
		{ key: 'tokyo', label: 'Tokyo' },
		{ key: 'new-delhi', label: 'New Delhi' },
		{ key: 'madrid', label: 'Madrid' },
	];

	private readonly destroyRef = inject(DestroyRef);
	private readonly router = inject(Router);
	private readonly store = inject(Store);
	private readonly projectService = inject(ProjectService);
	private readonly formBuilder = inject(FormBuilder);
	protected readonly projects = this.store.selectSignal(ProjectSelectors.projects);
	protected readonly selectedProjectId = this.store.selectSignal(ProjectSelectors.selectedProjectId);
	protected readonly isCreateModalOpen = signal(false);
	protected readonly isEditModalOpen = signal(false);
	protected readonly isDeleteModalOpen = signal(false);
	protected readonly isInstallModalOpen = signal(false);
	protected readonly isSubmitting = signal(false);
	protected readonly isInstallingExample = signal(false);
	protected readonly installInProgressKey = signal<ExampleProjectKey | null>(null);
	protected readonly createErrorMessage = signal('');
	protected readonly editErrorMessage = signal('');
	protected readonly deleteErrorMessage = signal('');
	protected readonly installErrorMessage = signal('');
	protected readonly exampleProjectOptions = ProjectsPageComponent.EXAMPLE_PROJECT_OPTIONS;
	protected readonly editProjectId = signal<string | null>(null);
	protected readonly deleteProjectId = signal<string | null>(null);
	protected readonly createProjectForm = this.formBuilder.nonNullable.group({
		name: ['', [Validators.required, Validators.maxLength(255)]],
		description: ['', [Validators.maxLength(2000)]],
	});
	protected readonly editProjectForm = this.formBuilder.nonNullable.group({
		name: ['', [Validators.required, Validators.maxLength(255)]],
		description: ['', [Validators.maxLength(2000)]],
	});

	protected selectProject(projectId: string): void {
		this.router.navigate([...toProjectPageCommands(projectId, DEFAULT_PROJECT_PAGE)]);
	}

	protected openCreateProjectModal(): void {
		this.createErrorMessage.set('');
		this.isCreateModalOpen.set(true);
	}

	protected closeCreateProjectModal(): void {
		this.isCreateModalOpen.set(false);
		this.isSubmitting.set(false);
		this.createErrorMessage.set('');
		this.createProjectForm.reset({
			name: '',
			description: '',
		});
	}

	protected createProject(): void {
		if (this.createProjectForm.invalid || this.isSubmitting()) {
			this.createProjectForm.markAllAsTouched();
			return;
		}

		const { name, description } = this.createProjectForm.getRawValue();
		this.isSubmitting.set(true);

		this.projectService
			.createProject$({
				name: name.trim(),
				description: description.trim(),
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.store.dispatch(
						ProjectActions.projectsLoaded({ projects: this.projectService.projects() }),
					);
					this.closeCreateProjectModal();
				},
				error: (error: unknown) => {
					this.createErrorMessage.set(this.resolveErrorMessage(error, 'Unable to create project.'));
					this.isSubmitting.set(false);
				},
			});
	}

	protected openInstallExampleModal(): void {
		this.installErrorMessage.set('');
		this.isInstallModalOpen.set(true);
	}

	protected closeInstallExampleModal(): void {
		this.isInstallModalOpen.set(false);
		this.isInstallingExample.set(false);
		this.installInProgressKey.set(null);
		this.installErrorMessage.set('');
	}

	protected installExampleProject(exampleKey: ExampleProjectKey): void {
		if (this.isInstallingExample()) {
			return;
		}

		this.installErrorMessage.set('');
		this.isInstallingExample.set(true);
		this.installInProgressKey.set(exampleKey);
		this.projectService
			.installExampleProject$({ exampleKey })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.store.dispatch(
						ProjectActions.projectsLoaded({ projects: this.projectService.projects() }),
					);
					this.closeInstallExampleModal();
					this.isInstallingExample.set(false);
				},
				error: (error: unknown) => {
					this.installErrorMessage.set(
						this.resolveErrorMessage(error, 'Unable to install the selected example project.'),
					);
					this.isInstallingExample.set(false);
					this.installInProgressKey.set(null);
				},
			});
	}

	protected openEditProjectModal(project: Project): void {
		this.editProjectId.set(project.id);
		this.editErrorMessage.set('');
		this.editProjectForm.reset({
			name: project.name,
			description: project.description,
		});
		this.isEditModalOpen.set(true);
	}

	protected closeEditProjectModal(): void {
		this.isEditModalOpen.set(false);
		this.editProjectId.set(null);
		this.editErrorMessage.set('');
		this.isSubmitting.set(false);
		this.editProjectForm.reset({
			name: '',
			description: '',
		});
	}

	protected updateProject(): void {
		if (this.editProjectForm.invalid || this.isSubmitting()) {
			this.editProjectForm.markAllAsTouched();
			return;
		}
		const projectId = this.editProjectId();
		if (!projectId) {
			return;
		}
		const { name, description } = this.editProjectForm.getRawValue();
		this.isSubmitting.set(true);
		this.projectService
			.updateProject$(projectId, {
				name: name.trim(),
				description: description.trim(),
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (project) => {
					this.store.dispatch(ProjectActions.projectUpdated({ project }));
					this.closeEditProjectModal();
				},
				error: (error: unknown) => {
					this.editErrorMessage.set(this.resolveErrorMessage(error, 'Unable to update project.'));
					this.isSubmitting.set(false);
				},
			});
	}

	protected openDeleteProjectModal(project: Project): void {
		this.deleteProjectId.set(project.id);
		this.deleteErrorMessage.set('');
		this.isDeleteModalOpen.set(true);
	}

	protected closeDeleteProjectModal(): void {
		this.isDeleteModalOpen.set(false);
		this.deleteProjectId.set(null);
		this.deleteErrorMessage.set('');
		this.isSubmitting.set(false);
	}

	protected confirmDeleteProject(): void {
		const projectId = this.deleteProjectId();
		if (!projectId || this.isSubmitting()) {
			return;
		}
		if (this.selectedProjectId() === projectId) {
			this.deleteErrorMessage.set('Cannot delete the project currently active in the route.');
			return;
		}
		this.isSubmitting.set(true);
		this.projectService
			.deleteProject$(projectId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.store.dispatch(ProjectActions.projectDeleted({ projectId }));
					this.closeDeleteProjectModal();
				},
				error: (error: unknown) => {
					this.deleteErrorMessage.set(this.resolveErrorMessage(error, 'Unable to delete project.'));
					this.isSubmitting.set(false);
				},
			});
	}

	protected getProjectById(projectId: string | null): Project | null {
		if (!projectId) {
			return null;
		}
		return this.projects().find((project) => project.id === projectId) ?? null;
	}

	private resolveErrorMessage(error: unknown, fallback: string): string {
		if (error instanceof HttpErrorResponse) {
			const errorMessage = error.error?.message;
			if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
				return errorMessage;
			}
		}
		return fallback;
	}
}
