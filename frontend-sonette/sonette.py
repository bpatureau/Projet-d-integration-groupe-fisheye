import tkinter as tk
from tkinter import messagebox, font as tkfont
from datetime import datetime
import serial
import threading
import time
import json
import os
import paho.mqtt.client as mqtt
import uuid

# ===================== PALETTE DE COULEURS MODERNE=====================
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

# ===================== GESTION CONFIGURATION =====================
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

def charger_professeurs(payload):
    """Charge la liste des professeurs depuis professeurs.json"""
    # Ce bloc est laissé tel quel pour la compatibilité, mais l'app le gère via MQTT
    profs_defaut = {
        "Mme Vroman": {"disponible": True, "id": str(uuid.uuid4())},
        "M. Dubruille": {"disponible": False, "id": str(uuid.uuid4())},
        "M. De Smet": {"disponible": True, "id": str(uuid.uuid4())},
        "M. Van Dormael": {"disponible": True, "id": str(uuid.uuid4())}
    }
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

# ===================== COMMUNICATION ARDUINO =====================
config = charger_config()
arduino = None
esp = None

# ===================== MQTT CLIENT =====================
unacked_publish = set()
mqttc = None 

def on_publish(client, userdata, mid):
    """Callback quand un message est publié avec succès"""
    userdata.discard(mid)

def create_mqtt_client(broker, port, user, passwd, client_id):
    """Crée et démarre le client MQTT avec MQTTv5"""
    client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv5)
    client.username_pw_set(user, passwd)
    client.on_publish = on_publish
    client.user_data_set(unacked_publish)

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

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect

    try:
        client.connect(broker, port, keepalive=60)
        client.loop_start()
        print(f"[MQTT] Connexion initialisée avec client_id={client_id}")
    except Exception as e:
        print(f"[MQTT] ✗ Erreur de connexion: {e}")

    return client

def publish_mqtt(client, topic, payload, qos=1, retain=False, wait=False):
    """Publie un message MQTT et attend la confirmation si demandé"""
    if client is None:
        print("[MQTT] ✗ Client MQTT non initialisé. Impossible de publier.")
        return False
        
    try:
        payload_str = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else str(payload)
        
        if not client.is_connected():
            print(f"[MQTT] ✗ Impossible de publier. Déconnecté de: {topic}")
            return False

        msg = client.publish(topic, payload_str, qos=qos, retain=retain)

        if qos > 0:
            unacked_publish.add(msg.mid)

        if wait:
            msg.wait_for_publish()

        print(f"[MQTT] → {topic}")
        print(f"      {payload_str}")
        return True
    except Exception as e:
        print(f"[MQTT] ✗ Erreur de publication: {e}")
        return False

# ===================== WIDGETS MODERNES =====================
class ModernButton(tk.Frame):
    """Bouton moderne avec effet hover"""
    def __init__(self, parent, text, command=None, bg_color=None, fg_color=None, **kwargs):
        super().__init__(parent, bg=parent.cget('bg'))

        self.bg_normal = bg_color or COLORS['primary']
        self.bg_hover = COLORS['primary_dark']
        self.fg_color = fg_color or COLORS['white']
        self.command = command

        self.button = tk.Label(
            self,
            text=text,
            bg=self.bg_normal,
            fg=self.fg_color,
            font=("Segoe UI", 11, "bold"),
            padx=30,
            pady=12,
            cursor="hand2"
        )
        self.button.pack()

        self.button.bind("<Enter>", self.on_enter)
        self.button.bind("<Leave>", self.on_leave)
        self.button.bind("<Button-1>", self.on_click)

    def on_enter(self, e):
        self.button.config(bg=self.bg_hover)

    def on_leave(self, e):
        self.button.config(bg=self.bg_normal)

    def on_click(self, e):
        if self.command:
            self.command()

class ModernCard(tk.Frame):
    """Carte moderne avec bordure subtile"""
    def __init__(self, parent, **kwargs):
        super().__init__(parent, bg=COLORS['white'], relief="flat", bd=0, **kwargs)
        self.configure(highlightbackground=COLORS['border_light'], highlightthickness=1)

# ===================== APPLICATION TKINTER =====================
class SonnetteApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Sonnette Intelligente")
        
        if config.get("full_screen"):
            self.root.attributes('-fullscreen', True)
        self.root.configure(bg=COLORS['light_gray'])

        self.root.bind('<Escape>', self.quitter_fullscreen)
        self.root.bind('<F11>', self.toggle_fullscreen)

        self.prof_selectionne = None
        self.prof_index = 0
        self.prof_widgets = {}
        self.canvas = None
        self.door_status = 0
        self.teacher_id = ""
        
        # --- STATUTS DE CONNEXION ---
        self.arduino_connecte = False
        self.esp_connecte = False
        self.mqtt_connecte = False
        # Flags pour éviter les pop-up à répétition
        self.alerte_mqtt_affiche = False
        self.alerte_arduino_affiche = False
        self.alerte_esp_affiche = False
        
        self.connecter_serial()

        global mqttc 
        mqttc = create_mqtt_client(
            config.get("mqtt_broker", "localhost"),
            config.get("mqtt_port", 1883),
            config.get("mqtt_user", "user1"),
            config.get("mqtt_password", "user1"),
            config.get("mqtt_client_id", f"fisheye_{uuid.uuid4().hex[:8]}")
        )
        self.mqtt_client = mqttc
        self.client_id = config.get("mqtt_client_id")
        
        self.professeurs = {}
        self.prof_noms = []

        self.setup_fonts()

        self.create_header()
        self.create_main_content()

        self.root.after(1000, self.subscribe_topics)
        self.root.after(2000, self.publier_status)

        if self.prof_noms:
            self.selectionner_prof(self.prof_noms[self.prof_index])

        self.root.after(100, self.activer_focus_message)
        
        global arduino, esp
        if arduino and self.arduino_connecte:
            self.thread_joystick = threading.Thread(target=self.lire_joystick, daemon=True)
            self.thread_joystick.start()
        if esp and self.esp_connecte:
            self.esp_t = threading.Thread(target=self.read_esp, daemon=True)
            self.esp_t.start()
        
        self.verifier_mqtt() 

        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
    def connecter_serial(self):
        """Tente d'ouvrir les ports série pour Arduino et ESP"""
        global arduino, esp
        
        # --- Connexion Arduino (Joystick) ---
        try:
            arduino = serial.Serial(config['serial_port_arduino'], config['baudrate_arduino'], timeout=config['timeout'])
            arduino.flushInput()
            self.arduino_connecte = True
            print(f"[INFO] Arduino connecté sur {config['serial_port_arduino']}")
        except Exception as e:
            print(f"[ERREUR] Impossible d'ouvrir le port série Arduino : {e}")
            arduino = None
            self.arduino_connecte = False

        # --- Connexion ESP (Porte/Buzzer) ---
        try:
            esp = serial.Serial(config["serial_port_esp"], config['baudrate_esp'], timeout=config['timeout'])
            esp.flush()
            self.esp_connecte = True
            print(f"[INFO] Esp connecté sur {config['serial_port_esp']}")
        except Exception as e:
            print(f"[ERREUR] Impossible d'ouvrir le port série ESP : {e}")
            esp = None
            self.esp_connecte = False

    def setup_fonts(self):
        """Configure les polices modernes"""
        self.font_title = tkfont.Font(family="Segoe UI", size=24, weight="bold")
        self.font_subtitle = tkfont.Font(family="Segoe UI", size=14, weight="bold")
        self.font_body = tkfont.Font(family="Segoe UI", size=11)
        self.font_small = tkfont.Font(family="Segoe UI", size=9)

    def create_header(self):
        """Crée l'en-tête moderne"""
        header = tk.Frame(self.root, bg=COLORS['white'], height=80)
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)

        header_content = tk.Frame(header, bg=COLORS['white'])
        header_content.pack(fill="both", expand=True, padx=30, pady=15)

        title_frame = tk.Frame(header_content, bg=COLORS['white'])
        title_frame.pack(side="left")

        tk.Label(
            title_frame,
            text="🔔 Sonnette",
            font=self.font_title,
            bg=COLORS['white'],
            fg=COLORS['text_dark']
        ).pack(anchor="w")

        tk.Label(
            title_frame,
            text="Communication avec les professeurs",
            font=self.font_small,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        ).pack(anchor="w")

        status_container = tk.Frame(header_content, bg=COLORS['white'])
        status_container.pack(side="right", fill="y")
        
        # NOTE: Suppression du self.alert_label pour utiliser le pop-up

        indicator_frame = tk.Frame(status_container, bg=COLORS['white'])
        indicator_frame.pack(side="bottom", anchor="e")

        self.create_status_indicator(indicator_frame, "Arduino", self.arduino_connecte)
        self.create_status_indicator(indicator_frame, "ESP", self.esp_connecte, is_esp=True)
        self.create_status_indicator(indicator_frame, "MQTT", self.mqtt_connecte, is_mqtt=True)

        separator = tk.Frame(self.root, bg=COLORS['medium_gray'], height=1)
        separator.pack(fill="x")

    def create_status_indicator(self, parent, name, is_connected, is_mqtt=False, is_esp=False):
        """Crée et stocke les références aux indicateurs de statut"""
        status_frame = tk.Frame(parent, bg=COLORS['white'])
        status_frame.pack(side="left", padx=(10, 0))

        indicator_color = COLORS['online'] if is_connected else COLORS['offline']
        indicator_text = "Connecté" if is_connected else "Déconnecté"

        indicator = tk.Label(
            status_frame,
            text="●",
            font=("Segoe UI", 16),
            bg=COLORS['white'],
            fg=indicator_color
        )
        indicator.pack(side="left", padx=(0, 5))

        text_frame = tk.Frame(status_frame, bg=COLORS['white'])
        text_frame.pack(side="left")

        tk.Label(
            text_frame,
            text=f"État {name}",
            font=self.font_small,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        ).pack(anchor="w")

        status_label = tk.Label(
            text_frame,
            text=indicator_text,
            font=("Segoe UI", 10, "bold"),
            bg=COLORS['white'],
            fg=COLORS['text_dark']
        )
        status_label.pack(anchor="w")
        
        if is_mqtt:
            self.mqtt_status_indicator = indicator
            self.mqtt_status_label = status_label
        elif is_esp:
            self.esp_status_indicator = indicator
            self.esp_status_label = status_label
        else:
            self.arduino_status_indicator = indicator
            self.arduino_status_label = status_label

    def create_main_content(self):
        """Crée le contenu principal"""
        main_container = tk.Frame(self.root, bg=COLORS['light_gray'])
        main_container.pack(fill="both", expand=True, padx=20, pady=20)

        self.create_message_section(main_container)
        self.create_professors_section(main_container)
    
    # ... (Les autres fonctions d'UI comme create_message_section, create_professors_section,
    # create_prof_item_tous, create_prof_item, selectionner_prof, scroll_vers_selection,
    # clear_placeholder, activer_focus_message restent inchangées) ...

    def create_message_section(self, parent):
        """Section d'écriture de message"""
        message_card = ModernCard(parent)
        message_card.pack(side="left", fill="both", expand=True, padx=(0, 10))

        # En-tête de la carte
        header = tk.Frame(message_card, bg=COLORS['primary_light'])
        header.pack(fill="x")

        tk.Label(
            header,
            text="✍️  Composer un message",
            font=self.font_subtitle,
            bg=COLORS['primary_light'],
            fg=COLORS['text_dark'],
            anchor="w"
        ).pack(padx=25, pady=15)

        # Corps de la carte
        body = tk.Frame(message_card, bg=COLORS['white'])
        body.pack(fill="both", expand=True, padx=25, pady=20)

        # Zone de texte moderne
        text_container = tk.Frame(body, bg=COLORS['white'])
        text_container.pack(fill="both", expand=True)

        tk.Label(
            text_container,
            text="Message",
            font=self.font_body,
            bg=COLORS['white'],
            fg=COLORS['text_dark'],
            anchor="w"
        ).pack(anchor="w", pady=(0, 8))

        # Frame pour la zone de texte avec bordure (ajusté pour le nouveau thème)
        text_frame = tk.Frame(text_container, bg=COLORS['white'], highlightbackground=COLORS['medium_gray'], highlightthickness=1)
        text_frame.pack(fill="both", expand=True)

        self.message_text = tk.Text(
            text_frame,
            height=10,
            font=self.font_body,
            relief="flat",
            bd=0,
            padx=15,
            pady=15,
            bg=COLORS['white'],
            fg=COLORS['text_dark'],
            insertbackground=COLORS['secondary'] # Curseur bleu vif
        )
        self.message_text.pack(fill="both", expand=True)
        self.message_text.insert("1.0", "")
        self.message_text.bind("<FocusIn>", self.clear_placeholder)

        # Instructions
        instruction_card = tk.Frame(body, bg=COLORS['primary_light'], bd=0, highlightbackground=COLORS['border_light'], highlightthickness=1)
        instruction_card.pack(fill="x", pady=15)

        instruction_content = tk.Frame(instruction_card, bg=COLORS['primary_light'])
        instruction_content.pack(padx=20, pady=15)

        tk.Label(
            instruction_content,
            text="🕹️",
            font=("Segoe UI", 20),
            bg=COLORS['primary_light']
        ).pack(side="left", padx=(0, 15))

        tk.Label(
            instruction_content,
            text="Utilisez le joystick pour naviguer\nAppuyez sur le bouton pour envoyer",
            font=self.font_body,
            bg=COLORS['primary_light'],
            fg=COLORS['text_dark'],
            justify="left"
        ).pack(side="left")

        # Sélection actuelle
        self.selection_label = tk.Label(
            body,
            text="Aucun destinataire sélectionné",
            font=self.font_body,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        )
        self.selection_label.pack(pady=(10, 0))

        # Notification
        self.notif_label = tk.Label(
            body,
            text="",
            font=("Segoe UI", 12, "bold"),
            bg=COLORS['white'],
            wraplength=500,
            justify="center"
        )
        self.notif_label.pack(pady=15)

    def create_professors_section(self, parent):
        """Section des professeurs"""
        profs_card = ModernCard(parent)
        profs_card.pack(side="right", fill="both", expand=True, padx=(10, 0))

        # En-tête de la carte
        header = tk.Frame(profs_card, bg=COLORS['primary_light'])
        header.pack(fill="x")

        tk.Label(
            header,
            text="👥  Destinataires",
            font=self.font_subtitle,
            bg=COLORS['primary_light'],
            fg=COLORS['text_dark'],
            anchor="w"
        ).pack(padx=25, pady=15)

        # Corps avec liste scrollable
        list_container = tk.Frame(profs_card, bg=COLORS['white'])
        list_container.pack(fill="both", expand=True, padx=15, pady=15)

        # Canvas pour le scroll
        self.canvas = tk.Canvas(
            list_container,
            bg=COLORS['white'],
            highlightthickness=0,
            bd=0
        )

        scrollbar = tk.Scrollbar(
            list_container,
            orient="vertical",
            command=self.canvas.yview,
            troughcolor=COLORS['light_gray'],
            bg=COLORS['medium_gray'],
            activebackground=COLORS['medium_gray']
        )

        self.profs_list_frame = tk.Frame(self.canvas, bg=COLORS['white'])

        self.profs_list_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )

        self.canvas.create_window((0, 0), window=self.profs_list_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)

        # Créer les items
        widgets_tous = self.create_prof_item_tous()
        self.prof_widgets["TOUS"] = widgets_tous

        for i, (nom, info) in enumerate(self.professeurs.items()):
            widgets = self.create_prof_item(nom, info)
            self.prof_widgets[nom] = widgets

        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
    def create_prof_item_tous(self):
        """Crée l'item 'TOUS' avec un fond principal bleu"""
        item_frame = tk.Frame(
            self.profs_list_frame,
            bg=COLORS['primary'],
            cursor="hand2",
            bd=0,
            highlightbackground=COLORS['primary_dark'],
            highlightthickness=2 # Bordure foncée pour l'effet spécial
        )
        item_frame.pack(fill="x", padx=10, pady=8)

        content = tk.Frame(item_frame, bg=COLORS['primary'])
        content.pack(fill="x", padx=20, pady=15)

        left_side = tk.Frame(content, bg=COLORS['primary'])
        left_side.pack(side="left")

        icon = tk.Label(
            left_side,
            text="📢",
            font=("Segoe UI", 18),
            bg=COLORS['primary']
        )
        icon.pack(side="left", padx=(0, 15))

        text_frame = tk.Frame(left_side, bg=COLORS['primary'])
        text_frame.pack(side="left")

        nom_label = tk.Label(
            text_frame,
            text="TOUS LES PROFESSEURS",
            font=("Segoe UI", 12, "bold"),
            bg=COLORS['primary'],
            fg=COLORS['white'],
            anchor="w"
        )
        nom_label.pack(anchor="w")

        nb_profs = len(self.professeurs)
        tk.Label(
            text_frame,
            text=f"{nb_profs} destinataires",
            font=self.font_small,
            bg=COLORS['primary'],
            fg=COLORS['white'],
            anchor="w"
        ).pack(anchor="w")

        for widget in [item_frame, content, left_side, icon, text_frame, nom_label]:
            widget.bind("<Button-1>", lambda e: self.selectionner_prof("TOUS"))

        return {'nom_label': nom_label, 'item_frame': item_frame, 'is_tous': True}

    def create_prof_item(self, nom, info):
        """Crée un item professeur"""
        item_frame = tk.Frame(
            self.profs_list_frame,
            bg=COLORS['white'],
            cursor="hand2",
            bd=0,
            highlightbackground=COLORS['medium_gray'],
            highlightthickness=1
        )
        item_frame.pack(fill="x", padx=10, pady=5)

        content = tk.Frame(item_frame, bg=COLORS['white'])
        content.pack(fill="x", padx=20, pady=15)

        # Nom du professeur
        nom_label = tk.Label(
            content,
            text=nom,
            font=("Segoe UI", 11),
            bg=COLORS['white'],
            fg=COLORS['text_dark'],
            anchor="w"
        )
        nom_label.pack(side="left")

        # Status
        status_frame = tk.Frame(content, bg=COLORS['white'])
        status_frame.pack(side="right")

        couleur = COLORS['success'] if info["disponible"] else COLORS['danger']
        texte = "Disponible" if info["disponible"] else "Indisponible"

        status_indicator = tk.Label(
            status_frame,
            text="●",
            font=("Segoe UI", 14),
            bg=COLORS['white'],
            fg=couleur
        )
        status_indicator.pack(side="left", padx=(0, 8))

        status_label = tk.Label(
            status_frame,
            text=texte,
            font=self.font_small,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        )
        status_label.pack(side="left")

        for widget in [item_frame, content, nom_label, status_frame, status_indicator, status_label]:
            widget.bind("<Button-1>", lambda e, n=nom: self.selectionner_prof(n))

        return {
            'nom_label': nom_label,
            'item_frame': item_frame,
            'status_indicator': status_indicator,
            'status_label': status_label,
            'is_tous': False
        }

    def selectionner_prof(self, nom):
        """Sélectionne un professeur"""
        # Désélectionner l'ancien (ajusté pour le nouveau thème)
        if self.prof_selectionne and self.prof_selectionne in self.prof_widgets:
            old_widgets = self.prof_widgets[self.prof_selectionne]
            if old_widgets.get('is_tous'):
                # Ramener à la couleur primaire normale
                old_widgets['item_frame'].config(bg=COLORS['primary'], highlightbackground=COLORS['primary_dark'], highlightthickness=2)
                for widget in old_widgets['item_frame'].winfo_children():
                    if isinstance(widget, tk.Frame):
                        widget.config(bg=COLORS['primary'])
                        for child in widget.winfo_children():
                            if isinstance(child, tk.Frame):
                                child.config(bg=COLORS['primary'])
                                for grand_child in child.winfo_children():
                                    if grand_child.winfo_class() == 'Label':
                                        grand_child.config(bg=COLORS['primary'])
                            elif child.winfo_class() == 'Label':
                                child.config(bg=COLORS['primary'])
            else:
                # Ramener au blanc et bordure gris clair
                old_widgets['item_frame'].config(
                    bg=COLORS['white'],
                    highlightbackground=COLORS['medium_gray'],
                    highlightthickness=1
                )
                for widget in old_widgets['item_frame'].winfo_children():
                    if isinstance(widget, tk.Frame):
                        widget.config(bg=COLORS['white'])
                        for child in widget.winfo_children():
                            if child.winfo_class() == 'Label':
                                child.config(bg=COLORS['white'])

        self.prof_selectionne = nom

        if nom == "TOUS":
            self.selection_label.config(
                text=f"📢 Envoi à tous les professeurs ({len(self.professeurs)})",
                fg=COLORS['primary'] # Couleur modifiée
            )
        else:
            self.selection_label.config(
                text=f"📩 Destinataire : {nom}",
                fg=COLORS['text_dark']
            )

        widgets = self.prof_widgets[nom]
        if widgets.get('is_tous'):
            widgets['item_frame'].config(bg=COLORS['primary_dark'], highlightbackground=COLORS['primary'], highlightthickness=2)
            for widget in widgets['item_frame'].winfo_children():
                if isinstance(widget, tk.Frame):
                    widget.config(bg=COLORS['primary_dark'])
                    for child in widget.winfo_children():
                        if isinstance(child, tk.Frame):
                            child.config(bg=COLORS['primary_dark'])
                            for grand_child in child.winfo_children():
                                if grand_child.winfo_class() == 'Label':
                                    grand_child.config(bg=COLORS['primary_dark'])
                        elif child.winfo_class() == 'Label':
                            child.config(bg=COLORS['primary_dark'])
        else:
            widgets['item_frame'].config(
                bg=COLORS['primary_light'],
                highlightbackground=COLORS['primary'],
                highlightthickness=2
            )
            for widget in widgets['item_frame'].winfo_children():
                if isinstance(widget, tk.Frame):
                    widget.config(bg=COLORS['primary_light'])
                    for child in widget.winfo_children():
                        if child.winfo_class() == 'Label':
                            child.config(bg=COLORS['primary_light'])


        self.scroll_vers_selection(nom)
        print(f"[SÉLECTION] {nom}")

        if nom != "TOUS" and nom in self.professeurs:
            self.teacher_id = self.professeurs[nom].get("id")

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

    def clear_placeholder(self, event):
        """Efface le placeholder au focus"""
        contenu = self.message_text.get("1.0", "end-1c")
        if contenu == "":
            self.message_text.delete("1.0", "end")
            self.message_text.config(fg=COLORS['text_dark'])

    def activer_focus_message(self):
        self.message_text.focus_set()
        if self.message_text.get("1.0", "end-1c") == "":
            self.message_text.delete("1.0", "end")

    def afficher_notification(self, message, duree=3000, couleur=None):
        """Affiche une notification temporaire dans le corps principal"""
        if couleur is None:
            couleur = COLORS['text_dark']
        self.notif_label.config(text=message, fg=couleur)
        self.root.after(duree, lambda: self.notif_label.config(text=""))
        
    def afficher_alerte_popup(self, message, titre, couleur):
        """Affiche un pop-up non bloquant au centre de l'écran"""
        popup = tk.Toplevel(self.root)
        popup.title(titre)
        popup.config(bg=COLORS['white'])
        popup.attributes('-topmost', True) # Reste au-dessus
        popup.resizable(False, False)

        # Positionner au centre
        self.root.update_idletasks()
        root_w = self.root.winfo_width()
        root_h = self.root.winfo_height()
        popup_w = 400
        popup_h = 150
        x = self.root.winfo_x() + root_w // 2 - popup_w // 2
        y = self.root.winfo_y() + root_h // 2 - popup_h // 2
        popup.geometry(f'{popup_w}x{popup_h}+{x}+{y}')

        frame = tk.Frame(popup, bg=couleur, padx=20, pady=15)
        frame.pack(fill="both", expand=True)

        tk.Label(
            frame,
            text="❌ ERREUR DE CONNEXION ❌",
            font=self.font_subtitle,
            bg=couleur,
            fg=COLORS['white'] if couleur != COLORS['warning'] else COLORS['text_dark']
        ).pack(pady=(0, 5))

        tk.Label(
            frame,
            text=message,
            font=self.font_body,
            bg=couleur,
            fg=COLORS['white'] if couleur != COLORS['warning'] else COLORS['text_dark'],
            wraplength=popup_w - 40,
            justify="center"
        ).pack(pady=(5, 10))
        
        # Bouton OK pour fermer
        close_btn = ModernButton(
            popup, 
            text="J'ai compris", 
            command=popup.destroy, 
            bg_color=COLORS['primary_dark']
        )
        close_btn.pack(pady=10)


    def verifier_connexions_serial(self):
        """Vérifie l'état de l'Arduino et de l'ESP"""
        global arduino, esp
        
        # --- Vérification Arduino ---
        arduino_etat_precedent = self.arduino_connecte
        try:
            if arduino and arduino.is_open:
                 self.arduino_connecte = True
            else:
                self.connecter_serial() 
                
        except Exception as e:
            self.arduino_connecte = False
            
        # Mise à jour de l'UI Arduino
        if self.arduino_connecte:
            self.arduino_status_indicator.config(fg=COLORS['online'])
            self.arduino_status_label.config(text="Connecté")
            self.alerte_arduino_affiche = False
        else:
            self.arduino_status_indicator.config(fg=COLORS['offline'])
            self.arduino_status_label.config(text="Déconnecté")
            if arduino_etat_precedent and not self.alerte_arduino_affiche:
                self.afficher_alerte_popup("La connexion Arduino (Joystick) est perdue. Veuillez vérifier le câble et redémarrer l'application.", "Arduino Déconnecté", COLORS['danger'])
                self.alerte_arduino_affiche = True
                
        # --- Vérification ESP ---
        esp_etat_precedent = self.esp_connecte
        try:
            if esp and esp.is_open:
                self.esp_connecte = True
            else:
                self.connecter_serial()
        except Exception as e:
            self.esp_connecte = False

        # Mise à jour de l'UI ESP
        if self.esp_connecte:
            self.esp_status_indicator.config(fg=COLORS['online'])
            self.esp_status_label.config(text="Connecté")
            self.alerte_esp_affiche = False
        else:
            self.esp_status_indicator.config(fg=COLORS['offline'])
            self.esp_status_label.config(text="Déconnecté")
            if esp_etat_precedent and not self.alerte_esp_affiche:
                self.afficher_alerte_popup("La connexion ESP (Porte) est perdue. Le buzzer et les commandes de porte sont désactivés.", "ESP Déconnecté", COLORS['danger'])
                self.alerte_esp_affiche = True

    def verifier_mqtt(self):
        """Vérifie et met à jour le status MQTT et appelle la vérification série"""
        
        self.verifier_connexions_serial()
        
        # --- Vérification MQTT ---
        mqtt_etat_precedent = self.mqtt_connecte
        try:
            if self.mqtt_client and self.mqtt_client.is_connected():
                self.mqtt_connecte = True
                self.mqtt_status_indicator.config(fg=COLORS['online'])
                self.mqtt_status_label.config(text="Connecté")
                self.alerte_mqtt_affiche = False
            else:
                self.mqtt_connecte = False
                self.mqtt_status_indicator.config(fg=COLORS['offline'])
                self.mqtt_status_label.config(text="Déconnecté")
                
                if mqtt_etat_precedent and not self.alerte_mqtt_affiche:
                    self.afficher_alerte_popup("Le broker MQTT est déconnecté. Les messages et mises à jour de statut ne seront pas envoyés.", "MQTT Déconnecté", COLORS['danger'])
                    self.alerte_mqtt_affiche = True

        except Exception as e:
            self.mqtt_connecte = False
            self.mqtt_status_indicator.config(fg=COLORS['danger'])
            self.mqtt_status_label.config(text="Erreur")
            if mqtt_etat_precedent and not self.alerte_mqtt_affiche:
                self.afficher_alerte_popup("Erreur critique avec le client MQTT. Vérifiez la configuration du broker.", "Erreur MQTT", COLORS['danger'])
                self.alerte_mqtt_affiche = True

        self.root.after(2000, self.verifier_mqtt)

    def subscribe_topics(self):
        """S'abonner aux topics MQTT"""
        if not self.mqtt_connecte:
            self.root.after(5000, self.subscribe_topics) 
            return
            
        topics = [
            (f"fisheye/{self.client_id}/bell/activate", 1),
            (f"fisheye/{self.client_id}/buzz/activate", 1),
            (f"fisheye/{self.client_id}/display/update", 1),
            (f"fisheye/{self.client_id}/data/teachers", 1),
            (f"fisheye/{self.client_id}/cmd/ring", 1)
        ]

        for topic, qos in topics:
            self.mqtt_client.subscribe(topic, qos)
            print(f"[MQTT] ✓ Abonné à '{topic}'")

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
                    couleur=COLORS['warning']
                ))

            elif "buzz/activate" in topic:
                duration = payload.get("duration", 500)
                self.root.after(0, lambda: self.afficher_notification(
                    f"🚨 Buzzer activé ({duration}ms)",
                    duree=duration,
                    couleur=COLORS['danger']
                ))

            elif "display/update" in topic:
                teacher_name = payload.get("teacherName", "")
                self.root.after(0, lambda: self.afficher_notification(
                    f"📺 Affichage: {teacher_name}",
                    duree=3000,
                    couleur=COLORS['secondary']
                ))

            elif "data/teachers" in topic:
                profs = {}
                for teacher in payload["teachers"]:
                    profs[teacher["name"]] = {"disponible" : teacher["isPresent"], "id" : teacher["id"]}
                self.professeurs = profs
                self.prof_noms = ["TOUS"] + list(self.professeurs.keys())
                self.recharger_professeurs()

            elif "cmd/ring" in topic:
                self.send_esp('turn_on')
                publish_mqtt(self.mqtt_client, f"fisheye/{self.client_id}/event/ack_ring", {"success" : True}, qos=1)

        except json.JSONDecodeError:
            print(f"[MQTT] Message non-JSON reçu: {msg.payload.decode()}")
        except Exception as e:
            print(f"[MQTT] Erreur traitement message: {e}")

    def publier_button_pressed(self):
        """Publier un événement de bouton pressé"""
        if not self.mqtt_connecte:
            self.afficher_notification("❌ Envoi impossible: MQTT déconnecté.", 3000, COLORS['danger'])
            return
            
        topic = f"fisheye/{self.client_id}/event/button"
        payload = ( {"targetTeacherId": self.teacher_id} if self.teacher_id else {})


        def send_unpressed():
            time.sleep(3)
            publish_mqtt(self.mqtt_client, f"fisheye/{self.client_id}/button", "unpressed", qos=0)

        t = threading.Thread(target=send_unpressed, daemon=True)
        t.start()

        publish_mqtt(self.mqtt_client, topic, payload, qos=1)

    def publier_status(self):
        """Publier le status de l'appareil"""
        if not self.mqtt_connecte: return

        topic = f"fisheye/{self.client_id}/status"
        payload = "online"
        publish_mqtt(self.mqtt_client, topic, payload, qos=1, retain=True)

    def lire_joystick(self):
        """Boucle de lecture du joystick"""
        global arduino
        seuil = config["joystick_threshold"]
        delai = config["joystick_delay"]
        dernier_temps = time.time()

        while True:
            try:
                if arduino and arduino.is_open and arduino.in_waiting > 0:
                    ligne = arduino.readline().decode('utf-8').strip()
                    arduino.flushInput()

                    if not ligne:
                        continue

                    try:
                        x, y, bouton_joystick, bouton_sonnette = ligne.split(',')
                        x, y, bouton_joystick, bouton_sonnette = int(x), int(y), int(bouton_joystick), int(bouton_sonnette)
                    except ValueError:
                        time.sleep(0.1)
                        continue

                    if time.time() - dernier_temps > delai:
                        if x < 512 - seuil:
                            self.root.after(0, self.deplacer_selection, "gauche")
                            dernier_temps = time.time()
                        elif x > 512 + seuil:
                            self.root.after(0, self.deplacer_selection, "droite")
                            dernier_temps = time.time()

                    if bouton_joystick:
                        self.root.after(0, self.envoyer_au_prof)
                        time.sleep(0.5) 

                    if bouton_sonnette:
                        
                        self.root.after(0, self.publier_button_pressed)
                        self.root.after(0, lambda : self.send_esp('turn_on'))

                        self.root.after(0, lambda: self.afficher_notification(f"Ca sonne !", 2000, COLORS['accent']))
                        time.sleep(0.5) 
                        
                time.sleep(0.01)
            except serial.SerialException as e:
                print(f"[ERREUR JOYSTICK SÉRIE] Connexion perdue: {e}")
                self.arduino_connecte = False
                self.root.after(0, lambda: self.verifier_connexions_serial())
                time.sleep(5) 
            except Exception as e:
                print(f"[ERREUR JOYSTICK GRAVE] {e}")
                time.sleep(1)

    def deplacer_selection(self, direction):
        """Déplace la sélection avec le joystick"""
        if direction in ["haut", "gauche"]:
            self.prof_index = (self.prof_index - 1) % len(self.prof_noms)
        elif direction in ["bas", "droite"]:
            self.prof_index = (self.prof_index + 1) % len(self.prof_noms)
        
        if self.prof_noms:
            nom = self.prof_noms[self.prof_index]
            self.selectionner_prof(nom)

    def envoyer_au_prof(self):
        """Envoie le message au professeur sélectionné via MQTT"""
        
        message = self.message_text.get("1.0", "end-1c").strip()
        
        if not self.mqtt_connecte:
            self.afficher_notification("❌ Envoi impossible: MQTT déconnecté.", 3000, COLORS['danger'])
            return

        if not message or message == "":
            self.afficher_notification(
                "⚠️ Veuillez écrire un message",
                duree=2000,
                couleur=COLORS['warning']
            )
            return

        if not self.prof_selectionne:
            self.afficher_notification(
                "⚠️ Aucun professeur sélectionné",
                duree=2000,
                couleur=COLORS['warning']
            )
            return

        topic = f"fisheye/{self.client_id}/event/message"
        payload = {"text": message}

        if self.prof_selectionne == "TOUS":
            notif_text = f"✓ Message envoyé à TOUS les professeurs"
        else:
            payload["targetTeacherId"] = self.professeurs[self.prof_selectionne].get("id")
            notif_text = f"✓ Message envoyé à {self.prof_selectionne}"

        if publish_mqtt(self.mqtt_client, topic, payload, qos=1):
            self.afficher_notification(notif_text, duree=3000, couleur=COLORS['success'])
            self.message_text.delete("1.0", "end")
            self.message_text.insert("1.0", "")
            print(f"[MESSAGE] Envoyé à {self.prof_selectionne}: {message}")
        else:
            self.afficher_notification(
                "✗ Erreur d'envoi du message",
                duree=3000,
                couleur=COLORS['danger']
            )

    def send_esp(self, cmd):
        global esp
        if esp and self.esp_connecte:
            try:
                if cmd == "turn_on":
                    esp.write(b'TURN_ON(5)\n')
                elif cmd == "turn_off":
                    esp.write(b'TURN_OFF\n')
            except serial.SerialException as e:
                print(f"[ERREUR ESP SÉRIE] Écriture échouée: {e}")
                self.esp_connecte = False
                self.root.after(0, lambda: self.verifier_connexions_serial())
        else:
            self.afficher_notification("❌ Commande ESP impossible: ESP déconnecté.", 3000, COLORS['danger'])

    def read_esp(self):
        global esp
        while True:
            try:
                if esp and esp.is_open and esp.in_waiting > 0:
                    ligne = esp.readline().decode('utf-8').strip()
                    esp.flushInput()

                    if not ligne:
                        continue

                    try:
                        cmd, *arg = ligne.split(' ')

                    except ValueError:
                        time.sleep(0.1)
                        continue

                    if cmd == "DEBUG":
                        pass

                    if cmd == 'DOOR':
                        if arg[0] == 'OPEN':
                            publish_mqtt(self.mqtt_client, f"fisheye/{self.client_id}/event/door", "OPEN", 0)

                    if cmd == 'ACK':
                        print(cmd, arg)

                time.sleep(0.01)
            except serial.SerialException as e:
                print(f"[ERREUR ESP SÉRIE] Connexion perdue: {e}")
                self.esp_connecte = False
                self.root.after(0, lambda: self.verifier_connexions_serial())
                time.sleep(5)
            except Exception as e:
                print(f"[ERREUR ESP GRAVE] {e}")
                time.sleep(1)

    def recharger_professeurs(self):
        """Recharge la liste des professeurs"""
        self.prof_noms = ["TOUS"] + list(self.professeurs.keys())

        for widget in self.profs_list_frame.winfo_children():
            widget.destroy()

        self.prof_widgets.clear()

        widgets_tous = self.create_prof_item_tous()
        self.prof_widgets["TOUS"] = widgets_tous

        for nom, info in self.professeurs.items():
            widgets = self.create_prof_item(nom, info)
            self.prof_widgets[nom] = widgets

        self.prof_index = 0
        if self.prof_noms:
            self.selectionner_prof(self.prof_noms[0])

        print(f"[INFO] {len(self.professeurs)} professeurs rechargés")

    def quitter_fullscreen(self, event=None):
        """Quitte le mode plein écran"""
        self.root.attributes('-fullscreen', False)

    def toggle_fullscreen(self, event=None):
        """Bascule le mode plein écran"""
        is_fullscreen = self.root.attributes('-fullscreen')
        self.root.attributes('-fullscreen', not is_fullscreen)

    def on_closing(self):
        """Handler pour fermeture propre"""
        print("[INFO] Fermeture de l'application...")

        try:
            topic = f"fisheye/{self.client_id}/status"
            payload = "offline"
            publish_mqtt(self.mqtt_client, topic, payload, qos=1, retain=True)

            timeout = time.time() + 2
            while unacked_publish and time.time() < timeout:
                time.sleep(0.1)

            if self.mqtt_client:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
        except Exception as e:
            print(f"[ERREUR] Lors de la fermeture MQTT: {e}")

        global arduino, esp
        try:
            if arduino and arduino.is_open:
                arduino.close()
                print("[INFO] Port série Arduino fermé")
            if esp and esp.is_open:
                esp.close()
                print("[INFO] Port série ESP fermé")
        except Exception as e:
            print(f"[ERREUR] Lors de la fermeture des ports série: {e}")

        self.root.quit()
        self.root.destroy()


# ===================== MAIN =====================
if __name__ == "__main__":
    root = tk.Tk()
    app = SonnetteApp(root)
    root.mainloop()