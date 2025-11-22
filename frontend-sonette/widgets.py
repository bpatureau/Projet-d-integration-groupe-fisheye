# widgets.py
import tkinter as tk
from constants import COLORS


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
        # Bordure subtile en bleu clair
        self.configure(highlightbackground=COLORS['border_light'], highlightthickness=1)
