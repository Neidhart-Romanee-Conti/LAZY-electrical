# LAZY Logo bridge

Runs a program you built in LAZY Logo against a real Siemens LOGO! 8 (0BA8 or newer) over Ethernet.

## How it works

The LOGO! keeps its own program running. This bridge:

1. reads the LOGO!'s physical inputs I1… from its variable memory (VB1024 onward),
2. runs your LAZY Logo program on the PC with the same logic as the browser simulator,
3. writes each output Qn as a bit into the LOGO!'s V memory (Q1 = V0.0, Q2 = V0.1 … by default).

A LOGO! does not let an outside client switch its physical Q outputs directly, so the LOGO! program has to pass those V bits through to its outputs (step 3 below).

## Setup

```
pip install python-snap7
```

**In LOGO!Soft Comfort (one time):**

1. *Tools → Ethernet Connections*: give the module an IP address on the same subnet as your PC.
2. Add a **server connection (S7)**: local TSAP `20.00`, remote TSAP `10.00`, and allow read/write access. Tick *Accept all connection requests* or enter the PC's IP.
3. In the program, add a **Network input** block per output, set to *local VM*, addresses V0.0, V0.1, … and wire each to the matching Q. Example: NI1 (V0.0) → Q1.
4. In *Settings → Access control*, enable access for S7/Modbus. Download the program to the LOGO!.

## Use

```
python bridge.py monitor --ip 192.168.0.3          # watch I and Q, changes nothing
python bridge.py dry program.json                  # test a program with no hardware
python bridge.py run program.json --ip 192.168.0.3 # run it for real
```

Options for `run`: `--out-base N` puts Q1 at VN.0 instead of V0.0. `--cycle 0.05` sets the scan time in seconds. If your TSAPs differ, pass `--local-tsap 0x1000 --remote-tsap 0x2000`.

Get `program.json` from the page with **Copy JSON** and paste it into a file. The included `program.json` is a sample (stair light, motor start/stop with overload, beacon, delayed contactor).

When you stop the bridge with Ctrl+C it sets all its V bits back to 0.

## Safety

The PC is now part of your control loop. If the PC, network or script stops, the V bits keep their last value until the bridge clears them. Do not use this for anything where a stuck output can hurt someone. Keep emergency stops and overload protection hard-wired, independent of the LOGO! program.

## Notes

- Address map used (LOGO! 8): I at VB1024–1031, Q at VB1064–1071, M at VB1104–1117. Bit 0 of VB1024 is I1.
- Inputs are read once per scan. A pulse shorter than the scan time (plus network delay, often 10–30 ms) can be missed.
- Timers run on the PC clock, so timing accuracy is a few tens of milliseconds, not the LOGO!'s own precision.
