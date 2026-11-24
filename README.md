# tiny-stack-vm

A tiny stack VM for make.fun's tiny stack ISA v1: 32-bit wrapping integers,
a 256-value stack, a 64-deep call stack, 256 words of memory, byte I/O, and
traps 2–11.

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![repo](https://img.shields.io/badge/repo-tiny--stack--vm--01--v2-green)](https://github.com/tamadung/tiny-stack-vm-01-v2)

Run `node main.ts`: reads `/input/<id>/program.bin` + `input.bin`, writes
`/output/<id>/stdout.bin` + `exit.txt`. Node 22, no dependencies, MIT.
