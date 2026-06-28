/**
 * Seed de Núcleo — replica los datos del prototipo en la base de datos.
 * Ejecutar: pnpm db:seed  (o  npx tsx prisma/seed.ts)
 *
 * Usa ids explícitos (e1..e17, d-*) para poder enlazar manager/departamento
 * sin segundas pasadas. Las contraseñas se hashean con bcrypt.
 */
import { PrismaClient, Role, EmployeeStatus, AbsenceType, AbsenceStatus, OnboardingPhase, PayrollItemType, DocumentCategory, DocumentStatus, SignatureStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const D = (s: string) => new Date(s + 'T00:00:00Z');

// ── Departamentos ──
const DEPTS = [
  { id: 'd-eng',       name: 'Ingeniería', color: '#6366F1', leadId: 'e3'  },
  { id: 'd-design',    name: 'Diseño',     color: '#EC4899', leadId: 'e7'  },
  { id: 'd-data',      name: 'Datos',      color: '#1FB6E8', leadId: 'e10' },
  { id: 'd-product',   name: 'Producto',   color: '#8B5CF6', leadId: null  },
  { id: 'd-marketing', name: 'Marketing',  color: '#F59E0B', leadId: 'e12' },
  { id: 'd-customer',  name: 'Customer',   color: '#14B8A6', leadId: 'e14' },
  { id: 'd-people',    name: 'People',     color: '#10B981', leadId: 'e2'  },
  { id: 'd-finance',   name: 'Finanzas',   color: '#0F1419', leadId: 'e16' },
];

// ── Empleados (orden: managers antes que reports) ──
type E = { id: string; fullName: string; jobTitle: string; dept: string; managerId: string | null; level: string; location: string; remote: boolean; email: string; phone: string; startDate: string; status: EmployeeStatus; salary: number | null; birthday: string; dni: string; address: string; iban: string; emergency: string; fromRecruitment?: boolean };
const EMPLOYEES: E[] = [
  { id:'e1', fullName:'Elena Vázquez', jobTitle:'CEO & Fundadora', dept:'d-people', managerId:null, level:'exec', location:'Madrid', remote:false, email:'elena.vazquez@grupo.com', phone:'+34 600 ··· ···', startDate:'2021-01-04', status:'ACTIVO', salary:null, birthday:'12 mar', dni:'····5521R', address:'Calle Serrano ··, Madrid', iban:'ES·· ···· ···· 4821', emergency:'Marco Vázquez · +34 6·· ··· ···' },
  { id:'e2', fullName:'Blanca Ruiz', jobTitle:'Head of People', dept:'d-people', managerId:'e1', level:'lead', location:'Madrid', remote:false, email:'blanca.ruiz@grupo.com', phone:'+34 611 ··· ···', startDate:'2021-06-15', status:'ACTIVO', salary:58000, birthday:'04 jul', dni:'····3092M', address:'Calle Goya ··, Madrid', iban:'ES·· ···· ···· 1180', emergency:'Laura Ruiz · +34 6·· ··· ···' },
  { id:'e3', fullName:'Carlos Soto Vega', jobTitle:'VP Engineering', dept:'d-eng', managerId:'e1', level:'exec', location:'Madrid', remote:false, email:'carlos.soto@grupo.com', phone:'+34 622 ··· ···', startDate:'2024-09-02', status:'ACTIVO', salary:95000, birthday:'21 ene', dni:'····7741K', address:'Calle Alcalá ··, Madrid', iban:'ES·· ···· ···· 9921', emergency:'Marta Vega · +34 6·· ··· ···' },
  { id:'e4', fullName:'Sofía Navarro Gil', jobTitle:'Principal Engineer', dept:'d-eng', managerId:'e3', level:'senior', location:'Barcelona', remote:true, email:'sofia.navarro@grupo.com', phone:'+34 633 ··· ···', startDate:'2026-06-23', status:'ONBOARDING', salary:82000, birthday:'08 sep', dni:'····1182T', address:'Carrer de Mallorca ··, Barcelona', iban:'ES·· ···· ···· 2210', emergency:'Jordi Navarro · +34 6·· ··· ···', fromRecruitment:true },
  { id:'e5', fullName:'Lucía Martín Vega', jobTitle:'Tech Lead', dept:'d-eng', managerId:'e3', level:'lead', location:'Madrid', remote:false, email:'lucia.martin@grupo.com', phone:'+34 644 ··· ···', startDate:'2025-02-10', status:'ACTIVO', salary:72000, birthday:'15 may', dni:'····6634P', address:'Calle Princesa ··, Madrid', iban:'ES·· ···· ···· 5567', emergency:'Ana Martín · +34 6·· ··· ···' },
  { id:'e6', fullName:'Diego Ortega Marín', jobTitle:'Backend Engineer', dept:'d-eng', managerId:'e3', level:'mid', location:'Madrid', remote:false, email:'diego.ortega@grupo.com', phone:'+34 655 ··· ···', startDate:'2025-07-01', status:'ACTIVO', salary:52000, birthday:'27 nov', dni:'····4490L', address:'Calle Fuencarral ··, Madrid', iban:'ES·· ···· ···· 7732', emergency:'Pedro Ortega · +34 6·· ··· ···' },
  { id:'e7', fullName:'Elena Castro Prat', jobTitle:'Design Lead', dept:'d-design', managerId:'e1', level:'lead', location:'Barcelona', remote:true, email:'elena.castro@grupo.com', phone:'+34 666 ··· ···', startDate:'2023-03-20', status:'ACTIVO', salary:70000, birthday:'02 feb', dni:'····2235N', address:'Passeig de Gràcia ··, Barcelona', iban:'ES·· ···· ···· 3398', emergency:'Marc Castro · +34 6·· ··· ···' },
  { id:'e8', fullName:'Pablo García Ruiz', jobTitle:'Senior Designer', dept:'d-design', managerId:'e7', level:'senior', location:'Barcelona', remote:true, email:'pablo.garcia@grupo.com', phone:'+34 677 ··· ···', startDate:'2024-11-04', status:'AUSENTE', salary:56000, birthday:'19 ago', dni:'····8801C', address:'Carrer de València ··, Barcelona', iban:'ES·· ···· ···· 4421', emergency:'Núria García · +34 6·· ··· ···' },
  { id:'e9', fullName:'María Fernández Lozano', jobTitle:'Product Designer', dept:'d-design', managerId:'e7', level:'mid', location:'Bilbao', remote:true, email:'maria.fernandez@grupo.com', phone:'+34 688 ··· ···', startDate:'2025-09-15', status:'ACTIVO', salary:48000, birthday:'30 abr', dni:'····5567H', address:'Gran Vía ··, Bilbao', iban:'ES·· ···· ···· 1145', emergency:'Iker Fernández · +34 6·· ··· ···' },
  { id:'e10', fullName:'Patricia Gómez Aznar', jobTitle:'Data Lead', dept:'d-data', managerId:'e1', level:'lead', location:'Madrid', remote:false, email:'patricia.gomez@grupo.com', phone:'+34 699 ··· ···', startDate:'2024-01-22', status:'ACTIVO', salary:68000, birthday:'11 oct', dni:'····3340D', address:'Calle Velázquez ··, Madrid', iban:'ES·· ···· ···· 8876', emergency:'Luis Gómez · +34 6·· ··· ···' },
  { id:'e11', fullName:'Andrés Pérez Salas', jobTitle:'Data Analyst', dept:'d-data', managerId:'e10', level:'mid', location:'Madrid', remote:false, email:'andres.perez@grupo.com', phone:'+34 610 ··· ···', startDate:'2025-10-06', status:'ACTIVO', salary:44000, birthday:'06 jun', dni:'····9912F', address:'Calle Atocha ··, Madrid', iban:'ES·· ···· ···· 2234', emergency:'Sara Pérez · +34 6·· ··· ···' },
  { id:'e12', fullName:'Iván Moreno Páez', jobTitle:'Marketing Manager', dept:'d-marketing', managerId:'e1', level:'lead', location:'Madrid', remote:false, email:'ivan.moreno@grupo.com', phone:'+34 621 ··· ···', startDate:'2023-05-08', status:'ACTIVO', salary:62000, birthday:'24 dic', dni:'····4456J', address:'Calle Hortaleza ··, Madrid', iban:'ES·· ···· ···· 6690', emergency:'Clara Moreno · +34 6·· ··· ···' },
  { id:'e13', fullName:'Raúl Domínguez Cobo', jobTitle:'Content Marketing', dept:'d-marketing', managerId:'e12', level:'mid', location:'Málaga', remote:true, email:'raul.dominguez@grupo.com', phone:'+34 632 ··· ···', startDate:'2026-06-12', status:'ONBOARDING', salary:42000, birthday:'17 mar', dni:'····7723G', address:'Calle Larios ··, Málaga', iban:'ES·· ···· ···· 3312', emergency:'Eva Domínguez · +34 6·· ··· ···', fromRecruitment:true },
  { id:'e14', fullName:'Ana Romero Cano', jobTitle:'Customer Success Lead', dept:'d-customer', managerId:'e1', level:'lead', location:'Valencia', remote:false, email:'ana.romero@grupo.com', phone:'+34 643 ··· ···', startDate:'2024-04-15', status:'ACTIVO', salary:58000, birthday:'09 jul', dni:'····2218R', address:'Calle Colón ··, Valencia', iban:'ES·· ···· ···· 5543', emergency:'Pau Romero · +34 6·· ··· ···' },
  { id:'e15', fullName:'Carmen Iglesias Reyes', jobTitle:'CS Manager', dept:'d-customer', managerId:'e14', level:'mid', location:'Valencia', remote:false, email:'carmen.iglesias@grupo.com', phone:'+34 654 ··· ···', startDate:'2025-06-01', status:'ACTIVO', salary:46000, birthday:'21 feb', dni:'····8845K', address:'Avenida del Puerto ··, Valencia', iban:'ES·· ···· ···· 1198', emergency:'José Iglesias · +34 6·· ··· ···' },
  { id:'e16', fullName:'Javier Ramos Gil', jobTitle:'Finance Manager', dept:'d-finance', managerId:'e1', level:'lead', location:'Madrid', remote:false, email:'javier.ramos@grupo.com', phone:'+34 665 ··· ···', startDate:'2022-09-12', status:'ACTIVO', salary:66000, birthday:'03 nov', dni:'····3367M', address:'Paseo de la Castellana ··, Madrid', iban:'ES·· ···· ···· 7741', emergency:'Lucía Ramos · +34 6·· ··· ···' },
  { id:'e17', fullName:'Marcos Ortiz León', jobTitle:'Talent Acquisition', dept:'d-people', managerId:'e2', level:'mid', location:'Madrid', remote:false, email:'marcos.ortiz@grupo.com', phone:'+34 676 ··· ···', startDate:'2025-03-03', status:'ACTIVO', salary:40000, birthday:'14 sep', dni:'····5590P', address:'Calle Bravo Murillo ··, Madrid', iban:'ES·· ···· ···· 2256', emergency:'Rosa Ortiz · +34 6·· ··· ···' },
];

// Vacaciones por empleado (total/used/pending), mismas que el prototipo
const VAC: Record<string, [number, number, number]> = {
  e1:[23,9,0], e2:[23,11,2], e3:[23,6,0], e4:[23,0,0], e5:[23,14,0], e6:[23,8,5], e7:[23,10,0], e8:[23,18,0], e9:[23,5,0], e10:[23,12,0], e11:[23,3,0], e12:[23,9,0], e13:[23,0,0], e14:[23,13,0], e15:[23,7,3], e16:[23,15,0], e17:[23,6,0],
};

const ABSENCES = [
  { employeeId:'e6',  type:'VACACIONES', start:'2026-07-14', end:'2026-07-18', days:5, status:'PENDIENTE', reason:'Vacaciones de verano' },
  { employeeId:'e15', type:'VACACIONES', start:'2026-07-21', end:'2026-07-23', days:3, status:'PENDIENTE', reason:'Días personales' },
  { employeeId:'e2',  type:'PERSONAL',   start:'2026-06-30', end:'2026-06-30', days:1, status:'PENDIENTE', reason:'Asunto personal' },
  { employeeId:'e8',  type:'VACACIONES', start:'2026-06-25', end:'2026-06-30', days:4, status:'APROBADA',  reason:'Vacaciones' },
  { employeeId:'e5',  type:'ENFERMEDAD', start:'2026-06-27', end:'2026-06-27', days:1, status:'APROBADA',  reason:'Baja médica' },
  { employeeId:'e11', type:'VACACIONES', start:'2026-08-04', end:'2026-08-14', days:9, status:'PENDIENTE', reason:'Vacaciones de agosto' },
  { employeeId:'e12', type:'PERSONAL',   start:'2026-07-07', end:'2026-07-07', days:1, status:'APROBADA',  reason:'Mudanza' },
  { employeeId:'e9',  type:'VACACIONES', start:'2026-07-28', end:'2026-08-01', days:5, status:'APROBADA',  reason:'Vacaciones' },
] as const;

const ONB_TASKS = [
  { id:'t1',  phase:'ANTES',   label:'Firmar contrato y documentación', owner:'RRHH' },
  { id:'t2',  phase:'ANTES',   label:'Preparar equipo informático', owner:'IT' },
  { id:'t3',  phase:'ANTES',   label:'Crear cuentas y accesos', owner:'IT' },
  { id:'t4',  phase:'ANTES',   label:'Asignar buddy de acompañamiento', owner:'Manager' },
  { id:'t5',  phase:'DIA1',    label:'Bienvenida y tour de la empresa', owner:'RRHH' },
  { id:'t6',  phase:'DIA1',    label:'Entrega de equipo y accesos', owner:'IT' },
  { id:'t7',  phase:'DIA1',    label:'Reunión inicial con el manager', owner:'Manager' },
  { id:'t8',  phase:'SEMANA1', label:'Presentación al equipo', owner:'Manager' },
  { id:'t9',  phase:'SEMANA1', label:'Formación de producto', owner:'Equipo' },
  { id:'t10', phase:'SEMANA1', label:'Configurar entorno de desarrollo', owner:'Equipo' },
  { id:'t11', phase:'MES1',    label:'Definir objetivos del primer trimestre', owner:'Manager' },
  { id:'t12', phase:'MES1',    label:'Feedback de la primera semana', owner:'RRHH' },
  { id:'t13', phase:'MES1',    label:'Revisión de los 30 días', owner:'Manager' },
] as const;
const ONBOARDING = [
  { employeeId:'e13', buddyId:'e12', startDate:'2026-06-12', done:['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10'] },
  { employeeId:'e4',  buddyId:'e5',  startDate:'2026-06-23', done:['t1','t2','t3','t4','t5','t6','t7'] },
];

const PERF_STATUS: Record<string, { self: boolean; manager: boolean; o2o: boolean; rating: number | null }> = {
  e1:{self:true,manager:true,o2o:true,rating:null}, e2:{self:true,manager:true,o2o:true,rating:4.6}, e3:{self:true,manager:true,o2o:false,rating:null}, e5:{self:true,manager:true,o2o:true,rating:4.4}, e6:{self:true,manager:false,o2o:false,rating:null}, e7:{self:true,manager:true,o2o:true,rating:4.1}, e8:{self:false,manager:false,o2o:false,rating:null}, e9:{self:true,manager:false,o2o:false,rating:null}, e10:{self:true,manager:true,o2o:true,rating:4.3}, e11:{self:true,manager:true,o2o:false,rating:3.8}, e12:{self:true,manager:true,o2o:true,rating:4.0}, e14:{self:true,manager:true,o2o:true,rating:4.5}, e15:{self:false,manager:false,o2o:false,rating:null}, e16:{self:true,manager:true,o2o:true,rating:4.2}, e17:{self:true,manager:false,o2o:false,rating:null},
};
const OKRS = [
  { scope:'Empresa', ownerId:'e1', title:'Consolidar el producto en el mercado español', krs:[['Alcanzar 5.000 clientes activos',68],['Reducir el churn mensual al 3%',80],['NPS por encima de 50',55]] },
  { scope:'Ingeniería', ownerId:'e3', title:'Escalar la plataforma para 10x de carga', krs:[['Migrar autenticación a nuevo sistema',75],['Reducir latencia p95 por debajo de 200ms',60],['Cobertura de tests al 80%',45]] },
  { scope:'Marketing', ownerId:'e12', title:'Multiplicar la generación de demanda', krs:[['Triplicar leads cualificados',52],['Publicar 12 casos de éxito',33]] },
] as const;

const INCIDENCIAS = [
  { employeeId:'e5',  type:'BONUS',       concept:'Objetivo Q1 cumplido', amount:1200 },
  { employeeId:'e6',  type:'HORAS_EXTRA', concept:'12h proyecto migración', amount:340 },
  { employeeId:'e8',  type:'DEDUCCION',   concept:'4 días sin sueldo', amount:-620 },
  { employeeId:'e12', type:'BONUS',       concept:'Campaña Q2', amount:900 },
] as const;

const DOCS = [
  { name:'Política de teletrabajo 2026', cat:'POLITICAS', ownerId:'e2', date:'2026-01-15', status:'VIGENTE' },
  { name:'Plan de igualdad del grupo', cat:'POLITICAS', ownerId:'e2', date:'2025-11-02', status:'VIGENTE' },
  { name:'Contrato · Sofía Navarro', cat:'CONTRATOS', ownerId:'e2', date:'2026-06-23', status:'FIRMADO' },
  { name:'Contrato · Raúl Domínguez', cat:'CONTRATOS', ownerId:'e2', date:'2026-06-12', status:'FIRMADO' },
  { name:'Certificado de retenciones 2025', cat:'CERTIFICADOS', ownerId:'e16', date:'2026-01-31', status:'EMITIDO' },
  { name:'Nóminas · junio 2026 (lote)', cat:'NOMINAS', ownerId:'e16', date:'2026-06-30', status:'PENDIENTE' },
  { name:'Acuerdo de confidencialidad · Sofía Navarro', cat:'CONTRATOS', ownerId:'e2', date:'2026-06-24', status:'PENDIENTE' },
  { name:'Certificado de formación · RGPD', cat:'FORMACION', ownerId:'e17', date:'2026-05-20', status:'VIGENTE' },
] as const;
const DOC_TEMPLATES = [
  { name:'Contrato indefinido', category:'CONTRATOS' },
  { name:'Carta de oferta', category:'CONTRATOS' },
  { name:'Certificado laboral', category:'CERTIFICADOS' },
  { name:'Acuerdo de teletrabajo', category:'POLITICAS' },
  { name:'Anexo de modificación', category:'CONTRATOS' },
  { name:'Recibí de equipo informático', category:'CERTIFICADOS' },
] as const;

// Cálculo de nómina (idéntico al prototipo)
const irpfRate = (a: number) => a>=80000?0.30:a>=60000?0.26:a>=45000?0.22:a>=30000?0.18:0.14;
const payrollFor = (annual: number) => {
  const gross = Math.round(annual/12);
  const irpf = Math.round(gross*irpfRate(annual));
  const ss = Math.round(gross*0.0635);
  return { gross, irpf, ss, net: gross - irpf - ss };
};

async function main() {
  console.log('🌱  Limpiando y sembrando…');
  // Orden inverso de dependencias
  await db.$transaction([
    db.auditLog.deleteMany(), db.notification.deleteMany(),
    db.documentSignature.deleteMany(), db.document.deleteMany(), db.documentTemplate.deleteMany(),
    db.payrollItem.deleteMany(), db.payslip.deleteMany(), db.payrollRun.deleteMany(),
    db.keyResult.deleteMany(), db.objective.deleteMany(), db.review.deleteMany(), db.performanceCycle.deleteMany(),
    db.onboardingTask.deleteMany(), db.onboardingProcess.deleteMany(), db.onboardingTemplateTask.deleteMany(), db.onboardingTemplate.deleteMany(),
    db.timeEntry.deleteMany(), db.leaveBalance.deleteMany(), db.absence.deleteMany(), db.holiday.deleteMany(),
    db.user.deleteMany(), db.employee.deleteMany(), db.department.deleteMany(),
  ]);

  // Departamentos (sin lead todavía)
  for (const d of DEPTS) await db.department.create({ data: { id: d.id, name: d.name, color: d.color } });

  // Empleados (en orden → managers existen antes que reports)
  for (const e of EMPLOYEES) {
    await db.employee.create({ data: {
      id: e.id, fullName: e.fullName, email: e.email, phone: e.phone, jobTitle: e.jobTitle,
      level: e.level, location: e.location, remote: e.remote, startDate: D(e.startDate),
      status: e.status, salary: e.salary ?? undefined, birthday: e.birthday, dni: e.dni,
      address: e.address, iban: e.iban, emergency: e.emergency, fromRecruitment: e.fromRecruitment ?? false,
      departmentId: e.dept, managerId: e.managerId ?? undefined,
    }});
  }
  // Asignar leads de departamento
  for (const d of DEPTS) if (d.leadId) await db.department.update({ where: { id: d.id }, data: { leadId: d.leadId } });

  // Saldos de vacaciones
  for (const [employeeId, [total, used, pending]] of Object.entries(VAC))
    await db.leaveBalance.create({ data: { employeeId, year: 2026, total, used, pending } });

  // Ausencias
  for (const a of ABSENCES)
    await db.absence.create({ data: { employeeId: a.employeeId, type: a.type as AbsenceType, startDate: D(a.start), endDate: D(a.end), days: a.days, status: a.status as AbsenceStatus, reason: a.reason, approverId: a.status === 'APROBADA' ? 'e2' : undefined, decidedAt: a.status === 'APROBADA' ? new Date() : undefined } });

  // Onboarding
  const tpl = await db.onboardingTemplate.create({ data: { name: 'Onboarding estándar' } });
  for (const [i, t] of ONB_TASKS.entries())
    await db.onboardingTemplateTask.create({ data: { templateId: tpl.id, label: t.label, phase: t.phase as OnboardingPhase, owner: t.owner, order: i } });
  for (const o of ONBOARDING) {
    const proc = await db.onboardingProcess.create({ data: { employeeId: o.employeeId, buddyId: o.buddyId, templateId: tpl.id, startDate: D(o.startDate) } });
    for (const t of ONB_TASKS) {
      const done = o.done.includes(t.id);
      await db.onboardingTask.create({ data: { processId: proc.id, label: t.label, phase: t.phase as OnboardingPhase, owner: t.owner, done, doneAt: done ? new Date() : undefined } });
    }
  }

  // Desempeño
  const cycle = await db.performanceCycle.create({ data: { name: 'Revisión Q2 2026', startDate: D('2026-06-01'), endDate: D('2026-06-30') } });
  for (const [employeeId, s] of Object.entries(PERF_STATUS)) {
    const reviewerId = EMPLOYEES.find(e => e.id === employeeId)?.managerId ?? undefined;
    await db.review.create({ data: { cycleId: cycle.id, employeeId, reviewerId: reviewerId ?? undefined, selfDone: s.self, managerDone: s.manager, o2oDone: s.o2o, rating: s.rating ?? undefined } });
  }
  for (const okr of OKRS) {
    const o = await db.objective.create({ data: { cycleId: cycle.id, scope: okr.scope, ownerId: okr.ownerId, title: okr.title } });
    for (const [title, progress] of okr.krs) await db.keyResult.create({ data: { objectiveId: o.id, title: title as string, progress: progress as number } });
  }

  // Nómina (junio 2026)
  const paid = EMPLOYEES.filter(e => e.salary);
  let totalGross = 0;
  const run = await db.payrollRun.create({ data: { period: '2026-06' } });
  for (const e of paid) {
    const p = payrollFor(e.salary!);
    totalGross += p.gross;
    await db.payslip.create({ data: { runId: run.id, employeeId: e.id, gross: p.gross, irpf: p.irpf, ss: p.ss, net: p.net } });
  }
  for (const inc of INCIDENCIAS) await db.payrollItem.create({ data: { runId: run.id, employeeId: inc.employeeId, type: inc.type as PayrollItemType, concept: inc.concept, amount: inc.amount } });
  await db.payrollRun.update({ where: { id: run.id }, data: { totalGross, totalCost: Math.round(totalGross * 1.30) } });

  // Documentos
  for (const d of DOCS) await db.document.create({ data: { name: d.name, category: d.cat as DocumentCategory, ownerId: d.ownerId, status: d.status as DocumentStatus, createdAt: D(d.date) } });
  for (const t of DOC_TEMPLATES) await db.documentTemplate.create({ data: { name: t.name, category: t.category as DocumentCategory } });

  // Usuarios (login). Contraseña demo para todos: "nucleo123"
  const hash = await bcrypt.hash('nucleo123', 10);
  await db.user.create({ data: { email: 'admin@grupo.com', passwordHash: hash, role: Role.ADMIN, employeeId: 'e1' } });
  await db.user.create({ data: { email: 'blanca.ruiz@grupo.com', passwordHash: hash, role: Role.RRHH, employeeId: 'e2' } });
  await db.user.create({ data: { email: 'carlos.soto@grupo.com', passwordHash: hash, role: Role.MANAGER, employeeId: 'e3' } });
  await db.user.create({ data: { email: 'diego.ortega@grupo.com', passwordHash: hash, role: Role.EMPLEADO, employeeId: 'e6' } });

  console.log(`✅  Seed completado: ${EMPLOYEES.length} empleados, ${DEPTS.length} departamentos, nómina ${run.period}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
