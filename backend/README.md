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

## Base de données

### Commandes Prisma de base

```bash
npm run prisma:generate  # Générer le client Prisma
npm run prisma:migrate   # Appliquer les migrations
npm run prisma:studio    # Ouvrir l'interface Prisma Studio
```

### Seeding de la base de données

```bash
npm run prisma:reset
```

Cette commande va :

- Supprimer toutes les données existantes
- Réappliquer toutes les migrations
- Créer automatiquement des données de démo
