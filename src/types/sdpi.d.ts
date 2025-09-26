export type Item = {
	disabled?: boolean;
	label?: string;
	value: string;
};

export type ItemGroup = {
	label?: string;
	children: Item[];
};

export type DataSourceResultItem = Item | ItemGroup;

export type DataSourceResult = DataSourceResultItem[];

export type DataSourcePayload = {
	event: string;
	items: DataSourceResult;
};