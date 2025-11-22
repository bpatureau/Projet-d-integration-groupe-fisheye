# app.py
import tkinter as tk
from tkinter import font as tkfont
import threading
import time
import json

from constants import COLORS
from utils import charger_professeurs, sauvegarder_professeurs
from mqtt_service import publish_mqtt
from widgets import ModernButton, ModernCard


class SonnetteApp:
    def __init__(self, root, config, mqtt_client, arduino, esp, unacked_publish):
        self.root = root
        self.config = config
        self.mqtt_client = mqtt_client
        self.arduino = arduino
        self.esp = esp
        self.unacked_publish = unacked_publish  # Référence pour gérer la fermeture

        self.root.title("Sonnette Intelligente")

        # Mode plein écran
        if self.config.get("full_screen"):
            self.root.attributes('-fullscreen', True)

        self.root.configure(bg=COLORS['light_gray'])

        # Touches de contrôle
        self.root.bind('<Escape>', self.quitter_fullscreen)
        self.root.bind('<F11>', self.toggle_fullscreen)

        # Charger les professeurs
        self.professeurs = charger_professeurs()
        self.prof_noms = ["TOUS"] + list(self.professeurs.keys())
        self.prof_selectionne = None
        self.prof_index = 0
        self.prof_widgets = {}
        self.canvas = None
        self.door_status = 0

        self.client_id = self.config.get("mqtt_client_id")

        # Configuration des polices modernes
        self.setup_fonts()

        # S'abonner aux topics après connexion
        self.root.after(1000, self.subscribe_topics)
        self.root.after(2000, self.publier_status)

        # Créer l'interface
        self.create_header()
        self.create_main_content()

        # Sélection initiale
        if self.prof_noms:
            self.selectionner_prof(self.prof_noms[self.prof_index])

        # Focus sur la zone de texte
        self.root.after(100, self.activer_focus_message)

        # Thread pour le joystick
        if self.arduino:
            self.thread_joystick = threading.Thread(target=self.lire_joystick, daemon=True)
            self.thread_joystick.start()

        # Handler fermeture propre
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def setup_fonts(self):
        """Configure les polices modernes"""
        self.font_title = tkfont.Font(family="Segoe UI", size=24, weight="bold")
        self.font_subtitle = tkfont.Font(family="Segoe UI", size=14, weight="bold")
        self.font_body = tkfont.Font(family="Segoe UI", size=11)
        self.font_small = tkfont.Font(family="Segoe UI", size=9)

    # ... (Inclure ici toutes les méthodes create_header, create_main_content, etc.)
    # ATTENTION: Tu dois copier toutes les méthodes de la classe SonnetteApp originale ici.
    # Remplace les références globales 'config', 'arduino', 'mqttc' par 'self.config', 'self.arduino', 'self.mqtt_client'

    # Exemple pour create_header (abrégé):
    def create_header(self):
        header = tk.Frame(self.root, bg=COLORS['white'], height=80)
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)

        # ... reste du code de create_header ...
        # Assure-toi d'ajouter 'self.' devant verifier_mqtt et les variables

        # Container pour le contenu de l'en-tête
        header_content = tk.Frame(header, bg=COLORS['white'])
        header_content.pack(fill="both", expand=True, padx=30, pady=15)

        # Titre
        title_frame = tk.Frame(header_content, bg=COLORS['white'])
        title_frame.pack(side="left")

        title = tk.Label(
            title_frame,
            text="🔔 Sonnette",
            font=self.font_title,
            bg=COLORS['white'],
            fg=COLORS['text_dark']
        )
        title.pack(anchor="w")

        subtitle = tk.Label(
            title_frame,
            text="Communication avec les professeurs",
            font=self.font_small,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        )
        subtitle.pack(anchor="w")

        # Status MQTT
        status_frame = tk.Frame(header_content, bg=COLORS['white'])
        status_frame.pack(side="right")

        self.mqtt_status_indicator = tk.Label(
            status_frame,
            text="●",
            font=("Segoe UI", 16),
            bg=COLORS['white'],
            fg=COLORS['warning']
        )
        self.mqtt_status_indicator.pack(side="left", padx=(0, 10))

        mqtt_text_frame = tk.Frame(status_frame, bg=COLORS['white'])
        mqtt_text_frame.pack(side="left")

        tk.Label(
            mqtt_text_frame,
            text="État MQTT",
            font=self.font_small,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        ).pack(anchor="w")

        self.mqtt_status_label = tk.Label(
            mqtt_text_frame,
            text="Connexion...",
            font=("Segoe UI", 10, "bold"),
            bg=COLORS['white'],
            fg=COLORS['text_dark']
        )
        self.mqtt_status_label.pack(anchor="w")

        separator = tk.Frame(self.root, bg=COLORS['medium_gray'], height=1)
        separator.pack(fill="x")

        self.verifier_mqtt()

    # Copie ici les autres méthodes : create_main_content, create_message_section, create_professors_section, etc.
    # N'oublie pas d'adapter send_esp pour utiliser self.esp

    def send_esp(self, cmd):
        if self.esp:
            if cmd == "turn_on":
                self.esp.write(b'TURN_ON(5)')
            elif cmd == "turn_off":
                self.esp.write(b'TURN_OFF')

    def lire_joystick(self):
        """Boucle de lecture du joystick"""
        seuil = self.config["joystick_threshold"]  # Utilisation de self.config
        delai = self.config["joystick_delay"]
        dernier_temps = time.time()

        while True:
            try:
                if self.arduino and self.arduino.in_waiting > 0:  # Utilisation de self.arduino
                    ligne = self.arduino.readline().decode('utf-8').strip()
                    self.arduino.flushInput()

                    if not ligne:
                        continue

                    try:
                        x, y, bouton_joystick, bouton_sonnette = ligne.split(',')
                        x, y, bouton_joystick, bouton_sonnette = int(x), int(y), int(bouton_joystick), int(
                            bouton_sonnette)
                    except ValueError:
                        print(f"[ERREUR JOYSTICK] Format: {ligne}")
                        time.sleep(0.1)
                        continue

                    # Navigation
                    if time.time() - dernier_temps > delai:
                        if x < 512 - seuil:
                            self.root.after(0, self.deplacer_selection, "gauche")
                            dernier_temps = time.time()
                        elif x > 512 + seuil:
                            self.root.after(0, self.deplacer_selection, "droite")
                            dernier_temps = time.time()

                    # bouton joystick
                    if bouton_joystick:
                        self.root.after(0, self.envoyer_au_prof)
                        time.sleep(0.5)

                        # bouton sonette
                    if bouton_sonnette:
                        self.root.after(0, self.publier_button_pressed)
                        self.root.after(0, lambda: self.send_esp('turn_on'))
                        self.root.after(0, lambda: self.afficher_notification(f"Ca sonne !", 2000, COLORS['accent']))
                        time.sleep(0.5)

                time.sleep(0.01)
            except Exception as e:
                print(f"[ERREUR JOYSTICK GRAVE] {e}")
                time.sleep(1)

    def on_closing(self):
        """Handler pour fermeture propre"""
        print("[INFO] Fermeture de l'application...")
        try:
            topic = f"fisheye/{self.client_id}/status"
            payload = "offline"
            publish_mqtt(self.mqtt_client, topic, payload, qos=1, retain=True)

            timeout = time.time() + 2
            # On utilise self.unacked_publish passé depuis le main
            while self.unacked_publish and time.time() < timeout:
                time.sleep(0.1)

            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        except Exception as e:
            print(f"[ERREUR] Lors de la fermeture MQTT: {e}")

        try:
            if self.arduino and self.arduino.is_open:
                self.arduino.close()
                print("[INFO] Port série Arduino fermé")
            if self.esp and self.esp.is_open:
                self.esp.close()
                print("[INFO] Port série ESP fermé")
        except Exception as e:
            print(f"[ERREUR] Lors de la fermeture Hardware: {e}")

        self.root.quit()
        self.root.destroy()

    # ... Ajouter toutes les autres méthodes manquantes ici (subscribe_topics, handle_mqtt_message, etc.) ...
