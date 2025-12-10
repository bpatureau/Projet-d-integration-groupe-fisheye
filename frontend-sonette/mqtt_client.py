"""
Module de gestion du client MQTT
"""
import paho.mqtt.client as mqtt
import json
import time


class MQTTManager:
    """Gestionnaire de communication MQTT"""
    
    def __init__(self, config):
        self.config = config
        self.client = None
        self.connecte = False
        self.unacked_publish = set()
        self.message_callback = None
        
    def create_client(self):
        """Crée et configure le client MQTT"""
        self.client = mqtt.Client(
            client_id=self.config.get("mqtt_client_id"),
            protocol=mqtt.MQTTv5
        )
        self.client.username_pw_set(
            self.config.get("mqtt_user"),
            self.config.get("mqtt_password")
        )
        self.client.on_publish = self._on_publish
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.user_data_set(self.unacked_publish)
        
        return self.client
    
    def _on_publish(self, client, userdata, mid):
        """Callback de publication réussie"""
        userdata.discard(mid)
    
    def _on_connect(self, client, userdata, flags, reason_code, properties):
        """Callback de connexion"""
        if reason_code == 0:
            print(f"[MQTT] ✓ Connecté au broker")
            self.connecte = True
        else:
            print(f"[MQTT] ✗ Échec de connexion: {reason_code}")
            self.connecte = False
    
    def _on_disconnect(self, client, userdata, reason_code, properties):
        """Callback de déconnexion"""
        self.connecte = False
        if reason_code != 0:
            print(f"[MQTT] ✗ Déconnexion inattendue: {reason_code}")
        else:
            print(f"[MQTT] Déconnecté du broker")
    
    def connect(self):
        """Connecte au broker MQTT"""
        if not self.client:
            self.create_client()
        
        try:
            self.client.connect(
                self.config.get("mqtt_broker"),
                self.config.get("mqtt_port"),
                keepalive=60
            )
            self.client.loop_start()
            print(f"[MQTT] Connexion initialisée")
            return True
        except Exception as e:
            print(f"[MQTT] ✗ Erreur de connexion: {e}")
            return False
    
    def publish(self, topic, payload, qos=1, retain=False, wait=False):
        """Publie un message MQTT"""
        if not self.client or not self.connecte:
            print("[MQTT] ✗ Impossible de publier. Non connecté.")
            return False
        
        try:
            payload_str = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else str(payload)
            msg = self.client.publish(topic, payload_str, qos=qos, retain=retain)
            
            if qos > 0:
                self.unacked_publish.add(msg.mid)
            
            if wait:
                msg.wait_for_publish()
            
            print(f"[MQTT] → {topic}")
            print(f"      {payload_str}")
            return True
        except Exception as e:
            print(f"[MQTT] ✗ Erreur de publication: {e}")
            return False
    
    def subscribe(self, topics):
        """S'abonne à une liste de topics"""
        if not self.connecte:
            return False
        
        for topic, qos in topics:
            self.client.subscribe(topic, qos)
            print(f"[MQTT] ✓ Abonné à '{topic}'")
        
        return True
    
    def set_message_callback(self, callback):
        """Définit le callback pour les messages entrants"""
        self.message_callback = callback
        self.client.on_message = callback
    
    def disconnect(self):
        """Déconnecte proprement du broker"""
        try:
            # Publier status offline
            client_id = self.config.get("mqtt_client_id")
            self.publish(f"fisheye/{client_id}/status", "offline", qos=1, retain=True)
            
            # Attendre les messages non confirmés
            timeout = time.time() + 2
            while self.unacked_publish and time.time() < timeout:
                time.sleep(0.1)
            
            if self.client:
                self.client.loop_stop()
                self.client.disconnect()
            
            print("[INFO] Client MQTT déconnecté")
        except Exception as e:
            print(f"[ERREUR] Déconnexion MQTT: {e}")