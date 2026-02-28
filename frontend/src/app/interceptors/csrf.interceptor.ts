import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { CsrfTokenService } from '../services/csrf-token.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
	const csrfTokenService = inject(CsrfTokenService);
	const requestWithCredentials = request.clone({ withCredentials: true });

	if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
		return next(requestWithCredentials);
	}

	if (request.headers.has('X-CSRF-TOKEN')) {
		return next(requestWithCredentials);
	}

	return csrfTokenService.getCsrfToken().pipe(
		switchMap((csrfToken) =>
			next(
				requestWithCredentials.clone({
					setHeaders: {
						[csrfToken.headerName]: csrfToken.token,
					},
				}),
			),
		),
	);
};
