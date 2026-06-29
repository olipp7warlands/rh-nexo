# Lecciones — Nexo

> Patrones aprendidos para no repetir errores. Revisar al inicio de cada sesión.
> Máx. 20 activas; purgar las ya incorporadas al código/config.

## Prisma
1. **Enums en multilínea, siempre.** Prisma NO admite `enum X { A B C }` en una sola línea
   (error confuso "This line is not an enum value definition" que apunta a líneas equivocadas
   en cascada). Un valor por línea.
2. **`prisma generate` desde la raíz necesita `@prisma/client` en la raíz.** El paquete dueño de
   `prisma/schema.prisma` y del script de seed (aquí, la raíz del monorepo) debe declarar
   `@prisma/client`, no solo `apps/api`. Si no, `generate` intenta auto-instalarlo y falla.
3. **`migrate dev` auto-siembra.** Usar `--skip-seed` cuando se quiera controlar el seed aparte
   y evitar dobles inserciones / errores de unicidad.

## Monorepo / TypeScript (pnpm)
4. **Cada paquete declara los tipos que consume.** Con el aislamiento de pnpm, `packages/ui` no
   "ve" los `@types/react` de `apps/web`. Un paquete que importa React debe tener `@types/react`
   (+ `@types/react-dom`) en sus propias `devDependencies`, o `tsc` falla con
   "Could not find a declaration file for module 'react'".
5. **Artefactos fuera de git.** Añadir `*.tsbuildinfo` al `.gitignore` (lo genera `tsc -b`).

## React / Formularios
6. **Inputs reutilizables con `forwardRef`.** Para integrarse con React Hook Form (`register()`),
   los componentes de input del design system deben reenviar `ref` al `<input>` real.

## Verificación
7. **El patrón glob de Vitest importa.** `*.spec.ts` NO casa con `auth.e2e-spec.ts` (es `-spec.ts`).
   Usar `*spec.ts` en `include` para aceptar ambas convenciones.
8. **NestJS bajo Vitest requiere SWC.** La DI y class-validator dependen de la metadata de
   decoradores; usar `unplugin-swc` en `vitest.config.ts` (esbuild solo no la emite).
