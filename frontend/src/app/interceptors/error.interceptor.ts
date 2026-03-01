import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';
import { ROUTES } from '../app.routes';
import { AuthService } from '../services/auth.service';

const DEFAULT_ERROR_TITLE = 'Request failed';
const UNAUTHORIZED_STATUSES = new Set([401, 403]);

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
	const toastr = inject(ToastrService);
	const router = inject(Router);
	const authService = inject(AuthService);
	return next(request).pipe(
		catchError((error: unknown) => {
			if (shouldHandleUnauthorized(error, request.url)) {
				authService.logout();
				if (router.url !== `/${ROUTES.LOGIN}`) {
					void router.navigate(['/', ROUTES.LOGIN]);
				}
			}
			toastr.error(toErrorMessage(error), DEFAULT_ERROR_TITLE);
			return throwError(() => error);
		}),
	);
};

const shouldHandleUnauthorized = (error: unknown, requestUrl: string): boolean => {
	if (!(error instanceof HttpErrorResponse)) {
		return false;
	}
	if (!UNAUTHORIZED_STATUSES.has(error.status)) {
		return false;
	}
	if (requestUrl.includes('/api/auth/login') || requestUrl.includes('/api/auth/csrf-token')) {
		return false;
	}
	return true;
};

const toErrorMessage = (error: unknown): string => {
	if (!(error instanceof HttpErrorResponse)) {
		return 'Unexpected error. Please try again.';
	}

	const detail = readErrorDetail(error.error);
	if (detail) {
		return detail;
	}

	if (error.status === 0) {
		return 'Cannot reach backend right now. Please try again.';
	}

	return 'Unexpected server error. Please try again.';
};

const readErrorDetail = (errorPayload: unknown): string | null => {
	if (
		typeof errorPayload === 'object' &&
		errorPayload !== null &&
		'detail' in errorPayload &&
		typeof errorPayload.detail === 'string' &&
		errorPayload.detail.trim().length > 0
	) {
		return errorPayload.detail;
	}
	return null;
};
