#include <ESP8266WiFi.h>
#include <espnow.h>

//1 -> faire sonner + duration
//2 -> arretr faire sonner
//3 -> porte ouverte
//4 -> porte fermer
//5 -> ack
//6 -> error


// ──────────────────────────────────────────
//  Structure envoyée au MASTER
// ──────────────────────────────────────────
typedef struct {
    uint8_t cmd;
    uint8_t arg;
} message_t;

uint8_t masterAddr[] = {0xA4, 0xCF, 0x12, 0xEA, 0x72, 0xE7};


// ──────────────────────────────────────────
//         Réception ACK MASTER
// ──────────────────────────────────────────
void onReceive(uint8_t *mac, uint8_t *data, uint8_t len) {
    if (len != sizeof(message_t)) return;

    message_t msg;
    memcpy(&msg, data, sizeof(msg));

    // Si c'est un message d'état du bouton
    if (msg.cmd == 3) {
        Serial.println("DOOR OPEN");
        return;
    }

    if (msg.cmd == 4) {
        Serial.println("DOOR CLOSE");
        return;
    }

    Serial.printf("ACK %d %d\n", msg.cmd, msg.arg);

}

// ──────────────────────────────────────────
//     Envoi avec retry ×5 + attente ACK
// ──────────────────────────────────────────
void sendCommand(uint8_t cmd, uint8_t arg) {
    message_t msg;
    msg.cmd = cmd;
    msg.arg = arg;

    esp_now_send(masterAddr, (uint8_t*)&msg, sizeof(msg));
    delay(250);

}

// ──────────────────────────────────────────
//            SETUP
// ──────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(100);

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    if (esp_now_init() != 0) {
        Serial.println("ESP ERROR");
        return;
    }

    esp_now_set_self_role(ESP_NOW_ROLE_COMBO);
    esp_now_add_peer(masterAddr, ESP_NOW_ROLE_COMBO, 1, NULL, 0);
    esp_now_register_recv_cb(onReceive);

    Serial.println("ESP READY");
}

// ──────────────────────────────────────────
//            LOOP — Analyse Série
// ──────────────────────────────────────────
void loop() {

    if (Serial.available()) {

        String input = Serial.readStringUntil('\n');

        Serial.print("DEBUG ");
        Serial.println(input);

        input.trim();

        // ─────────── ALLUMAGE AVEC DURÉE ───────────
        if (input.startsWith("TURN_ON")) {
            Serial.println("DEBUG CMD 1");

            int arg = 0;

            if (input.indexOf('(') > 0) {
                arg = input.substring(input.indexOf('(')+1, input.indexOf(')')).toInt();

                sendCommand(1, arg);
            }
            else{
              Serial.println("MISSING ARG");
            }

        }

        // ─────────── EXTINCTION SIMPLE ───────────
        else if (input == "TURN_OFF") {
            Serial.println("DEBUG CMD 2");
            sendCommand(2, 0);
        }


        else {
            Serial.println("UNKN CMD");
        }
    }

    delay(10);
}