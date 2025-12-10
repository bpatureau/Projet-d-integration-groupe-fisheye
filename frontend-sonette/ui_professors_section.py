"""
Module de la section des professeurs
"""
import tkinter as tk
from tkinter import font as tkfont
from config import COLORS
from ui_widgets import ModernCard


class ProfessorsSectionUI:
    """Gestionnaire de la section des professeurs"""
    
    def __init__(self, parent):
        self.parent = parent
        self.canvas = None
        self.profs_list_frame = None
        self.prof_widgets = {}
        self.selection_callback = None
        
    def create(self, professeurs):
        """Crée la section des professeurs"""
        profs_card = ModernCard(self.parent)
        profs_card.pack(side="right", fill="both", expand=True, padx=(10, 0))
        
        # En-tête
        self._create_header(profs_card)
        
        # Corps avec liste scrollable
        self._create_scrollable_list(profs_card, professeurs)
        
        return profs_card
    
    def _create_header(self, parent):
        """Crée l'en-tête de la carte"""
        header = tk.Frame(parent, bg=COLORS['primary_light'])
        header.pack(fill="x")
        
        font_subtitle = tkfont.Font(family="Segoe UI", size=14, weight="bold")
        
        tk.Label(
            header,
            text="👥  Destinataires",
            font=font_subtitle,
            bg=COLORS['primary_light'],
            fg=COLORS['text_dark'],
            anchor="w"
        ).pack(padx=25, pady=15)
    
    def _create_scrollable_list(self, parent, professeurs):
        """Crée la liste scrollable des professeurs"""
        list_container = tk.Frame(parent, bg=COLORS['white'])
        list_container.pack(fill="both", expand=True, padx=15, pady=15)
        
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
        self._create_tous_item(len(professeurs))
        for nom, info in professeurs.items():
            self._create_prof_item(nom, info)
        
        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
    
    def _create_tous_item(self, nb_profs):
        """Crée l'item 'TOUS'"""
        item_frame = tk.Frame(
            self.profs_list_frame,
            bg=COLORS['primary'],
            cursor="hand2",
            bd=0,
            highlightbackground=COLORS['primary_dark'],
            highlightthickness=2
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
        
        tk.Label(
            text_frame,
            text=f"{nb_profs} destinataires",
            font=("Segoe UI", 9),
            bg=COLORS['primary'],
            fg=COLORS['white'],
            anchor="w"
        ).pack(anchor="w")
        
        for widget in [item_frame, content, left_side, icon, text_frame, nom_label]:
            widget.bind("<Button-1>", lambda e: self._on_select("TOUS"))
        
        self.prof_widgets["TOUS"] = {
            'nom_label': nom_label, 
            'item_frame': item_frame, 
            'is_tous': True
        }
    
    def _create_prof_item(self, nom, info):
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
            font=("Segoe UI", 9),
            bg=COLORS['white'],
            fg=COLORS['text_light']
        )
        status_label.pack(side="left")
        
        for widget in [item_frame, content, nom_label, status_frame, status_indicator, status_label]:
            widget.bind("<Button-1>", lambda e, n=nom: self._on_select(n))
        
        self.prof_widgets[nom] = {
            'nom_label': nom_label,
            'item_frame': item_frame,
            'status_indicator': status_indicator,
            'status_label': status_label,
            'is_tous': False
        }
    
    def _on_select(self, nom):
        """Callback interne de sélection"""
        if self.selection_callback:
            self.selection_callback(nom)
    
    def set_selection_callback(self, callback):
        """Définit le callback de sélection"""
        self.selection_callback = callback
    
    def update_selection_style(self, current_nom, previous_nom=None):
        """Met à jour le style de sélection"""
        # Désélectionner l'ancien
        if previous_nom and previous_nom in self.prof_widgets:
            self._deselect_item(previous_nom)
        
        # Sélectionner le nouveau
        if current_nom in self.prof_widgets:
            self._select_item(current_nom)
    
    def _select_item(self, nom):
        """Applique le style de sélection"""
        widgets = self.prof_widgets[nom]
        
        if widgets.get('is_tous'):
            widgets['item_frame'].config(
                bg=COLORS['primary_dark'],
                highlightbackground=COLORS['primary'],
                highlightthickness=2
            )
            self._update_frame_bg(widgets['item_frame'], COLORS['primary_dark'])
        else:
            widgets['item_frame'].config(
                bg=COLORS['primary_light'],
                highlightbackground=COLORS['primary'],
                highlightthickness=2
            )
            self._update_frame_bg(widgets['item_frame'], COLORS['primary_light'])
    
    def _deselect_item(self, nom):
        """Retire le style de sélection"""
        widgets = self.prof_widgets[nom]
        
        if widgets.get('is_tous'):
            widgets['item_frame'].config(
                bg=COLORS['primary'],
                highlightbackground=COLORS['primary_dark'],
                highlightthickness=2
            )
            self._update_frame_bg(widgets['item_frame'], COLORS['primary'])
        else:
            widgets['item_frame'].config(
                bg=COLORS['white'],
                highlightbackground=COLORS['medium_gray'],
                highlightthickness=1
            )
            self._update_frame_bg(widgets['item_frame'], COLORS['white'])
    
    def _update_frame_bg(self, frame, color):
        """Met à jour récursivement la couleur de fond"""
        for widget in frame.winfo_children():
            if isinstance(widget, tk.Frame):
                widget.config(bg=color)
                self._update_frame_bg(widget, color)
            elif widget.winfo_class() == 'Label':
                widget.config(bg=color)
    
    def scroll_to_item(self, nom):
        """Scroll vers un item"""
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
                position = (item_y + item_height / 2 - canvas_height / 2) / total_height
                position = max(0.0, min(1.0, position))
                self.canvas.yview_moveto(position)
        except Exception as e:
            print(f"[ERREUR SCROLL] {e}")
    
    def clear_all(self):
        """Efface tous les items"""
        for widget in self.profs_list_frame.winfo_children():
            widget.destroy()
        self.prof_widgets.clear()