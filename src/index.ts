/* =================================================================
  CONFIGURATION
  All config is read from wrangler.toml ([vars] and secrets)
================================================================= */

const REQUEST_HEADERS = {
    'accept': '*/*',
    'accept-language': 'en-GB,en;q=0.8',
    'cookie': 'brw=brw5mznMDPbxOXggK; __Host-airtable-session=eyJzZXNzaW9uSWQiOiJzZXNsaGtPQldHS2VITlBMQyIsImNzcmZTZWNyZXQiOiJYdVZqTVdCVllzaUp5bHdaR21VWm5sT1EifQ==; __Host-airtable-session.sig=wsABHMb8O05x3NF6Se2ky1f3yJZnO4ULZ3QB8LBuWVw; AWSALBTGCORS=/o0hZyLErafzyDP5FXQyPtC2LP0N8OOWuqP6AOiCq2/gMD4jxOsZxMn4jj+tr4oPEqvJJ6Ob/eP3b5EuWkmccRG//XFif1pPUAd8yle1bt8ATlP/6Rrca2bmSX+x1Wnlf/54nT6MN+IU+YVMqLW6NxZhbabrJAaaoJxzuhdyvqB6lAXmchQ=; brwConsent=opt-in',
    'priority': 'u=1, i',
    'sec-ch-ua': '"Brave";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-gpc': '1',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'x-airtable-application-id': 'appjSXAWiVF4d1HoZ',
    'x-airtable-inter-service-client': 'webClient',
    'x-airtable-page-load-id': 'pglZUFnTW74jvbgLz',
    'x-requested-with': 'XMLHttpRequest',
    'x-time-zone': 'America/Los_Angeles',
    'x-user-locale': 'en'
}

// Keys and column IDs centralized in one place
const KV_KEYS = {
  PREVIOUS_TOP_URLS: 'previous_top_urls',
};

const AIRTABLE_COLUMNS = {
  COMPANY: 'fld3l0CHdEtB1J5mc',
  TITLE: 'fld8Y85lQOsSpeVFR',
  URL: 'fld0JOdY3vdhUbQBK',
};



/* =================================================================
  TYPESCRIPT INTERFACES
================================================================= */

export interface Env {
	RESEND_API_KEY_1: string;	
	RESEND_API_KEY_2: string;
	RESEND_API_KEY_3: string;
	RESEND_API_KEY_4: string;
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
		ctx.waitUntil(runAirtableETL(env));
	},
};

/**
 * Main ETL function - COMPARE TOP 100 JOBS
 */
async function runAirtableETL(env: Env): Promise<void> {
	try {
		const { records } = await fetchAirtableData(env);

		if (records) {
			const currentTop100 = records.slice(0, 100);

			const previousTopUrls = await getPreviousTopUrls(env);

			// Find NEW jobs that are ranked higher than any previously sent job
			const newJobs: typeof currentTop100 = [];

			if (previousTopUrls.length > 0) {
				let foundJobIndex = -1;
				// Search through current top 100 for any match with previous URLs
				for (let i = 0; i < currentTop100.length; i++) {
					const jobUrl = getJobUrl(currentTop100[i]);
					if (jobUrl && previousTopUrls.includes(jobUrl)) {
						foundJobIndex = i;
						break; // Break as soon as we find one match
					}
				}

				if (foundJobIndex >= 0) {
					newJobs.push(...currentTop100.slice(0, foundJobIndex));
				} else {
					// If no previous job found in current top 100, send all 100
					newJobs.push(...currentTop100);
				}
			} else {
				newJobs.push(...currentTop100);
			}

			if (newJobs.length > 0) {
				const htmlContent: string = formatJobsAsList(newJobs);
				const recordCount = newJobs.length;

				try {
					await sendEmailWithHtml(env, htmlContent, recordCount);

					// Store all current top 100 URLs for next comparison
					const currentTop100Urls = currentTop100
						.map(job => getJobUrl(job))
						.filter(url => url !== null) as string[];
					await updatePreviousTopUrls(env, currentTop100Urls);
				} catch (emailError) {
					console.error("Failed to send email, not updating stored job IDs:", emailError);
					throw emailError;
				}
			}
		}
	} catch (err: any) {
		console.error("ETL job failed:", err.message);
	}
}

/* =================================================================
  HELPER FUNCTIONS (UPDATED & NEW)
================================================================= */

/**
 * Get the previous top 100 job URLs from KV storage
 */
async function getPreviousTopUrls(env: Env): Promise<string[]> {
	try {
		const previousUrlsData = await env.SENT_JOBS_KV.get(KV_KEYS.PREVIOUS_TOP_URLS);
		if (previousUrlsData) {
			const jobUrls = JSON.parse(previousUrlsData) as string[];
			return jobUrls
		}
		return [];
	} catch (err) {
		console.error("Failed to get previous top job URLs:", err);
		return [];
	}
}

/**
 * Update the stored top 100 job URLs in KV storage
 */
async function updatePreviousTopUrls(env: Env, currentTopUrls: string[]): Promise<void> {
	try {
		await env.SENT_JOBS_KV.put(KV_KEYS.PREVIOUS_TOP_URLS, JSON.stringify(currentTopUrls));
	} catch (err) {
		console.error("Failed to update previous top job URLs:", err);
	}
}

/**
 * Parse date from cell value (unchanged)
 */

/**
 * Sends an email with an HTML body (no attachment).
 */
async function sendEmailWithHtml(env: Env, htmlBody: string, recordCount: number): Promise<void> {

	const subject = `New Jobs Report: ${recordCount} New Jobs Found`;

	const recipients: { to: string; intro: string }[] = [
		{ to: "saginalarishith@gmail.com", intro: `${recordCount} new jobs found.` },
		{ to: "lathagowda1202@gmail.com", intro: `${recordCount} new jobs found.` },
		{ to: "saisravan1023@gmail.com", intro: `${recordCount} new jobs found.` },
		{ to: "poluvvssaikiran@gmail.com", intro: `${recordCount} new jobs found.` },
	];

	const apiKeys: string[] = [
		env.RESEND_API_KEY_1,
		env.RESEND_API_KEY_2,
		env.RESEND_API_KEY_3,
		env.RESEND_API_KEY_4,
	];

	const emailRequests = recipients.map((recipient, index) => {
		const payload = buildEmailPayload(env.FROM_EMAIL, recipient.to, subject, recipient.intro, htmlBody);
		return sendResendEmail(apiKeys[index], payload);
	});

	await Promise.all(emailRequests);
}

function buildEmailPayload(from: string, to: string, subject: string, intro: string, htmlBody: string) {
	return {
		from: `${from}`,
		to: [to],
		subject,
		html: `
		<html>
		  <body>
			<p>${intro}</p>
			${htmlBody}
		  </body>
		</html>
	  `,
	};
}

async function sendResendEmail(apiKey: string, payload: unknown): Promise<void> {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		let errorMessage = "Unknown error";
		try {
			const errorResponse = await response.json();
			errorMessage = (typeof errorResponse === "object" && errorResponse && "message" in errorResponse)
				? (errorResponse as { message?: string }).message || errorMessage
				: JSON.stringify(errorResponse);
			console.error(`Resend API Error (${response.status}): ${JSON.stringify(errorResponse)}`);
		} catch (_) {
			console.error(`Resend API Error (${response.status}): Unable to parse error response`);
		}
		throw new Error(`Failed to send email via Resend: ${errorMessage}`);
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
	const cellValue = (record.cellValuesByColumnId[AIRTABLE_COLUMNS.COMPANY]);
	if (cellValue && typeof cellValue === 'string') {
		return cellValue;
	}

	return 'Unknown Company';
}

/**
 * Extract job title from record
 */
function getJobTitle(record: AirtableRow): string {
	const cellValue = record.cellValuesByColumnId[AIRTABLE_COLUMNS.TITLE];

	if (cellValue && typeof cellValue === 'string' && cellValue.length > 0) {
		return cellValue;
	}

	return 'Unknown Job Title';
}

/**
 * Extract job URL from record
 */
function getJobUrl(record: AirtableRow): string | null {
	const rawCellValue = record.cellValuesByColumnId[AIRTABLE_COLUMNS.URL];
	return extractHttpUrl(rawCellValue);
}

function extractHttpUrl(value: CellValue): string | null {
	if (!value) {
		return null;
	}

	if (typeof value === 'string' && value.startsWith('http')) {
		return value;
	}

	if (Array.isArray(value) && value.length > 0) {
		return extractHttpUrl(value[0]);
	}

	if (typeof value === 'object' && 'url' in value && value.url && typeof value.url === 'string' && value.url.startsWith('http')) {
		return value.url;
	}

	return null;
}

/**
 * Fetches and parses the Airtable data.
 */
async function fetchAirtableData(env: Env): Promise<FetchResult> {
	try {
		const response: Response = await fetch(env.TARGET_URL, {
			headers: REQUEST_HEADERS,
		});
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