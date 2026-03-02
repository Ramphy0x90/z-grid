import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DEFAULT_PROJECT_PAGE, ROUTES, toProjectPageCommands, toProjectsCommands } from '../app.routes';

export type WorkspaceRouteState = {
	isLoginRoute: boolean;
	isWorkspaceRoute: boolean;
	projectId: string | null;
	pageId: string | null;
};

@Injectable({
	providedIn: 'root',
})
export class WorkspaceRouteService {
	private readonly router = inject(Router);

	readCurrentRoute(): WorkspaceRouteState {
		const urlTree = this.router.parseUrl(this.router.url);
		const segments = urlTree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
		const [firstSegment, secondSegment] = segments;
		const isLoginRoute = firstSegment === ROUTES.LOGIN;
		const hasPrimarySegment = typeof firstSegment === 'string' && firstSegment.length > 0;
		const isWorkspaceRoute = hasPrimarySegment && !isLoginRoute && firstSegment !== ROUTES.PROJECTS;
		return {
			isLoginRoute,
			isWorkspaceRoute,
			projectId: isWorkspaceRoute ? firstSegment : null,
			pageId: secondSegment ?? null,
		};
	}

	ensureValidProjectRoute(
		validProjectIds: readonly string[],
		selectedProjectId: string | null,
		selectedPageId: string | null,
	): void {
		if (selectedProjectId && validProjectIds.includes(selectedProjectId)) {
			return;
		}
		if (validProjectIds.length === 0) {
			void this.router.navigate([...toProjectsCommands()]);
			return;
		}
		const fallbackProjectId = validProjectIds[0];
		const pageId = selectedPageId ?? DEFAULT_PROJECT_PAGE;
		void this.router.navigate([...toProjectPageCommands(fallbackProjectId, pageId)]);
	}
}
