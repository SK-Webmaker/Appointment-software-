# Tests

```bash
./test/run.sh                        # everything
./test/run.sh kai-core-test.mjs      # one suite
```

Each suite spawns its own server, on its own port, with its own
`KAIRO_DATA_DIR`, and prints `N passed, N failed` as its last line. The runner
kills any stray server between suites — a stale process holding a port serves
the **old** code and quietly turns a regression run into a lie.

Browser suites need Playwright. It is a **dev** dependency and deliberately not
one of Kairo's — the product ships with none at all:

```bash
npm i --no-save playwright-core
```

Set `KAIRO_PW` to point at an existing install instead. Without it, those suites
say so and stand down rather than failing in a way that looks like a bug.

## Why these live in the repo

They did not, once. They lived in a session scratchpad, and when the container
that held them was reclaimed, **roughly two thousand checks across sixty suites
went with it** — every one of them written against a bug that had actually
happened. Coverage that is not committed is coverage you have until the next
time the machine restarts.

## How they are written

Every assertion says what an owner would notice, not what a function returns —
"Monday is closed", "nothing was actually booked", "the client looks picked but
is not" — because the point of a name is to tell whoever reads the failure what
broke for whoever was using it.

And every guarantee here has been **falsified**: the code was deliberately
broken and the suite re-run, to check it actually fails. A test that passes
against broken code is worse than no test, because it is a claim nobody will
re-check.
