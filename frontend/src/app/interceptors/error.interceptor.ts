import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, throwError } from 'rxjs';

const DEFAULT_ERROR_TITLE = 'Request failed';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
	const toastr = inject(ToastrService);
	return next(request).pipe(
		catchError((error: unknown) => {
			toastr.error(toErrorMessage(error), DEFAULT_ERROR_TITLE);
			return throwError(() => error);
		}),
	);
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
