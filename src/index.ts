/* =================================================================
  WORKER ENTRYPOINT (CRON TRIGGER)
================================================================= */
import { Env } from './types';
import { fetchAirtableData } from './airtable';
import { getCompanyName, getJobTitle, getJobUrl } from './parsing';
import { getPreviousTopUrl, updatePreviousTopUrl } from './storage';
import { sendEmailWithHtml, formatJobsAsList } from './email';

export default {
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(runAirtableETL(env));
	},

	// Minimal HTTP handler for local `wrangler dev` testing.
	// Use `?test=true` to trigger the scheduled ETL once.
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);
			if (url.searchParams.get('test') === 'true') {
				ctx.waitUntil(runAirtableETL(env));
				return new Response('Triggered runAirtableETL', { status: 200 });
			}
			return new Response('OK', { status: 200 });
		} catch (err: any) {
			return new Response(String(err?.message || err), { status: 500 });
		}
	}
};

/**
 * Main ETL function - COMPARE TOP 100 JOBS
 */
async function runAirtableETL(env: Env): Promise<void> {
	try {
        console.log("Starting ETL process...");
		const { records } = await fetchAirtableData(env);

		if (records) {
			console.log(`\n========== DEBUG: FETCHED RECORDS ==========`);
			console.log(`Total records fetched: ${records.length}`);
			
			const currentTop100 = records.slice(0, 100);
			console.log(`\n========== DEBUG: TOP 100 JOBS ==========`);
			console.log(`Top 100 count: ${currentTop100.length}`);
			
			// Print first 5 jobs for debugging
			console.log(`\nFirst 5 jobs:`);
			currentTop100.slice(0, 5).forEach((job, index) => {
				const company = getCompanyName(job);
				const title = getJobTitle(job);
				const url = getJobUrl(job);
				console.log(`${index + 1}. ${company} - ${title}`);
				console.log(`   URL: ${url}`);
			});

			// Get the previous top job URL
			const previousTopUrl = await getPreviousTopUrl(env);
			console.log(`\n========== DEBUG: PREVIOUS TOP URL ==========`);
			console.log(`Previous top URL: ${previousTopUrl || '(none - first run)'}`);
			console.log(`==========================================\n`);

            // Find NEW jobs that are ranked higher than the previously sent job
            const newJobs: typeof currentTop100 = [];
            
            if (previousTopUrl) {
                // Find the position of the previously sent job in current rankings
                let previousJobIndex = -1;
                for (let i = 0; i < currentTop100.length; i++) {
                    const jobUrl = getJobUrl(currentTop100[i]);
                    if (jobUrl === previousTopUrl) {
                        previousJobIndex = i;
                        break;
                    }
                }
                
                console.log(`\n========== DEBUG: NEW JOBS LOGIC ==========`);
                console.log(`Previous job found at index: ${previousJobIndex}`);
                
                if (previousJobIndex >= 0) {
                    // Only send jobs that are ranked higher (better) than the previously sent job
                    newJobs.push(...currentTop100.slice(0, previousJobIndex));
                    console.log(`New jobs count (ranked higher): ${newJobs.length}`);
                } else {
                    // Previous job not found in current top 100, send all jobs
                    newJobs.push(...currentTop100);
                    console.log(`Previous job not in top 100 - sending all ${newJobs.length} jobs`);
                }
            } else {
                // No previous job URL stored, send all jobs
                newJobs.push(...currentTop100);
                console.log(`\n========== DEBUG: NEW JOBS LOGIC ==========`);
                console.log(`No previous URL - sending all ${newJobs.length} jobs (first run)`);
            }
            
            console.log(`\nNew jobs to send:`);
            newJobs.slice(0, 3).forEach((job, index) => {
                const company = getCompanyName(job);
                const title = getJobTitle(job);
                console.log(`${index + 1}. ${company} - ${title}`);
            });
            if (newJobs.length > 3) {
                console.log(`... and ${newJobs.length - 3} more`);
            }
            console.log(`==========================================\n`);

			if (newJobs.length > 0) {
				// Send only the NEW jobs
				const htmlContent: string = formatJobsAsList(newJobs);
				const recordCount = newJobs.length;

				try {
					// Pass the HTML string directly to the send function
					await sendEmailWithHtml(env, htmlContent, recordCount);

					// Update the stored top job URL ONLY AFTER successfully sending email
					const lastJobUrl = getJobUrl(newJobs[0]);
					if (lastJobUrl) {
						await updatePreviousTopUrl(env, lastJobUrl);
					}
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
