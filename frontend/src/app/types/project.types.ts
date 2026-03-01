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

export type CreateGridRequest = {
	name: string;
	description: string;
};
