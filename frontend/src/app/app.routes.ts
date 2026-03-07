import { Type } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export type AppPage = {
	id: string;
	label: string;
	shortLabel: string;
	icon: string;
};

export type AppPageGroup = {
	id: 'grid' | 'static-calculation';
	label: string;
	shortLabel: string;
	icon: string;
	children: readonly AppPage[];
};

export const enum ROUTES {
	LOGIN = 'login',
	PROJECTS = 'projects',
	SETTINGS = 'settings',
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
			{ id: 'grid-editor', label: 'Grid Editor', shortLabel: 'GE', icon: 'bi-pencil-square' },
			{ id: 'grid-upgrade', label: 'Grid Upgrade', shortLabel: 'GU', icon: 'bi-arrow-up-circle' },
		],
	},
	{
		id: 'static-calculation',
		label: 'Static calculation',
		shortLabel: 'S',
		icon: 'bi-calculator',
		children: [
			{ id: 'power-flow', label: 'Power Flow', shortLabel: 'PF', icon: 'bi-lightning-charge' },
			{ id: 'power-quality', label: 'Power Quality', shortLabel: 'PQ', icon: 'bi-soundwave' },
			{ id: 'hosting-capacity', label: 'Hosting Capacity', shortLabel: 'HC', icon: 'bi-bar-chart-line' },
			{ id: 'short-circuit', label: 'Short Circuit', shortLabel: 'SC', icon: 'bi-exclamation-triangle' },
		],
	},
];

export const PAGES: readonly AppPage[] = PAGE_GROUPS.flatMap((group) => group.children);

const pageLoaders: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
	'grid-editor': () =>
		import('./pages/grid-editor/grid-editor-page.component').then(
			(module) => module.GridEditorPageComponent,
		),
	'grid-upgrade': () =>
		import('./pages/grid-upgrade/grid-upgrade-page.component').then(
			(module) => module.GridUpgradePageComponent,
		),
	'power-flow': () =>
		import('./pages/power-flow/power-flow-page.component').then(
			(module) => module.PowerFlowPageComponent,
		),
	'power-quality': () =>
		import('./pages/power-quality/power-quality-page.component').then(
			(module) => module.PowerQualityPageComponent,
		),
	'hosting-capacity': () =>
		import('./pages/hosting-capacity/hosting-capacity-page.component').then(
			(module) => module.HostingCapacityPageComponent,
		),
	'short-circuit': () =>
		import('./pages/short-circuit/short-circuit-page.component').then(
			(module) => module.ShortCircuitPageComponent,
		),
};

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
		path: ROUTES.LOGIN,
		loadComponent: () =>
			import('./pages/login/login-page.component').then(
				(module) => module.LoginPageComponent,
			),
	},
	{
		path: ROUTES.PROJECTS,
		canActivate: [authGuard],
		loadComponent: () =>
			import('./pages/projects/projects-page.component').then(
				(module) => module.ProjectsPageComponent,
			),
	},
	{
		path: ROUTES.SETTINGS,
		canActivate: [authGuard],
		loadComponent: () =>
			import('./pages/settings/settings-page.component').then(
				(module) => module.SettingsPageComponent,
			),
	},
	{
		path: `:${ROUTE_PARAMS.PROJECT_ID}`,
		canActivate: [authGuard],
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: DEFAULT_PROJECT_PAGE,
			},
			...PAGES.map((page) => ({
				path: page.id,
				loadComponent: pageLoaders[page.id] ?? pageLoaders[DEFAULT_PROJECT_PAGE],
				data: { pageId: page.id },
			})),
		],
	},
	{
		path: '**',
		redirectTo: ROUTES.PROJECTS,
	},
];
