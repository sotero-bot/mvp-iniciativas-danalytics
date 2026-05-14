import * as fs from 'fs';
import * as path from 'path';

export async function extractTextFromFile(filePath: string, mimetype: string, originalname: string): Promise<string> {
    const ext = path.extname(originalname).toLowerCase();

    if (
        mimetype.startsWith('text/') ||
        ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml'].includes(ext)
    ) {
        return fs.readFileSync(filePath, 'utf8');
    }

    if (mimetype === 'application/pdf' || ext === '.pdf') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const result = await pdfParse(buffer);
        return result.text;
    }

    if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === '.docx'
    ) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    if (
        mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        ext === '.xlsx' ||
        ext === '.xls'
    ) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(filePath);
        let text = '';
        for (const sheetName of workbook.SheetNames) {
            const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
            text += `\n--- Hoja: ${sheetName} ---\n${csvContent}`;
        }
        return text;
    }

    throw new Error(`Tipo de archivo no soportado: ${ext}`);
}
