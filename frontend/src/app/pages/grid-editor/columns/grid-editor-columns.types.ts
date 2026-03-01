export type PaneId =
	| 'buses'
	| 'lines'
	| 'transformers'
	| 'loads'
	| 'generators'
	| 'shuntCompensators';

export type TableColumn = {
	key: string;
	label: string;
};
