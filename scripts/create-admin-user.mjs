/**
 * Alta/actualización puntual de un usuario ADMIN real, fuera del seed.
 * Uso: ver la explicación en el mensaje que acompaña a este script (no hay endpoint público
 * para esto a propósito).
 *
 * Idempotente: si el email ya existe, actualiza passwordHash/role (y employeeId si se pasa
 * --employee-id); si no existe, lo crea. Nunca imprime la contraseña ni el hash.
 *
 * Contraseña: variable de entorno ADMIN_PASSWORD, o prompt enmascarado por consola si hay TTY.
 * Conexión: usa DATABASE_URL del entorno igual que `prisma migrate deploy`/`pnpm db:seed` en
 * este repo — no hay .env de producción "aparte": el .env de la raíz YA es producción.
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 12; // más estricto que el mínimo de login (6, ver auth.dto.ts):
                                  // esta es una credencial real que sustituye a las demo.

const CTRL_C = '';
const BACKSPACE_CHARS = new Set(['', '\b']);

function parseArgs(argv) {
  const args = { yes: false };
  for (const raw of argv) {
    const [key, ...rest] = raw.replace(/^--/, '').split('=');
    const value = rest.join('=');
    if (key === 'email') args.email = value;
    else if (key === 'employee-id') args.employeeId = value;
    else if (key === 'yes') args.yes = true;
  }
  return args;
}

function maskDbUrl(url) {
  try {
    const u = new URL(url);
    const ref = (u.username || '').split('.')[1] ?? u.username;
    return `${u.hostname} (proyecto: ${ref ?? 'desconocido'})`;
  } catch {
    return '(no se pudo interpretar DATABASE_URL)';
  }
}

function askConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

// Prompt con eco desactivado. Si no hay TTY (p. ej. lanzado desde un pipe), devuelve null:
// en ese caso hay que usar ADMIN_PASSWORD.
function askPasswordMasked(question) {
  if (!process.stdin.isTTY) return Promise.resolve(null);
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let input = '';
    const onData = (char) => {
      if (char === '\n' || char === '\r') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
        return;
      }
      if (char === CTRL_C) {
        stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(130);
      }
      if (BACKSPACE_CHARS.has(char)) {
        input = input.slice(0, -1);
        return;
      }
      input += char;
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error('Falta --email=<correo>. Uso: node scripts/create-admin-user.mjs --email=tu@correo.com [--employee-id=eXX] [--yes]');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
    console.error('Email con formato inválido:', args.email);
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askPasswordMasked('Contraseña para el nuevo ADMIN (no se mostrará en pantalla): ');
  }
  if (!password) {
    console.error('No hay contraseña disponible. Define ADMIN_PASSWORD o ejecuta esto en una terminal interactiva.');
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('No hay DATABASE_URL en el entorno.');
    process.exit(1);
  }

  console.log(`\nDestino: ${maskDbUrl(databaseUrl)}`);
  console.log(`Acción: crear/actualizar User email=${args.email} role=ADMIN` + (args.employeeId ? ` employeeId=${args.employeeId}` : ' (sin employeeId)'));

  if (!args.yes) {
    const answer = await askConfirmation('Escribe SI para continuar: ');
    if (answer.trim().toUpperCase() !== 'SI') {
      console.log('Cancelado.');
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  try {
    if (args.employeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: args.employeeId } });
      if (!employee) {
        console.error(`No existe ningún Employee con id "${args.employeeId}".`);
        process.exit(1);
      }
      const linkedToOther = await prisma.user.findFirst({
        where: { employeeId: args.employeeId, email: { not: args.email } },
      });
      if (linkedToOther) {
        console.error(`Ese Employee ya está vinculado a otro usuario: ${linkedToOther.email}. Un Employee solo puede tener un User (employeeId es único).`);
        process.exit(1);
      }
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    password = null; // ya no hace falta en memoria en texto plano

    const existing = await prisma.user.findUnique({ where: { email: args.email } });
    const data = {
      passwordHash,
      role: Role.ADMIN,
      ...(args.employeeId ? { employeeId: args.employeeId } : {}),
    };

    const user = existing
      ? await prisma.user.update({ where: { email: args.email }, data })
      : await prisma.user.create({ data: { email: args.email, ...data } });

    console.log(existing ? '\n✅ Usuario actualizado:' : '\n✅ Usuario creado:');
    console.log({ id: user.id, email: user.email, role: user.role, employeeId: user.employeeId, createdAt: user.createdAt });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message ?? e);
  process.exit(1);
});
