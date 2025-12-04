"""
Module de gestion du joystick Arduino
"""
import time
import serial
import threading


class JoystickHandler:
    """Gestionnaire de lecture du joystick"""
    
    def __init__(self, serial_manager, config, callbacks):
        self.serial_manager = serial_manager
        self.config = config
        self.callbacks = callbacks
        self.running = False
        self.thread = None
        
    def start(self):
        """Démarre le thread de lecture du joystick"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()
        print("[JOYSTICK] Thread démarré")
    
    def stop(self):
        """Arrête le thread de lecture"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        print("[JOYSTICK] Thread arrêté")
    
    def _read_loop(self):
        """Boucle de lecture du joystick"""
        seuil = self.config["joystick_threshold"]
        delai = self.config["joystick_delay"]
        dernier_temps = time.time()
        
        while self.running:
            try:
                arduino = self.serial_manager.arduino
                
                if not arduino or not arduino.is_open or arduino.in_waiting == 0:
                    time.sleep(0.01)
                    continue
                
                ligne = arduino.readline().decode('utf-8').strip()
                arduino.flushInput()
                
                if not ligne:
                    continue
                
                try:
                    x, y, bouton_joystick, bouton_sonnette = ligne.split(',')
                    x, y, bouton_joystick, bouton_sonnette = (
                        int(x), int(y), int(bouton_joystick), int(bouton_sonnette)
                    )
                except ValueError:
                    time.sleep(0.1)
                    continue
                
                # Navigation avec délai
                if time.time() - dernier_temps > delai:
                    if x < 512 - seuil:
                        self.callbacks['navigation']("gauche")
                        dernier_temps = time.time()
                    elif x > 512 + seuil:
                        self.callbacks['navigation']("droite")
                        dernier_temps = time.time()
                
                # Bouton joystick
                if bouton_joystick:
                    self.callbacks['button_pressed']()
                    time.sleep(0.5)  # Anti-rebond
                
                # Bouton sonnette
                if bouton_sonnette:
                    self.callbacks['bell_pressed']()
                    time.sleep(0.5)  # Anti-rebond
                
                time.sleep(0.01)
                
            except serial.SerialException as e:
                print(f"[ERREUR JOYSTICK SÉRIE] Connexion perdue: {e}")
                self.serial_manager.arduino_connecte = False
                self.callbacks['connection_lost']('arduino')
                time.sleep(5)
                
            except Exception as e:
                print(f"[ERREUR JOYSTICK GRAVE] {e}")
                time.sleep(1)