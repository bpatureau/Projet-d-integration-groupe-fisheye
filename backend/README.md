# Backend - Fisheye

## Prérequis

- Node.js (>= 22+) et npm

## Installation

```bash
cd backend
npm install
```

## Configuration

- Fournir les variables d'environnement nécessaires (ex: fichier `.env`) et le fichier de crédentiel `credentials/service-account.json` si utilisé.

## Démarrage

- Développement (mode watch) :

```bash
npm run dev
```

- Production :

```bash
npm run build
npm start
```

- Option Docker :

```bash
docker-compose up -d
```

## Astuce rapide

- Pour la base de données Prisma (si nécessaire) :

```bash
npm run prisma:generate
npm run prisma:migrate
```
