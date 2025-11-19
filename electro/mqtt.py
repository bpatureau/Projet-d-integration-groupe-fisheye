import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("my/topic")  # Subscribe first

def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    print(f"Received on {msg.topic}: {payload}")  # This will print your own modified message

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

client.connect("broker.hivemq.com", 1883, 60)  # Use a public broker for testing
client.loop_start()  # Start the network loop

# Simulate modifying and publishing to the same topic
original_data = "initial value"
modified_data = original_data + " - modified!"
client.publish("my/topic", modified_data)  # Listener will receive this

# Keep running to see the reception
client.loop_forever()
