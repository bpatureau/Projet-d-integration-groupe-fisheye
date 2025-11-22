# mqtt_service.py
import paho.mqtt.client as mqtt
import json
import uuid

# Set global pour stocker les messages non acquittés
unacked_publish = set()


def on_publish(client, userdata, mid):
    """Callback quand un message est publié avec succès"""
    userdata.discard(mid)


def publish_mqtt(client, topic, payload, qos=1, retain=False, wait=False):
    """Publie un message MQTT et attend la confirmation si demandé"""
    try:
        payload_str = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else str(payload)
        msg = client.publish(topic, payload_str, qos=qos, retain=retain)

        if qos > 0:
            unacked_publish.add(msg.mid)

        if wait:
            msg.wait_for_publish()

        print(f"[MQTT] → {topic}")
        print(f"        {payload_str}")
        return True
    except Exception as e:
        print(f"[MQTT] ✗ Erreur de publication: {e}")
        return False


def create_mqtt_client(config):
    """Crée et démarre le client MQTT avec MQTTv5"""
    broker = config.get("mqtt_broker", "localhost")
    port = config.get("mqtt_port", 1883)
    user = config.get("mqtt_user", "user1")
    passwd = config.get("mqtt_password", "user1")
    client_id = config.get("mqtt_client_id", f"fisheye_{uuid.uuid4().hex[:8]}")

    def on_connect(client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            print(f"[MQTT] ✓ Connecté au broker {broker}:{port}")
        else:
            print(f"[MQTT] ✗ Échec de connexion: {reason_code}")

    def on_disconnect(client, userdata, reason_code, properties):
        if reason_code != 0:
            print(f"[MQTT] ✗ Déconnexion inattendue: {reason_code}")
        else:
            print(f"[MQTT] Déconnecté du broker")

    def on_message(client, userdata, msg):
        print(f"[MQTT] ← Message reçu sur '{msg.topic}': {msg.payload.decode()}")

    client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv5)
    client.username_pw_set(user, passwd)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    client.on_publish = on_publish
    client.user_data_set(unacked_publish)

    try:
        client.connect(broker, port, keepalive=60)
        client.loop_start()
        print(f"[MQTT] Connexion initialisée avec client_id={client_id}")
    except Exception as e:
        print(f"[MQTT] ✗ Erreur de connexion: {e}")

    return client, unacked_publish
