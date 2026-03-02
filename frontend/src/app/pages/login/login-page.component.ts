import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
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

		const { username, password } = this.loginForm.getRawValue();
		this.authService
			.login$({
				username: username.trim(),
				password,
			})
			.pipe(take(1))
			.subscribe({
				next: () => {
					void this.router.navigate(['/', ROUTES.PROJECTS]);
				},
				error: (error: unknown) => {
					void error;
					this.isSubmitting.set(false);
				},
			});
	}
}
