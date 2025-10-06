#!/usr/bin/env python3
import json
import time
import threading
from typing import Optional

import paho.mqtt.client as mqtt
from paho.mqtt.client import CallbackAPIVersion

class HomeAssistantDoorClient:
    def __init__(
        self,
        mqtt_host: str = "localhost",
        mqtt_port: int = 1883,
        client_id: str = "door-node-1",
        username: Optional[str] = None,
        password: Optional[str] = None,
        discovery_prefix: str = "homeassistant",
        node_id: str = "front_door",
        device_id: str = "front_door_device_01",
        manufacturer: str = "Custom",
        model: str = "Doorbell+DoorStatus",
        sw_version: str = "1.0.0",
        doorbell_object_id: str = "doorbell",     # now a binary_sensor
        door_object_id: str = "door_status",      # binary_sensor for door state
        protocol=mqtt.MQTTv5,
        keepalive: int = 60,
        doorbell_device_class: str = "sound",     # alternative: "occupancy" or "problem"
        doorbell_payload_on: str = "ON",
        doorbell_payload_off: str = "OFF",
        door_payload_on: str = "ON",
        door_payload_off: str = "OFF",
        doorbell_auto_off_secs: float = 1.0,      # send OFF after X seconds; set 0 to disable
    ):
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.client_id = client_id
        self.username = username
        self.password = password
        self.discovery_prefix = discovery_prefix
        self.node_id = node_id
        self.device_id = device_id
        self.manufacturer = manufacturer
        self.model = model
        self.sw_version = sw_version
        self.doorbell_object_id = doorbell_object_id
        self.door_object_id = door_object_id
        self.protocol = protocol
        self.keepalive = keepalive
        self.doorbell_device_class = doorbell_device_class
        self.doorbell_payload_on = doorbell_payload_on
        self.doorbell_payload_off = doorbell_payload_off
        self.door_payload_on = door_payload_on
        self.door_payload_off = door_payload_off
        self.doorbell_auto_off_secs = doorbell_auto_off_secs

        # Topics
        self.avail_topic = f"{self.client_id}/status"
        self.doorbell_state_topic = f"{self.client_id}/doorbell/state"
        self.door_state_topic = f"{self.client_id}/door/state"

        # Discovery topics
        self.doorbell_discovery_topic = f"{self.discovery_prefix}/binary_sensor/{self.node_id}/{self.doorbell_object_id}/config"
        self.door_discovery_topic = f"{self.discovery_prefix}/binary_sensor/{self.node_id}/{self.door_object_id}/config"

        # Client
        self._client = mqtt.Client(
            CallbackAPIVersion.VERSION2,
            client_id=self.client_id,
            protocol=self.protocol,
            transport="tcp",
        )
        if self.username is not None:
            self._client.username_pw_set(self.username, self.password)

        # LWT
        self._client.will_set(self.avail_topic, payload="offline", qos=1, retain=True)

        # v2 callbacks
        self._client.on_connect = self._on_connect_v2
        self._client.on_disconnect = self._on_disconnect_v2
        self._client.on_message = self._on_message

        # Discovery retained check
        self._have_doorbell_config = threading.Event()
        self._have_door_config = threading.Event()
        self._connected_once = threading.Event()

        self._client.message_callback_add(self.doorbell_discovery_topic, self._on_doorbell_discovery_message)
        self._client.message_callback_add(self.door_discovery_topic, self._on_door_discovery_message)

        self._loop_running = False

    # Public API

    def start(self, clean_start: bool = True, session_expiry_interval: int = 0):
        props = None
        if self.protocol == mqtt.MQTTv5:
            props = mqtt.Properties(mqtt.PacketTypes.CONNECT)
            props.SessionExpiryInterval = session_expiry_interval

        self._client.connect(
            host=self.mqtt_host,
            port=self.mqtt_port,
            keepalive=self.keepalive,
            clean_start=mqtt.MQTT_CLEAN_START_FIRST_ONLY if clean_start else mqtt.MQTT_CLEAN_START_NO,
            properties=props,
        )

        self._client.subscribe([(self.doorbell_discovery_topic, 1), (self.door_discovery_topic, 1)])

        if not self._loop_running:
            self._client.loop_start()
            self._loop_running = True

        self._connected_once.wait(timeout=5)
        self._client.publish(self.avail_topic, "online", qos=1, retain=True)

    def stop(self, set_offline: bool = True):
        if set_offline:
            self._client.publish(self.avail_topic, "offline", qos=1, retain=True)
        if self._loop_running:
            self._client.loop_stop()
            self._loop_running = False
        self._client.disconnect()

    def auto_discovery(self, wait_sec: float = 1.0):
        # Wait to receive any retained discovery messages
        self._have_doorbell_config.clear()
        self._have_door_config.clear()
        time.sleep(wait_sec)

        if not self._have_doorbell_config.is_set():
            self._publish_retained(self.doorbell_discovery_topic, self._doorbell_discovery_payload())
        if not self._have_door_config.is_set():
            self._publish_retained(self.door_discovery_topic, self._door_discovery_payload())

    def publish_doorbell(self):
        """
        Represent a doorbell ring by setting the doorbell binary_sensor ON briefly,
        then OFF, so automations can trigger on each press. If doorbell_auto_off_secs
        is 0, only ON is sent (use HA off_delay if desired). Retain is False so events
        are momentary. [web:1]
        """
        self._client.publish(self.doorbell_state_topic, self.doorbell_payload_on, qos=1, retain=False)
        if self.doorbell_auto_off_secs and self.doorbell_auto_off_secs > 0:
            def _auto_off():
                time.sleep(self.doorbell_auto_off_secs)
                self._client.publish(self.doorbell_state_topic, self.doorbell_payload_off, qos=1, retain=False)
            threading.Thread(target=_auto_off, daemon=True).start()

    def set_door_status(self, is_open: bool):
        """
        Persistent door status; retained so HA restores state on restart. [web:1]
        """
        payload = self.door_payload_on if is_open else self.door_payload_off
        self._client.publish(self.door_state_topic, payload, qos=1, retain=True)

    # Internals

    def _device_block(self):
        return {
            "identifiers": [self.device_id],
            "name": "Front Door",
            "manufacturer": self.manufacturer,
            "model": self.model,
            "sw_version": self.sw_version,
        }

    def _doorbell_discovery_payload(self):
        # Binary sensor representing a pulse when the doorbell rings.
        # off_delay can be configured in HA UI after discovery if preferred; here we perform timed OFF in code. [web:1]
        return {
            "unique_id": f"{self.device_id}_{self.doorbell_object_id}",
            "name": "Doorbell",
            "state_topic": self.doorbell_state_topic,
            "payload_on": self.doorbell_payload_on,
            "payload_off": self.doorbell_payload_off,
            "device_class": self.doorbell_device_class,
            "availability": [
                {"topic": self.avail_topic, "payload_available": "online", "payload_not_available": "offline"}
            ],
            "device": self._device_block(),
        }

    def _door_discovery_payload(self):
        # Door state as a binary_sensor with device_class door; retained states recommended. [web:1]
        return {
            "unique_id": f"{self.device_id}_{self.door_object_id}",
            "name": "Door",
            "state_topic": self.door_state_topic,
            "payload_on": self.door_payload_on,
            "payload_off": self.door_payload_off,
            "device_class": "door",
            "availability": [
                {"topic": self.avail_topic, "payload_available": "online", "payload_not_available": "offline"}
            ],
            "device": self._device_block(),
        }

    def _publish_retained(self, topic: str, payload: dict):
        self._client.publish(topic, json.dumps(payload), qos=1, retain=True)

    # v2 callbacks

    def _on_connect_v2(self, client, userdata, flags, reason_code, properties):
        self._connected_once.set()

    def _on_disconnect_v2(self, client, userdata, reason_code, properties):
        pass

    def _on_message(self, client, userdata, msg):
        pass

    def _on_doorbell_discovery_message(self, client, userdata, msg):
        if msg.payload and len(msg.payload) > 0:
            self._have_doorbell_config.set()

    def _on_door_discovery_message(self, client, userdata, msg):
        if msg.payload and len(msg.payload) > 0:
            self._have_door_config.set()


# Example usage
if __name__ == "__main__":
    ha = HomeAssistantDoorClient(
        mqtt_host="192.168.0.102",
        mqtt_port=1883,
        client_id="door-node-1",
        doorbell_device_class="sound",  # could also be "occupancy" if preferred
        doorbell_auto_off_secs=1.0,     # set 0 and configure off_delay in HA if desired
        username="pico",
        password="pico",
    )
    ha.start(clean_start=True, session_expiry_interval=0)
    ha.auto_discovery()
    # Initialize door closed
    ha.set_door_status(is_open=False)
    # Simulate doorbell press
    time.sleep(1.0)
    ha.publish_doorbell()
    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        ha.stop(set_offline=True)
