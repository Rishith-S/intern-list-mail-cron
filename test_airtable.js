const https = require('https');

// Extracted from the HTML output in the previous step
const accessPolicy = JSON.stringify({
    "allowedActions": [
        {"modelClassName":"view","modelIdSelector":"viw61qgWuwtIvkyIP","action":"readSharedViewData"},
        {"modelClassName":"view","modelIdSelector":"viw61qgWuwtIvkyIP","action":"getMetadataForPrinting"},
        {"modelClassName":"view","modelIdSelector":"viw61qgWuwtIvkyIP","action":"readSignedAttachmentUrls"},
        {"modelClassName":"row","modelIdSelector":"rows *[displayedInView=viw61qgWuwtIvkyIP]","action":"createDocumentPreviewSession"},
        {"modelClassName":"view","modelIdSelector":"viw61qgWuwtIvkyIP","action":"downloadCsv"},
        {"modelClassName":"view","modelIdSelector":"viw61qgWuwtIvkyIP","action":"downloadICal"},
        {"modelClassName":"row","modelIdSelector":"rows *[displayedInView=viw61qgWuwtIvkyIP]","action":"downloadAttachment"}
    ],
    "shareId": "shrOTtndhc6HSgnYb",
    "applicationId": "app17F0kkWQZhC6HB",
    "generationNumber": 0,
    "expires": "2026-01-29T00:00:00.000Z",
    "signature": "c01aaa74c722543d347340a337c8340a7f1019dc7ba7a908ea4d3530bc54cafa"
});

const viewId = 'viw61qgWuwtIvkyIP';
const requestId = 'req' + Math.random().toString(36).substr(2, 5); // Random request ID

const params = new URLSearchParams({
    stringifiedObjectParams: JSON.stringify({ shouldUseNestedResponseFormat: true }),
    requestId: requestId,
    accessPolicy: accessPolicy
});

const url = `https://airtable.com/v0.3/view/${viewId}/readSharedViewData?${params.toString()}`;

console.log('Fetching URL:', url);

https.get(url, {
    headers: {
        'x-airtable-application-id': 'app17F0kkWQZhC6HB',
        'x-requested-with': 'XMLHttpRequest',
        'x-user-locale': 'en',
        'x-time-zone': 'America/Los_Angeles'
    }
}, (res) => {
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => console.log('Body length:', data.length));
}).on('error', (e) => {
    console.error(e);
});