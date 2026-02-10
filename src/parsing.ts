import { AirtableRow, AirtableLink } from './types';

/**
 * Extract company name from record
 */
export function getCompanyName(record: AirtableRow): string {
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
export function getJobTitle(record: AirtableRow): string {
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
export function getJobUrl(record: AirtableRow): string | null {
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
