# Railway Deployment Guide

## Prisma Client Generation

Prisma client is automatically generated:
1. After `npm install` (via `postinstall` script)
2. Before build (via `build` script)

## Build Process

The build script runs in this order:
1. `prisma generate` - Generates Prisma client to `generated/prisma/`
2. `nest build` - Compiles TypeScript to JavaScript
3. `copy:prisma` - Copies generated Prisma client to `dist/generated/prisma/`

## Environment Variables

Make sure to set `DATABASE_URL` in Railway environment variables.

## Notes

- The `generated/prisma` folder is gitignored and will be created during build
- Railway will automatically run `npm install` and `npm run build` during deployment
