export type Project = {
	id: string;
	teamId: string;
	name: string;
	description: string;
};

export type ProjectGrid = {
	id: string;
	projectId: string;
	name: string;
	description: string;
	busCount: number;
};

export type CreateProjectRequest = {
	name: string;
	description: string;
};

export type ExampleProjectKey = 'zurich' | 'tokyo' | 'new-delhi' | 'madrid';

export type InstallExampleProjectRequest = {
	exampleKey: ExampleProjectKey;
	projectName?: string;
	gridName?: string;
};

export type UpdateProjectRequest = {
	name: string;
	description: string;
};

export type CreateGridRequest = {
	name: string;
	description: string;
};
