import requests
from gpiozero import Button, LED
from signal import pause
from mqtt import HomeAssistantDoorClient
import sys


API_KEY = "your_api_key_here"
HEADERS = {
    "Authorization": "ApiKey your-secret-device-key-here-change-me",
    "Content-Type": "application/json"
}

# LED on GPIO 17 (BCM numbering)
ring_led = LED(17)  # GPIO numbering follows BCM by default in gpiozero

def require_local_api_ok(url="http://localhost:8080/api/health", timeout=2.0):
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code == 200:
            print("Health check OK.")
            return
        print(f"Health check failed with status {resp.status_code}. Exiting.")
        sys.exit(1)
    except requests.RequestException as e:
        print(f"Health check error: {e}. Exiting.")
        sys.exit(1)

def pulse_led(duration=3.0):
    # Single on-period for 'duration' seconds, non-blocking
    ring_led.blink(on_time=duration, off_time=0, n=1, background=True)

def doorbell_ring():
    url = "http://localhost:8080/api/device/ring"
    body = {"type": "doorbell"}
    requests.post(url, json=body, headers=HEADERS)
    print("Sent doorbell event.")

    ha.publish_doorbell()

    pulse_led(3.0)



def door_close():
    ha.set_door_status(is_open=False)
    print("Door close")

def door_open():
    url = "http://localhost:8080/api/device/visits/answer"
    requests.post(url, headers=HEADERS)

    ha.set_door_status(is_open=True)

    print('Door open')

if __name__ == "__main__":

    require_local_api_ok()

    # Set up buttons on pins 2, 3, and 4
    button1 = Button(2)
    #button2 = Button(3)
    button3 = Button(4)


    button1.when_pressed = doorbell_ring
    #button2.when_pressed = send_ring_motion
    button3.when_pressed = door_close
    button3.when_released = door_open

    ha = HomeAssistantDoorClient(
        mqtt_host="192.168.0.102",
        mqtt_port=1883,
        client_id="door-node-1",
        doorbell_device_class="sound",  # could also be "occupancy" if preferred
        doorbell_auto_off_secs=1.0,  # set 0 and configure off_delay in HA if desired
        username="pico",
        password="pico",
    )
    ha.start(clean_start=True, session_expiry_interval=0)
    ha.auto_discovery()

    if not button3.is_pressed:
        door_open()
    else:
        doorbell_ring()


    print("Listening for button presses...")
    pause()  # Keeps the script running
