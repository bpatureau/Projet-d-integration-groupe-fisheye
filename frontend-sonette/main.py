# main.py
import tkinter as tk
from utils import charger_config
from hardware import init_hardware
from mqtt_service import create_mqtt_client
from app import SonnetteApp

if __name__ == "__main__":
    # 1. Charger la configuration
    config = charger_config()

    # 2. Initialiser le matériel (Arduino/ESP)
    arduino, esp = init_hardware(config)

    # 3. Initialiser MQTT
    mqtt_client, unacked_publish = create_mqtt_client(config)

    # 4. Lancer l'application GUI
    root = tk.Tk()

    # On passe toutes les dépendances à l'application via le constructeur
    app = SonnetteApp(root, config, mqtt_client, arduino, esp, unacked_publish)

    root.mainloop()
