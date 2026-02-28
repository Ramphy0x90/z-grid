import { Routes } from '@angular/router';

export type AppPage = {
	id: string;
	label: string;
	shortLabel: string;
};

export type AppPageGroup = {
	id: 'grid' | 'static-calculation';
	label: string;
	shortLabel: string;
	icon: string;
	children: readonly AppPage[];
};

export const enum ROUTES {
	PROJECTS = 'projects',
}

export const ROUTE_PARAMS = {
	PROJECT_ID: 'projectId',
} as const;

export const DEFAULT_PROJECT_PAGE = 'grid-editor';

export const PAGE_GROUPS: readonly AppPageGroup[] = [
	{
		id: 'grid',
		label: 'Grid',
		shortLabel: 'G',
		icon: 'bi-grid-3x3-gap',
		children: [
			{ id: 'grid-editor', label: 'Grid Editor', shortLabel: 'GE' },
			{ id: 'grid-upgrade', label: 'Grid Upgrade', shortLabel: 'GU' },
		],
	},
	{
		id: 'static-calculation',
		label: 'Static calculation',
		shortLabel: 'S',
		icon: 'bi-calculator',
		children: [
			{ id: 'power-flow', label: 'Power Flow', shortLabel: 'PF' },
			{ id: 'hosting-capacity', label: 'Hosting Capacity', shortLabel: 'HC' },
			{ id: 'short-circuit', label: 'Short Circuit', shortLabel: 'SC' },
		],
	},
];

export const PAGES: readonly AppPage[] = PAGE_GROUPS.flatMap((group) => group.children);

export const toProjectsCommands = (): readonly [string, ROUTES.PROJECTS] => ['/', ROUTES.PROJECTS];

export const toProjectPageCommands = (
	projectId: string,
	pageId: string,
): readonly [string, string, string] => ['/', projectId, pageId];

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: ROUTES.PROJECTS,
	},
	{
		path: ROUTES.PROJECTS,
		loadComponent: () =>
			import('./pages/projects/projects-page.component').then(
				(module) => module.ProjectsPageComponent,
			),
	},
	{
		path: `:${ROUTE_PARAMS.PROJECT_ID}`,
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: DEFAULT_PROJECT_PAGE,
			},
			...PAGES.map((page) => ({
				path: page.id,
				loadComponent: () =>
					import('./pages/workspace/workspace-page.component').then(
						(module) => module.WorkspacePageComponent,
					),
				data: { pageId: page.id },
			})),
		],
	},
	{
		path: '**',
		redirectTo: ROUTES.PROJECTS,
	},
];
