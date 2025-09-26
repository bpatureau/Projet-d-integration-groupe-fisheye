# Fisheye 🐟

## Sonnette connectée 100% locale et privée

Fisheye est une solution de sonnette connectée qui fonctionne entièrement en local, sans connexion internet. Toutes vos données restent stockées et sécurisées directement sur l'appareil.

## 🎯 Caractéristiques

- **100% local** : Aucune donnée ne quitte votre réseau
- **Écran tactile** : Affichage de messages personnalisés et informations
- **Messages vocaux** : Enregistrement via microphone intégré
- **Interface web** : Dashboard accessible depuis n'importe quel navigateur
- **Gestion des disponibilités** : Planification des heures de présence

## 🛠️ Architecture technique

Le système repose sur un **Raspberry Pi 4** avec :

- **Hardware** : Écran tactile, microphone, haut-parleur
- **Backend** : API REST en Go avec authentification Bearer
- **Frontend** : Dashboard React.js
- **Base de données** : PostgreSQL (Docker)
- **Contrôle hardware** : Programme Python pour les GPIO

## 📱 Fonctionnalités du dashboard

Accessible via l'adresse IP du Raspberry Pi sur votre réseau local :

- Consultation des logs système
- Écoute et gestion des messages vocaux  
- Visualisation des notifications récentes
- Configuration des horaires de disponibilité
- Personnalisation des messages affichés
