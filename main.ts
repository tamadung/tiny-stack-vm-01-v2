import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Tiny stack VM for make.fun's tiny stack ISA v1.
const MAX_STEPS = 1000000;
const MAX_OUT = 65536;

const META: Record<number, [number, number, number]> = {
  0x00: [0, 0, 0], 0x01: [1, 0, 1], 0x02: [4, 0, 1], 0x03: [0, 1, 0],
  0x04: [0, 1, 2], 0x05: [0, 2, 2], 0x06: [0, 2, 3], 0x07: [0, 3, 3],
  0x10: [0, 2, 1], 0x11: [0, 2, 1], 0x12: [0, 2, 1], 0x13: [0, 2, 1],
  0x14: [0, 2, 1], 0x15: [0, 2, 1], 0x16: [0, 2, 1], 0x17: [0, 1, 1],
  0x18: [0, 2, 1], 0x19: [0, 2, 1], 0x1a: [0, 2, 1], 0x1b: [0, 1, 1],
  0x1c: [0, 2, 1], 0x1d: [0, 2, 1], 0x1e: [0, 2, 1], 0x20: [0, 2, 1],
  0x21: [0, 2, 1], 0x22: [0, 2, 1], 0x30: [2, 0, 0], 0x31: [2, 1, 0],
  0x32: [2, 1, 0], 0x33: [2, 0, 0], 0x34: [0, 0, 0], 0x40: [0, 1, 1],
  0x41: [0, 2, 0], 0x50: [0, 1, 0], 0x51: [0, 1, 0], 0x52: [0, 0, 1],
  0x53: [0, 1, 0],
};

class Trap extends Error {
  code: number;
  constructor(code: number) {
    super("trap " + code);
    this.code = code;
  }
}

function run(prog: Buffer, input: Buffer): { out: Buffer; code: number } {
  const mem = new Int32Array(256);
  const stack = new Int32Array(256);
  const calls = new Int32Array(64);
  const out = new Uint8Array(MAX_OUT);
  let sp = 0, cp = 0, pc = 0, ip = 0, steps = 0, used = 0;
  const finish = (code: number) => ({ out: Buffer.from(out.subarray(0, used)), code });
  const emit = (bytes: Uint8Array) => {
    if (used + bytes.length > MAX_OUT) throw new Trap(11);
    out.set(bytes, used);
    used += bytes.length;
  };
  const printNum = (v: number) => {
    const s = String(v);
    if (used + s.length > MAX_OUT) throw new Trap(11);
    for (let i = 0; i < s.length; i++) out[used++] = s.charCodeAt(i);
  };
  try {
    for (;;) {
      if (steps >= MAX_STEPS) throw new Trap(10);
      if (pc < 0 || pc >= prog.length) throw new Trap(9);
      const op = prog[pc];
      const meta = META[op];
      if (!meta) throw new Trap(5);
      if (pc + 1 + meta[0] > prog.length) throw new Trap(9);
      steps++;
      if (sp < meta[1]) throw new Trap(2);
      if (sp - meta[1] + meta[2] > 256) throw new Trap(3);
      const next = pc + 1 + meta[0];
      const imm16 = prog[pc + 1] | (prog[pc + 2] << 8);
      const off = imm16 >= 32768 ? imm16 - 65536 : imm16;
      switch (op) {
        case 0x00: return finish(0);
        case 0x01: { const b = prog[pc + 1]; stack[sp++] = b < 128 ? b : b - 256; break; }
        case 0x02: stack[sp++] = prog[pc + 1] | (prog[pc + 2] << 8) | (prog[pc + 3] << 16) | (prog[pc + 4] << 24); break;
        case 0x03: sp--; break;
        case 0x04: stack[sp] = stack[sp - 1]; sp++; break;
        case 0x05: { const t = stack[sp - 1]; stack[sp - 1] = stack[sp - 2]; stack[sp - 2] = t; break; }
        case 0x06: stack[sp] = stack[sp - 2]; sp++; break;
        case 0x07: { const a = stack[sp - 3]; stack[sp - 3] = stack[sp - 2]; stack[sp - 2] = stack[sp - 1]; stack[sp - 1] = a; break; }
        case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
        case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
        case 0x20: case 0x21: case 0x22: {
          const b = stack[--sp], a = stack[--sp];
          let r = 0;
          if (op === 0x10) r = (a + b) | 0;
          else if (op === 0x11) r = (a - b) | 0;
          else if (op === 0x12) r = Math.imul(a, b);
          else if (op === 0x13) { if (b === 0) throw new Trap(4); r = (a / b) | 0; }
          else if (op === 0x14) { if (b === 0) throw new Trap(4); r = a % b; }
          else if (op === 0x15) { if (b === 0) throw new Trap(4); r = Math.floor((a >>> 0) / (b >>> 0)); }
          else if (op === 0x16) { if (b === 0) throw new Trap(4); r = (a >>> 0) % (b >>> 0); }
          else if (op === 0x18) r = a & b;
          else if (op === 0x19) r = a | b;
          else if (op === 0x1a) r = a ^ b;
          else if (op === 0x1c) r = a << (b & 31);
          else if (op === 0x1d) r = a >> (b & 31);
          else if (op === 0x1e) r = a >>> (b & 31);
          else if (op === 0x20) r = a === b ? 1 : 0;
          else if (op === 0x21) r = a < b ? 1 : 0;
          else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
          stack[sp++] = r;
          break;
        }
        case 0x17: stack[sp - 1] = -stack[sp - 1]; break;
        case 0x1b: stack[sp - 1] = ~stack[sp - 1]; break;
        case 0x30: pc = next + off; continue;
        case 0x31: if (stack[--sp] === 0) { pc = next + off; continue; } break;
        case 0x32: if (stack[--sp] !== 0) { pc = next + off; continue; } break;
        case 0x33: if (cp >= 64) throw new Trap(7); calls[cp++] = next; pc = imm16; continue;
        case 0x34: if (cp === 0) throw new Trap(8); pc = calls[--cp]; continue;
        case 0x40: { const addr = stack[--sp]; if (addr < 0 || addr > 255) throw new Trap(6); stack[sp++] = mem[addr]; break; }
        case 0x41: { const addr = stack[--sp], v = stack[--sp]; if (addr < 0 || addr > 255) throw new Trap(6); mem[addr] = v; break; }
        case 0x50: printNum(stack[--sp]); break;
        case 0x51: emit(Uint8Array.of(stack[--sp] & 255)); break;
        case 0x52: stack[sp++] = ip < input.length ? input[ip++] : -1; break;
        case 0x53: return finish(stack[--sp] & 255);
      }
      pc = next;
    }
  } catch (e) {
    if (e instanceof Trap) return finish(e.code);
    throw e;
  }
}

function main(): void {
  const inDir = process.argv[2] ?? "/input";
  const outDir = process.argv[3] ?? "/output";
  for (const id of readdirSync(inDir).sort()) {
    const dir = join(inDir, id);
    let prog: Buffer;
    try { prog = readFileSync(join(dir, "program.bin")); } catch { continue; }
    let input: Buffer;
    try { input = readFileSync(join(dir, "input.bin")); } catch { input = Buffer.alloc(0); }
    const result = run(prog, input);
    const od = join(outDir, id);
    mkdirSync(od, { recursive: true });
    writeFileSync(join(od, "stdout.bin"), result.out);
    writeFileSync(join(od, "exit.txt"), String(result.code) + "\n");
  }
}

main();
