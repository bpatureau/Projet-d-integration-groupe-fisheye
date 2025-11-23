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

### Configuration MQTT (Sécurisé)

Le broker MQTT est entièrement conteneurisé et sécurisé par défaut (MQTTS sur le port 8883).

**Configuration automatique :**

Au démarrage via Docker Compose, le conteneur :

1. Génère automatiquement un fichier de mots de passe basé sur les variables d'environnement `MQTT_USERNAME` et `MQTT_PASSWORD` (défaut: `admin` / `password`).
2. Génère automatiquement des certificats SSL auto-signés si aucun certificat n'est présent dans `mosquitto/certs/`.

**Utilisation de certificats de production :**

Pour utiliser vos propres certificats (ex: Let's Encrypt) :

1. Placez vos fichiers `ca.crt`, `server.crt` et `server.key` dans le dossier `backend/mosquitto/certs/`.
2. Redémarrez le conteneur MQTT.

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

- Docker :

```bash
docker compose up -d --build
```

## Base de données

### Commandes Prisma de base

```bash
npm run prisma:generate  # Générer le client Prisma
npm run prisma:migrate   # Appliquer les migrations
npm run prisma:seed      # Seed de la base de données
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
