# Reglas arquitectónicas del proyecto CRM

## Stack técnico fijo

Este proyecto NO debe cambiar el stack actual.

Frontend:
- React 18
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- React Router DOM v6
- Axios + TanStack Query
- React Hook Form + Zod

Backend:
- Express.js (server-side)
- API PHP externa en crm.claudiogonzalez.dev

Base de datos:
- MySQL accedida vía PHP
- Node NO accede directo a MySQL

Bundler:
- Vite build dual (client + server)

## Regla obligatoria

La migración CRM V2 modifica:
- modelo de datos
- endpoints
- workflow
- UI

pero NO implica cambiar el stack técnico.

No proponer:
- Next.js
- Prisma
- Sequelize
- NestJS
- Supabase
- Firebase
- ORM nuevos
- cambio de DB

Si una solución requiere cambiar el stack, debe proponerse alternativa compatible.
