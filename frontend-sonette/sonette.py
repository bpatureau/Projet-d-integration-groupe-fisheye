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
        print(f"     {payload_str}")
        return True
    except Exception as e:
        print(f"[MQTT] ✗ Erreur de publication: {e}")
        return False

mqttc = create_mqtt_client(
    config.get("mqtt_broker", "localhost"),
    config.get("mqtt_port", 1883),
    config.get("mqtt_user", "user1"),
    config.get("mqtt_password", "user1"),
    config.get("mqtt_client_id", f"fisheye_{uuid.uuid4().hex[:8]}")
)

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
        # Bordure subtile en bleu clair pour l'esthétique "dégradé abstrait"
        self.configure(highlightbackground=COLORS['border_light'], highlightthickness=1)

# ===================== APPLICATION TKINTER =====================
class SonnetteApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Sonnette Intelligente")
        
        # Mode plein écran
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
        
        # Référence au client MQTT
        self.mqtt_client = mqttc
        self.client_id = config.get("mqtt_client_id")
        
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
        if arduino:
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
    
    def create_header(self):
        """Crée l'en-tête moderne"""
        header = tk.Frame(self.root, bg=COLORS['white'], height=80)
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)
        
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
        
        # Ligne de séparation
        separator = tk.Frame(self.root, bg=COLORS['medium_gray'], height=1)
        separator.pack(fill="x")
        
        # Vérifier la connexion MQTT périodiquement
        self.verifier_mqtt()
    
    def create_main_content(self):
        """Crée le contenu principal"""
        main_container = tk.Frame(self.root, bg=COLORS['light_gray'])
        main_container.pack(fill="both", expand=True, padx=20, pady=20)
        
        self.create_message_section(main_container)
        self.create_professors_section(main_container)
    
    def create_message_section(self, parent):
        """Section d'écriture de message"""
        message_card = ModernCard(parent)
        message_card.pack(side="left", fill="both", expand=True, padx=(0, 10))
        
        # En-tête de la carte
        header = tk.Frame(message_card, bg=COLORS['primary_light'])
        header.pack(fill="x")
        
        tk.Label(
            header,
            text="✍️  Composer un message",
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
            text="👥  Destinataires",
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
                fg=COLORS['primary_light']
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
        
        # Publier la sélection MQTT
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
    
    def afficher_notification(self, message, duree=3000, couleur=None):
        """Affiche une notification temporaire"""
        if couleur is None:
            couleur = COLORS['text_dark']
        self.notif_label.config(text=message, fg=couleur)
        self.root.after(duree, lambda: self.notif_label.config(text=""))
    
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
    
    def verifier_mqtt(self):
        """Vérifie et met à jour le status MQTT"""
        try:
            if self.mqtt_client.is_connected():
                self.mqtt_status_indicator.config(fg=COLORS['online'])
                self.mqtt_status_label.config(text="Connecté")
            else:
                self.mqtt_status_indicator.config(fg=COLORS['offline'])
                self.mqtt_status_label.config(text="Déconnecté")
        except:
            self.mqtt_status_indicator.config(fg=COLORS['danger'])
            self.mqtt_status_label.config(text="Erreur")
        
        self.root.after(2000, self.verifier_mqtt)
    
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
        
        except json.JSONDecodeError:
            print(f"[MQTT] Message non-JSON reçu: {msg.payload.decode()}")
        except Exception as e:
            print(f"[MQTT] Erreur traitement message: {e}")
    
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
        payload = {"teacherId": teacher_id}
        publish_mqtt(self.mqtt_client, topic, payload, qos=0)
    
    def publier_door_opened(self):
        """Publier un événement de porte ouverte"""
        topic = f"fisheye/{self.client_id}/door/opened"
        payload = {}
        publish_mqtt(self.mqtt_client, topic, payload, qos=1)
    
    def publier_status(self):
        """Publier le status de l'appareil"""
        topic = f"fisheye/{self.client_id}/status"
        payload = "online"
        publish_mqtt(self.mqtt_client, topic, payload, qos=1, retain=True)
    
    def lire_joystick(self):
        """Boucle de lecture du joystick"""
        seuil = config["joystick_threshold"]
        delai = config["joystick_delay"]
        dernier_temps = time.time()
        
        while True:
            try:
                if arduino and arduino.in_waiting > 0:
                    ligne = arduino.readline().decode('utf-8').strip()
                    arduino.flushInput()
                    
                    if not ligne:
                        continue
                    
                    try:
                        # On s'attend à 4 valeurs (X, Y, Bouton Joystick, Bouton Sonnette)
                        x, y, bouton_joystick, bouton_sonnette = ligne.split(',')
                        x, y, bouton_joystick, bouton_sonnette = int(x), int(y), int(bouton_joystick), int(bouton_sonnette)
                    except ValueError:
                        print(f"[ERREUR JOYSTICK] Format de données incorrect: {ligne}. Assurez-vous d'envoyer 'X,Y,BoutonJoystick,BoutonSonnette'.")
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
                        time.sleep(0.5) # Anti-rebond
                        
                    # bouton sonette
                    if bouton_sonnette:
                        
                        self.root.after(0, self.publier_button_pressed)
                        
                        # Notification UI
                        self.root.after(0, lambda: self.afficher_notification(f"Ca sonne !", 2000, COLORS['accent']))
                        
                        time.sleep(0.5) # Anti-rebond
                        
                time.sleep(0.01)
            except Exception as e:
                print(f"[ERREUR JOYSTICK GRAVE] {e}")
                time.sleep(1)
    
    def deplacer_selection(self, direction):
        """Déplace la sélection avec le joystick"""
        if direction in ["haut", "gauche"]:
            self.prof_index = (self.prof_index - 1) % len(self.prof_noms)
        elif direction in ["bas", "droite"]:
            self.prof_index = (self.prof_index + 1) % len(self.prof_noms)
        
        nom = self.prof_noms[self.prof_index]
        self.selectionner_prof(nom)
    
    def envoyer_au_prof(self):
        """Envoie le message au professeur sélectionné via MQTT"""
        message = self.message_text.get("1.0", "end-1c").strip()
        
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
        
        # Préparer le payload MQTT
        topic = f"fisheye/{self.client_id}/message/sent"
        payload = {"message": message}
        
        if self.prof_selectionne == "TOUS":
            payload["to"] = "all"
            payload["recipients"] = list(self.professeurs.keys())
            notif_text = f"✓ Message envoyé à TOUS les professeurs"
        else:
            payload["teacherId"] = self.professeurs[self.prof_selectionne].get("id")
            notif_text = f"✓ Message envoyé à {self.prof_selectionne}"
            
            teacher_id = self.professeurs[self.prof_selectionne].get("id")
            if teacher_id:
                self.publier_button_pressed(teacher_id)
        
        # Publier le message
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
        if nom not in self.prof_widgets or nom == "TOUS":
            return
        
        info = self.professeurs[nom]
        widgets = self.prof_widgets[nom]
        
        couleur = COLORS['success'] if info["disponible"] else COLORS['danger']
        texte = "Disponible" if info["disponible"] else "Indisponible"
        
        widgets['status_indicator'].config(fg=couleur)
        widgets['status_label'].config(text=texte)
    
    def recharger_professeurs(self):
        """Recharge la liste des professeurs"""
        self.professeurs = charger_professeurs()
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
            # Publier status offline avec timeout
            topic = f"fisheye/{self.client_id}/status"
            payload = "offline"
            publish_mqtt(self.mqtt_client, topic, payload, qos=1, retain=True)
            
            # Attendre max 2 secondes pour les messages non confirmés
            timeout = time.time() + 2
            while unacked_publish and time.time() < timeout:
                time.sleep(0.1)
            
            # Arrêter le client MQTT
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        except Exception as e:
            print(f"[ERREUR] Lors de la fermeture MQTT: {e}")
        
        try:
            # Fermer le port série si ouvert
            if arduino and arduino.is_open:
                arduino.close()
                print("[INFO] Port série fermé")
        except Exception as e:
            print(f"[ERREUR] Lors de la fermeture Arduino: {e}")
        
        # Forcer la fermeture de la fenêtre
        self.root.quit()
        self.root.destroy()


# ===================== MAIN =====================
if __name__ == "__main__":
    root = tk.Tk()
    app = SonnetteApp(root)
    root.mainloop()