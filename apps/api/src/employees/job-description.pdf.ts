import * as React from 'react';
import * as path from 'path';

// humanX Tanda 3: @react-pdf/renderer (v4) es ESM-only (`"type": "module"`, sin build CJS) —
// apps/api compila a CommonJS. La forma correcta de cargar un paquete ESM-only desde código
// CJS es un `import()` dinámico (TypeScript lo emite tal cual, no lo baja a `require`), nunca
// un `import` estático de nivel de módulo — por eso vive dentro de la función, no arriba del
// fichero. Ver tasks/todo.md Tanda 3.
type ReactPdfModule = typeof import('@react-pdf/renderer');

const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
let fontsRegistered = false;

function registerFontsOnce(Font: ReactPdfModule['Font']) {
  if (fontsRegistered) return;
  Font.register({ family: 'Inter', src: path.join(FONTS_DIR, 'Inter-Variable.ttf') });
  Font.register({ family: 'Playfair Display', src: path.join(FONTS_DIR, 'PlayfairDisplay-Variable.ttf') });
  Font.register({ family: 'IBM Plex Mono', src: path.join(FONTS_DIR, 'IBMPlexMono-Regular.ttf') });
  // Sin esto, react-pdf parte palabras en español con guiones automáticos de un algoritmo
  // pensado para inglés — apagarlo evita cortes raros tipo "Ingenie-ría".
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const formatDate = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

export interface JobDescriptionData {
  fullName: string;
  vinculo: 'PLANTILLA' | 'EXTERNO';
  jobTitle: string;
  startDate: Date;
  vencimientoContrato: Date | null;
  descripcionPuesto: string | null;
  horario: string | null;
  remote: boolean;
  sociedad: string | null;
  departamento: string | null;
  proyecto: string | null;
  responsable: string | null;
  centroTrabajo: string;
  jornada: string | null;
  tipoContrato: string;
}

type FieldDef = { label: string; value: string | null | undefined; mono?: boolean };

/**
 * Genera el PDF de Job Description. La plantilla se elige por `data.vinculo`:
 * PLANTILLA → "Descripción de Funciones" (lenguaje laboral: responsable, jornada, funciones).
 * EXTERNO → "Prestación de Servicios" (lenguaje de servicios, sin subordinación laboral:
 * interlocutor, sin departamento/jornada/horario/tipo de contrato/puesto).
 * Cualquier campo vacío se omite entero, nunca se pinta un placeholder.
 */
export async function renderJobDescriptionPdf(data: JobDescriptionData): Promise<Buffer> {
  const { Document, Page, View, Text, Font, StyleSheet, renderToBuffer } = (await import(
    '@react-pdf/renderer'
  )) as ReactPdfModule;
  registerFontsOnce(Font);

  const styles = StyleSheet.create({
    page: { padding: 48, fontFamily: 'Inter', fontSize: 10, color: '#0F1419' },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 2,
      borderBottomColor: '#0F1419',
      paddingBottom: 16,
      marginBottom: 24,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    brandMark: { width: 18, height: 18, backgroundColor: '#0F1419', borderRadius: 5, marginRight: 8 },
    brandName: { fontFamily: 'Playfair Display', fontSize: 17 },
    docTitle: { fontFamily: 'Playfair Display', fontSize: 13, marginTop: 6, color: '#4B5563' },
    metaRight: { alignItems: 'flex-end' },
    personName: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
    metaLabel: { fontSize: 7.5, color: '#9CA3AF', textTransform: 'uppercase' },
    metaValue: { fontFamily: 'IBM Plex Mono', fontSize: 9.5 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
    field: { width: '50%', marginBottom: 14, paddingRight: 12 },
    fieldLabel: { fontSize: 7.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 3 },
    fieldValue: { fontSize: 10.5, color: '#0F1419' },
    fieldValueMono: { fontFamily: 'IBM Plex Mono', fontSize: 10 },
    sectionTitle: { fontFamily: 'Playfair Display', fontSize: 12.5, marginBottom: 8, marginTop: 4 },
    sectionText: { fontSize: 10.5, lineHeight: 1.5, color: '#0F1419' },
    footer: {
      position: 'absolute',
      bottom: 32,
      left: 48,
      right: 48,
      fontSize: 7.5,
      color: '#9CA3AF',
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      paddingTop: 8,
    },
  });

  const h = React.createElement;

  const Field = ({ label, value, mono }: FieldDef) =>
    value
      ? h(
          View,
          { style: styles.field },
          h(Text, { style: styles.fieldLabel }, label),
          h(Text, { style: mono ? styles.fieldValueMono : styles.fieldValue }, value),
        )
      : null;

  const esExterno = data.vinculo === 'EXTERNO';
  const docTitle = esExterno ? 'Prestación de servicios' : 'Descripción de funciones';
  const sectionTitle = esExterno ? 'Servicio prestado' : 'Funciones';
  const emitido = formatDate(new Date());

  const fields: FieldDef[] = esExterno
    ? [
        { label: 'Sociedad', value: data.sociedad },
        { label: 'Proyecto', value: data.proyecto },
        { label: 'Interlocutor', value: data.responsable },
        { label: 'Modalidad', value: data.remote ? 'Remoto' : 'Presencial' },
        {
          label: 'Duración',
          value: data.vencimientoContrato
            ? `Desde ${formatDate(data.startDate)} hasta ${formatDate(data.vencimientoContrato)}`
            : `Desde ${formatDate(data.startDate)}, sin fecha de fin`,
        },
      ]
    : [
        { label: 'Puesto', value: data.jobTitle },
        { label: 'Sociedad', value: data.sociedad },
        { label: 'Departamento', value: data.departamento },
        { label: 'Proyecto', value: data.proyecto },
        { label: 'Responsable', value: data.responsable },
        { label: 'Centro de trabajo', value: data.centroTrabajo },
        { label: 'Jornada', value: data.jornada },
        { label: 'Horario', value: data.horario },
        { label: 'Tipo de contrato', value: data.tipoContrato },
        { label: 'Fecha de alta', value: formatDate(data.startDate), mono: true },
      ];

  const doc = h(
    Document,
    { title: `${docTitle} · ${data.fullName}` },
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(
        View,
        { style: styles.headerRow },
        h(
          View,
          null,
          h(View, { style: styles.brandRow }, h(View, { style: styles.brandMark }), h(Text, { style: styles.brandName }, 'humanX')),
          h(Text, { style: styles.docTitle }, docTitle),
        ),
        h(
          View,
          { style: styles.metaRight },
          h(Text, { style: styles.personName }, data.fullName),
          h(Text, { style: styles.metaLabel }, 'Fecha de emisión'),
          h(Text, { style: styles.metaValue }, emitido),
        ),
      ),
      h(View, { style: styles.grid }, ...fields.map((f) => h(Field, f))),
      data.descripcionPuesto
        ? h(
            View,
            null,
            h(Text, { style: styles.sectionTitle }, sectionTitle),
            h(Text, { style: styles.sectionText }, data.descripcionPuesto),
          )
        : null,
      h(
        Text,
        { style: styles.footer, fixed: true },
        'Documento generado por humanX. ',
        esExterno
          ? 'Este documento describe el servicio prestado y no constituye, ni debe interpretarse como, relación laboral.'
          : 'Documento interno de descripción de funciones.',
      ),
    ),
  );

  return renderToBuffer(doc);
}
