"""
Module de communication série avec Arduino et ESP
"""
import serial
import time
import threading


class SerialManager:
    """Gestionnaire de communication série"""
    
    def __init__(self, config):
        self.config = config
        self.arduino = None
        self.esp = None
        self.arduino_connecte = False
        self.esp_connecte = False
        
    def connecter_arduino(self):
        """Tente d'ouvrir le port série Arduino"""
        try:
            self.arduino = serial.Serial(
                self.config['serial_port_arduino'], 
                self.config['baudrate_arduino'],
                timeout=self.config['timeout']
            )
            self.arduino.flushInput()
            self.arduino_connecte = True
            print(f"[INFO] Arduino connecté sur {self.config['serial_port_arduino']}")
            return True
        except Exception as e:
            print(f"[ERREUR] Impossible d'ouvrir le port série Arduino : {e}")
            self.arduino = None
            self.arduino_connecte = False
            return False
    
    def connecter_esp(self):
        """Tente d'ouvrir le port série ESP"""
        try:
            self.esp = serial.Serial(
                self.config["serial_port_esp"], 
                self.config['baudrate_esp'], 
                timeout=self.config['timeout']
            )
            self.esp.flush()
            self.esp_connecte = True
            print(f"[INFO] ESP connecté sur {self.config['serial_port_esp']}")
            return True
        except Exception as e:
            print(f"[ERREUR] Impossible d'ouvrir le port série ESP : {e}")
            self.esp = None
            self.esp_connecte = False
            return False
    
    def connecter_tous(self):
        """Tente de connecter tous les périphériques série"""
        self.connecter_arduino()
        self.connecter_esp()
    
    def verifier_connexions(self):
        """Vérifie l'état des connexions série"""
        # Vérification Arduino
        arduino_etat_precedent = self.arduino_connecte
        try:
            if self.arduino and self.arduino.is_open:
                self.arduino_connecte = True
            else:
                self.connecter_arduino()
        except Exception:
            self.arduino_connecte = False
        
        # Vérification ESP
        esp_etat_precedent = self.esp_connecte
        try:
            if self.esp and self.esp.is_open:
                self.esp_connecte = True
            else:
                self.connecter_esp()
        except Exception:
            self.esp_connecte = False
        
        return {
            'arduino': self.arduino_connecte,
            'esp': self.esp_connecte,
            'arduino_changed': arduino_etat_precedent != self.arduino_connecte,
            'esp_changed': esp_etat_precedent != self.esp_connecte
        }
    
    def send_esp(self, cmd):
        """Envoie une commande à l'ESP"""
        if self.esp and self.esp_connecte:
            try:
                if cmd == "turn_on":
                    self.esp.write(b'TURN_ON(5)\n')
                elif cmd == "turn_off":
                    self.esp.write(b'TURN_OFF\n')
                return True
            except serial.SerialException as e:
                print(f"[ERREUR ESP SÉRIE] Écriture échouée: {e}")
                self.esp_connecte = False
                return False
        return False
    
    def fermer_tous(self):
        """Ferme tous les ports série"""
        try:
            if self.arduino and self.arduino.is_open:
                self.arduino.close()
                print("[INFO] Port série Arduino fermé")
        except Exception as e:
            print(f"[ERREUR] Fermeture Arduino: {e}")
        
        try:
            if self.esp and self.esp.is_open:
                self.esp.close()
                print("[INFO] Port série ESP fermé")
        except Exception as e:
            print(f"[ERREUR] Fermeture ESP: {e}")