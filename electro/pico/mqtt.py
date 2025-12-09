#MQTT
from lib.umqtt import robust2
import network
import ntptime
import time
from secret import *

# Connect to Wi-Fi (Replace with your SSID & password)
wifi = network.WLAN(network.STA_IF)
wifi.active(True)
wifi.connect(wifi_SSID, wifi_password)
while not wifi.isconnected():
    time.sleep(1)

print('Connection successful')
print('Network Config:', wifi.ifconfig())

time.sleep(2)

# --- 1. Sync RTC to UTC via NTP ---
ntptime.host = "pool.ntp.org"
ntptime.settime()  # sets RTC to UTC
time.sleep(1)  # give RTC a moment to update

print('ntp success')


MQTT_BROKER = "bx.phausman.be"
MQTT_PORT = 1883
MQTT_USER = "pico"
MQTT_PASSWD = "pico"

CLIENT_ID = "panel_client_001"

TOPIC_AVAILABILITY = f'fisheye/{CLIENT_ID}/status'

def mqtt_callback(topic, msg, retained, duplicate):
    topic = topic.decode('utf-8')
    msg = msg.decode('utf-8')
    print(f"Received: {topic} → {msg}")



client = robust2.MQTTClient(CLIENT_ID, MQTT_BROKER, port=MQTT_PORT, user=MQTT_USER, password=MQTT_PASSWD)
client.set_callback(mqtt_callback)
client.connect()

client.publish(TOPIC_AVAILABILITY, "online", retain=True)

client.subscribe(f"fisheye/{CLIENT_ID}/data/teachers")
client.subscribe(f"fisheye/{CLIENT_ID}/data/schedule")

print('connected')

