import { Env, FetchResult, AirtableApiResponse, AirtableRow } from './types';
import { AIRTABLE_CONFIG } from './config';

/**
 * Fetches and parses the Airtable data by dynamically getting the fresh access tokens.
 */
export async function fetchAirtableData(env: Env): Promise<FetchResult> {
    try {
        console.log(`\n========== 1. FETCHING EMBED PAGE ==========`);
        console.log(`Embed URL: ${AIRTABLE_CONFIG.EMBED_URL}`);
        
        // 1. Fetch the embed page to get the "accessPolicy"
        const embedResponse = await globalThis.fetch(AIRTABLE_CONFIG.EMBED_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!embedResponse.ok) console.warn("Embed fetch status:", embedResponse.status);
        const embedText = await embedResponse.text();

        // 2. Extract accessPolicy
        let accessPolicyStr = "";
        
        // First try: Look for URL-encoded accessPolicy in the HTML (e.g. inside preloaded data or fetch calls)
        // It typically looks like: ...&accessPolicy=%7B%22allowedActions...
        const urlMatch = embedText.match(/accessPolicy=([^&"]+)/);
        
        if (urlMatch) {
            try {
                accessPolicyStr = decodeURIComponent(urlMatch[1]);
                console.log("Found accessPolicy via URL parameter match");
            } catch (e) {
                console.warn("Failed to decode URL matched accessPolicy");
            }
        }
        
        // Second try: Look for JSON stringified version if first failed
        if (!accessPolicyStr || accessPolicyStr.length < 10) {
            const jsonMatch = embedText.match(/"accessPolicy":"(.*?)"/);
            if (jsonMatch) {
                let rawMatch = jsonMatch[1];
                try {
                    // Handle doubly escaped JSON strings if present
                    if (rawMatch.startsWith('\\"')) {
                        accessPolicyStr = JSON.parse(`"${rawMatch}"`);
                    } else {
                        accessPolicyStr = rawMatch;
                    }
                    console.log("Found accessPolicy via JSON string match");
                } catch (e) {
                    console.warn("Failed to parse JSON matched accessPolicy");
                }
            }
        }

        if (!accessPolicyStr || accessPolicyStr.length < 10) {
            console.error("Could not find valid accessPolicy in embed page HTML");
            throw new Error("Failed to extract accessPolicy from Airtable embed");
        }
        
        console.log(`Access Policy found (length: ${accessPolicyStr.length})`);
        
        // 3. Construct the API URL
        const requestId = `req${Math.random().toString(36).substring(2, 7)}`;
        const params = new URLSearchParams({
            stringifiedObjectParams: JSON.stringify({ shouldUseNestedResponseFormat: true }),
            requestId: requestId,
            accessPolicy: accessPolicyStr // This expects the JSON string of the policy
        });

        const apiUrl = `https://airtable.com/v0.3/view/${AIRTABLE_CONFIG.VIEW_ID}/readSharedViewData?${params.toString()}`;
        
        console.log(`\n========== 2. FETCHING DATA FROM API ==========`);
        console.log(`API URL constructed successfully`);

        // 4. Fetch the actual data
        const response: Response = await globalThis.fetch(apiUrl, { 
            headers: {
                'x-airtable-application-id': AIRTABLE_CONFIG.APP_ID,
                'x-requested-with': 'XMLHttpRequest',
                'x-user-locale': 'en',
                'x-time-zone': 'America/Los_Angeles',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
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
