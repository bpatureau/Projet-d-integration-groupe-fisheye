"""
Module de gestion de l'ESP
"""
import time
import serial
import threading


class ESPHandler:
    """Gestionnaire de communication avec l'ESP"""
    
    def __init__(self, serial_manager, callbacks):
        self.serial_manager = serial_manager
        self.callbacks = callbacks
        self.running = False
        self.thread = None
    
    def start(self):
        """Démarre le thread de lecture de l'ESP"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()
        print("[ESP] Thread démarré")
    
    def stop(self):
        """Arrête le thread de lecture"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        print("[ESP] Thread arrêté")
    
    def _read_loop(self):
        """Boucle de lecture de l'ESP"""
        while self.running:
            try:
                esp = self.serial_manager.esp
                
                if not esp or not esp.is_open or esp.in_waiting == 0:
                    time.sleep(0.01)
                    continue
                
                ligne = esp.readline().decode('utf-8').strip()
                esp.flushInput()
                
                if not ligne:
                    continue
                
                try:
                    cmd, *args = ligne.split(' ')
                except ValueError:
                    time.sleep(0.1)
                    continue
                
                # Traitement des commandes
                if cmd == "DEBUG":
                    pass  # Ignorer les messages debug
                
                elif cmd == 'DOOR':
                    if args and args[0] == 'OPEN':
                        self.callbacks['door_opened']()
                
                elif cmd == 'ACK':
                    print(f"[ESP] ACK: {args}")
                
                time.sleep(0.01)
                
            except serial.SerialException as e:
                print(f"[ERREUR ESP SÉRIE] Connexion perdue: {e}")
                self.serial_manager.esp_connecte = False
                self.callbacks['connection_lost']('esp')
                time.sleep(5)
                
            except Exception as e:
                print(f"[ERREUR ESP GRAVE] {e}")
                time.sleep(1)