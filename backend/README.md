# Backend - Fisheye

## Prérequis

- Node.js (v22+)
- Docker & Docker Compose

## Démarrage rapide

Suivez ces étapes dans l'ordre pour lancer le projet localement.

1. **Installation des dépendances**

   ```bash
   npm install
   ```

2. **Configuration de l'environnement**
   Copiez le fichier d'exemple pour créer votre configuration locale.

   ```bash
   cp .env.example .env
   ```

   _Assurez-vous que les variables dans `.env` sont correctes._

3. **Lancement de l'infrastructure**
   Démarre la base de données PostgreSQL et le broker MQTT.

   ```bash
   docker compose up -d
   ```

4. **Initialisation de la base de données**
   Génère le client, applique les migrations et remplit la base avec des données de test.

   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run prisma:seed
   ```

5. **Démarrage du serveur**
   Lance le serveur en mode développement (watch).

   ```bash
   npm run dev
   ```

## Commandes utiles

| Commande               | Description                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `npx prisma studio`    | Ouvre une interface web pour visualiser la base de données.                        |
| `npm run prisma:reset` | **Attention** : Supprime la BDD, re-migre et re-seed (utile pour repartir à zéro). |
| `npm run build`        | Compile le projet pour la production.                                              |
| `npm start`            | Lance le serveur compilé (production).                                             |

## Note sur MQTT

Le broker MQTT est géré par Docker. Il se configure automatiquement au premier lancement (génération des certificats SSL dans `mosquitto/certs/` et des utilisateurs).
