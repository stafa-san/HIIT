# Sensor ↔ app contract

How a H.I.T.T. sensor gets impacts into the app. The firmware and the app can
be developed independently as long as both sides follow this page.

## Two ways in

| Path | When | How |
|---|---|---|
| **USB (Web Serial)** | Wired Arduino prototype, hackathon demo | Plug the board into a laptop running **Chrome or Edge**. Dashboard → cable icon (Sensor gateway) → **Connect sensor**. |
| **HTTP** | Wi-Fi boards (ESP32, Nano 33 IoT, UNO R4 WiFi) or a gateway script | `POST /api/ingest` with the ingest key. Requires Firebase mode. |

Either way the reading goes through the same `recordImpact` command as the
simulator, so levels, alerts and season stats behave identically.

## Serial line format (USB)

One reading per line, newline-terminated. Default **9600 baud** (115200 also
selectable). Any of these work:

```
{"id":"HT-0137","g":96.2,"rot":5400}      JSON — preferred
HT-0137,96.2,5400                         CSV: id, peak linear g, rotational rad/s² (optional)
id=HT-0137 g=96.2 rot=5400                key=value
96.2                                      bare number → the gateway's "default sensor"
Force: 512                                labelled number → also treated as bare
# anything                                comment, shown in the gateway log only
```

- **`g` is peak linear acceleration in g.** If the board only has raw ADC
  values, print them and set **Scale → g** in the gateway (e.g. `0.12`) until
  real calibration exists.
- **One line per impact or a continuous stream — both work.** The gateway
  treats samples ≥ the trigger (default 10 g) as a burst, keeps the peak, and
  closes the burst after 120 ms below trigger. One impact is recorded per burst
  with a 250 ms refractory window.
- **Sensor IDs** look like `HT-0137` (two letters, dash, four digits). An
  unknown ID is auto-registered as a spare — assign it in Sensor management.
- During **Install and verify → Run test tap**, bare readings are routed to the
  sensor being tested.

Reference sketch: [`hitt_serial_example/hitt_serial_example.ino`](hitt_serial_example/hitt_serial_example.ino).

## HTTP ingest

```bash
curl -X POST https://<your-app>.vercel.app/api/ingest \
  -H "Authorization: Bearer $HITT_INGEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sensorId":"HT-0137","linearG":96.2,"rotationalRadS2":5400}'
```

- Body: one reading, an array, or `{"readings":[…]}` (max 50). Field aliases:
  `sensorId|sensor|id`, `linearG|g|peak`, `rotationalRadS2|rot|rotational`,
  optional `at` (epoch ms).
- Response: `{"ok":true,"results":[{"sensorId":"HT-0137","kind":"recorded","impactId":"…","level":"alert"}]}`.
  `kind` is one of `recorded`, `test-tap`, `registered-unknown-sensor`,
  `unassigned-sensor`, `retired-sensor`.
- `GET /api/health` shows whether ingest is enabled.

## Thresholds

| Level | Default | Effect |
|---|---|---|
| Alert | ≥ 80 g | Red banner, phone alert (sound + vibration + notification), evaluation checklist |
| Watch | ≥ 60 g | Player flagged on the roster |
| Logged | below 60 g | Counted in session / season load |

Thresholds are editable from the dashboard header and apply to new impacts.
