#MQTT
from lib.umqtt import robust2
import network
from secret import *

# Connect to Wi-Fi (Replace with your SSID & password)
wifi = network.WLAN(network.STA_IF)
wifi.active(True)
wifi.connect(wifi_SSID, wifi_password)
while not wifi.isconnected():
    time.sleep(1)

# --- 1. Sync RTC to UTC via NTP ---
ntptime.host = "pool.ntp.org"
ntptime.settime()  # sets RTC to UTC
time.sleep(1)  # give RTC a moment to update

MQTT_BROKER = "bx.phausman.be"
MQTT_PORT = 1883
MQTT_USER = "pico"
MQTT_PASSWD = "pico"

CLIENT_ID = "ultidesk"

TOPIC_AVAILABILITY = 'ultidesk/status'

def mqtt_callback(topic, msg, retained, duplicate):
    global tft_power
    topic = topic.decode('utf-8')
    msg = msg.decode('utf-8')
    print(f"Received: {topic} → {msg}")



client = robust2.MQTTClient(CLIENT_ID, MQTT_BROKER, port=MQTT_PORT, user=MQTT_USER, password=MQTT_PASSWD)
client.set_callback(mqtt_callback)
client.connect()

client.publish(TOPIC_AVAILABILITY, "online", retain=True)

client.subscribe("ultidesk/light1/set")
