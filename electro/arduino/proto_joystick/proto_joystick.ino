int Button = 2;

void setup() {
  Serial.begin(9600);
  pinMode(Button, INPUT_PULLUP); // D1 comme entrée avec résistance pull-up
}

void loop() {
  // Lecture des valeurs analogiques du joystick (0-1023)
  int axeX = analogRead(A0);
  int axeY = analogRead(A1);
  
  // Lecture du bouton digital (0 ou 1)
  int bouton = !digitalRead(Button);
  
  // Envoi au format CSV: X,Y,Bouton
  Serial.print(axeX);
  Serial.print(",");
  Serial.print(axeY);
  Serial.print(",");
  Serial.println(bouton);

  while(!digitalRead(Button)){
    delay(10);
  }
  
  delay(50); // 20 lectures par seconde
}
