import { BadRequestException } from '@nestjs/common';

/**
 * Normaliza y valida un número de teléfono.
 * 
 * Comportamiento:
 * 1. Remueve espacios, guiones, paréntesis y caracteres no numéricos (manteniendo '+' si viene al inicio).
 * 2. Corrige duplicaciones de código de país generadas por frontends o autocompletado (ej: +5757... o 5757...).
 * 3. En Colombia (+57), los números tienen estrictamente 10 dígitos (móviles inician con 3, fijos con 60).
 *    Si el número resultante para Colombia tiene más o menos de 10 dígitos, lanza BadRequestException.
 * 4. Para otros países, valida formato internacional estándar E.164 (+ y 7-15 dígitos).
 */
export function normalizeAndValidatePhone(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new BadRequestException('El número de teléfono es requerido');
  }

  const trimmed = rawPhone.trim();
  const startsWithPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    throw new BadRequestException('El número de teléfono no contiene dígitos válidos');
  }

  // Caso: Código de país Colombia repetido (ej: 57573XXXXXXXXX o +57573XXXXXXXXX)
  while (digits.startsWith('5757') && digits.length > 12) {
    digits = digits.slice(2);
  }

  // Caso: Inicia con 57 y tiene dígitos de más (ej: prefijo antiguo de operadora o código de país extra)
  if (digits.startsWith('57') && digits.length > 12) {
    const last10 = digits.slice(-10);
    // Si los últimos 10 corresponden a un número celular (inicia en 3) o fijo (inicia en 6)
    if (/^[36]\d{9}$/.test(last10)) {
      digits = '57' + last10;
    }
  }

  // Caso: Usuario ingresó solo los 10 dígitos locales de Colombia (ej: 3001234567 o 6012345678)
  if (digits.length === 10 && /^[1-9]\d{9}$/.test(digits)) {
    if (!startsWithPlus || trimmed.startsWith('+57')) {
      return `+57${digits}`;
    }
  }

  // Caso: Inicia con 57 (Colombia)
  if (digits.startsWith('57')) {
    const localPart = digits.slice(2);
    if (localPart.length !== 10) {
      throw new BadRequestException(
        `El número de teléfono para Colombia debe tener exactamente 10 dígitos (se recibieron ${localPart.length} dígitos: "${localPart}"). Ejemplo: +573001234567`
      );
    }
    return `+57${localPart}`;
  }

  // Caso: Número internacional E.164
  const normalized = startsWithPlus ? `+${digits}` : `+${digits}`;
  const e164Regex = /^\+[1-9]\d{6,14}$/;

  if (!e164Regex.test(normalized)) {
    throw new BadRequestException(
      'El formato del número de teléfono internacional es inválido. Debe cumplir con el estándar E.164 (ej: +12345678901)'
    );
  }

  return normalized;
}
