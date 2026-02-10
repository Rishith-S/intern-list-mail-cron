
const fs = require('fs');

async function debugAccessPolicy() {
    const url = "https://airtable.com/embed/app17F0kkWQZhC6HB/shrOTtndhc6HSgnYb";
    
    console.log(`Fetching ${url}...`);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    });
    
    const text = await response.text();
    console.log(`Fetched ${text.length} bytes.`);
    
    // Find all indexes
    const indices = [];
    let pos = text.indexOf("accessPolicy");
    while (pos !== -1) {
        indices.push(pos);
        pos = text.indexOf("accessPolicy", pos + 1);
    }
    
    console.log(`Found ${indices.length} occurrences.`);
    
    indices.forEach((idx, i) => {
        console.log(`\nOccurrence ${i+1} at ${idx}:`);
        console.log(text.substring(idx - 10, idx + 200));
    });

    // Try the regex
    const regex = /"accessPolicy":"(.*?)"/;
    const match = text.match(regex);
    if (match) {
        console.log("\nRegex match[1]:");
        console.log(match[1]);
        console.log("Length:", match[1].length);
    } else {
        console.log("\nRegex failed to match.");
    }
}

debugAccessPolicy();
