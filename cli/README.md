# jobhunt

The command line for [JobHunt](https://jobhunt.app). Sign in once in your browser, then read where
your job search stands, see your recent activity and save a posting from a terminal, a script or a
desktop plugin. It uses the same account, permissions and data as the website and your AI assistant.

## Install

```sh
npm install --global jobhunt
jobhunt --version
```

Needs Node.js 22.23.3 or newer and a JobHunt account.

## Sign in

```sh
jobhunt auth login
```

Your browser opens JobHunt's approval screen and lists what the command line may do. Approve it and
the command finishes; there is nothing to copy or type. It waits five minutes for you. No password is
typed into the terminal. The connection is kept in your operating system's credential store
(Keychain, Credential Manager or Secret Service); where there is none, in a file only you can read.
Sign out, and revoke the connection, with `jobhunt auth logout`. `--preset read-only|standard|full` picks a preset (the default is standard, which can save tasks, contacts, interview rounds, documents and highlights as well as applications), and `--scopes` replaces the permissions it
asks for.

## Everyday commands

| Command | What it does |
| --- | --- |
| `jobhunt status` | `{"signed_in": true}` or `false`. Nothing else, no name or email. |
| `jobhunt overview` | Where your search stands: stages, tasks, interviews, jobs in Applied. |
| `jobhunt activity [--days N]` | The actions you recorded each day, for a contribution graph. |
| `jobhunt jobs save URL` | Saves a posting link to To Apply, as your assistant would. |

Add `--json` for one compact line of JSON; scripts and plugins should always use it. On success the
exit code is `0` and nothing is written to stderr. On failure stdout is empty, stderr has one line,
`{"error": {"code": "…", "status": N}}`, and the exit code says why:

| Exit | Meaning |
| --- | --- |
| `2` | The command was used wrongly or an input is not valid. |
| `3` | You are not signed in, or the connection was refused. Run `jobhunt auth login`. |
| `4` | The connection lacks a permission. Sign in again with the permissions above. |
| `5` | A conflict. |
| `6` | Too many requests; wait and retry. |
| `7` | JobHunt could not be reached or answered badly. |
| `8` | Not found. |

The commands never prompt, never use colour, and renew the connection quietly, so they are safe to
call every few minutes from a status bar.

## Everything else

`jobhunt --help` lists every command: applications, contacts, tasks, documents, exports and more.
Each reads and writes only what the connection's permissions allow, and a command that deletes
something says so and asks for the exact name before it does.

## Privacy

`jobhunt overview` includes your name and the jobs you track. Treat its output as private. The CLI
sends requests only to `https://jobhunt.app` (or the `--origin` you give it), never follows a
redirect with your connection, and writes no logs.

## Licence

MIT. See `LICENSE` in the package.
