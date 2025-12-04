"""
Module de création de l'en-tête de l'interface
"""
import tkinter as tk
from tkinter import font as tkfont
from config import COLORS
from ui_widgets import StatusIndicator


class HeaderUI:
    """Gestionnaire de l'en-tête de l'application"""
    
    def __init__(self, parent):
        self.parent = parent
        self.alert_label = None
        self.arduino_indicator = None
        self.esp_indicator = None
        self.mqtt_indicator = None
        
    def create(self, arduino_status=False, esp_status=False, mqtt_status=False):
        """Crée l'en-tête complet"""
        header = tk.Frame(self.parent, bg=COLORS['white'], height=80)
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)
        
        header_content = tk.Frame(header, bg=COLORS['white'])
        header_content.pack(fill="both", expand=True, padx=30, pady=15)
        
        # Titre à gauche
        self._create_title(header_content)
        
        # Status et alertes à droite
        self._create_status_area(header_content, arduino_status, esp_status, mqtt_status)
        
        # Ligne de séparation
        separator = tk.Frame(self.parent, bg=COLORS['medium_gray'], height=1)
        separator.pack(fill="x")
        
        return header
    
    def _create_title(self, parent):
        """Crée la zone de titre"""
        title_frame = tk.Frame(parent, bg=COLORS['white'])
        title_frame.pack(side="left")
        
        font_title = tkfont.Font(family="Segoe UI", size=24, weight="bold")
        font_small = tkfont.Font(family="Segoe UI", size=9)
        
        title = tk.Label(
            title_frame,
            text="🔔 Sonnette",
            font=font_title,
            bg=COLORS['white'],
            fg=COLORS['text_dark']
        )
        title.pack(anchor="w")
        
        subtitle = tk.Label(
            title_frame,
            text="Communication avec les professeurs",
            font=font_small,
            bg=COLORS['white'],
            fg=COLORS['text_light']
        )
        subtitle.pack(anchor="w")
    
    def _create_status_area(self, parent, arduino_status, esp_status, mqtt_status):
        """Crée la zone de statut et alertes"""
        status_container = tk.Frame(parent, bg=COLORS['white'])
        status_container.pack(side="right", fill="y")
        
        # Zone d'alertes
        self.alert_label = tk.Label(
            status_container,
            text="",
            font=("Segoe UI", 10, "bold"),
            bg=COLORS['white'],
            fg=COLORS['danger'],
        )
        self.alert_label.pack(side="top", anchor="e", pady=(0, 5))
        
        # Frame pour les indicateurs
        indicator_frame = tk.Frame(status_container, bg=COLORS['white'])
        indicator_frame.pack(side="bottom", anchor="e")
        
        # Création des indicateurs
        self.arduino_indicator = StatusIndicator(indicator_frame, "Arduino", arduino_status)
        self.esp_indicator = StatusIndicator(indicator_frame, "ESP", esp_status)
        self.mqtt_indicator = StatusIndicator(indicator_frame, "MQTT", mqtt_status)
    
    def update_arduino_status(self, is_connected):
        """Met à jour le statut Arduino"""
        if self.arduino_indicator:
            self.arduino_indicator.update_status(is_connected)
    
    def update_esp_status(self, is_connected):
        """Met à jour le statut ESP"""
        if self.esp_indicator:
            self.esp_indicator.update_status(is_connected)
    
    def update_mqtt_status(self, is_connected):
        """Met à jour le statut MQTT"""
        if self.mqtt_indicator:
            self.mqtt_indicator.update_status(is_connected)
    
    def show_alert(self, message, color=None, duration=5000):
        """Affiche une alerte dans l'en-tête"""
        if color is None:
            color = COLORS['danger']
        self.alert_label.config(text=f"🚨 {message}", fg=color)
        
        if duration > 0:
            self.parent.after(duration, lambda: self.alert_label.config(text=""))