import { Env, AirtableRow } from './types';
import { getCompanyName, getJobTitle, getJobUrl } from './parsing';

/**
 * Sends an email with an HTML body (no attachment).
 */
export async function sendEmailWithHtml(env: Env, htmlBody: string, recordCount: number): Promise<void> {

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

	const emailPayload1 = {
		from: `${env.FROM_EMAIL}`,
		to: "lathagowda1202@gmail.com",
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
	const emailPayload2 = {
		from: `${env.FROM_EMAIL}`,
		to: "poluvvssaikiran@gmail.com",
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
	const emailPayload3 = {
		from: `${env.FROM_EMAIL}`,
		to: "Saisravan1023@gmail.com",
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

	const response = await globalThis.fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(emailPayload),
	});
	const response1 = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${env.RESEND_API_KEY_1}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(emailPayload1),
	});
	const response2 = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${env.RESEND_API_KEY_2}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(emailPayload2),
	});
	const response3 = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${env.RESEND_API_KEY_3}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(emailPayload2),
	});

	console.log(response)

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
	}

	// if (!response1.ok) {
	// 	let errorMessage = "Unknown error";
	// 	try {
	// 		const errorResponse = await response.json();
	// 		errorMessage = (typeof errorResponse === "object" && errorResponse && "message" in errorResponse)
	// 			? (errorResponse as { message?: string }).message || errorMessage
	// 			: JSON.stringify(errorResponse);
	// 		console.error(`Resend API Error (${response.status}): ${JSON.stringify(errorResponse)}`);
	// 	} catch (parseErr) {
	// 		console.error(`Resend API Error (${response.status}): Unable to parse error response`);
	// 	}
	// 	throw new Error(`Failed to send email via Resend: ${errorMessage}`);
	// }
	// if (!response2.ok) {
	// 	let errorMessage = "Unknown error";
	// 	try {
	// 		const errorResponse = await response.json();
	// 		errorMessage = (typeof errorResponse === "object" && errorResponse && "message" in errorResponse)
	// 			? (errorResponse as { message?: string }).message || errorMessage
	// 			: JSON.stringify(errorResponse);
	// 		console.error(`Resend API Error (${response.status}): ${JSON.stringify(errorResponse)}`);
	// 	} catch (parseErr) {
	// 		console.error(`Resend API Error (${response.status}): Unable to parse error response`);
	// 	}
	// 	throw new Error(`Failed to send email via Resend: ${errorMessage}`);
	// }
	// if (!response3.ok) {
	// 	let errorMessage = "Unknown error";
	// 	try {
	// 		const errorResponse = await response.json();
	// 		errorMessage = (typeof errorResponse === "object" && errorResponse && "message" in errorResponse)
	// 			? (errorResponse as { message?: string }).message || errorMessage
	// 			: JSON.stringify(errorResponse);
	// 		console.error(`Resend API Error (${response.status}): ${JSON.stringify(errorResponse)}`);
	// 	} catch (parseErr) {
	// 		console.error(`Resend API Error (${response.status}): Unable to parse error response`);
	// 	}
	// 	throw new Error(`Failed to send email via Resend: ${errorMessage}`);
	// }
}

/**
* Formats jobs as a simple list like in the image - Company: Job Title (link)
 */
export function formatJobsAsList(records: AirtableRow[]): string {
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
