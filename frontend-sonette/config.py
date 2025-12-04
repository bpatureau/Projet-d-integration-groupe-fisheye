"""
Module de gestion de la configuration
"""
import json
import os
import uuid


# Palette de couleurs moderne
COLORS = {
    'primary': '#0F4C81',
    'primary_dark': '#0A3B66',
    'primary_light': '#E0F2F7',
    'secondary': '#4A90E2',
    'accent': '#78C2F2',
    'success': '#28A745',
    'warning': '#FFC107',
    'danger': '#DC3545',
    'white': '#FFFFFF',
    'light_gray': '#F5F5F5',
    'medium_gray': '#D0D0D0',
    'border_light': '#A8DDEB',
    'text_dark': '#212529',
    'text_light': '#6C757D',
    'online': '#28A745',
    'offline': '#DC3545',
}


def charger_config():
    """Charge la configuration depuis config.json"""
    config_defaut = {
        "serial_port_arduino": "COM4",
        "baudrate_arduino": 9600,
        "serial_port_esp": "COM3", 
        "baudrate_esp": 115200,
        "timeout": 1,
        "joystick_threshold": 300,
        "joystick_delay": 0.4,
        "mqtt_broker": "bx.phausman.be",
        "mqtt_user": "user1",
        "mqtt_password": "user1",
        "mqtt_port": 1883,
        "mqtt_client_id": f"fisheye_{uuid.uuid4().hex[:8]}",
        "full_screen": False
    }

    try:
        if os.path.exists("config.json"):
            with open("config.json", "r", encoding="utf-8") as f:
                config = json.load(f)
                if "mqtt_client_id" not in config:
                    config["mqtt_client_id"] = f"fisheye_{uuid.uuid4().hex[:8]}"
                print("[INFO] Configuration chargée depuis config.json")
                return config
        else:
            with open("config.json", "w", encoding="utf-8") as f:
                json.dump(config_defaut, f, indent=4)
            print("[INFO] Fichier config.json créé avec les valeurs par défaut")
            return config_defaut
    except Exception as e:
        print(f"[ERREUR] Impossible de charger la config : {e}")
        return config_defaut


def charger_professeurs(payload=None):
    """Charge la liste des professeurs depuis professeurs.json"""
    profs_defaut = {
        "Mme Vroman": {"disponible": True, "id": str(uuid.uuid4())},
        "M. Dubruille": {"disponible": False, "id": str(uuid.uuid4())},
        "M. De Smet": {"disponible": True, "id": str(uuid.uuid4())},
        "M. Van Dormael": {"disponible": True, "id": str(uuid.uuid4())}
    }

    if payload:
        print(payload)

    return profs_defaut


def sauvegarder_professeurs(professeurs):
    """Sauvegarde les professeurs dans professeurs.json"""
    try:
        with open("professeurs.json", "w", encoding="utf-8") as f:
            json.dump(professeurs, f, indent=4, ensure_ascii=False)
        print("[INFO] Professeurs sauvegardés dans professeurs.json")
        return True
    except Exception as e:
        print(f"[ERREUR] Impossible de sauvegarder les professeurs : {e}")
        return False