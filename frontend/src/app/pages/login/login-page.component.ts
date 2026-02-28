import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ROUTES } from '../../app.routes';
import { AuthService } from '../../services/auth.service';
import { take } from 'rxjs';

@Component({
	selector: 'app-login-page',
	imports: [ReactiveFormsModule],
	templateUrl: './login-page.component.html',
	styleUrl: './login-page.component.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
	private readonly destroyRef = inject(DestroyRef);
	private readonly router = inject(Router);
	private readonly formBuilder = inject(FormBuilder);
	private readonly authService = inject(AuthService);

	protected readonly isSubmitting = signal(false);
	protected readonly submitError = signal<string | null>(null);
	protected readonly loginForm = this.formBuilder.nonNullable.group({
		username: ['', [Validators.required]],
		password: ['', [Validators.required]],
	});

	constructor() {
		if (this.authService.isAuthenticated()) {
			void this.router.navigate(['/', ROUTES.PROJECTS]);
		}
	}

	protected login(): void {
		if (this.loginForm.invalid || this.isSubmitting()) {
			this.loginForm.markAllAsTouched();
			return;
		}

		this.isSubmitting.set(true);
		this.submitError.set(null);

		const { username, password } = this.loginForm.getRawValue();
		this.authService
			.login({
				username: username.trim(),
				password,
			})
			.pipe(take(1))
			.subscribe({
				next: () => {
					void this.router.navigate(['/', ROUTES.PROJECTS]);
				},
				error: (error: unknown) => {
					this.isSubmitting.set(false);
					this.submitError.set(this.getLoginErrorMessage(error));
				},
			});
	}

	private getLoginErrorMessage(error: unknown): string {
		if (error instanceof HttpErrorResponse) {
			const detail =
				typeof error.error === 'object' &&
				error.error !== null &&
				'detail' in error.error &&
				typeof error.error.detail === 'string'
					? error.error.detail
					: null;

			if (detail) {
				return detail;
			}

			if (error.status === 0) {
				return 'Cannot reach backend right now. Please try again.';
			}
		}

		return 'Login failed. Please try again.';
	}
}
