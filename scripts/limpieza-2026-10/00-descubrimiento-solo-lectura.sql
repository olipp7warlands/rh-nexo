-- PASO 0 — Solo SELECT. Confirmar que produccion == seed y que no hay datos reales mezclados.
SELECT email, role, "isActive", "employeeId", "createdAt", "lastLogin" FROM "User" ORDER BY "createdAt";

SELECT 'Employee' t, count(*) total, count(*) FILTER (WHERE id ~ '^e[0-9]+$') demo FROM "Employee"
UNION ALL SELECT 'Department', count(*), count(*) FILTER (WHERE id LIKE 'd-%') FROM "Department"
UNION ALL SELECT 'Candidate', count(*), count(*) FILTER (WHERE email LIKE '%@example.com') FROM "Candidate"
UNION ALL SELECT 'Job', count(*), NULL FROM "Job"
UNION ALL SELECT 'Application', count(*), NULL FROM "Application"
UNION ALL SELECT 'Document (3a col = con fichero en Storage, debe ser 0)', count(*), count(*) FILTER (WHERE "fileUrl" IS NOT NULL) FROM "Document"
UNION ALL SELECT 'Payslip (3a col = con PDF)', count(*), count(*) FILTER (WHERE "pdfUrl" IS NOT NULL) FROM "Payslip"
UNION ALL SELECT 'Anotacion', count(*), NULL FROM "Anotacion"
UNION ALL SELECT 'AuditLog', count(*), NULL FROM "AuditLog"
UNION ALL SELECT 'AuditDecision', count(*), NULL FROM "AuditDecision"
UNION ALL SELECT 'Proyecto (debe ser 0: la migracion no lo siembra)', count(*), NULL FROM "Proyecto";

-- Empleados que NO son demo (si salen filas, hay datos reales en produccion):
SELECT id, "fullName", email, "createdAt" FROM "Employee" WHERE id !~ '^e[0-9]+$';

-- Que ha hecho la cuenta real (y sobre que entidades):
SELECT a.action, a.entity, count(*) FROM "AuditLog" a JOIN "User" u ON u.id = a."actorId"
 WHERE u.email = 'blanca.garcia@wowinx.com' GROUP BY 1, 2 ORDER BY 3 DESC;

-- Uso de las cuentas demo tras el seed:
SELECT u.email, count(a.*) acciones, max(a."createdAt") ultima
  FROM "User" u LEFT JOIN "AuditLog" a ON a."actorId" = u.id
 WHERE u.email LIKE '%@grupo.com' GROUP BY 1;
