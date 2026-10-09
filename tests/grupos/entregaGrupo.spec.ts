/**
 * HU-23 · "entregó todo en la fase 3": presentación final entregada + bitácora y plantilla
 * del proyecto con respuesta. Es la condición para poder finalizar un grupo y para que
 * cuente como "listo para revisar".
 */

import { describe, it, expect } from 'vitest';

import { entregaCompleta } from '../../apps/api/src/modules/grupos/application/entrega-grupo';

const resp = (tipo: string) => ({ plantilla: { tipoFormulario: tipo } });
const ENTREGA = { entregadoEn: new Date('2026-10-01') };

describe('entregaCompleta', () => {
  it('presentación + bitácora + plantilla → completa', () => {
    expect(
      entregaCompleta({ presentacionFinal: ENTREGA, respuestasFormulario: [resp('bitacora'), resp('plantilla_proyecto')] }),
    ).toBe(true);
  });

  it('sin presentación → incompleta', () => {
    expect(entregaCompleta({ presentacionFinal: null, respuestasFormulario: [resp('bitacora'), resp('plantilla_proyecto')] })).toBe(false);
  });

  it('presentación sin entregadoEn → incompleta', () => {
    expect(
      entregaCompleta({ presentacionFinal: { entregadoEn: null }, respuestasFormulario: [resp('bitacora'), resp('plantilla_proyecto')] }),
    ).toBe(false);
  });

  it('falta la bitácora → incompleta', () => {
    expect(entregaCompleta({ presentacionFinal: ENTREGA, respuestasFormulario: [resp('plantilla_proyecto')] })).toBe(false);
  });

  it('falta la plantilla del proyecto → incompleta', () => {
    expect(entregaCompleta({ presentacionFinal: ENTREGA, respuestasFormulario: [resp('bitacora')] })).toBe(false);
  });

  it('ignora respuestas de otros tipos de formulario', () => {
    expect(entregaCompleta({ presentacionFinal: ENTREGA, respuestasFormulario: [resp('feedback'), resp('bitacora')] })).toBe(false);
  });

  it('datos ausentes (mocks/consultas sin los campos) → incompleta, nunca lanza', () => {
    expect(entregaCompleta({} as any)).toBe(false);
  });
});
