"""
Application principale Sonnette
"""
import tkinter as tk
import json
from config import charger_config, charger_professeurs, COLORS
from serial_comm import SerialManager
from mqtt_client import MQTTManager
from joystick_handler import JoystickHandler
from esp_handler import ESPHandler
from ui_header import HeaderUI
from ui_message_section import MessageSectionUI
from ui_professors_section import ProfessorsSectionUI


class SonnetteApp:
    """Application principale de la sonnette"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("Sonnette")
        
        # Charger la configuration
        self.config = charger_config()
        
        # Mode plein écran
        if self.config.get("full_screen"):
            self.root.attributes('-fullscreen', True)
        self.root.configure(bg=COLORS['light_gray'])
        
        # Bindings clavier
        self.root.bind('<Escape>', self.quitter_fullscreen)
        self.root.bind('<F11>', self.toggle_fullscreen)
        
        # Variables d'état
        self.prof_selectionne = None
        self.prof_index = 0
        self.professeurs = {}
        self.prof_noms = []
        self.teacher_id = ""
        self.alerte_mqtt_affiche = False
        self.alerte_arduino_affiche = False
        self.alerte_esp_affiche = False
        
        # Gestionnaires
        self.serial_manager = SerialManager(self.config)
        self.mqtt_manager = MQTTManager(self.config)
        self.joystick_handler = None
        self.esp_handler = None
        
        # UI Components
        self.header_ui = None
        self.message_ui = None
        self.professors_ui = None
        
        # Initialisation
        self.initialize()
    
    def initialize(self):
        """Initialise tous les composants"""
        # Connexions série
        self.serial_manager.connecter_tous()
        
        # Connexion MQTT
        self.mqtt_manager.connect()
        
        # Charger les professeurs
        self.professeurs = charger_professeurs()
        self.prof_noms = ["TOUS"] + list(self.professeurs.keys())
        
        # Créer l'interface
        self.create_ui()
        
        # Handlers
        self.setup_handlers()
        
        # Démarrer les threads
        self.start_threads()
        
        # Tâches périodiques
        self.root.after(1000, self.subscribe_mqtt_topics)
        self.root.after(2000, self.publier_status)
        self.root.after(2000, self.verifier_connexions)
        
        # Sélection initiale
        if self.prof_noms:
            self.selectionner_prof(self.prof_noms[self.prof_index])
        
        # Focus
        self.root.after(100, lambda: self.message_ui.focus_message())
        
        # Handler de fermeture
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    def create_ui(self):
        """Crée l'interface utilisateur"""
        # En-tête
        self.header_ui = HeaderUI(self.root)
        self.header_ui.create(
            self.serial_manager.arduino_connecte,
            self.serial_manager.esp_connecte,
            self.mqtt_manager.connecte
        )
        
        # Contenu principal
        main_container = tk.Frame(self.root, bg=COLORS['light_gray'])
        main_container.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Section message
        self.message_ui = MessageSectionUI(main_container)
        self.message_ui.create()
        
        # Section professeurs
        self.professors_ui = ProfessorsSectionUI(main_container)
        self.professors_ui.create(self.professeurs)
        self.professors_ui.set_selection_callback(self.selectionner_prof)
    
    def setup_handlers(self):
        """Configure les handlers"""
        # Joystick callbacks
        joystick_callbacks = {
            'navigation': self.deplacer_selection,
            'button_pressed': self.envoyer_au_prof,
            'bell_pressed': self.on_bell_pressed,
            'connection_lost': self.on_serial_connection_lost
        }
        
        self.joystick_handler = JoystickHandler(
            self.serial_manager,
            self.config,
            joystick_callbacks
        )
        
        # ESP callbacks
        esp_callbacks = {
            'door_opened': self.on_door_opened,
            'connection_lost': self.on_serial_connection_lost
        }
        
        self.esp_handler = ESPHandler(
            self.serial_manager,
            esp_callbacks
        )
        
        # MQTT callback
        self.mqtt_manager.set_message_callback(self.handle_mqtt_message)
    
    def start_threads(self):
        """Démarre les threads de communication"""
        if self.serial_manager.arduino_connecte:
            self.joystick_handler.start()
        else:
            self.show_alert("⚠️ Arduino non connecté", COLORS['warning'])
        
        if self.serial_manager.esp_connecte:
            self.esp_handler.start()
        else:
            self.show_alert("⚠️ ESP non connecté", COLORS['warning'])
    
    def subscribe_mqtt_topics(self):
        """S'abonne aux topics MQTT"""
        if not self.mqtt_manager.connecte:
            print("[MQTT] Abonnement reporté: Client non connecté.")
            self.root.after(5000, self.subscribe_mqtt_topics)
            return
        
        client_id = self.config.get("mqtt_client_id")
        topics = [
            (f"fisheye/{client_id}/bell/activate", 1),
            (f"fisheye/{client_id}/buzz/activate", 1),
            (f"fisheye/{client_id}/display/update", 1),
            (f"fisheye/{client_id}/data/teachers", 1),
            (f"fisheye/{client_id}/cmd/ring", 1)
        ]
        
        self.mqtt_manager.subscribe(topics)
    
    def handle_mqtt_message(self, client, userdata, msg):
        """Traite les messages MQTT entrants"""
        try:
            payload = json.loads(msg.payload.decode()) if msg.payload else {}
            topic = msg.topic
            
            print(f"[MQTT] ← {topic}: {payload}")
            
            if "bell/activate" in topic:
                duration = payload.get("duration", 1000)
                self.root.after(0, lambda: self.show_notification(
                    f"🔔 Sonnette activée ({duration}ms)",
                    COLORS['warning'],
                    duration
                ))
            
            elif "buzz/activate" in topic:
                duration = payload.get("duration", 500)
                self.root.after(0, lambda: self.show_notification(
                    f"🚨 Buzzer activé ({duration}ms)",
                    COLORS['danger'],
                    duration
                ))
            
            elif "display/update" in topic:
                teacher_name = payload.get("teacherName", "")
                self.root.after(0, lambda: self.show_notification(
                    f"📺 Affichage: {teacher_name}",
                    COLORS['secondary'],
                    3000
                ))
            
            elif "data/teachers" in topic:
                profs = {}
                for teacher in payload["teachers"]:
                    profs[teacher["name"]] = {
                        "disponible": teacher["isPresent"],
                        "id": teacher["id"]
                    }
                self.professeurs = profs
                self.prof_noms = ["TOUS"] + list(self.professeurs.keys())
                self.root.after(0, self.recharger_professeurs)
            
            elif "cmd/ring" in topic:
                self.serial_manager.send_esp('turn_on')
                self.mqtt_manager.publish(
                    f"fisheye/{self.config.get('mqtt_client_id')}/event/ack_ring",
                    {"success": True},
                    qos=1
                )
        
        except json.JSONDecodeError:
            print(f"[MQTT] Message non-JSON: {msg.payload.decode()}")
        except Exception as e:
            print(f"[MQTT] Erreur traitement: {e}")
    
    def selectionner_prof(self, nom):
        """Sélectionne un professeur"""
        previous = self.prof_selectionne
        self.prof_selectionne = nom
        
        # Mettre à jour le style
        self.professors_ui.update_selection_style(nom, previous)
        
        # Mettre à jour le label
        if nom == "TOUS":
            text = f"📢 Envoi à tous les professeurs ({len(self.professeurs)})"
            color = COLORS['primary']
        else:
            text = f"📩 Destinataire : {nom}"
            color = COLORS['text_dark']
        
        self.message_ui.update_selection(text, color)
        
        # Scroll
        self.professors_ui.scroll_to_item(nom)
        
        # Stocker l'ID du professeur
        if nom != "TOUS" and nom in self.professeurs:
            self.teacher_id = self.professeurs[nom].get("id")
        
        print(f"[SÉLECTION] {nom}")
    
    def deplacer_selection(self, direction):
        """Déplace la sélection"""
        if direction in ["haut", "gauche"]:
            self.prof_index = (self.prof_index - 1) % len(self.prof_noms)
        elif direction in ["bas", "droite"]:
            self.prof_index = (self.prof_index + 1) % len(self.prof_noms)
        
        self.root.after(0, lambda: self.selectionner_prof(self.prof_noms[self.prof_index]))
    
    def envoyer_au_prof(self):
        """Envoie le message au professeur sélectionné"""
        message = self.message_ui.get_message()
        
        if not self.mqtt_manager.connecte:
            self.show_alert("❌ Envoi impossible: MQTT déconnecté.", COLORS['danger'], 3000)
            return
        
        if not message:
            self.show_notification(
                "⚠️ Veuillez écrire un message",
                COLORS['warning'],
                2000
            )
            return
        
        if not self.prof_selectionne:
            self.show_notification(
                "⚠️ Aucun professeur sélectionné",
                COLORS['warning'],
                2000
            )
            return
        
        # Préparer le payload
        topic = f"fisheye/{self.config.get('mqtt_client_id')}/event/message"
        payload = {"text": message}
        
        if self.prof_selectionne == "TOUS":
            notif_text = f"✓ Message envoyé à TOUS les professeurs"
        else:
            payload["targetTeacherId"] = self.professeurs[self.prof_selectionne].get("id")
            notif_text = f"✓ Message envoyé à {self.prof_selectionne}"
        
        # Publier
        if self.mqtt_manager.publish(topic, payload, qos=1):
            self.show_notification(notif_text, COLORS['success'], 3000)
            self.message_ui.clear_message()
            print(f"[MESSAGE] Envoyé à {self.prof_selectionne}: {message}")
        else:
            self.show_notification(
                "✗ Erreur d'envoi du message",
                COLORS['danger'],
                3000
            )
    
    def on_bell_pressed(self):
        """Callback bouton sonnette pressé"""
        self.root.after(0, self.publier_button_pressed)
        self.root.after(0, lambda: self.serial_manager.send_esp('turn_on'))
        self.root.after(0, lambda: self.show_notification("Ca sonne !", COLORS['accent'], 2000))
    
    def on_door_opened(self):
        """Callback porte ouverte"""
        client_id = self.config.get("mqtt_client_id")
        self.mqtt_manager.publish(f"fisheye/{client_id}/event/door", "OPEN", qos=0)
    
    def on_serial_connection_lost(self, device_type):
        """Callback perte de connexion série"""
        self.root.after(0, self.verifier_connexions)
    
    def publier_button_pressed(self):
        """Publie un événement bouton pressé"""
        if not self.mqtt_manager.connecte:
            return
        
        topic = f"fisheye/{self.config.get('mqtt_client_id')}/event/button"
        payload = {"targetTeacherId": self.teacher_id} if self.teacher_id else {}
        
        self.mqtt_manager.publish(topic, payload, qos=1)
    
    def publier_status(self):
        """Publie le status de l'appareil"""
        if not self.mqtt_manager.connecte:
            return
        
        topic = f"fisheye/{self.config.get('mqtt_client_id')}/status"
        self.mqtt_manager.publish(topic, "online", qos=1, retain=True)
    
    def verifier_connexions(self):
        """Vérifie périodiquement les connexions"""
        # Vérifier série
        status = self.serial_manager.verifier_connexions()
        
        # Mettre à jour l'UI
        self.header_ui.update_arduino_status(status['arduino'])
        self.header_ui.update_esp_status(status['esp'])
        
        # Alertes si changement
        if status['arduino_changed'] and not status['arduino'] and not self.alerte_arduino_affiche:
            self.show_alert("Connexion Arduino PERDUE", COLORS['danger'], 10000)
            self.alerte_arduino_affiche = True
        elif status['arduino']:
            self.alerte_arduino_affiche = False
        
        if status['esp_changed'] and not status['esp'] and not self.alerte_esp_affiche:
            self.show_alert("Connexion ESP PERDUE", COLORS['danger'], 10000)
            self.alerte_esp_affiche = True
        elif status['esp']:
            self.alerte_esp_affiche = False
        
        # Vérifier MQTT
        mqtt_etat_precedent = self.mqtt_manager.connecte
        self.mqtt_manager.connecte = self.mqtt_manager.client.is_connected() if self.mqtt_manager.client else False
        
        self.header_ui.update_mqtt_status(self.mqtt_manager.connecte)
        
        if mqtt_etat_precedent and not self.mqtt_manager.connecte and not self.alerte_mqtt_affiche:
            self.show_alert("Connexion MQTT PERDUE", COLORS['danger'], 10000)
            self.alerte_mqtt_affiche = True
        elif self.mqtt_manager.connecte:
            self.alerte_mqtt_affiche = False
        
        # Répéter
        self.root.after(2000, self.verifier_connexions)
    
    def recharger_professeurs(self):
        """Recharge la liste des professeurs"""
        self.prof_noms = ["TOUS"] + list(self.professeurs.keys())
        
        self.professors_ui.clear_all()
        self.professors_ui._create_tous_item(len(self.professeurs))
        for nom, info in self.professeurs.items():
            self.professors_ui._create_prof_item(nom, info)
        
        self.prof_index = 0
        if self.prof_noms:
            self.selectionner_prof(self.prof_noms[0])
        
        print(f"[INFO] {len(self.professeurs)} professeurs rechargés")
    
    def show_notification(self, message, color, duration):
        """Affiche une notification"""
        self.message_ui.show_notification(message, color, duration)
    
    def show_alert(self, message, color, duration=5000):
        """Affiche une alerte"""
        self.header_ui.show_alert(message, color, duration)
    
    def quitter_fullscreen(self, event=None):
        """Quitte le mode plein écran"""
        self.root.attributes('-fullscreen', False)
    
    def toggle_fullscreen(self, event=None):
        """Bascule le mode plein écran"""
        is_fullscreen = self.root.attributes('-fullscreen')
        self.root.attributes('-fullscreen', not is_fullscreen)
    
    def on_closing(self):
        """Fermeture propre de l'application"""
        print("[INFO] Fermeture de l'application...")
        
        # Arrêter les threads
        if self.joystick_handler:
            self.joystick_handler.stop()
        if self.esp_handler:
            self.esp_handler.stop()
        
        # Déconnecter MQTT
        self.mqtt_manager.disconnect()
        
        # Fermer les ports série
        self.serial_manager.fermer_tous()
        
        # Fermer la fenêtre
        self.root.quit()
        self.root.destroy()


def main():
    """Point d'entrée de l'application"""
    root = tk.Tk()
    app = SonnetteApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()