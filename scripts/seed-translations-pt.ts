/**
 * Seed de traducciones PT para el contenido vigente del taller.
 * Idempotente: usa upsert por (entityType, entityId, field, locale).
 *
 * Uso:
 *   npx tsx scripts/seed-translations-pt.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── IDs reales de la BD (obtenidos el 2026-06-11) ───────────────────────────

// Plantilla 1: Taller: Mapa de Oportunidades Analíticas
const PASO_1_1 = 'f30aaa08-7814-45cf-af89-3e126054ee6b'; // Descripción del área
const PASO_1_2 = '22d27411-a736-4a25-8c72-b81f73f04a01'; // Exploración y reflexión
const PASO_1_3 = 'd8ad5346-d03b-4dc6-9ab5-9226dbb44293'; // Generación y priorización con IA

const PREG_1_1_1 = '25c55999-4ca0-4d5e-8ba5-4c28a7709745';
const PREG_1_1_2 = '9bb36556-4c2e-4b64-880e-03d2627d0d47';
const PREG_1_1_3 = '8bbb2099-f0ba-413b-a46f-f9bff2f8bba3';
const PREG_1_2_1 = '8d42cc4d-d34c-4507-9f16-9df3bb420c8e';
const PREG_1_2_2 = '1706a2ed-4455-46c7-be8b-1ab4fa395995';
const PREG_1_2_3 = '3930c2f9-b0f9-4553-9917-d31815c78275';
const PREG_1_2_4 = '8c317da8-8829-4a25-b312-bbbee22e52b0';
const PREG_1_2_5 = 'a0b5961c-9919-4c81-ae70-25e341b2cc9c';
const PREG_1_3_1 = '9cdd3c74-f003-4769-9abd-0614d1fb5049';

// Plantilla 2: Taller: Construcción del Analytics Canvas
const PASO_2_1 = 'f86d63e4-8f94-4245-a53a-a87ea62c1f60'; // Bloque 1
const PASO_2_2 = '503a2986-9f32-4044-99a9-9ed27a2b8172'; // Bloque 2
const PASO_2_3 = '37a1332b-d5e5-4f8c-8ecd-e612f596cc9b'; // Bloque 3
const PASO_2_4 = '5925bb4b-c00f-47a2-b3ea-1c31a5cd5937'; // Bloque 4
const PASO_2_5 = '17a293dc-8531-4132-8fad-97e41fab3d99'; // Bloque 5
const PASO_2_6 = 'd7af3b39-f13d-41ff-a63d-9657a06be2ad'; // Bloque 6
const PASO_2_7 = 'e0dd0f85-297e-47ef-9ed3-9ba9eff9fb02'; // Bloque 7
const PASO_2_8 = '13ec2b5e-3e38-4636-94fb-46053c232b4d'; // Bloque 8
const PASO_2_9 = '4330e13d-f7db-4763-a543-3cbbec864872'; // Bloque 9

const PREG_2_1_1 = '90a60175-7df1-45c6-b7ad-7f447fc28a08';
const PREG_2_2_1 = '37358aee-d20a-42ea-99c7-522fd79cd60d';
const PREG_2_3_1 = '4aa813d8-9109-4bc8-acbd-024594a00e90';
const PREG_2_4_1 = '33c68b50-61bf-4932-ba9e-02b51e29c456';
const PREG_2_5_1 = '660c0df7-3737-4b56-ba3b-8a6e086ab42d';
const PREG_2_6_1 = 'feef2b7f-fee3-4b60-a341-f26180361112';
const PREG_2_7_1 = '4ca0c58a-9a39-4ef0-ad34-685f12ade86c';
const PREG_2_8_1 = 'a77bbed2-c87d-47e3-beab-fb2456bccb35';
const PREG_2_9_1 = 'cdf3ad16-5e8a-49d5-be21-5322adc450f3';

// ─── Datos de traducción ─────────────────────────────────────────────────────

type Row = { entityType: string; entityId: string; field: string; locale: string; value: string };

const TRANSLATIONS: Row[] = [
  // ── Plantilla 1 · Paso 1: Descripción del área ──
  { entityType: 'PasoPlantilla', entityId: PASO_1_1, field: 'titulo', locale: 'pt', value: 'Descrição da área' },
  { entityType: 'PasoPlantilla', entityId: PASO_1_1, field: 'objetivo', locale: 'pt', value: 'Contextualizar a área de trabalho para focar melhor na identificação de oportunidades analíticas.' },
  { entityType: 'PasoPlantilla', entityId: PASO_1_1, field: 'instrucciones', locale: 'pt', value: 'Antes de explorar oportunidades, descreva a área onde você trabalha. Isso ajudará a focar as ideias e torná-las relevantes para o seu contexto real.' },

  { entityType: 'PreguntaPlantilla', entityId: PREG_1_1_1, field: 'enunciado', locale: 'pt', value: 'O que faz a sua área? Descreva brevemente a missão ou propósito da área dentro da organização. Qual problema resolve ou qual valor gera?' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_1_1_2, field: 'enunciado', locale: 'pt', value: 'Quais são seus principais processos? Mencione os 3 a 5 processos mais importantes executados na área (ex.: planejamento, atendimento ao cliente, compras, suporte técnico, etc.).' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_1_1_3, field: 'enunciado', locale: 'pt', value: 'Quais são seus principais indicadores? Liste os indicadores ou métricas usados hoje para medir o desempenho da área (ex.: tempo de resposta, taxa de erro, volume de solicitações, cumprimento de SLA, etc.).' },

  // ── Plantilla 1 · Paso 2: Exploración y reflexión ──
  { entityType: 'PasoPlantilla', entityId: PASO_1_2, field: 'titulo', locale: 'pt', value: 'Exploração e reflexão' },
  { entityType: 'PasoPlantilla', entityId: PASO_1_2, field: 'objetivo', locale: 'pt', value: 'Reconhecer quais desafios, atritos e oportunidades existem na sua área. Ainda não pense em soluções nem em tecnologia — apenas descreva o que você vive hoje.' },
  { entityType: 'PasoPlantilla', entityId: PASO_1_2, field: 'instrucciones', locale: 'pt', value: 'Você vai percorrer 5 ângulos diferentes do seu trabalho. Cada ângulo ativa uma categoria diferente de desafios — incluindo os que você já normalizou e talvez não perceba como problema. Escreva pelo menos um desafio por ângulo.\n\nO objetivo é chegar a 5 ou mais desafios concretos que a IA possa analisar no próximo passo. Se um ângulo gerar mais de um, escreva todos — mais variedade significa mais oportunidades para analisar.' },

  { entityType: 'PreguntaPlantilla', entityId: PREG_1_2_1, field: 'enunciado', locale: 'pt', value: 'Ângulo 1 — Tempo e carga operacional\n\nQuais tarefas ou atividades consomem tempo demais da sua equipe — tempo que poderia ser usado em algo de maior valor?\n\nPense no que se repete toda semana ou todo mês. O que exige muitas pessoas, muitos passos ou muitas revisões. O que gera mais desgaste do que resultado.\n\nExemplo: «Todo mês dedicamos 3 dias a consolidar manualmente informações de faturamento de quatro fontes diferentes para montar um único relatório.»' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_1_2_2, field: 'enunciado', locale: 'pt', value: 'Ângulo 2 — Decisões com pouca informação\n\nQuais decisões importantes você toma hoje com base em intuição ou informação incompleta — porque os dados não estão disponíveis, chegam tarde ou não são confiáveis?\n\nNão precisa ser uma decisão estratégica. Pode ser algo operacional do dia a dia. O importante é que você sente que decide com mais incerteza do que gostaria.\n\nExemplo: «Quando alocamos turnos do pessoal, não temos visibilidade da demanda esperada, então sobredimensionamos em alguns dias e ficamos com falta em outros.»' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_1_2_3, field: 'enunciado', locale: 'pt', value: 'Ângulo 3 — Erros, retrabalho e riscos\n\nOnde ocorrem erros frequentes, retrabalho ou situações de risco que a área já normalizou — mas que continuam custando tempo, dinheiro ou reputação?\n\nBusque os «sempre foi assim» da sua área. Erros que são corrigidos manualmente, alertas que ninguém detecta a tempo, inconsistências descobertas tarde.\n\nExemplo: «Os erros no cálculo da folha de pagamento são detectados após o pagamento, gerando correções retroativas e insatisfação da equipe.»' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_1_2_4, field: 'enunciado', locale: 'pt', value: 'Ângulo 4 — Visibilidade e acompanhamento\n\nO que você gostaria de poder ver, monitorar ou antecipar — mas hoje não consegue porque a informação não existe, chega tarde ou está dispersa?\n\nEste ângulo não é necessariamente uma «dor» hoje — é uma oportunidade de visibilidade que melhoraria sua capacidade de reagir ou se antecipar. Às vezes o maior problema é o que você não vê.\n\nExemplo: «Não temos como saber se um fornecedor estratégico está em risco de descumprimento até que ele já tenha falhado. Gostaríamos de detectar isso antes.»' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_1_2_5, field: 'enunciado', locale: 'pt', value: 'Ângulo 5 — Conhecimento e atendimento\n\nQuais processos ou decisões dependem do conhecimento de uma ou poucas pessoas — e se tornam gargalo quando essa pessoa não está disponível?\n\nTambém se aplica a consultas internas ou externas que chegam em volume, são repetitivas, mas exigem tempo de alguém qualificado para respondê-las.\n\nExemplo: «As consultas sobre elegibilidade de benefícios sempre chegam para a mesma pessoa. Quando ela não está, tudo atrasa e a equipe não sabe como responder.»' },

  // ── Plantilla 1 · Paso 3: Generación y priorización con IA ──
  { entityType: 'PasoPlantilla', entityId: PASO_1_3, field: 'titulo', locale: 'pt', value: 'Geração e priorização com IA' },
  { entityType: 'PasoPlantilla', entityId: PASO_1_3, field: 'objetivo', locale: 'pt', value: 'Obter ideias de projetos de análise geradas automaticamente pela IA e priorizá-las por valor e viabilidade.' },
  { entityType: 'PasoPlantilla', entityId: PASO_1_3, field: 'instrucciones', locale: 'pt', value: 'O assistente de IA analisará o contexto da sua área e os desafios identificados para propor oportunidades concretas. A geração é automática — você não precisa escrever nada.\n\nAssim que ver os resultados:\n1. Baixe a planilha Excel pré-preenchida.\n2. Complete a tabela de priorização com sua equipe usando a escala na aba «Critérios» do arquivo Excel.\n3. Envie novamente o arquivo Excel preenchido.' },

  { entityType: 'PreguntaPlantilla', entityId: PREG_1_3_1, field: 'enunciado', locale: 'pt', value: 'Gere as oportunidades com o assistente, revise e baixe a planilha pré-preenchida, complemente as informações com sua equipe e envie o arquivo final.' },

  // ── Plantilla 2 · Bloque 1 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_1, field: 'titulo', locale: 'pt', value: 'Bloco 1: Problema ou desafio atual' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_1, field: 'objetivo', locale: 'pt', value: 'Identificar a dor que motiva o projeto.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_1, field: 'instrucciones', locale: 'pt', value: 'Leia com atenção antes de começar\n\nCopie do mapa de oportunidades o que encontrar na coluna "Dor identificada" e adicione as informações adicionais que considerar relevantes.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_1_1, field: 'enunciado', locale: 'pt', value: 'Copie a dor identificada do mapa de oportunidades e complemente com mais contexto se tiver.' },

  // ── Plantilla 2 · Bloque 2 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_2, field: 'titulo', locale: 'pt', value: 'Bloco 2: Solução proposta' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_2, field: 'objetivo', locale: 'pt', value: 'Identificar a solução viável.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_2, field: 'instrucciones', locale: 'pt', value: 'Leia com atenção antes de começar\n\nCopie do mapa de oportunidades o que encontrar nas colunas "Tipo de solução sugerida" e "Oportunidade de melhoria" e adicione as informações adicionais que considerar relevantes.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_2_1, field: 'enunciado', locale: 'pt', value: 'Copie a solução proposta do mapa de oportunidades e complemente com o que considerar relevante.' },

  // ── Plantilla 2 · Bloque 3 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_3, field: 'titulo', locale: 'pt', value: 'Bloco 3: Dados e fontes disponíveis' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_3, field: 'objetivo', locale: 'pt', value: 'Identificar com quais informações a equipe conta para desenvolver a solução.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_3, field: 'instrucciones', locale: 'pt', value: 'Reflita primeiro:\n• Que informações a sua equipe usa hoje para gerenciar esse processo? Estão em um sistema, em Excel, em e-mails, em papel?\n• Quem administra essas informações e com que frequência são atualizadas?\n• Essas informações são completas e confiáveis, ou têm lacunas frequentes?\n\nFaça uma lista das fontes de informação disponíveis e indique quais considera confiáveis e quais apresentam problemas de qualidade ou acesso.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_3_1, field: 'enunciado', locale: 'pt', value: 'Faça uma lista das fontes de informação disponíveis. Indique quais considera confiáveis e quais apresentam problemas de qualidade ou acesso.' },

  // ── Plantilla 2 · Bloque 4 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_4, field: 'titulo', locale: 'pt', value: 'Bloco 4: Usuários do resultado' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_4, field: 'objetivo', locale: 'pt', value: 'Definir quem usará os resultados desta solução e para quê.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_4, field: 'instrucciones', locale: 'pt', value: 'Reflita primeiro:\n• Quais pessoas ou cargos da sua equipe usariam o resultado desta solução no seu trabalho diário?\n• Usariam para tomar decisões, acompanhar, reportar ou executar tarefas?\n• Essas pessoas estariam prontas para usá-lo desde o primeiro dia, ou precisariam de algum treinamento ou acompanhamento?' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_4_1, field: 'enunciado', locale: 'pt', value: 'Identifique as pessoas ou cargos que usarão o resultado. Indique para quê usariam e se precisariam de treinamento.' },

  // ── Plantilla 2 · Bloque 5 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_5, field: 'titulo', locale: 'pt', value: 'Bloco 5: Entregáveis esperados' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_5, field: 'objetivo', locale: 'pt', value: 'Definir quais produtos concretos sairão desta solução.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_5, field: 'instrucciones', locale: 'pt', value: 'Reflita primeiro:\n• Como você imagina o resultado final desta solução? É um relatório, um alerta, um resumo automático, uma recomendação, um painel de acompanhamento?\n• Com que frequência esse resultado seria gerado — em tempo real, diário, semanal, sob demanda?\n• Onde os usuários o veriam — em um e-mail, em uma tela, em uma reunião, em um sistema que já usam?\n\nDescreva com suas próprias palavras o que esta solução deveria produzir, em que formato e com que frequência. Não é necessário usar termos técnicos — o importante é que fique claro o que o usuário receberia ao final.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_5_1, field: 'enunciado', locale: 'pt', value: 'Descreva o que esta solução deveria produzir, em que formato e com que frequência.' },

  // ── Plantilla 2 · Bloque 6 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_6, field: 'titulo', locale: 'pt', value: 'Bloco 6: Atores principais e equipe responsável' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_6, field: 'objetivo', locale: 'pt', value: 'Determinar quem lidera, apoia e valida o projeto.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_6, field: 'instrucciones', locale: 'pt', value: 'Reflita primeiro:\n• Quem é o patrocinador ou dono do projeto?\n• Quais áreas devem participar?\n• Quais perfis técnicos e de negócio são necessários?\n\nEscreva a equipe que propõe e identifique se falta algum perfil-chave.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_6_1, field: 'enunciado', locale: 'pt', value: 'Defina a equipe responsável pelo projeto e o papel de cada ator.' },

  // ── Plantilla 2 · Bloque 7 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_7, field: 'titulo', locale: 'pt', value: 'Bloco 7: KPIs de sucesso' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_7, field: 'objetivo', locale: 'pt', value: 'Definir como saberemos que a solução funcionou.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_7, field: 'instrucciones', locale: 'pt', value: 'Reflita primeiro:\n• O que deveria mudar concretamente na sua área se a solução funcionar bem? Menos tempo em uma tarefa, menos erros, decisões mais rápidas, menos retrabalho?\n• Como mediria essa mudança? Você já tem algum dado de referência de como esse indicador está hoje?\n• Em quanto tempo esperaria ver essa mudança — semanas, meses?\n• Quem faria o acompanhamento desse indicador dentro da equipe?\n\nEscreva os indicadores que usaria para medir o sucesso desta solução. Para cada um, tente indicar como está hoje e onde gostaria de chegar.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_7_1, field: 'enunciado', locale: 'pt', value: 'Escreva os indicadores que usaria para medir o sucesso. Para cada um, indique como está hoje e onde gostaria de chegar.' },

  // ── Plantilla 2 · Bloque 8 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_8, field: 'titulo', locale: 'pt', value: 'Bloco 8: Barreiras e riscos' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_8, field: 'objetivo', locale: 'pt', value: 'Antecipar o que pode dificultar o desenvolvimento ou a implementação da solução.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_8, field: 'instrucciones', locale: 'pt', value: 'Reflita primeiro:\n• O que poderia impedir que este projeto comece ou avance — falta de tempo, orçamento, dados, pessoas?\n• Há alguma decisão que dependeria de outra área ou da gerência para avançar?\n• O que aconteceria se a solução cometesse erros — há consequências operacionais, financeiras ou de clientes?\n\nEscreva as barreiras e riscos que identifica. Para cada um, tente indicar o quanto considera provável e se tem alguma ideia de como mitigá-lo.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_8_1, field: 'enunciado', locale: 'pt', value: 'Escreva as barreiras e riscos que identifica. Para cada um, indique o quanto considera provável e como o mitigaria.' },

  // ── Plantilla 2 · Bloque 9 ──
  { entityType: 'PasoPlantilla', entityId: PASO_2_9, field: 'titulo', locale: 'pt', value: 'Bloco 9: Potencial de valor estratégico' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_9, field: 'objetivo', locale: 'pt', value: 'Conectar a solução com os resultados que importam para a organização.' },
  { entityType: 'PasoPlantilla', entityId: PASO_2_9, field: 'instrucciones', locale: 'pt', value: 'Reflita primeiro:\n• Qual problema de negócio maior está por trás deste projeto — rentabilidade, experiência do cliente, eficiência operacional, conformidade?\n• Como esta solução contribui para os objetivos estratégicos da sua área ou da organização?\n• Há algum risco que esta solução ajudaria a reduzir — perdas, descumprimentos, rotatividade, insatisfação de clientes?\n\nDescreva com suas próprias palavras por que este projeto vale a pena para a organização, além da tarefa específica que resolve. Não é necessário ter números exatos — o importante é conectar a solução com algo que importe para a gerência.' },
  { entityType: 'PreguntaPlantilla', entityId: PREG_2_9_1, field: 'enunciado', locale: 'pt', value: 'Descreva por que este projeto vale a pena para a organização. Conecte a solução com os objetivos estratégicos e os riscos que ajudaria a reduzir.' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Iniciando seed de traducciones PT (${TRANSLATIONS.length} filas)...`);

  let upserted = 0;
  for (const row of TRANSLATIONS) {
    await prisma.translation.upsert({
      where: {
        entityType_entityId_field_locale: {
          entityType: row.entityType,
          entityId: row.entityId,
          field: row.field,
          locale: row.locale,
        },
      },
      create: row,
      update: { value: row.value },
    });
    upserted++;
  }

  console.log(`✅ ${upserted} traducciones PT insertadas/actualizadas.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
