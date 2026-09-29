# Contributing

Thanks for looking. Rubix is a personal project that I keep small on purpose,
and help is welcome — most of all in telling me what does not work.

## Bugs

Open a [bug report](https://github.com/lahvi13/rubix/issues/new?template=bug.yml).
The link on the app's About screen fills in the version for you; without it,
the version is at the bottom of that screen. Say which device and browser you
use and whether Rubix is installed or open in a tab — many bugs live in only one
of those.

No GitHub account? The e-mail address is on the About screen too.

## Ideas

Open an [idea](https://github.com/lahvi13/rubix/issues/new?template=idea.yml)
and describe what you are trying to do, not only the feature you have in mind.

Some things are left out deliberately and will stay out: accounts, a server,
cloud sync, analytics beyond counting page views, and ads. Everything happens on the device, and moving
data between devices is a file you export yourself.

## Pull requests

A small fix can go straight to a pull request. For anything bigger, open an
issue first so we agree on it before you spend the time.

The conventions are in [CLAUDE.md](CLAUDE.md) and the specification in
[SPEC.md](SPEC.md) — both in Czech. The parts that matter most:

- TypeScript strict, no `any`.
- Logic that can be tested without a DOM or a database lives in `src/domain/`
  and comes with table-driven tests.
- Every line of UI text goes into both `src/lib/strings/en.ts` and `cs.ts`.
- Times are whole milliseconds, never floats.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/),
  in English.

Before you open the pull request:

```sh
npm run lint
npm test
npm run build
```

By contributing you agree that your work is released under the project's
[GPL-3.0-or-later](LICENSE) license.

## Security

Please report a security problem privately through the repository's
**Security** tab (*Report a vulnerability*), not in a public issue.
