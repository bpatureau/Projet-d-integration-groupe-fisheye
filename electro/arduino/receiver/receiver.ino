#include <ESP8266WiFi.h>
#include <espnow.h>

#define LED_MASTER D3           // Active LOW
#define BUTTON_MASTER D2        // Bouton (pull-up interne)


//1 -> faire sonner + duration
//2 -> arretr faire sonner
//3 -> porte ouverte
//4 -> porte fermer
//5 -> ack
//6 -> error

// ──────────────────────────────────────────
//     Structure des messages ESP-NOW
// ──────────────────────────────────────────
typedef struct {
    uint8_t cmd;
    uint8_t arg;
} message_t;

uint8_t slaveAddr[] = {0xE8, 0x68, 0xE7, 0xD8, 0xEA, 0x0F};

unsigned long ledOffTime = 0;  // Timestamp pour extinction auto
bool ledAutoOff = false;       // Flag pour extinction automatique

int led_time = 0;
bool lastButtonState;

// ──────────────────────────────────────────
//         Réception d'un message
// ──────────────────────────────────────────
void onReceive(uint8_t *mac, uint8_t *data, uint8_t len) {
    if (len != sizeof(message_t)) return;

    message_t msg;
    message_t ack;
    memcpy(&msg, data, sizeof(msg));

    Serial.print("DEBUG CMD ");
    Serial.println(msg.cmd);

    bool buttonPressed = digitalRead(BUTTON_MASTER);

    if (buttonPressed && msg.cmd == 1) {
        Serial.println("MASTER : porte ouverte → sonette interdite");

        // Envoi ACK
        ack.cmd = 5;
        ack.arg = 0;

        esp_now_send(slaveAddr, (uint8_t*)&ack, sizeof(ack));
        return;
    }

    if (!buttonPressed && msg.cmd == 1 && msg.arg > 0) {

      Serial.println("DEBUG CMD 1 AND BUTTON PRESSED");



      digitalWrite(LED_MASTER, HIGH);

      led_time = msg.arg * 1000;

        ack.cmd = 5;
        ack.arg = 0;

        esp_now_send(slaveAddr, (uint8_t*)&ack, sizeof(ack));
        return;
    }
  

    if (msg.cmd == 2){
      Serial.println("DEBUG CMD 2");
      led_time = 0;

      // Envoi ACK
        ack.cmd = 5;
        ack.arg = 0;

        esp_now_send(slaveAddr, (uint8_t*)&ack, sizeof(ack));
        return;
    }

    // ACK normal
    ack.cmd = 6;
    ack.arg = 0;
    esp_now_send(slaveAddr, (uint8_t*)&ack, sizeof(ack));
}


// ──────────────────────────────────────────
//   Envoi état bouton au SLAVE (avec retry)
// ──────────────────────────────────────────
void sendButtonStatus(bool pressed) {


    message_t msg;

    if(pressed){
      msg.cmd = 3;  
      msg.arg = 0; 
    }

    else{
      msg.cmd = 4;  
      msg.arg = 0; 
    }
    


    esp_now_send(slaveAddr, (uint8_t*)&msg, sizeof(msg));


    Serial.print("État bouton envoyé au SLAVE : ");
    Serial.println(pressed ? "RELACHE" : "PRESSE");
}

void setup() {
    Serial.begin(115200);
    delay(100);

    // Configuration LED en premier et extinction immédiate
    pinMode(LED_MASTER, OUTPUT);
    digitalWrite(LED_MASTER, LOW);

    pinMode(BUTTON_MASTER, INPUT_PULLUP);
    
    Serial.println("LED MASTER initialisée : ÉTEINTE");

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    if (esp_now_init() != 0) {
        Serial.println("MASTER : Erreur ESP-NOW");
        digitalWrite(LED_MASTER, HIGH);
        delay(500);
        digitalWrite(LED_MASTER, LOW);
        return;
    }

    esp_now_set_self_role(ESP_NOW_ROLE_COMBO);
    esp_now_add_peer(slaveAddr, ESP_NOW_ROLE_COMBO, 1, NULL, 0);
    esp_now_register_recv_cb(onReceive);

    lastButtonState = digitalRead(BUTTON_MASTER);

    Serial.println("MASTER prêt !");
}

void loop() {
    // Gestion extinction automatique
    //if (ledAutoOff && millis() >= ledOffTime) {
    //    digitalWrite(LED_MASTER, HIGH);
    //    ledAutoOff = false;
    //    Serial.println("MASTER : Extinction automatique");
    //}

    // Détection état bouton
    
    bool currentButtonState = digitalRead(BUTTON_MASTER);

    if (currentButtonState != lastButtonState) {
        delay(50); // Debounce
        if (currentButtonState == HIGH) {
            Serial.println("MASTER : Bouton PRESSÉ");
            sendButtonStatus(true);
        } 
        else {
            Serial.println("MASTER : Bouton RELÂCHÉ");
            sendButtonStatus(false);
        }

          lastButtonState = currentButtonState;
    }

    //Serial.print("DEDUG led_time=");
    //Serial.println(led_time);
  
    if(led_time == 0){
      digitalWrite(LED_MASTER, LOW);
    }
    if(currentButtonState){
      //digitalWrite(LED_MASTER, LOW);
      led_time = 0;
    }

    led_time -= 10;
    if (led_time < 0){
      led_time=0;
    }
    delay(10);
}
