/* =================================================================
  CONFIGURATION
  All config is read from wrangler.toml ([vars] and secrets)
================================================================= */

const REQUEST_HEADERS: Record<string, string> = {
	'accept': '*/*',
	'accept-language': 'en-GB,en;q=0.8',
	'cookie': 'brw=brwRC5FOZ6HDymkcC; __Host-airtable-session=eyJzZXNzaW9uSWQiOiJzZXN6cHBDc2FuQldSdUdzQSIsImNzcmZTZWNyZXQiOiJlN2d0RDU1OVR3TGlZTTI0QnMyZlRIeHoifQ==; __Host-airtable-session.sig=U5CO9zIg-Jh7aD3jp4-xcx1TRxxSITYVwOP_ZYUiBVo; AWSALBTGCORS=dAiRwMcW4i/f7gic6/DG0kS71TOibYiWeSTKMBM6hSJC9EN99sPZb54AJ9hQ7DIVoZJgK5qeAp87C76lOSM/XHMJDlduN3F2U2+nKlaBsoejoT5cjliXAQavivZhG96vl69bYBypZlX71rofzf6UDhM/nZtLrGo1H4uKZ9uddVMOGhiZS9Q=; brwConsent=opt-in',
	'priority': 'u=1, i',
	'sec-ch-ua': '"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"',
	'sec-ch-ua-mobile': '?0',
	'sec-ch-ua-platform': '"macOS"',
	'sec-fetch-dest': 'empty',
	'sec-fetch-mode': 'cors',
	'sec-fetch-site': 'same-origin',
	'sec-fetch-storage-access': 'none',
	'sec-gpc': '1',
	'traceparent': '00-1ecd47058a5a2926b929ee5b7a30f892-9be1f61f07eb099d-01',
	'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
	'x-airtable-accept-msgpack': 'true',
	'x-airtable-application-id': 'app17F0kkWQZhC6HB',
	'x-airtable-inter-service-client': 'webClient',
	'x-airtable-page-load-id': 'pglj5n2j8O7zLgn8j',
	'x-early-prefetch': 'true',
	'x-requested-with': 'XMLHttpRequest',
	'x-time-zone': 'America/Los_Angeles',
	'x-user-locale': 'en'
};

/* =================================================================
  TYPESCRIPT INTERFACES
================================================================= */

export interface Env {
	RESEND_API_KEY: string;
	TO_EMAIL: string;
	FROM_EMAIL: string;
	TARGET_URL: string;
	SENT_JOBS_KV: KVNamespace;
}

// Airtable types (unchanged)
interface AirtableLink {
	label: string;
	url: string;
}
type CellValue = string | string[] | AirtableLink | null | undefined;
interface AirtableRow {
	id: string;
	createdTime: string;
	cellValuesByColumnId: { [columnId: string]: CellValue; };
}
interface AirtableTableData {
	rows: AirtableRow[];
}
interface AirtableApiResponse {
	data: { table: AirtableTableData; };
}
interface FetchResult {
	records: AirtableRow[] | null;
}


/* =================================================================
  WORKER ENTRYPOINT (CRON TRIGGER)
================================================================= */

export default {
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log("Cron triggered: Starting Airtable fetch-and-email (Resend) job...");
		ctx.waitUntil(runAirtableETL(env));
	},
};

/**
 * Main ETL function - COMPARE TOP 350 JOBS
 */
async function runAirtableETL(env: Env): Promise<void> {
	try {
		const { records } = await fetchAirtableData(env);

		if (records) {
			console.log(`Successfully fetched ${records.length} records. Processing jobs...`);
		
			// Get the previous top 350 job IDs
			const previousTopId = await getPreviousTopId(env);

			console.log(`Previous top job ID: ${previousTopId}`);

			const currentTop350 = records.slice(0, 350);

			// Find NEW jobs that weren't in the previous top 350
			const newJobs: typeof currentTop350 = [];
			for (const record of currentTop350) {
				if (previousTopId === record.id) {
					break;
				}
				newJobs.push(record);
			}
			console.log(`Found ${newJobs.length} NEW jobs that weren't in previous top 350.`);

			
			if (newJobs.length > 0) {
				console.log(`New jobs: ${newJobs[0].id}`);
				// Send only the NEW jobs
				const htmlContent: string = formatJobsAsList(newJobs);
				const recordCount = newJobs.length;

				try {
					// Pass the HTML string directly to the send function
					await sendEmailWithHtml(env, htmlContent, recordCount);

					// Update the stored top 350 job IDs ONLY AFTER successfully sending email
					await updatePreviousTopId(env, newJobs[0].id);

					console.log(`Successfully sent ${recordCount} NEW jobs to ${env.TO_EMAIL}.`);
				} catch (emailError) {
					console.error("Failed to send email, not updating stored job IDs:", emailError);
					throw emailError;
				}
			} else {
				console.log("No new jobs to send - all top 350 jobs were already sent before.");
			}

		} else {
			console.log("Script failed to fetch any data from Airtable.");
		}
	} catch (err: any) {
		console.error("ETL job failed:", err.message);
	}
}

/* =================================================================
  HELPER FUNCTIONS (UPDATED & NEW)
================================================================= */

/**
 * Get the previous top job ID from KV storage
 */
async function getPreviousTopId(env: Env): Promise<string> {
	try {
		const previousIdsData = await env.SENT_JOBS_KV.get('previous_top_id');
		if (previousIdsData) {
			const jobId = JSON.parse(previousIdsData) as string;
			return jobId
		}
		return "";
	} catch (err) {
		console.error("Failed to get previous top job ID:", err);
		return "";
	}
}

/**
 * Update the stored top job ID in KV storage
 */
async function updatePreviousTopId(env: Env, currentTopId: string): Promise<void> {
	try {
		await env.SENT_JOBS_KV.put('previous_top_id', JSON.stringify(currentTopId));
		console.log(`Updated stored top job ID to ${currentTopId}.`);
	} catch (err) {
		console.error("Failed to update previous top job ID:", err);
	}
}

/**
 	* Extract job date from record
 */
function getJobDate(record: AirtableRow): Date | null {
	const date = parseDate(record.createdTime);
	return date;
}

/**
 * Parse date from cell value (unchanged)
 */
function parseDate(cellValue: CellValue): Date | null {
	if (!cellValue) return null;

	// Handle string value		
	if (typeof cellValue === 'string') {
		const isoDate = new Date(cellValue);
		if (!isNaN(isoDate.getTime())) return isoDate;
	}
	return null;
}

/**
 * Sends an email with an HTML body (no attachment).
 */
async function sendEmailWithHtml(env: Env, htmlBody: string, recordCount: number): Promise<void> {

	const emailPayload = {
		from: `${env.FROM_EMAIL}`,
		to: env.TO_EMAIL,
		subject: `New Jobs Report: ${recordCount} New Jobs Found`,

		html: `
		<html>
		  <body>
			<p>Here are the new jobs found in the latest scan. ${recordCount} new jobs found.</p>
			${htmlBody}
		  </body>
		</html>
	  `,
	};

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(emailPayload),
	});

	if (!response.ok) {
		let errorMessage = "Unknown error";
		try {
			const errorResponse = await response.json();
			errorMessage = (typeof errorResponse === "object" && errorResponse && "message" in errorResponse)
				? (errorResponse as { message?: string }).message || errorMessage
				: JSON.stringify(errorResponse);
			console.error(`Resend API Error (${response.status}): ${JSON.stringify(errorResponse)}`);
		} catch (parseErr) {
			console.error(`Resend API Error (${response.status}): Unable to parse error response`);
		}
		throw new Error(`Failed to send email via Resend: ${errorMessage}`);
	} else {
		console.log("HTML Email sent successfully via Resend.");
	}
}

/**
* Formats jobs as a simple list like in the image - Company: Job Title (link)
 */
function formatJobsAsList(records: AirtableRow[]): string {
	// Add some basic CSS for the list
	const style = `
	  <style>
		.job-list {
		  font-family: Arial, sans-serif;
		  line-height: 1.6;
		  color: #333;
		}
		.job-item {
		  margin-bottom: 12px;
		  padding: 8px 0;
		}
		.company-name {
		  font-weight: bold;
		  color: #000;
		}
		.job-title {
		  color: #0066cc;
		  text-decoration: underline;
		}
		.job-title:hover {
		  color: #004499;
		}
	  </style>
	`;

	// Build the job list
	const jobItems = records.map(record => {
		const companyName = getCompanyName(record);
		const jobTitle = getJobTitle(record);
		const jobUrl = getJobUrl(record);

		const jobTitleHtml = jobUrl
			? `<a href="${jobUrl}" class="job-title" target="_blank">${jobTitle}</a>`
			: `<span class="job-title">${jobTitle}</span>`;

		return `<div class="job-item"><span class="company-name">${companyName}:</span> ${jobTitleHtml}</div>`;
	}).join('');

	return `${style}<div class="job-list">${jobItems}</div>`;
}

/**
 * Extract company name from record
 */
function getCompanyName(record: AirtableRow): string {
	const companyColumn = "fldpdL6kzApwtHAAq";

	const cellValue = (record.cellValuesByColumnId[companyColumn]);
	if (cellValue && typeof cellValue === 'string') {
		return cellValue;
	}

	return 'Unknown Company';
}

/**
 * Extract job title from record
 */
function getJobTitle(record: AirtableRow): string {
	const titleColumn = "fldiDLYrIz09i4roI";
	const cellValue = record.cellValuesByColumnId[titleColumn];

	if (cellValue && typeof cellValue === 'string' && cellValue.length > 0) {
		return cellValue;
	}

	return 'Unknown Job Title';
}

/**
 * Extract job URL from record
 */
	function getJobUrl(record: AirtableRow): string | null {
	const urlColumn = "fldyiaxKyYILOF7wH";

	const cellValue = (record.cellValuesByColumnId[urlColumn] as AirtableLink).url;

	if (cellValue) {
			// Handle string URLs
			if (typeof cellValue === 'string' && cellValue.startsWith('http')) {
				return cellValue;
			}
			// Handle link objects
			if (typeof cellValue === 'object' && cellValue !== null && (cellValue as any).url) {
				return (cellValue as any).url;
			}
			// Handle arrays
			if (Array.isArray(cellValue) && cellValue.length > 0) {
				const firstItem = cellValue[0];
				if (typeof firstItem === 'string' && firstItem.startsWith('http')) {
					return firstItem;
				}
				if (typeof firstItem === 'object' && firstItem !== null && (firstItem as any).url) {
					return (firstItem as any).url;
				}
			}
	}

	return null;
}

/**
 * Fetches and parses the Airtable data.
 */
async function fetchAirtableData(env: Env): Promise<FetchResult> {
	console.log("Fetching Airtable data...");
	try {
		const response: Response = await fetch(env.TARGET_URL, { headers: REQUEST_HEADERS });
		if (!response.ok) {
			throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
		}

		const data: AirtableApiResponse = await response.json();
		const records: AirtableRow[] = data.data.table.rows;

		return { records };

	} catch (err: any) {
		console.error("Failed during fetch:", err.message);
		throw err;
	}
}