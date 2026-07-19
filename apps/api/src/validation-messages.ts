import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * class-validator solo trae mensajes en inglés por defecto (p. ej. "fechaInicio must be a
 * valid ISO 8601 date string"), y esos mensajes llegan tal cual a las cajas de error de los
 * formularios. Traduce por tipo de constraint, no por mensaje literal, para cubrir cualquier
 * DTO sin tener que anotar cada decorador uno a uno.
 */
const TRANSLATORS: Record<string, (property: string) => string> = {
  isString: (p) => `${p} debe ser texto`,
  isNumber: (p) => `${p} debe ser un número`,
  isInt: (p) => `${p} debe ser un número entero`,
  isBoolean: (p) => `${p} debe ser verdadero o falso`,
  isEmail: (p) => `${p} debe ser un email válido`,
  isDateString: (p) => `${p} debe ser una fecha válida`,
  isEnum: (p) => `${p} tiene un valor no admitido`,
  isIn: (p) => `${p} tiene un valor no admitido`,
  isArray: (p) => `${p} debe ser una lista`,
  arrayNotEmpty: (p) => `${p} no puede estar vacío`,
  arrayMinSize: (p) => `${p} tiene muy pocos elementos`,
  minLength: (p) => `${p} es demasiado corto`,
  maxLength: (p) => `${p} es demasiado largo`,
  min: (p) => `${p} es menor que el mínimo permitido`,
  max: (p) => `${p} supera el máximo permitido`,
  isNotEmpty: (p) => `${p} es obligatorio`,
};

function translate(error: ValidationError): string[] {
  const own = Object.keys(error.constraints ?? {}).map(
    (key) => TRANSLATORS[key]?.(error.property) ?? `${error.property} no es válido`,
  );
  const nested = (error.children ?? []).flatMap(translate);
  return [...own, ...nested];
}

export function spanishValidationExceptionFactory(errors: ValidationError[]) {
  const messages = errors.flatMap(translate);
  return new BadRequestException(messages.length ? messages : ['Datos inválidos']);
}
