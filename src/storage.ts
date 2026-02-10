import { Env } from './types';

/**
 * Get the previous top job URL from KV storage
 */
export async function getPreviousTopUrl(env: Env): Promise<string> {
    try {
        const previousUrlData = await env.SENT_JOBS_KV.get('previous_top_url');
        console.log(previousUrlData)
        if (previousUrlData) {
            const jobUrl = JSON.parse(previousUrlData) as string;
            return jobUrl
        }
        return "";
    } catch (err) {
        console.error("Failed to get previous top job URL:", err);
        return "";
    }
}

/**
 * Update the stored top job URL in KV storage
 */
export async function updatePreviousTopUrl(env: Env, currentTopUrl: string): Promise<void> {
    try {
        await env.SENT_JOBS_KV.put('previous_top_url', JSON.stringify(currentTopUrl));
    } catch (err) {
        console.error("Failed to update previous top job URL:", err);
    }
}	
