import OpenAI from 'openai';
import { AccederInstanciaPorTokenUseCase } from './AccederInstanciaPorTokenUseCase';
import { PrismaService } from '../../../prisma.service';
import * as fs from 'fs';
import { extractTextFromFile } from '../../../shared/utils/extractTextFromFile';

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
            where: { id: pasoId },
            include: {
                actividad: {
                    include: {
                        iniciativa: {
                            include: { empresa: true }
                        }
                    }
                }
            }
        });

        if (!paso) throw new Error('Paso no encontrado');
        if (!paso.usarIa) throw new Error('El paso no tiene habilitada la IA');

        const empresa = paso.actividad.iniciativa.empresa;

        const lineas: string[] = ['CONTEXTO DE LA EMPRESA:'];
        lineas.push(`- Nombre de la empresa: ${empresa.nombre}`);
        if (empresa.contextoPdfTexto) {
            const ctx = empresa.contextoPdfTexto.length > 8000
                ? empresa.contextoPdfTexto.slice(0, 8000) + '\n[...contenido truncado...]'
                : empresa.contextoPdfTexto;
            lineas.push(`- Documento de contexto interno de la empresa:\n${ctx}`);
        }
        lineas.push('');
        lineas.push(`Refiérete a la empresa por su nombre ("${empresa.nombre}") cuando sea pertinente y usa el documento de contexto para personalizar tus respuestas.`);
        const contextoEmpresa = lineas.join('\n');

        const promptBase = customPrompt || paso.promptIa ||
            'Eres un experto evaluando respuestas. Revisa el texto proporcionado y ofrece feedback constructivo.';

        const systemPrompt = `${contextoEmpresa}\n\n---\n\n${promptBase}`;

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
