# hardware.py
import serial

def init_hardware(config):
    """Initialise les connexions série et retourne (arduino, esp)"""
    arduino = None
    esp = None

    # Init Arduino
    try:
        arduino = serial.Serial(config['serial_port_arduino'], config['baudrate_arduino'], timeout=config['timeout'])
        arduino.flushInput()
        print(f"[INFO] Arduino connecté sur {config['serial_port_arduino']}")
    except Exception as e:
        print(f"[ERREUR] Impossible d'ouvrir le port série Arduino : {e}")

    # Init ESP
    try:
        esp = serial.Serial(config["serial_port_esp"], config['baudrate_esp'], timeout=config['timeout'])
        esp.flush()
        print(f"[INFO] Esp connecté sur {config['serial_port_esp']}")
    except Exception as e:
        print(f"[ERREUR] Impossible d'ouvrir le port série ESP : {e}")

    return arduino, esp
