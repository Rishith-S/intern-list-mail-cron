// Environment bindings
export interface Env {
	RESEND_API_KEY: string;
	RESEND_API_KEY_1: string;
	RESEND_API_KEY_2: string;
	RESEND_API_KEY_3: string;
	TO_EMAIL: string;
	FROM_EMAIL: string;
	TARGET_URL: string;
	SENT_JOBS_KV: KVNamespace;
}

// Airtable types
export interface AirtableLink {
	label: string;
	url: string;
}

export type CellValue = string | string[] | AirtableLink | null | undefined;

export interface AirtableRow {
	id: string;
	createdTime: string;
	cellValuesByColumnId: { [columnId: string]: CellValue; };
}

export interface AirtableTableData {
	rows: AirtableRow[];
}

export interface AirtableApiResponse {
	data: { table: AirtableTableData; };
}

export interface FetchResult {
	records: AirtableRow[] | null;
}
