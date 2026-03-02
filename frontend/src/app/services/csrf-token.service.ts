import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type CsrfTokenResponse = {
  headerName: string;
  parameterName: string;
  token: string;
};

@Injectable({
  providedIn: 'root',
})
export class CsrfTokenService {
  private readonly httpBackend = inject(HttpBackend);
  private readonly http = new HttpClient(this.httpBackend);
  private readonly csrfTokenApiPath = `${environment.apiBaseUrl}/api/auth/csrf-token`;
  private readonly csrfTokenState = signal<CsrfTokenResponse | null>(null);

  getCsrfToken$(): Observable<CsrfTokenResponse> {
    const cachedToken = this.csrfTokenState();
    if (cachedToken) {
      return of(cachedToken);
    }

    return this.http
      .get<CsrfTokenResponse>(this.csrfTokenApiPath, { withCredentials: true })
      .pipe(tap((token) => this.csrfTokenState.set(token)));
  }
}
