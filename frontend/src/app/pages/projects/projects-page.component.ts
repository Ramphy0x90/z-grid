import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DEFAULT_PROJECT_PAGE, toProjectPageCommands } from '../../app.routes';
import { ProjectService } from '../../services/project.service';
import { ProjectActions } from '../../stores/project/project.actions';
import { ProjectSelectors } from '../../stores/project/project.selectors';

@Component({
	selector: 'app-projects-page',
	imports: [ReactiveFormsModule],
	templateUrl: './projects-page.component.html',
	styleUrl: './projects-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
	private readonly destroyRef = inject(DestroyRef);
	private readonly router = inject(Router);
	private readonly store = inject(Store);
	private readonly projectService = inject(ProjectService);
	private readonly formBuilder = inject(FormBuilder);
	protected readonly projects = this.store.selectSignal(ProjectSelectors.projects);
	protected readonly isCreateModalOpen = signal(false);
	protected readonly isSubmitting = signal(false);
	protected readonly submitError = signal<string | null>(null);
	protected readonly createProjectForm = this.formBuilder.nonNullable.group({
		name: ['', [Validators.required, Validators.maxLength(255)]],
		description: ['', [Validators.maxLength(2000)]],
	});

	protected selectProject(projectId: string): void {
		this.router.navigate([...toProjectPageCommands(projectId, DEFAULT_PROJECT_PAGE)]);
	}

	protected openCreateProjectModal(): void {
		this.submitError.set(null);
		this.isCreateModalOpen.set(true);
	}

	protected closeCreateProjectModal(): void {
		this.isCreateModalOpen.set(false);
		this.isSubmitting.set(false);
		this.submitError.set(null);
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
		this.submitError.set(null);

		this.projectService
			.createProject({
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
					this.isSubmitting.set(false);
					this.submitError.set(this.getCreateErrorMessage(error));
				},
			});
	}

	private getCreateErrorMessage(error: unknown): string {
		if (error instanceof HttpErrorResponse) {
			const details =
				typeof error.error === 'object' &&
				error.error !== null &&
				'detail' in error.error &&
				typeof error.error.detail === 'string'
					? error.error.detail
					: null;
			if (details) {
				return details;
			}
			if (error.status === 0) {
				return 'Cannot reach backend right now. Please try again.';
			}
		}
		return 'Failed to create project. Please try again.';
	}
}
