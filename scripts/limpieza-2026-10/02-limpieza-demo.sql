-- PASO 2 — Limpieza de datos demo en produccion. Idempotente, atomica, DRY-RUN por defecto.
--   Ensayo (no persiste nada):  psql "$DIRECT_URL" -f 02-limpieza-demo.sql
--   Real:                       psql "$DIRECT_URL" -v commit=true -f 02-limpieza-demo.sql
-- Usa DIRECT_URL (pooler de sesion :5432), NO el pooler de transaccion.
-- Identifica lo demo por identidad fija del seed (ids e1..e17, d-*, emails/titulos/nombres exactos),
-- nunca por "todo lo que haya": lo creado despues por usuarios reales no coincide y queda intacto.
-- NO toca: User (filas), AuditLog (solo INSERTA 1 fila resumen), catalogos Tanda 2, Categoria, Stage, plantillas, blanca.garcia.
-- Reestructura: 0 festivos/localizaciones/departamentos, 14 sociedades reales, 3 paises (España, Emiratos Árabes Unidos, India).
-- Orden: ejecutar ANTES de cargar festivos/localizaciones reales (el preflight aborta si ya hay reales).

\set ON_ERROR_STOP on
\if :{?commit} \else \set commit false \endif

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $cleanup$
DECLARE
  demo_emp   text[] := ARRAY['e1','e2','e3','e4','e5','e6','e7','e8','e9','e10','e11','e12','e13','e14','e15','e16','e17'];
  demo_dept  text[] := ARRAY['d-eng','d-design','d-data','d-product','d-marketing','d-customer','d-people','d-finance'];
  demo_users text[] := ARRAY['admin@grupo.com','blanca.ruiz@grupo.com','carlos.soto@grupo.com','diego.ortega@grupo.com'];
  demo_cand_emails text[] := ARRAY['sofia.navarro.cand@example.com','raul.dominguez.cand@example.com','marta.saez@example.com','hugo.belmonte@example.com','nadia.khattabi@example.com','oscar.prieto@example.com','lia.ferrer@example.com','bruno.cabrera@example.com','alicia.vega@example.com'];
  demo_job_titles text[] := ARRAY['Principal Engineer','Content Marketing','Senior Frontend Engineer','Data Engineer','Customer Success Manager'];
  demo_doc_names text[] := ARRAY['Política de teletrabajo 2026','Plan de igualdad del grupo','Contrato · Sofía Navarro','Contrato · Raúl Domínguez','Certificado de retenciones 2025','Nóminas · junio 2026 (lote)','Acuerdo de confidencialidad · Sofía Navarro','Certificado de formación · RGPD'];
  demo_soc   text[] := ARRAY['wowinX Tech España, S.L.','wowinX Servicios España, S.L.','wowinX Middle East FZ-LLC','wowinX India Private Limited','wowinX Colombia SAS','wowinX México, S.A. de C.V.'];
  demo_loc   text[] := ARRAY['Madrid','Barcelona','Bilbao','Málaga','Valencia'];
  demo_hol   text[] := ARRAY['Año Nuevo','Reyes','Viernes Santo','Día del Trabajo','Asunción','Fiesta Nacional','Todos los Santos','Constitución','Inmaculada','Navidad','Comunidad de Madrid','Diada'];
  new_soc_sl   text[] := ARRAY['Colibri Live SL','BeFootball SL','Prisma Virtual Reality SL','The Running of the Bulls SL','Trib3s Factory SL','Synaptia Invest SL','ROV Comunicaciones SL'];
  new_soc_fzco text[] := ARRAY['Virtual Sports Industry FZCO','Samarkanda Technology FZCO','BeSports Academy FZCO','BeConn3ct FZCO','wowinX FZCO','Imm3rsive FZCO','Trivium Studio FZCO'];
  pais_es constant text := 'España'; pais_ae constant text := 'Emiratos Árabes Unidos'; pais_in constant text := 'India';
  demo_period constant text := '2026-06';
  demo_cycle  constant text := 'Revisión Q2 2026';

  demo_user_ids text[]; demo_jobs text[]; demo_cands text[]; demo_apps text[]; demo_docs text[]; demo_runs text[];
  seed_ts timestamptz;
  bad int; n int; total int := 0; counts jsonb := '{}'::jsonb;
  cat_before jsonb; cat_after jsonb; audit_before bigint; audit_after bigint;
BEGIN
  -- ───────────── Instantanea de invariantes (se compara al final) ─────────────
  SELECT jsonb_build_object(
    'TipoContrato',(SELECT count(*) FROM "TipoContrato"),
    'Jornada',(SELECT count(*) FROM "Jornada"), 'RelacionEmergencia',(SELECT count(*) FROM "RelacionEmergencia"),
    'Idioma',(SELECT count(*) FROM "Idioma"), 'Proyecto',(SELECT count(*) FROM "Proyecto"),
    'Categoria',(SELECT count(*) FROM "Categoria"), 'Stage',(SELECT count(*) FROM "Stage"),
    'PlantillaProceso',(SELECT count(*) FROM "PlantillaProceso"), 'PlantillaProcesoTarea',(SELECT count(*) FROM "PlantillaProcesoTarea"),
    'DocumentTemplate',(SELECT count(*) FROM "DocumentTemplate"),
    'User',(SELECT count(*) FROM "User")) INTO cat_before;
  SELECT count(*) INTO audit_before FROM "AuditLog";

  -- ───────────── PREFLIGHT: cualquier anomalia => EXCEPTION => rollback total ─────────────
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email='blanca.garcia@wowinx.com' AND "isActive" AND role='ADMIN') THEN
    RAISE EXCEPTION 'PREFLIGHT: blanca.garcia@wowinx.com no existe / inactiva / no es ADMIN';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE email='blanca.garcia@wowinx.com' AND "employeeId" = ANY(demo_emp)) THEN
    RAISE EXCEPTION 'PREFLIGHT: blanca.garcia esta vinculada a un empleado demo (%). Crea/vincula su ficha real antes',
      (SELECT "employeeId" FROM "User" WHERE email='blanca.garcia@wowinx.com');
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE email = ANY(demo_users) AND "isActive") THEN
    RAISE EXCEPTION 'PREFLIGHT: hay cuentas demo activas; ejecuta antes 01-desactivar-cuentas-demo.sql';
  END IF;

  SELECT array_agg(id), min("createdAt") INTO demo_user_ids, seed_ts FROM "User" WHERE email = ANY(demo_users);
  demo_user_ids := COALESCE(demo_user_ids, '{}');
  SELECT COALESCE(array_agg(id),'{}') INTO demo_cands FROM "Candidate" WHERE email = ANY(demo_cand_emails);
  SELECT COALESCE(array_agg(id),'{}') INTO demo_jobs  FROM "Job" WHERE title = ANY(demo_job_titles) AND "hiringManagerId" = ANY(demo_emp);
  SELECT COALESCE(array_agg(id),'{}') INTO demo_apps  FROM "Application" WHERE "jobId" = ANY(demo_jobs) OR "candidateId" = ANY(demo_cands);
  SELECT COALESCE(array_agg(id),'{}') INTO demo_runs  FROM "PayrollRun" WHERE period = demo_period;

  -- Empleados reales colgando de estructura demo (el FK los dejaria en NULL en silencio)
  SELECT count(*) INTO bad FROM "Employee" WHERE id <> ALL(demo_emp) AND ("managerId" = ANY(demo_emp) OR "departmentId" = ANY(demo_dept));
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % empleados NO demo dependen de managers/departamentos demo', bad; END IF;
  SELECT count(*) INTO bad FROM "Employee" WHERE id <> ALL(demo_emp) AND "candidateId" = ANY(demo_cands);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % empleados NO demo enlazados a candidatos demo', bad; END IF;
  SELECT count(*) INTO bad FROM "Job" WHERE id <> ALL(demo_jobs) AND "departmentId" = ANY(demo_dept);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % ofertas NO demo usan departamentos demo', bad; END IF;

  -- Estructura: nada real colgando de sociedades/localizaciones demo; nada desconocido en los catalogos
  SELECT count(*) INTO bad FROM "Employee" e JOIN "Sociedad" s ON s.id=e."sociedadId" WHERE s.nombre = ANY(demo_soc) AND e.id <> ALL(demo_emp);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % empleados NO demo en sociedades demo', bad; END IF;
  SELECT count(*) INTO bad FROM "RegistroPuesto" r JOIN "Sociedad" s ON s.id=r."sociedadId" WHERE s.nombre = ANY(demo_soc) AND r."empleadoId" <> ALL(demo_emp);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % registros de puesto NO demo en sociedades demo', bad; END IF;
  SELECT count(*) INTO bad FROM "Employee" e JOIN "Localizacion" l ON l.id=e."localizacionId" WHERE l.nombre = ANY(demo_loc) AND e.id <> ALL(demo_emp);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % empleados NO demo en localizaciones demo', bad; END IF;
  SELECT count(*) INTO bad FROM "Sociedad" WHERE nombre <> ALL(demo_soc) AND nombre <> ALL(new_soc_sl) AND nombre <> ALL(new_soc_fzco);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % sociedades desconocidas (ni demo ni de la lista real)', bad; END IF;
  SELECT count(*) INTO bad FROM "Localizacion" WHERE nombre <> ALL(demo_loc);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % localizaciones que no son demo (ya hay reales cargadas)', bad; END IF;
  SELECT count(*) INTO bad FROM "Holiday" WHERE name <> ALL(demo_hol);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % festivos que no son demo (ya hay reales cargados)', bad; END IF;
  SELECT count(*) INTO bad FROM "Pais" WHERE nombre <> ALL(ARRAY['España','Dubái','India','Colombia','México', pais_ae]);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % paises desconocidos', bad; END IF;

  -- Reclutamiento: nada mezclado demo/real
  SELECT count(*) INTO bad FROM "Application"
   WHERE ("jobId" = ANY(demo_jobs)) <> ("candidateId" = ANY(demo_cands));
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % candidaturas mezclan oferta/candidato demo y real', bad; END IF;

  -- Actividad real sobre fichas demo (creada tras el seed o escrita por un autor real)
  SELECT count(*) INTO bad FROM "Anotacion" WHERE "empleadoId" = ANY(demo_emp)
     AND ("autorId" <> ALL(demo_user_ids) OR "createdAt" > seed_ts + interval '1 hour');
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % anotaciones sobre fichas demo son posteriores al seed o de autor real', bad; END IF;
  SELECT count(*) INTO bad FROM "Absence" WHERE "employeeId" = ANY(demo_emp) AND "createdAt" > seed_ts + interval '1 hour';
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % ausencias de empleados demo creadas tras el seed', bad; END IF;
  SELECT count(*) INTO bad FROM "TimeEntry" WHERE "employeeId" = ANY(demo_emp);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: hay fichajes de empleados demo (el seed no crea ninguno)'; END IF;

  -- Documentos: solo los 8 del seed y SIN fichero en Storage (SQL no puede borrar objetos del bucket)
  SELECT count(*) INTO bad FROM "Document" WHERE "ownerId" = ANY(demo_emp) AND (name <> ALL(demo_doc_names) OR "fileUrl" IS NOT NULL);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % documentos de empleados demo no son del seed o tienen fichero en Storage', bad; END IF;
  SELECT COALESCE(array_agg(id),'{}') INTO demo_docs FROM "Document" WHERE "ownerId" = ANY(demo_emp);
  SELECT count(*) INTO bad FROM "DocumentSignature" WHERE "employeeId" = ANY(demo_emp) AND "documentId" <> ALL(demo_docs);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % firmas de empleados demo sobre documentos no demo', bad; END IF;

  -- Nomina: solo el lote del seed, sin PDFs
  SELECT count(*) INTO bad FROM "Payslip" WHERE "employeeId" = ANY(demo_emp) AND ("runId" <> ALL(demo_runs) OR "pdfUrl" IS NOT NULL);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % nominas demo fuera del lote % o con PDF', bad, demo_period; END IF;
  SELECT count(*) INTO bad FROM "PayrollItem" WHERE "employeeId" = ANY(demo_emp) AND "runId" <> ALL(demo_runs);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % incidencias de nomina demo fuera del lote %', bad, demo_period; END IF;
  SELECT count(*) INTO bad FROM "Payslip" WHERE "runId" = ANY(demo_runs) AND "employeeId" <> ALL(demo_emp);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: el lote % contiene % nominas de personas NO demo', demo_period, bad; END IF;

  -- Desempeno: solo el ciclo del seed
  SELECT count(*) INTO bad FROM "Review" r JOIN "PerformanceCycle" c ON c.id = r."cycleId"
   WHERE (r."employeeId" = ANY(demo_emp)) <> (c.name = demo_cycle);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % reviews mezclan ciclo/empleado demo y real', bad; END IF;
  SELECT count(*) INTO bad FROM "Objective" o LEFT JOIN "PerformanceCycle" c ON c.id = o."cycleId"
   WHERE o."ownerId" = ANY(demo_emp) AND COALESCE(c.name,'') <> demo_cycle;
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % objetivos demo fuera del ciclo del seed', bad; END IF;

  -- ───────────── BORRADO (hijos antes que padres) ─────────────
  -- Reclutamiento. OJO: AuditDecision es traza de decisiones sobre candidaturas demo (FK RESTRICT a Application).
  DELETE FROM "AuditDecision" WHERE "applicationId" = ANY(demo_apps); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('AuditDecision',n); total := total+n;
  DELETE FROM "Evaluation"    WHERE "applicationId" = ANY(demo_apps); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Evaluation',n);    total := total+n;
  DELETE FROM "Interview"     WHERE "applicationId" = ANY(demo_apps); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Interview',n);     total := total+n;
  DELETE FROM "Application"   WHERE id = ANY(demo_apps);              GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Application',n);   total := total+n;
  DELETE FROM "Job"           WHERE id = ANY(demo_jobs);              GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Job',n);           total := total+n;

  -- Procesos (instancias; las PLANTILLAS se conservan)
  DELETE FROM "ProcesoTarea" WHERE "procesoId" IN (SELECT id FROM "Proceso" WHERE "employeeId" = ANY(demo_emp)); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('ProcesoTarea',n); total := total+n;
  DELETE FROM "Proceso"      WHERE "employeeId" = ANY(demo_emp);                                              GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Proceso',n);      total := total+n;

  -- Desempeno
  DELETE FROM "KeyResult" WHERE "objectiveId" IN (SELECT id FROM "Objective" WHERE "ownerId" = ANY(demo_emp)); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('KeyResult',n); total := total+n;
  DELETE FROM "Objective" WHERE "ownerId" = ANY(demo_emp);    GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Objective',n); total := total+n;
  DELETE FROM "Review"    WHERE "employeeId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Review',n);    total := total+n;
  DELETE FROM "PerformanceCycle" c WHERE c.name = demo_cycle
     AND NOT EXISTS (SELECT 1 FROM "Review" r WHERE r."cycleId" = c.id) AND NOT EXISTS (SELECT 1 FROM "Objective" o WHERE o."cycleId" = c.id);
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('PerformanceCycle',n); total := total+n;

  -- Nomina
  DELETE FROM "PayrollItem" WHERE "employeeId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('PayrollItem',n); total := total+n;
  DELETE FROM "Payslip"     WHERE "employeeId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Payslip',n);     total := total+n;
  DELETE FROM "PayrollRun" r WHERE r.id = ANY(demo_runs)
     AND NOT EXISTS (SELECT 1 FROM "Payslip" p WHERE p."runId" = r.id) AND NOT EXISTS (SELECT 1 FROM "PayrollItem" i WHERE i."runId" = r.id);
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('PayrollRun',n); total := total+n;

  -- Documentos (las PLANTILLAS de documento se conservan)
  DELETE FROM "DocumentSignature" WHERE "documentId" = ANY(demo_docs) OR "employeeId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('DocumentSignature',n); total := total+n;
  DELETE FROM "Document" WHERE id = ANY(demo_docs);                                                    GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Document',n);          total := total+n;

  -- Memoria, expediente, tiempo
  DELETE FROM "Anotacion"        WHERE "empleadoId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Anotacion',n);        total := total+n;
  DELETE FROM "RegistroPuesto"   WHERE "empleadoId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('RegistroPuesto',n);   total := total+n;
  DELETE FROM "RegistroSalarial" WHERE "empleadoId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('RegistroSalarial',n); total := total+n;
  DELETE FROM "LeaveBalance"     WHERE "employeeId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('LeaveBalance',n);     total := total+n;
  DELETE FROM "Absence"          WHERE "employeeId" = ANY(demo_emp); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Absence',n);          total := total+n;

  -- Notificaciones de las cuentas demo (efimeras; no son auditoria)
  DELETE FROM "Notification" WHERE "userId" = ANY(demo_user_ids); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Notification',n); total := total+n;

  -- Empleados demo. Efectos por FK ya revisados en preflight: User.employeeId -> NULL (las 4 cuentas demo
  -- siguen existiendo, inactivas), _EmployeeToIdioma -> CASCADE, Department.leadId / manager / buddy -> NULL.
  DELETE FROM "Employee"  WHERE id = ANY(demo_emp);   GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Employee',n);  total := total+n;
  DELETE FROM "Candidate" WHERE id = ANY(demo_cands); GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Candidate',n); total := total+n;
  DELETE FROM "Department" d WHERE d.id = ANY(demo_dept)
     AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."departmentId" = d.id) AND NOT EXISTS (SELECT 1 FROM "Job" j WHERE j."departmentId" = d.id);
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Department',n); total := total+n;

  -- ── Estructura: festivos y localizaciones demo fuera; sociedades demo fuera y 14 reales dentro; paises 3 ──
  DELETE FROM "Holiday" WHERE name = ANY(demo_hol);          GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Holiday',n);       total := total+n;
  DELETE FROM "Localizacion" WHERE nombre = ANY(demo_loc);   GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Localizacion',n); total := total+n;
  DELETE FROM "Sociedad" WHERE nombre = ANY(demo_soc);       GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Sociedad_demo',n); total := total+n;
  -- "Dubái" pasa a "Emiratos Árabes Unidos" (mismo id; no hay nada que re-apuntar)
  UPDATE "Pais" SET nombre = pais_ae WHERE nombre = 'Dubái' AND NOT EXISTS (SELECT 1 FROM "Pais" WHERE nombre = pais_ae);
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Pais_renombrado',n); total := total+n;
  INSERT INTO "Pais"(id, nombre) SELECT gen_random_uuid()::text, pais_in WHERE NOT EXISTS (SELECT 1 FROM "Pais" WHERE nombre = pais_in);
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Pais_creado',n); total := total+n;
  IF (SELECT count(*) FROM "Pais" WHERE nombre IN (pais_es, pais_ae, pais_in)) <> 3 THEN
    RAISE EXCEPTION 'Faltan paises base (España / Emiratos Árabes Unidos / India)'; END IF;
  INSERT INTO "Sociedad"(id, nombre, "paisId")
  SELECT gen_random_uuid()::text, v.nombre, p.id
  FROM (SELECT unnest(new_soc_sl) AS nombre, pais_es AS pais UNION ALL SELECT unnest(new_soc_fzco), pais_ae) v
  JOIN "Pais" p ON p.nombre = v.pais
  ON CONFLICT (nombre) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Sociedad_creada',n); total := total+n;
  DELETE FROM "Pais" WHERE nombre IN ('Colombia','México')
     AND NOT EXISTS (SELECT 1 FROM "Sociedad" s WHERE s."paisId" = "Pais".id);
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('Pais_borrado',n); total := total+n;

  -- Traza de la propia limpieza (append-only; sin actor de aplicacion). Solo si hubo cambios => idempotente.
  IF total > 0 THEN
    INSERT INTO "AuditLog"(id, "actorId", action, entity, "entityId", before, after, "createdAt")
    VALUES (gen_random_uuid()::text, NULL, 'CLEANUP', 'DemoData', NULL, NULL,
            jsonb_build_object('filasBorradas', counts, 'nota', 'limpieza de datos demo del seed (script SQL, sin actor de aplicacion)'), now());
  END IF;

  -- ───────────── POSTCONDICIONES (si fallan => rollback) ─────────────
  SELECT jsonb_build_object(
    'TipoContrato',(SELECT count(*) FROM "TipoContrato"),
    'Jornada',(SELECT count(*) FROM "Jornada"), 'RelacionEmergencia',(SELECT count(*) FROM "RelacionEmergencia"),
    'Idioma',(SELECT count(*) FROM "Idioma"), 'Proyecto',(SELECT count(*) FROM "Proyecto"),
    'Categoria',(SELECT count(*) FROM "Categoria"), 'Stage',(SELECT count(*) FROM "Stage"),
    'PlantillaProceso',(SELECT count(*) FROM "PlantillaProceso"), 'PlantillaProcesoTarea',(SELECT count(*) FROM "PlantillaProcesoTarea"),
    'DocumentTemplate',(SELECT count(*) FROM "DocumentTemplate"),
    'User',(SELECT count(*) FROM "User")) INTO cat_after;
  IF cat_after <> cat_before THEN RAISE EXCEPTION 'POST: cambiaron catalogos/estructura/usuarios: antes % despues %', cat_before, cat_after; END IF;

  IF (SELECT count(*) FROM "Sociedad") <> 14
     OR (SELECT count(*) FROM "Sociedad" s JOIN "Pais" p ON p.id=s."paisId" WHERE s.nombre = ANY(new_soc_sl) AND p.nombre = pais_es) <> 7
     OR (SELECT count(*) FROM "Sociedad" s JOIN "Pais" p ON p.id=s."paisId" WHERE s.nombre = ANY(new_soc_fzco) AND p.nombre = pais_ae) <> 7 THEN
    RAISE EXCEPTION 'POST: sociedades finales != 14 (7 SL en España + 7 FZCO en EAU)'; END IF;
  IF (SELECT count(*) FROM "Pais") <> 3 OR (SELECT count(*) FROM "Pais" WHERE nombre IN (pais_es, pais_ae, pais_in)) <> 3 THEN
    RAISE EXCEPTION 'POST: paises finales != {España, Emiratos Árabes Unidos, India}'; END IF;
  IF (SELECT count(*) FROM "Localizacion") <> 0 THEN RAISE EXCEPTION 'POST: quedan localizaciones'; END IF;
  IF (SELECT count(*) FROM "Holiday") <> 0 THEN RAISE EXCEPTION 'POST: quedan festivos'; END IF;
  IF (SELECT count(*) FROM "Department") <> 0 THEN RAISE EXCEPTION 'POST: quedan departamentos'; END IF;

  SELECT count(*) INTO audit_after FROM "AuditLog";
  -- ">=": la API puede insertar logs reales (VIEW...) mientras corre; lo que nunca debe ocurrir es que baje.
  IF audit_after < audit_before + (CASE WHEN total > 0 THEN 1 ELSE 0 END) THEN
    RAISE EXCEPTION 'POST: AuditLog ha perdido filas (antes %, despues %)', audit_before, audit_after;
  END IF;
  IF EXISTS (SELECT 1 FROM "Employee" WHERE id = ANY(demo_emp)) OR EXISTS (SELECT 1 FROM "Candidate" WHERE id = ANY(demo_cands)) THEN
    RAISE EXCEPTION 'POST: quedan empleados/candidatos demo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email='blanca.garcia@wowinx.com' AND "isActive" AND role='ADMIN') THEN
    RAISE EXCEPTION 'POST: blanca.garcia alterada';
  END IF;

  RAISE NOTICE 'OK. filas borradas (total %): %', total, counts;
END
$cleanup$;

\if :commit
  \echo '>>> COMMIT'
  COMMIT;
\else
  \echo '>>> DRY-RUN: ROLLBACK (usa -v commit=true para aplicar)'
  ROLLBACK;
\endif
