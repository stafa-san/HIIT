/*
 * H.I.T.T. — reference serial output for the sideline gateway.
 *
 * This is NOT the production firmware; it shows the line format the
 * dashboard's USB gateway understands so the sensor and the app can be
 * integrated independently. Replace readImpactG() with the real sensor
 * reading + calibration.
 *
 * Wiring for this example: force-sensitive resistor on A0 (10k pull-down).
 * Open the dashboard in Chrome → Sensor gateway → Connect sensor (9600 baud).
 */

const char* SENSOR_ID = "HT-0137";   // printed on the housing; must match the app
const float TRIGGER_G = 10.0;        // ignore anything below this
const unsigned long QUIET_MS = 80;   // burst ends after this long below trigger

float readImpactG() {
  int raw = analogRead(A0);          // 0..1023
  // Placeholder calibration: map raw ADC to g. Replace with the bench-tested
  // curve for the real sensor/accelerometer.
  return raw * 0.12;
}

float burstPeak = 0;
unsigned long lastAbove = 0;

void setup() {
  Serial.begin(9600);
  Serial.println("# H.I.T.T. sensor ready");   // lines starting with # are logged, not parsed
}

void loop() {
  float g = readImpactG();
  unsigned long now = millis();

  if (g >= TRIGGER_G) {
    if (g > burstPeak) burstPeak = g;
    lastAbove = now;
  } else if (burstPeak > 0 && now - lastAbove > QUIET_MS) {
    // One line per impact. Any of these formats work:
    //   {"id":"HT-0137","g":96.2,"rot":5400}
    //   HT-0137,96.2,5400
    //   96.2            (bare number → the gateway's "default sensor")
    Serial.print("{\"id\":\"");
    Serial.print(SENSOR_ID);
    Serial.print("\",\"g\":");
    Serial.print(burstPeak, 1);
    Serial.println("}");
    burstPeak = 0;
  }
  delay(2);
}
