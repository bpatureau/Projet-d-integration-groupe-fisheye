from machine import Pin, I2C, ADC

import matrice_button
import ssd1306
import time
from random import randint
import neopixel
import ujson

from lib.umqtt import robust2
import network
import ntptime
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
#ntptime.host = "pool.ntp.org"
#ntptime.settime()  # sets RTC to UTC
#time.sleep(1)  # give RTC a moment to update
#
#print('ntp success')

FLAG_UPDATE = 0

CLIENT_ID = "panel_client_001"

TOPIC_AVAILABILITY = f'fisheye/{CLIENT_ID}/status'

def update_schedule(msg):
    global FLAG_UPDATE
    if FLAG_UPDATE == 0:
        print(f"Received: {msg}")
        FLAG_UPDATE = 1
        global index
        data = ujson.loads(msg)["teachers"]

        prof_array.clear()

        for teacher in data:

            schedule = [
                x
                for xs in teacher["schedule"]
                for x in xs
            ]

            prof_array.append({"name": teacher["name"], "id": teacher["id"], "schedule": schedule})
        # print(prof_array)

        display.fill_rect(0, 10, 128, 10, 0)
        display.text(prof_array[index]['name'], 0, 10)
        display.show()

        update_strip()

    else:
        FLAG_UPDATE -= 1

def mqtt_callback(topic, msg, retained, duplicate):
    topic = topic.decode('utf-8')
    msg = msg.decode('utf-8')
    # print(f"Received: {topic} → {msg}")

    if "/data/teachers" in topic:
        update_schedule(msg)

client = robust2.MQTTClient(CLIENT_ID, mqtt_server, port=mqtt_port, user=mqtt_user, password=mqtt_password)
client.set_callback(mqtt_callback)
client.connect()

client.publish(TOPIC_AVAILABILITY, "online", retain=True)

client.subscribe(f"fisheye/{CLIENT_ID}/data/teachers")

def scroll_prof(direction='up'):
    global prof_array, index

    if direction == 'up':
        index += 1
        if index >= len(prof_array):
            index = 0
    else:
        index -= 1
        if index < 0:
            index = 0

    display.fill_rect(0, 10, 128, 10, 0)
    display.text(prof_array[index]['name'], 0, 10)
    display.show()


    update_strip()


def update_strip():
    global prof_array, index

    for x in range(20):
        y = x * 2

        convert = {False: (255, 0, 0), True: (0, 255, 0)}
        # print(convert[prof_array[index]['schedule'][x]])
        np[y] = convert[prof_array[index]['schedule'][x]]
        np[y + 1] = convert[prof_array[index]['schedule'][x]]

    np.write()


def button_press(b_index):
    global prof_array, index, FLAG_UPDATE

    if b_index is not None:
        #print('button press')
        # print(prof_array[index]['schedule'][b_index])

        prof_array[index]['schedule'][b_index] = True if not prof_array[index]['schedule'][b_index] else False

        # print(prof_array[index]['schedule'][b_index])

        temp = []

        for x in range(5):
            temp.append([prof_array[index]['schedule'][x], prof_array[index]['schedule'][x+5], prof_array[index]['schedule'][x+10], prof_array[index]['schedule'][x+15]])

        FLAG_UPDATE += 1

        client.publish(f"fisheye/{CLIENT_ID}/event/schedule_update", ujson.dumps({"schedule": temp, "teacherId": prof_array[index]['id']}))
        # print("published: " + str(temp))

        update_strip()


prof_array = []
index = 0

i2c = I2C(sda=Pin(0), scl=Pin(1))
display = ssd1306.SSD1306_I2C(128, 32, i2c)

display.text('Prof: ', 0, 0)

display.show()

pot = ADC(28)

np = neopixel.NeoPixel(Pin(15), 40)

row_pins = [Pin(16, Pin.OUT), Pin(17, Pin.OUT), Pin(18, Pin.OUT), Pin(19, Pin.OUT),
            Pin(20, Pin.OUT)]
col_pins = [Pin(13, Pin.IN, Pin.PULL_UP), Pin(12, Pin.IN, Pin.PULL_UP), Pin(11, Pin.IN, Pin.PULL_UP),
            Pin(10, Pin.IN, Pin.PULL_UP)]

matrice = matrice_button.ButtonMatrix(row_pins, col_pins, button_press)

matrice.scan()

while True:

    if pot.read_u16() > 20_000:
        scroll_prof()
        time.sleep(0.4)
    matrice.scan()

    client.check_msg()

    time.sleep(0.1)
