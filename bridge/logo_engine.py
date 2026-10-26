"""LAZY Logo program engine.

Runs a program exported from the LAZY Logo page (format "logoforge/1").
The block semantics match the page's simulator exactly, so what you test
in the browser is what runs here.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Callable

# --- block definitions ---------------------------------------------------
# Each entry: (number of inputs, default value for unconnected inputs, eval fn)
# eval fn signature: (ins: list[int], state: dict, params: dict, dt: float, ctx: Ctx) -> int


@dataclass
class Ctx:
    inputs: dict[int, int] = field(default_factory=dict)
    outputs: dict[int, int] = field(default_factory=dict)


def _i(a, s, p, dt, c):
    return 1 if c.inputs.get(int(p["n"])) else 0


def _q(a, s, p, dt, c):
    c.outputs[int(p["n"])] = a[0]
    return a[0]


def _m(a, s, p, dt, c):
    out = s.get("v", 0)
    s["next"] = a[0]
    return out


def _edge(a, s, p, dt, c):
    out = 1 if a[0] and not s.get("prev") else 0
    s["prev"] = a[0]
    return out


def _ton(a, s, p, dt, c):
    s["t"] = s.get("t", 0.0) + dt if a[0] else 0.0
    return 1 if s["t"] >= float(p["T"]) else 0


def _tof(a, s, p, dt, c):
    trg, r = a
    if r:
        s["on"], s["t"] = 0, 0.0
    elif trg:
        s["on"], s["t"] = 1, 0.0
    elif s.get("on"):
        s["t"] = s.get("t", 0.0) + dt
        if s["t"] >= float(p["T"]):
            s["on"] = 0
    return 1 if s.get("on") else 0


def _rs(a, s, p, dt, c):
    if a[1]:
        s["q"] = 0
    elif a[0]:
        s["q"] = 1
    return 1 if s.get("q") else 0


def _tgl(a, s, p, dt, c):
    trg, st, r = a
    edge = trg and not s.get("prev")
    s["prev"] = trg
    if r:
        s["q"] = 0
    elif st:
        s["q"] = 1
    elif edge:
        s["q"] = 0 if s.get("q") else 1
    return 1 if s.get("q") else 0


def _ctr(a, s, p, dt, c):
    r, cnt, d = a
    s.setdefault("c", 0)
    edge = cnt and not s.get("prev")
    s["prev"] = cnt
    if r:
        s["c"] = 0
    elif edge:
        s["c"] += -1 if d else 1
    s["c"] = max(0, s["c"])
    return 1 if s["c"] >= int(p["on"]) else 0


def _clk(a, s, p, dt, c):
    if not a[0]:
        s["t"] = 0.0
        return 0
    s["t"] = s.get("t", 0.0) + dt
    period = float(p["th"]) + float(p["tl"])
    return 1 if (s["t"] % period) < float(p["th"]) else 0


BLOCKS: dict[str, tuple[int, list[int], Callable]] = {
    "I": (0, [], _i),
    "Q": (1, [0], _q),
    "M": (1, [0], _m),
    "HI": (0, [], lambda *x: 1),
    "LO": (0, [], lambda *x: 0),
    "AND": (4, [1, 1, 1, 1], lambda a, *x: 1 if all(a) else 0),
    "NAND": (4, [1, 1, 1, 1], lambda a, *x: 0 if all(a) else 1),
    "OR": (4, [0, 0, 0, 0], lambda a, *x: 1 if any(a) else 0),
    "NOR": (4, [0, 0, 0, 0], lambda a, *x: 0 if any(a) else 1),
    "XOR": (2, [0, 0], lambda a, *x: 1 if a[0] ^ a[1] else 0),
    "NOT": (1, [0], lambda a, *x: 0 if a[0] else 1),
    "EDGE": (1, [0], _edge),
    "TON": (1, [0], _ton),
    "TOF": (2, [0, 0], _tof),
    "RS": (2, [0, 0], _rs),
    "TGL": (3, [0, 0, 0], _tgl),
    "CTR": (3, [0, 0, 0], _ctr),
    "CLK": (1, [1], _clk),
}


class Program:
    def __init__(self, data: dict):
        if not isinstance(data.get("blocks"), list) or not isinstance(data.get("wires"), list):
            raise ValueError("Not a LAZY Logo program: missing 'blocks' or 'wires'")
        self.blocks = {b["id"]: b for b in data["blocks"]}
        for b in self.blocks.values():
            if b["type"] not in BLOCKS:
                raise ValueError(f"Unknown block type {b['type']!r} in {b['id']}")
        self.src: dict[str, dict[int, str]] = {}
        for w in data["wires"]:
            self.src.setdefault(w["to"], {})[int(w["pin"])] = w["from"]
        self.state: dict[str, dict] = {bid: {} for bid in self.blocks}
        self.vals: dict[str, int] = {}
        self.ctx = Ctx()

    @classmethod
    def load(cls, path: str) -> "Program":
        with open(path, encoding="utf-8") as f:
            return cls(json.load(f))

    def used(self, kind: str) -> list[int]:
        return sorted({int(b["p"]["n"]) for b in self.blocks.values() if b["type"] == kind})

    def step(self, inputs: dict[int, int], dt: float) -> dict[int, int]:
        """Run one scan cycle. Returns {Q number: 0/1}."""
        self.ctx.inputs = inputs
        self.ctx.outputs = {}
        cur: dict[str, int] = {}
        visiting: set[str] = set()

        def val(bid: str) -> int:
            if bid in cur:
                return cur[bid]
            if bid in visiting:  # feedback loop: use last cycle's value
                return self.vals.get(bid, 0)
            visiting.add(bid)
            b = self.blocks[bid]
            n_in, dflt, fn = BLOCKS[b["type"]]
            src = self.src.get(bid, {})
            ins = [val(src[i]) if i in src else dflt[i] for i in range(n_in)]
            cur[bid] = 1 if fn(ins, self.state[bid], b["p"], dt, self.ctx) else 0
            return cur[bid]

        for bid in self.blocks:
            val(bid)
        for bid, b in self.blocks.items():
            if b["type"] == "M":
                self.state[bid]["v"] = self.state[bid].get("next", 0)
        self.vals = cur
        return dict(self.ctx.outputs)
