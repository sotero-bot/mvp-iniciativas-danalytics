import OpenAI from 'openai';
import { AccederInstanciaPorTokenUseCase } from './AccederInstanciaPorTokenUseCase';
import { PrismaService } from '../../../prisma.service';

export class ConsultarIaPorTokenUseCase {
    private openai: OpenAI;

    constructor(
        private readonly accederUseCase: AccederInstanciaPorTokenUseCase,
        private readonly prisma: PrismaService,
    ) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'dummy_key', // Ensure it doesn't crash if env var is missing during build
        });
    }

    async execute(token: string, pasoId: string, respuestaUsuario: string, customPrompt?: string): Promise<string> {
        const instancia = await this.accederUseCase.execute(token);

        const paso = await this.prisma.pasoActividad.findUnique({
            where: { id: pasoId }
        });

        if (!paso) {
            throw new Error(`Paso no encontrado`);
        }

        if (!paso.usarIa) {
            throw new Error(`El paso no tiene habilitada la IA`);
        }

        const systemPrompt = customPrompt || paso.promptIa || 'Eres un experto evaluando respuestas. Revisa el texto proporcionado y ofrece feedback constructivo.';

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: respuestaUsuario }
                ],
            });

            return response.choices[0].message?.content || 'Sin respuesta de IA';
        } catch (error) {
            console.error('Error al consultar OpenAI:', error);
            throw new Error('Error al procesar la solicitud con IA');
        }
    }
}
