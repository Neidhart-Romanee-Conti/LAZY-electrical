#!/usr/bin/env python3
"""LAZY Logo bridge: run a LAZY Logo program against a real Siemens LOGO! 8.

Modes
  monitor   Show the LOGO!'s own inputs I1.. and outputs Q1.. live.
  run       Execute program.json on this PC: read the LOGO!'s physical inputs,
            compute the program, write the results into the LOGO!'s V memory.
  dry       Execute program.json with no hardware. Type input changes on stdin.

Examples
  python bridge.py monitor --ip 192.168.0.3
  python bridge.py run program.json --ip 192.168.0.3 --out-base 0
  python bridge.py dry program.json
"""
from __future__ import annotations

import argparse
import sys
import threading
import time

from logo_engine import Program

# LOGO! 8 (0BA8) variable-memory map, read-only process image areas.
VM_I = 1024   # I1..I64 -> VB1024..VB1031, I1 = bit 0 of VB1024
VM_Q = 1064   # Q1..Q64 -> VB1064..VB1071
VM_M = 1104   # M1..     -> VB1104..


def bit_addr(base: int, n: int) -> str:
    """Address of the n-th (1-based) bit starting at byte `base`, e.g. V1024.0."""
    return f"V{base + (n - 1) // 8}.{(n - 1) % 8}"


def read_bits(plc, base: int, count: int) -> dict[int, int]:
    """Read `count` bits starting at VB`base`, one byte request per 8 bits."""
    out: dict[int, int] = {}
    for byte in range((count + 7) // 8):
        v = int(plc.read(f"V{base + byte}")) & 0xFF
        for b in range(8):
            n = byte * 8 + b + 1
            if n <= count:
                out[n] = (v >> b) & 1
    return out


def connect(args):
    try:
        from snap7.logo import Logo
    except ImportError:
        sys.exit("python-snap7 is not installed. Run:  pip install python-snap7")
    plc = Logo()
    try:
        plc.connect(args.ip, args.local_tsap, args.remote_tsap)
    except Exception as e:  # snap7 raises RuntimeError with a short message
        sys.exit(
            f"Could not connect to LOGO! at {args.ip}: {e}\n"
            "Check the IP address, that the PC and LOGO! are on the same subnet, "
            "and that a server connection with matching TSAPs is configured "
            "(see README)."
        )
    print(f"Connected to LOGO! at {args.ip}")
    return plc


def fmt(bits: dict[int, int], prefix: str) -> str:
    return " ".join(f"{prefix}{n}:{'■' if v else '·'}" for n, v in sorted(bits.items()))


def cmd_monitor(args):
    plc = connect(args)
    try:
        while True:
            i = read_bits(plc, VM_I, args.inputs)
            q = read_bits(plc, VM_Q, args.outputs)
            print(f"\r{fmt(i, 'I')}  |  {fmt(q, 'Q')}   ", end="", flush=True)
            time.sleep(args.cycle)
    except KeyboardInterrupt:
        print()
    finally:
        plc.disconnect()


def run_loop(prog: Program, get_inputs, put_outputs, cycle: float, quiet: bool):
    last = time.monotonic()
    shown = None
    try:
        while True:
            now = time.monotonic()
            dt, last = now - last, now
            ins = get_inputs()
            outs = prog.step(ins, dt)
            put_outputs(outs)
            line = f"{fmt(ins, 'I')}  ->  {fmt(outs, 'Q')}"
            if not quiet and line != shown:
                print(line, flush=True)
                shown = line
            time.sleep(max(0.0, cycle - (time.monotonic() - now)))
    except KeyboardInterrupt:
        print("\nStopped.")


def cmd_run(args):
    prog = Program.load(args.program)
    used_i, used_q = prog.used("I"), prog.used("Q")
    print(f"Program: {len(prog.blocks)} blocks, inputs {used_i or '-'}, outputs {used_q or '-'}")
    for n in used_q:
        print(f"  Q{n} -> {bit_addr(args.out_base, n)}")
    plc = connect(args)
    n_in = max(used_i or [1])
    last_written: dict[int, int] = {}

    def get_inputs():
        return read_bits(plc, VM_I, n_in)

    def put_outputs(outs):
        for n in used_q:
            v = outs.get(n, 0)
            if last_written.get(n) != v:
                plc.write(bit_addr(args.out_base, n), v)
                last_written[n] = v

    try:
        run_loop(prog, get_inputs, put_outputs, args.cycle, args.quiet)
    finally:
        # Leave the hand-over bits off so the LOGO! falls back to a safe state.
        for n in used_q:
            try:
                plc.write(bit_addr(args.out_base, n), 0)
            except Exception:
                pass
        plc.disconnect()
        print("Output bits cleared, disconnected.")


def cmd_dry(args):
    prog = Program.load(args.program)
    inputs: dict[int, int] = {n: 0 for n in prog.used("I")}
    lock = threading.Lock()
    print("Dry run. Type e.g. '1' to toggle I1, '1 on' / '1 off' to set it, 'q' to quit.")

    def reader():
        for line in sys.stdin:
            parts = line.strip().lower().split()
            if not parts:
                continue
            if parts[0] in ("q", "quit", "exit"):
                import os
                os._exit(0)
            try:
                n = int(parts[0].lstrip("i"))
            except ValueError:
                print("Enter an input number, like 2 or 'i2 on'.")
                continue
            with lock:
                if len(parts) > 1:
                    inputs[n] = 1 if parts[1] in ("1", "on", "true") else 0
                else:
                    inputs[n] = 0 if inputs.get(n) else 1

    threading.Thread(target=reader, daemon=True).start()

    def get_inputs():
        with lock:
            return dict(inputs)

    run_loop(prog, get_inputs, lambda o: None, args.cycle, args.quiet)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="mode", required=True)

    def net(p):
        p.add_argument("--ip", required=True, help="IP address of the LOGO! module")
        p.add_argument("--local-tsap", type=lambda s: int(s, 0), default=0x1000,
                       help="TSAP of this PC (default 0x1000 = 10.00)")
        p.add_argument("--remote-tsap", type=lambda s: int(s, 0), default=0x2000,
                       help="TSAP of the LOGO! (default 0x2000 = 20.00)")

    m = sub.add_parser("monitor", help="show the LOGO!'s inputs and outputs")
    net(m)
    m.add_argument("--inputs", type=int, default=8)
    m.add_argument("--outputs", type=int, default=4)
    m.add_argument("--cycle", type=float, default=0.2)

    r = sub.add_parser("run", help="run program.json against a real LOGO!")
    r.add_argument("program")
    net(r)
    r.add_argument("--out-base", type=int, default=0,
                   help="V byte where Q1 is written; Q1 = V<base>.0, Q2 = V<base>.1 ... (default 0)")
    r.add_argument("--cycle", type=float, default=0.05, help="scan time in seconds (default 0.05)")
    r.add_argument("--quiet", action="store_true")

    d = sub.add_parser("dry", help="run program.json without hardware")
    d.add_argument("program")
    d.add_argument("--cycle", type=float, default=0.05)
    d.add_argument("--quiet", action="store_true")

    args = ap.parse_args()
    {"monitor": cmd_monitor, "run": cmd_run, "dry": cmd_dry}[args.mode](args)


if __name__ == "__main__":
    main()
