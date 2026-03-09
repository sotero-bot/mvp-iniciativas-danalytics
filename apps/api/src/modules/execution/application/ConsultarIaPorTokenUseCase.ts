import OpenAI from 'openai';
import { AccederInstanciaPorTokenUseCase } from './AccederInstanciaPorTokenUseCase';
import { PrismaService } from '../../../prisma.service';
import * as fs from 'fs';
import * as path from 'path';

async function extractTextFromFile(filePath: string, mimetype: string, originalname: string): Promise<string> {
    const ext = path.extname(originalname).toLowerCase();

    // Plain text / markdown / csv
    if (
        mimetype.startsWith('text/') ||
        ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml'].includes(ext)
    ) {
        return fs.readFileSync(filePath, 'utf8');
    }

    // PDF
    if (mimetype === 'application/pdf' || ext === '.pdf') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const result = await pdfParse(buffer);
        return result.text;
    }

    // Word .docx
    if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === '.docx'
    ) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    // Excel .xlsx
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

export class ConsultarIaPorTokenUseCase {
    private openai: OpenAI;

    constructor(
        private readonly accederUseCase: AccederInstanciaPorTokenUseCase,
        private readonly prisma: PrismaService,
    ) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
        });
    }

    async execute(
        token: string,
        pasoId: string,
        respuestaUsuario: string,
        customPrompt?: string,
        file?: { path: string; mimetype: string; originalname: string }
    ): Promise<string> {
        await this.accederUseCase.execute(token);

        const paso = await this.prisma.pasoActividad.findUnique({
            where: { id: pasoId }
        });

        if (!paso) throw new Error('Paso no encontrado');
        if (!paso.usarIa) throw new Error('El paso no tiene habilitada la IA');

        const systemPrompt = customPrompt || paso.promptIa ||
            'Eres un experto evaluando respuestas. Revisa el texto proporcionado y ofrece feedback constructivo.';

        // Build user message: text + file content if provided
        let userMessage = respuestaUsuario;
        if (file) {
            try {
                const fileText = await extractTextFromFile(file.path, file.mimetype, file.originalname);
                const truncated = fileText.length > 15000 ? fileText.slice(0, 15000) + '\n\n[...contenido truncado por longitud...]' : fileText;
                userMessage = `${respuestaUsuario}\n\n--- Contenido del archivo adjunto (${file.originalname}) ---\n${truncated}`;
            } finally {
                // Clean up temp file
                try { fs.unlinkSync(file.path); } catch { /* ignore */ }
            }
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
            });

            return response.choices[0].message?.content || 'Sin respuesta de IA';
        } catch (error) {
            console.error('Error al consultar OpenAI:', error);
            throw new Error('Error al procesar la solicitud con IA');
        }
    }
}
