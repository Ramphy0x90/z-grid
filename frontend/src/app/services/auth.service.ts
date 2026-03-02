import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
};

export type LoginRequest = {
  username: string;
  password: string;
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private static readonly STORAGE_KEY = 'zeus.auth.user';

  private readonly http = inject(HttpClient);
  private readonly loginApiPath = `${environment.apiBaseUrl}/api/auth/login`;
  private readonly currentUserState = signal<AuthUser | null>(this.loadStoredUser());

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = () => this.currentUserState() !== null;

  login$(request: LoginRequest): Observable<AuthUser> {
    return this.http.post<AuthUser>(this.loginApiPath, request).pipe(
      tap((user) => {
        this.currentUserState.set(user);
        localStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(user));
      }),
    );
  }

  logout(): void {
    this.currentUserState.set(null);
    localStorage.removeItem(AuthService.STORAGE_KEY);
  }

  private loadStoredUser(): AuthUser | null {
    const storedUser = localStorage.getItem(AuthService.STORAGE_KEY);
    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      localStorage.removeItem(AuthService.STORAGE_KEY);
      return null;
    }
  }
}
