"""
Module des widgets UI personnalisés
"""
import tkinter as tk
from config import COLORS


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


class StatusIndicator(tk.Frame):
    """Indicateur de statut avec point et texte"""
    
    def __init__(self, parent, name, is_connected=False):
        super().__init__(parent, bg=COLORS['white'])
        self.pack(side="left", padx=(10, 0))
        
        self.name = name
        self.is_connected = is_connected
        
        indicator_color = COLORS['online'] if is_connected else COLORS['offline']
        indicator_text = "Connecté" if is_connected else "Déconnecté"
        
        self.indicator = tk.Label(
            self,
            text="●",
            font=("Segoe UI", 16),
            bg=COLORS['white'],
            fg=indicator_color
        )
        self.indicator.pack(side="left", padx=(0, 5))
        
        text_frame = tk.Frame(self, bg=COLORS['white'])
        text_frame.pack(side="left")
        
        tk.Label(
            text_frame,
            text=f"État {name}",
            font=("Segoe UI", 9),
            bg=COLORS['white'],
            fg=COLORS['text_light']
        ).pack(anchor="w")
        
        self.status_label = tk.Label(
            text_frame,
            text=indicator_text,
            font=("Segoe UI", 10, "bold"),
            bg=COLORS['white'],
            fg=COLORS['text_dark']
        )
        self.status_label.pack(anchor="w")
    
    def update_status(self, is_connected):
        """Met à jour le statut de l'indicateur"""
        self.is_connected = is_connected
        indicator_color = COLORS['online'] if is_connected else COLORS['offline']
        indicator_text = "Connecté" if is_connected else "Déconnecté"
        
        self.indicator.config(fg=indicator_color)
        self.status_label.config(text=indicator_text)