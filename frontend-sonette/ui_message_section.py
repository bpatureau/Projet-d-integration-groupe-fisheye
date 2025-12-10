"""
Module de la section de composition de message
"""
import tkinter as tk
from tkinter import font as tkfont
from config import COLORS
from ui_widgets import ModernCard


class MessageSectionUI:
    """Gestionnaire de la section de message"""
    
    def __init__(self, parent):
        self.parent = parent
        self.message_text = None
        self.selection_label = None
        self.notif_label = None
        
    def create(self):
        """Crée la section de message"""
        message_card = ModernCard(self.parent)
        message_card.pack(side="left", fill="both", expand=True, padx=(0, 10))
        
        # En-tête
        self._create_header(message_card)
        
        # Corps
        body = tk.Frame(message_card, bg=COLORS['white'])
        body.pack(fill="both", expand=True, padx=25, pady=20)
        
        # Zone de texte
        self._create_text_area(body)
        
        # Instructions
        self._create_instructions(body)
        
        # Sélection actuelle
        self._create_selection_label(body)
        
        # Notifications
        self._create_notification_label(body)
        
        return message_card
    
    def _create_header(self, parent):
        """Crée l'en-tête de la carte"""
        header = tk.Frame(parent, bg=COLORS['primary_light'])
        header.pack(fill="x")
        
        font_subtitle = tkfont.Font(family="Segoe UI", size=14, weight="bold")
        
        tk.Label(
            header,
            text="✍️  Composer un message",
            font=font_subtitle,
            bg=COLORS['primary_light'],
            fg=COLORS['text_dark'],
            anchor="w"
        ).pack(padx=25, pady=15)
    
    def _create_text_area(self, parent):
        """Crée la zone de texte"""
        text_container = tk.Frame(parent, bg=COLORS['white'])
        text_container.pack(fill="both", expand=True)
        
        font_body = tkfont.Font(family="Segoe UI", size=11)
        
        tk.Label(
            text_container,
            text="Message",
            font=font_body,
            bg=COLORS['white'],
            fg=COLORS['text_dark'],
            anchor="w"
        ).pack(anchor="w", pady=(0, 8))
        
        text_frame = tk.Frame(
            text_container, 
            bg=COLORS['white'], 
            highlightbackground=COLORS['medium_gray'],
            highlightthickness=1
        )
        text_frame.pack(fill="both", expand=True)
        
        self.message_text = tk.Text(
            text_frame,
            height=10,
            font=font_body,
            relief="flat",
            bd=0,
            padx=15,
            pady=15,
            bg=COLORS['white'],
            fg=COLORS['text_dark'],
            insertbackground=COLORS['secondary']
        )
        self.message_text.pack(fill="both", expand=True)
        self.message_text.insert("1.0", "")
    
    def _create_instructions(self, parent):
        """Crée la carte d'instructions"""
        font_body = tkfont.Font(family="Segoe UI", size=11)
        
        instruction_card = tk.Frame(
            parent, 
            bg=COLORS['primary_light'], 
            bd=0, 
            highlightbackground=COLORS['border_light'],
            highlightthickness=1
        )
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
            font=font_body,
            bg=COLORS['primary_light'],
            fg=COLORS['text_dark'],
            justify="left"
        ).pack(side="left")
    
    def _create_selection_label(self, parent):
        """Crée le label de sélection"""
        font_body = tkfont.Font(family="Segoe UI", size=11)
        
        self.selection_label = tk.Label(
            parent,
            text="Aucun destinataire sélectionné",
            font=font_body,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        )
        self.selection_label.pack(pady=(10, 0))
    
    def _create_notification_label(self, parent):
        """Crée le label de notification"""
        self.notif_label = tk.Label(
            parent,
            text="",
            font=("Segoe UI", 12, "bold"),
            bg=COLORS['white'],
            wraplength=500,
            justify="center"
        )
        self.notif_label.pack(pady=15)
    
    def get_message(self):
        """Récupère le message saisi"""
        return self.message_text.get("1.0", "end-1c").strip()
    
    def clear_message(self):
        """Efface le message"""
        self.message_text.delete("1.0", "end")
        self.message_text.insert("1.0", "")
    
    def update_selection(self, text, color=None):
        """Met à jour le texte de sélection"""
        if color is None:
            color = COLORS['text_dark']
        self.selection_label.config(text=text, fg=color)
    
    def show_notification(self, message, color=None, duration=3000):
        """Affiche une notification"""
        if color is None:
            color = COLORS['text_dark']
        self.notif_label.config(text=message, fg=color)
        
        if duration > 0:
            self.parent.after(duration, lambda: self.notif_label.config(text=""))
    
    def focus_message(self):
        """Place le focus sur la zone de message"""
        self.message_text.focus_set()
        if self.message_text.get("1.0", "end-1c") == "":
            self.message_text.delete("1.0", "end")