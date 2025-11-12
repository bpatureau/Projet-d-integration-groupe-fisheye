import tkinter as tk
from tkinter import messagebox
from datetime import datetime
import serial
import threading
import time
import json
import os
import paho.mqtt.client as mqtt
import uuid

# ===================== GESTION CONFIGURATION =====================
def charger_config():
    """Charge la configuration depuis config.json"""
    config_defaut = {
        "serial_port": "COM4",
        "baudrate": 9600,
        "timeout": 1,
        "joystick_threshold": 300,
        "joystick_delay": 0.4,
        "mqtt_broker": "bx.phausman.be",
        "mqtt_user": "user1",
        "mqtt_password": "user1",
        "mqtt_port": 1883,
        "mqtt_client_id": f"fisheye_{uuid.uuid4().hex[:8]}"
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

# ===================== COMMUNICATION ARDUINO =====================
config = charger_config()

try:
    arduino = serial.Serial(config['serial_port'], config['baudrate'], timeout=config['timeout'])
    arduino.flushInput()
    print(f"[INFO] Arduino connecté sur {config['serial_port']}")
except Exception as e:
    print(f"[ERREUR] Impossible d'ouvrir le port série : {e}")
    arduino = None

# ===================== MQTT CLIENT =====================
unacked_publish = set()

def on_publish(client, userdata, mid):
    """Callback quand un message est publié avec succès"""
    userdata.discard(mid)

def create_mqtt_client(broker, port, user, passwd, client_id):
    """Crée et démarre le client MQTT avec MQTTv5"""
    client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv5)
    client.username_pw_set(user, passwd)
    client.on_publish = on_publish
    client.user_data_set(unacked_publish)
    
    # Callbacks additionnels
    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            print(f"[MQTT] ✓ Connecté au broker {broker}:{port}")
        else:
            print(f"[MQTT] ✗ Échec de connexion: {reason_code}")
    
    def on_disconnect(client, userdata, reason_code, properties):
        if reason_code != 0:
            print(f"[MQTT] ✗ Déconnexion inattendue: {reason_code}")
        else:
            print(f"[MQTT] Déconnecté du broker")
    
    def on_message(client, userdata, msg):
        print(f"[MQTT] ← Message reçu sur '{msg.topic}': {msg.payload.decode()}")
    
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    
    try:
        client.connect(broker, port, keepalive=60)
        client.loop_start()
        print(f"[MQTT] Connexion initialisée avec client_id={client_id}")
    except Exception as e:
        print(f"[MQTT] ✗ Erreur de connexion: {e}")
    
    return client

def publish_mqtt(client, topic, payload, qos=1, retain=False, wait=False):
    """Publie un message MQTT et attend la confirmation si demandé"""
    try:
        payload_str = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else str(payload)
        msg = client.publish(topic, payload_str, qos=qos, retain=retain)
        
        if qos > 0:
            unacked_publish.add(msg.mid)
        
        if wait:
            msg.wait_for_publish()
        
        print(f"[MQTT] → {topic}")
        print(f"        {payload_str}")
        return True
    except Exception as e:
        print(f"[MQTT] ✗ Erreur de publication: {e}")
        return False

# Initialiser le client MQTT
mqttc = create_mqtt_client(
    config.get("mqtt_broker", "localhost"),
    config.get("mqtt_port", 1883),
    config.get("mqtt_user", "user1"),
    config.get("mqtt_password", "user1"),
    config.get("mqtt_client_id", f"fisheye_{uuid.uuid4().hex[:8]}")
)

# ===================== APPLICATION TKINTER =====================
class SonnetteApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Interface de la sonnette")
        
        # Mode plein écran
        self.root.attributes('-fullscreen', True)
        self.root.configure(bg="#008b8b")
        
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
        
        # Référence au client MQTT
        self.mqtt_client = mqttc
        self.client_id = config.get("mqtt_client_id")
        
        # S'abonner aux topics après connexion
        self.root.after(1000, self.subscribe_topics)
        
        # Publier le status initial
        self.root.after(2000, self.publier_status)
        
        # Titre avec indicateur MQTT
        titre_frame = tk.Frame(root, bg="#00008b", height=50)
        titre_frame.pack(fill="x", padx=5, pady=5)
        titre_frame.pack_propagate(False)
        
        titre_container = tk.Frame(titre_frame, bg="#00008b")
        titre_container.pack(expand=True, fill="x")
        
        titre = tk.Label(titre_container, text="Interface de la sonnette",
                         font=("Arial", 18, "bold"), bg="#00008b", fg="white")
        titre.pack(side="left", padx=20)
        
        self.mqtt_status_label = tk.Label(titre_container, text="● MQTT: Connexion...",
                                          font=("Arial", 10), bg="#00008b", fg="#ffa500")
        self.mqtt_status_label.pack(side="right", padx=20)
        
        # Vérifier la connexion MQTT périodiquement
        self.verifier_mqtt()
        
        # Layout principal
        main_frame = tk.Frame(root, bg="#008b8b")
        main_frame.pack(fill="both", expand=True, padx=5, pady=5)
        
        self.create_messages_column(main_frame)
        self.create_profs_column(main_frame)
        
        # Sélection initiale
        if self.prof_noms:
            self.selectionner_prof(self.prof_noms[self.prof_index])
        
        # AUTO-FOCUS sur la zone de texte
        self.root.after(100, self.activer_focus_message)
        
        # Thread pour le joystick
        if arduino:
            self.thread_joystick = threading.Thread(target=self.lire_joystick, daemon=True)
            self.thread_joystick.start()
        
        # Handler fermeture propre
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    def subscribe_topics(self):
        """S'abonner aux topics MQTT"""
        topics = [
            (f"fisheye/{self.client_id}/bell/activate", 1),
            (f"fisheye/{self.client_id}/buzz/activate", 1),
            (f"fisheye/{self.client_id}/display/update", 1),
            ("fisheye/broadcast/#", 0)
        ]
        
        for topic, qos in topics:
            self.mqtt_client.subscribe(topic, qos)
            print(f"[MQTT] ✓ Abonné à '{topic}'")
        
        # Configurer le callback pour traiter les messages
        self.mqtt_client.on_message = self.handle_mqtt_message
    
    def handle_mqtt_message(self, client, userdata, msg):
        """Handler pour tous les messages MQTT entrants"""
        try:
            payload = json.loads(msg.payload.decode()) if msg.payload else {}
            topic = msg.topic
            
            print(f"[MQTT] ← {topic}: {payload}")
            
            if "bell/activate" in topic:
                duration = payload.get("duration", 1000)
                self.root.after(0, lambda: self.afficher_notification(
                    f"🔔 Sonnette activée ({duration}ms)", 
                    duree=duration,
                    couleur="#ff8c00"
                ))
            
            elif "buzz/activate" in topic:
                duration = payload.get("duration", 500)
                self.root.after(0, lambda: self.afficher_notification(
                    f"🚨 Buzzer activé ({duration}ms)", 
                    duree=duration,
                    couleur="#ff4500"
                ))
            
            elif "display/update" in topic:
                teacher_name = payload.get("teacherName", "")
                self.root.after(0, lambda: self.afficher_notification(
                    f"📺 Affichage: {teacher_name}", 
                    duree=3000,
                    couleur="#1e90ff"
                ))
        
        except json.JSONDecodeError:
            print(f"[MQTT] Message non-JSON reçu: {msg.payload.decode()}")
        except Exception as e:
            print(f"[MQTT] Erreur traitement message: {e}")
    
    def verifier_mqtt(self):
        """Vérifie et met à jour le status MQTT"""
        try:
            if self.mqtt_client.is_connected():
                self.mqtt_status_label.config(text="● MQTT: Connecté", fg="#00ff00")
            else:
                self.mqtt_status_label.config(text="● MQTT: Déconnecté", fg="#ff4500")
        except:
            self.mqtt_status_label.config(text="● MQTT: Erreur", fg="#ff0000")
        
        self.root.after(2000, self.verifier_mqtt)
    
    def publier_button_pressed(self, teacher_id=None):
        """Publier un événement de bouton pressé"""
        topic = f"fisheye/{self.client_id}/button/pressed"
        payload = {}
        
        if teacher_id:
            payload["targetTeacherId"] = teacher_id
        
        publish_mqtt(self.mqtt_client, topic, payload, qos=1)
    
    def publier_teacher_selected(self, teacher_id):
        """Publier une sélection d'enseignant"""
        topic = f"fisheye/{self.client_id}/teacher/selected"
        payload = {
            "teacherId": teacher_id
        }
        publish_mqtt(self.mqtt_client, topic, payload, qos=0)
    
    def publier_door_opened(self):
        """Publier un événement de porte ouverte"""
        topic = f"fisheye/{self.client_id}/door/opened"
        payload = {}
        publish_mqtt(self.mqtt_client, topic, payload, qos=1)
    
    def publier_status(self):
        """Publier le status de l'appareil"""
        topic = f"fisheye/{self.client_id}/status"
        payload = "online"   # <-- TEXTE BRUT
        publish_mqtt(self.mqtt_client, topic, payload, qos=1, retain=True)
    
    def on_closing(self):
        """Handler pour fermeture propre"""
        print("[INFO] Fermeture de l'application...")

        # Publier status offline en texte brut
        topic = f"fisheye/{self.client_id}/status"
        payload = "offline"   # <-- TEXTE BRUT
        publish_mqtt(self.mqtt_client, topic, payload, qos=1, retain=True, wait=True)

        # Attendre que tous les messages soient envoyés
        while unacked_publish:
            time.sleep(0.1)

        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()
        self.root.destroy()

    
    def quitter_fullscreen(self, event=None):
        self.root.attributes('-fullscreen', False)
    
    def toggle_fullscreen(self, event=None):
        is_fullscreen = self.root.attributes('-fullscreen')
        self.root.attributes('-fullscreen', not is_fullscreen)
    
    def activer_focus_message(self):
        self.message_text.focus_set()
        if self.message_text.get("1.0", "end-1c") == "Écrire un message...":
            self.message_text.delete("1.0", "end")
    
    def lire_joystick(self):
        """Boucle de lecture du joystick"""
        seuil = config["joystick_threshold"]
        delai = config["joystick_delay"]
        dernier_temps = time.time()
        
        while True:
            try:
                if arduino.in_waiting > 0:
                    ligne = arduino.readline().decode('utf-8').strip()
                    arduino.flushInput()
                    
                    if not ligne:
                        continue
                    
                    try:
                        x, y, bouton = ligne.split(',')
                        x, y, bouton = int(x), int(y), int(bouton)
                    except ValueError:
                        continue
                    
                    if time.time() - dernier_temps > delai:
                        if x < 512 - seuil:
                            self.root.after(0, self.deplacer_selection, "gauche")
                            dernier_temps = time.time()
                        elif x > 512 + seuil:
                            self.root.after(0, self.deplacer_selection, "droite")
                            dernier_temps = time.time()
                    
                    if bouton:
                        self.root.after(0, self.envoyer_au_prof)
                        time.sleep(0.5)
            except Exception as e:
                print("[ERREUR JOYSTICK]", e)
                time.sleep(1)
    
    def deplacer_selection(self, direction):
        if direction in ["haut", "gauche"]:
            self.prof_index = (self.prof_index - 1) % len(self.prof_noms)
        elif direction in ["bas", "droite"]:
            self.prof_index = (self.prof_index + 1) % len(self.prof_noms)
        
        nom = self.prof_noms[self.prof_index]
        self.selectionner_prof(nom)
        
        if nom != "TOUS" and nom in self.professeurs:
            teacher_id = self.professeurs[nom].get("id")
            if teacher_id:
                self.publier_teacher_selected(teacher_id)
    
    def scroll_vers_selection(self, nom):
        """Scroll automatiquement vers le professeur sélectionné"""
        if not self.canvas or nom not in self.prof_widgets:
            return
        
        try:
            item_frame = self.prof_widgets[nom]['item_frame']
            canvas_height = self.canvas.winfo_height()
            item_y = item_frame.winfo_y()
            item_height = item_frame.winfo_height()
            
            scroll_region = self.canvas.bbox("all")
            if scroll_region:
                total_height = scroll_region[3]
                position = (item_y + item_height/2 - canvas_height/2) / total_height
                position = max(0.0, min(1.0, position))
                self.canvas.yview_moveto(position)
        except Exception as e:
            print(f"[ERREUR SCROLL] {e}")
    
    def mettre_a_jour_disponibilite(self, nom, disponible):
        """Met à jour la disponibilité d'un professeur"""
        if nom not in self.professeurs:
            print(f"[ERREUR] Professeur '{nom}' introuvable")
            return False
        
        self.professeurs[nom]["disponible"] = disponible
        sauvegarder_professeurs(self.professeurs)
        self.rafraichir_affichage_prof(nom)
        
        status = "disponible" if disponible else "indisponible"
        print(f"[MAJ] {nom} est maintenant {status}")
        return True
    
    def rafraichir_affichage_prof(self, nom):
        """Rafraîchit l'affichage d'un professeur"""
        if nom not in self.prof_widgets:
            return
        
        info = self.professeurs[nom]
        widgets = self.prof_widgets[nom]
        
        for widget in widgets['item_frame'].winfo_children():
            if isinstance(widget, tk.Frame):
                for child in widget.winfo_children():
                    if isinstance(child, tk.Frame):
                        for subchild in child.winfo_children():
                            if isinstance(subchild, tk.Label):
                                if subchild.cget("text") == "●":
                                    couleur = "#00ff00" if info["disponible"] else "#ff0000"
                                    subchild.config(fg=couleur)
                                elif subchild.cget("text") in ["Disponible", "Indisponible"]:
                                    texte = "Disponible" if info["disponible"] else "Indisponible"
                                    subchild.config(text=texte)
    
    def recharger_professeurs(self):
        """Recharge la liste des professeurs"""
        self.professeurs = charger_professeurs()
        self.prof_noms = ["TOUS"] + list(self.professeurs.keys())
        
        for widget in self.profs_list_frame.winfo_children():
            widget.destroy()
        
        self.prof_widgets.clear()
        
        widgets_tous = self.create_prof_item_tous()
        self.prof_widgets["TOUS"] = widgets_tous
        
        for i, (nom, info) in enumerate(self.professeurs.items()):
            widgets = self.create_prof_item(nom, info, i + 1)
            self.prof_widgets[nom] = widgets
        
        self.prof_index = 0
        if self.prof_noms:
            self.selectionner_prof(self.prof_noms[0])
        
        print(f"[INFO] {len(self.professeurs)} professeurs rechargés")
    
    def create_messages_column(self, parent):
        left_frame = tk.Frame(parent, bg="#c0c0c0", relief="raised", bd=3)
        left_frame.pack(side="left", fill="both", expand=True, padx=(0, 3))
        
        write_section = tk.Frame(left_frame, bg="#c0c0c0")
        write_section.pack(fill="both", expand=True, padx=10, pady=10)
        
        label_write = tk.Label(write_section, text="Écrire un message",
                               font=("Arial", 11, "bold"), bg="#c0c0c0", fg="#00008b")
        label_write.pack(anchor="w", pady=(0, 10))
        
        self.message_text = tk.Text(write_section, height=8, font=("Arial", 10),
                                    relief="solid", bd=2)
        self.message_text.pack(fill="both", expand=True)
        self.message_text.insert("1.0", "Écrire un message...")
        self.message_text.bind("<FocusIn>", self.clear_placeholder)
        
        instruction_frame = tk.Frame(write_section, bg="#e8f4f8", relief="solid", bd=2)
        instruction_frame.pack(pady=15, fill="x")
        
        instruction_label = tk.Label(
            instruction_frame, 
            text="🕹️ Appuyez sur le bouton du joystick pour envoyer le message",
            font=("Arial", 11, "bold"), 
            bg="#e8f4f8", 
            fg="#00008b",
            pady=12
        )
        instruction_label.pack()
        
        self.selection_label = tk.Label(write_section, text="Aucun professeur sélectionné",
                                        font=("Arial", 9), bg="#c0c0c0", fg="#333333")
        self.selection_label.pack(pady=5)
        
        self.notif_label = tk.Label(write_section, text="", 
                                    font=("Arial", 11, "bold"), 
                                    bg="#c0c0c0", fg="#00008b",
                                    wraplength=400, justify="center")
        self.notif_label.pack(pady=10)
    
    def create_profs_column(self, parent):
        right_frame = tk.Frame(parent, bg="#c0c0c0", relief="raised", bd=3)
        right_frame.pack(side="right", fill="both", expand=True, padx=(3, 0))
        
        titre_profs = tk.Label(right_frame, text="Professeurs disponibles",
                               font=("Arial", 11, "bold"), bg="#c0c0c0", fg="#00008b")
        titre_profs.pack(anchor="w", padx=10, pady=10)
        
        list_frame = tk.Frame(right_frame, bg="white", relief="solid", bd=2)
        list_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        
        self.canvas = tk.Canvas(list_frame, bg="white", highlightthickness=0)
        scrollbar = tk.Scrollbar(list_frame, orient="vertical", command=self.canvas.yview)
        self.profs_list_frame = tk.Frame(self.canvas, bg="white")
        
        self.profs_list_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        
        self.canvas.create_window((0, 0), window=self.profs_list_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)
        
        widgets_tous = self.create_prof_item_tous()
        self.prof_widgets["TOUS"] = widgets_tous
        
        for i, (nom, info) in enumerate(self.professeurs.items()):
            widgets = self.create_prof_item(nom, info, i + 1)
            self.prof_widgets[nom] = widgets
        
        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
    
    def create_prof_item_tous(self):
        bg_color = "#e8f4f8"
        item_frame = tk.Frame(self.profs_list_frame, bg=bg_color, relief="raised", bd=2, cursor="hand2")
        item_frame.pack(fill="x", padx=5, pady=5)
        
        content_frame = tk.Frame(item_frame, bg=bg_color)
        content_frame.pack(fill="x", padx=10, pady=10)
        
        nom_label = tk.Label(content_frame, text="TOUS LES PROFESSEURS", 
                            font=("Arial", 10, "bold"), bg=bg_color, anchor="w")
        nom_label.pack(side="left")
        
        dispo_frame = tk.Frame(content_frame, bg=bg_color)
        dispo_frame.pack(side="right")
        
        nb_profs = len(self.professeurs)
        info_label = tk.Label(dispo_frame, text=f"({nb_profs} profs)", 
                             font=("Arial", 9), bg=bg_color)
        info_label.pack(side="left")
        
        for widget in [item_frame, content_frame, nom_label, dispo_frame, info_label]:
            widget.bind("<Button-1>", lambda e: self.selectionner_prof("TOUS"))
        
        return {'nom_label': nom_label, 'item_frame': item_frame}
    
    def create_prof_item(self, nom, info, index):
        bg_color = "white" if index % 2 == 0 else "#f5f5f5"
        item_frame = tk.Frame(self.profs_list_frame, bg=bg_color, relief="flat", bd=1, cursor="hand2")
        item_frame.pack(fill="x", padx=5, pady=2)
        
        content_frame = tk.Frame(item_frame, bg=bg_color)
        content_frame.pack(fill="x", padx=10, pady=8)
        
        nom_label = tk.Label(content_frame, text=nom, font=("Arial", 10), bg=bg_color, anchor="w")
        nom_label.pack(side="left")
        
        dispo_frame = tk.Frame(content_frame, bg=bg_color)
        dispo_frame.pack(side="right")
        
        couleur = "#00ff00" if info["disponible"] else "#ff0000"
        texte = "Disponible" if info["disponible"] else "Indisponible"
        
        cercle = tk.Label(dispo_frame, text="●", font=("Arial", 12), bg=bg_color, fg=couleur)
        cercle.pack(side="left", padx=(0, 5))
        
        status_label = tk.Label(dispo_frame, text=texte, font=("Arial", 9), bg=bg_color)
        status_label.pack(side="left")
        
        for widget in [item_frame, content_frame, nom_label, dispo_frame, cercle, status_label]:
            widget.bind("<Button-1>", lambda e, n=nom: self.selectionner_prof(n))
        
        return {'nom_label': nom_label, 'item_frame': item_frame}
    
    def selectionner_prof(self, nom):
        if self.prof_selectionne and self.prof_selectionne in self.prof_widgets:
            old_widgets = self.prof_widgets[self.prof_selectionne]
            old_widgets['nom_label'].config(font=("Arial", 10))
            old_widgets['item_frame'].config(relief="flat" if self.prof_selectionne != "TOUS" else "raised")
        
        self.prof_selectionne = nom
        self.selection_label.config(text=f"Professeur sélectionné : {nom}")
        
        widgets = self.prof_widgets[nom]
        widgets['nom_label'].config(font=("Arial", 10, "bold"))
        widgets['item_frame'].config(relief="solid", bd=3)
        
        self.scroll_vers_selection(nom)
        print(f"[SÉLECTION] {nom}")
    
    def afficher_notification(self, message, duree=3000, couleur="#00008b"):
        """Affiche une notification temporaire"""
        self.notif_label.config(text=message, fg=couleur)
        self.root.after(duree, lambda: self.notif_label.config(text=""))
    
    def clear_placeholder(self, event):
        """Efface le placeholder au focus"""
        contenu = self.message_text.get("1.0", "end-1c")
        if contenu == "Écrire un message...":
            self.message_text.delete("1.0", "end")
            self.message_text.config(fg="black")
    
    def envoyer_au_prof(self):
        """Envoie le message au professeur sélectionné via MQTT"""
        message = self.message_text.get("1.0", "end-1c").strip()
        
        if not message or message == "Écrire un message...":
            self.afficher_notification("⚠️ Veuillez écrire un message", duree=2000, couleur="#ff4500")
            return
        
        if not self.prof_selectionne:
            self.afficher_notification("⚠️ Aucun professeur sélectionné", duree=2000, couleur="#ff4500")
            return
        
        # Préparer le payload MQTT
        topic = f"fisheye/{self.client_id}/message/sent"
        payload = {
            "message": message
        }
        
        if self.prof_selectionne == "TOUS":
            payload["to"] = "all"
            payload["recipients"] = list(self.professeurs.keys())
            notif_text = f"✓ Message envoyé à TOUS les professeurs"
        else:
            payload["teacherId"] = self.professeurs[self.prof_selectionne].get("id")
            notif_text = f"✓ Message envoyé à {self.prof_selectionne}"
            
            # Publier aussi l'événement de bouton pressé pour ce professeur
            teacher_id = self.professeurs[self.prof_selectionne].get("id")
            if teacher_id:
                self.publier_button_pressed(teacher_id)
        
        # Publier le message
        if publish_mqtt(self.mqtt_client, topic, payload, qos=1):
            self.afficher_notification(notif_text, duree=3000, couleur="#00ff00")
            self.message_text.delete("1.0", "end")
            self.message_text.insert("1.0", "Écrire un message...")
            print(f"[MESSAGE] Envoyé à {self.prof_selectionne}: {message}")
        else:
            self.afficher_notification("✗ Erreur d'envoi du message", duree=3000, couleur="#ff0000")


# ===================== MAIN =====================
if __name__ == "__main__":
    root = tk.Tk()
    app = SonnetteApp(root)
    root.mainloop()