@echo off

git pull
pnpm build
pnpm run electron:dev
