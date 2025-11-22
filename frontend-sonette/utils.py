# utils.py
import json
import os
import uuid

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

def charger_professeurs():
    """Charge la liste des professeurs depuis professeurs.json"""
    profs_defaut = {
        "Mme Vroman": {"disponible": True, "id": str(uuid.uuid4())},
        "M. Dubruille": {"disponible": False, "id": str(uuid.uuid4())},
        "M. De Smet": {"disponible": True, "id": str(uuid.uuid4())},
        "M. Van Dormael": {"disponible": True, "id": str(uuid.uuid4())}
    }

    try:
        if os.path.exists("professeurs.json"):
            with open("professeurs.json", "r", encoding="utf-8") as f:
                profs = json.load(f)
            for nom, info in profs.items():
                if "id" not in info:
                    info["id"] = str(uuid.uuid4())
            print(f"[INFO] {len(profs)} professeurs chargés depuis professeurs.json")
            return profs
        else:
            with open("professeurs.json", "w", encoding="utf-8") as f:
                json.dump(profs_defaut, f, indent=4, ensure_ascii=False)
            print("[INFO] Fichier professeurs.json créé avec les valeurs par défaut")
            return profs_defaut
    except Exception as e:
        print(f"[ERREUR] Impossible de charger les professeurs : {e}")
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
