# Plugin contract: `jobhunt status`, `overview`, `activity`, `jobs save`

For desktop plugins, status bars and scripts that read a person's JobHunt search from the command
line. Everything here is stable: a change to a field name or meaning is a major version of the
package, and `tests/plugin.test.ts` fails if the output or this file drifts. The examples below
are made-up data in the real shapes; the same files are in `plugin-fixtures/` for building against.

## The rules every command follows

- **Success:** one line of JSON on stdout, ending in a newline, and exit code `0`. Nothing on stderr.
- **Failure:** nothing on stdout, one line of JSON on stderr, and a non-zero exit code.
  `{"error": {"code": "…", "status": N}}` always has `code` and `status` (`0` when no HTTP answer
  arrived). It may also have `request_id`, `retry_after_seconds` and, for a refusal the service
  explains, `message`, one sentence written for a person. It never contains a credential or the request.
- **Exit codes:** `2` the command was used wrongly or an input is not valid; `3` not signed in or the
  connection was refused; `4` the connection lacks a permission; `5` a conflict; `6` rate limited
  (`retry_after_seconds` says when); `7` the service could not be reached or answered badly;
  `8` not found. A signed-out person is `3` for `overview`, `activity` and `jobs save`, and a normal
  answer (`{"signed_in": false}`, exit `0`) for `status`.
- No prompts, no colour, no terminal control codes. Only `auth login` opens a browser.
- Safe to call every few minutes. The access token is renewed silently when it is about to expire;
  the commands never ask the person anything. Call `status` or `overview` no more than once a minute.
- Always `--json`. Without it the same data is printed indented for reading.
- The service is `https://jobhunt.app` unless `--origin` says otherwise (`--allow-loopback` for a local app).

## Signing in: one command, no flags

```sh
jobhunt auth login
```

That is the whole integration. It asks for the standard integration permissions (the ten below, one
write: saving a link), opens the person's default browser on JobHunt's approval screen, and waits. The
person approves in the browser; the command saves the connection and exits `0`. `--scopes a,b,c`
replaces the set; nothing else is needed.

- **Safe from a GUI process.** It never prompts, never reads stdin and does not need a terminal. The
  browser is opened with the platform's own opener (`xdg-open`, `open`, `rundll32`), detached, so a
  plugin may start it from a button and wait for it to finish. Run it with `--json`.
- **Exit codes:** `0` the connection is saved. `3` the person declined (`authorization_denied`), nobody
  approved within **5 minutes** (`authorization_timeout`), or the connection was refused; `2` a
  `--scopes` value is not valid; `7` JobHunt could not be reached. On failure stdout is empty and
  stderr has the usual one-line `{"error": …}`.
- **Why it failed.** After the person approves, each step that can fail has its own `code`, and
  `message` is one sentence that names the step and never holds a credential:
  `granted_scope_mismatch` (exit `3`; the permissions granted differ from the ones asked for, and the
  message lists which were not granted), `invalid_token_response` (`3`; the token answer was malformed:
  the message names the field), `account_check_failed` (`7`, or the HTTP status's code; JobHunt issued
  the connection but checking it against the account failed), `credential_store_unavailable` (`3`;
  the message says whether the store could not be opened, refused the write or returned something
  else). The connection that was issued is revoked in each case, so nothing is left half-signed-in.
- **stdout on success** is one line, below: no name and no email. **stderr** starts with two lines
  (the words `Authorize JobHunt in your browser:` and then the approval link on a line of its own), so a
  plugin can show the link if no browser opened; the approval can be finished in any browser on this
  computer. On failure the two lines come first and the one-line `{"error": …}` follows them.
- **What the person sees.** The approval screen names the app as "an app on this computer that calls
  itself “JobHunt CLI”", states that it returns to this computer, and lists the permissions. It does
  not claim a verified identity.
- The access token and its renewal token go to the operating system's credential store (Keychain,
  Credential Manager, Secret Service); where none is available, to a file only the person can read, in
  `~/.config/jobhunt/cli` (`~/Library/Application Support/JobHunt/cli` on macOS, `%LOCALAPPDATA%\JobHunt\cli`
  on Windows). Signing in again replaces and revokes the earlier connection. `jobhunt auth logout`
  removes it and revokes it at JobHunt. The person can also end it in JobHunt's Connect Agent panel.
- Use `status` first: sign in only when it says `{"signed_in": false}`.

The ten permissions: `read:profile, read:applications, write:applications, read:campaigns, read:companies, read:contacts, read:documents, read:interviews, read:tasks, read:analytics`.

<!-- fixture: login-success.json -->
```json
{
  "authenticated": true,
  "origin": "https://jobhunt.app",
  "profile": "default",
  "account_id": "00000000-0000-4000-8000-000000000001",
  "scopes": [
    "read:profile",
    "read:applications",
    "write:applications",
    "read:campaigns",
    "read:companies",
    "read:contacts",
    "read:documents",
    "read:interviews",
    "read:tasks",
    "read:analytics"
  ],
  "storage": "keyring"
}
```

## `jobhunt status --json`

`{"signed_in": true|false}` and nothing else: no name, no email. It makes one small request to check
that the saved connection is still accepted. A revoked or expired connection is `false`, not an error.
An unreachable service is an error (exit `7`), so a plugin can tell "signed out" from "offline".

<!-- fixture: status-signed-in.json -->
```json
{
  "signed_in": true
}
```

<!-- fixture: status-signed-out.json -->
```json
{
  "signed_in": false
}
```

## `jobhunt overview --json`

Exactly the structured result of the `get_overview` tool at `https://jobhunt.app/mcp`, which the
command calls with the same token: the same fields, the same vocabulary. Read the tool's own
description for every field. What matters to a plugin:

- `today` is a calendar day and `time_zone` its zone, both the person's. `*_on`, `due` and `today`
  are days in that zone; `*_at` are UTC instants; `*_days` are whole days from that day to `today`.
- `total` on a list is how many exist; the list may hold fewer. `0` means none. A missing or `null`
  field means nothing is recorded, not zero.
- `setup` lists what the account still lacks (`[]` when nothing); `setup_complete: false` means a
  fact could not be read with this connection.
- `access.kind` is `free`, `trial`, `subscribed`, `read_only` or `review`; for a `trial`, `ends_on`
  and `days_left` say when it ends. Show them as facts, never as a warning.
- It contains the person's name and job titles. Do not write it to logs.
- A field this connection has no permission for is left out or marked in `not_included`.

<!-- fixture: overview.json -->
```json
{
  "ok": true,
  "today": "2026-11-18",
  "time_zone": "America/Los_Angeles",
  "time_zone_saved": true,
  "account": {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Sample Person"
  },
  "setup": [],
  "setup_complete": true,
  "access": {
    "kind": "trial",
    "ends_at": "2026-11-25T08:00:00Z",
    "ends_on": "2026-11-25",
    "days_left": 7,
    "next": "On 2026-11-25 the account becomes read-only: saved work can still be viewed and exported, and changes need a subscription, described at https://jobhunt.example/pricing; mention this only when the person asks about cost or access, or once when 3 days or fewer remain."
  },
  "hunt": {
    "id": "sample-hunt",
    "name": "Sample Hunt",
    "status": "active"
  },
  "stages": [
    {
      "name": "To Apply",
      "type": "saved",
      "jobs": 3,
      "final": false
    },
    {
      "name": "Applied",
      "type": "applied",
      "jobs": 2,
      "final": false
    },
    {
      "name": "Interview",
      "type": "interview",
      "jobs": 1,
      "final": false
    }
  ],
  "jobs_total": 6,
  "tasks": {
    "overdue": [
      {
        "id": "00000000-0000-4000-8000-0000000000a1",
        "title": "Send a thank-you note",
        "due": "2026-11-16",
        "job_id": null,
        "due_days": 2
      }
    ],
    "due_in_next_7_days": [
      {
        "id": "00000000-0000-4000-8000-0000000000a2",
        "title": "Update the sample resume",
        "due": "2026-11-20",
        "job_id": null,
        "due_in_days": 2
      }
    ],
    "complete": true
  },
  "interviews": {
    "rounds": [
      {
        "round": "Phone screen",
        "scheduled_at": "2026-11-19T17:00:00Z",
        "on": "2026-11-19",
        "company": "Example Co",
        "title": "Sample Engineer"
      }
    ],
    "total": 1
  },
  "applied": {
    "jobs": [
      {
        "company": "Example Co",
        "title": "Sample Engineer",
        "stage_days": 4
      }
    ],
    "total": 2
  },
  "offers": {
    "jobs": [],
    "total": 0
  },
  "reading_link": {
    "jobs": [],
    "total": 0
  },
  "covers": "Stage counts; tasks overdue or due by 2026-11-25; interviews 2026-11-18 to 2026-11-25; Applied and offer jobs, longest in stage first; links being read. Only what JobHunt recorded: email and calendars are not read, so nothing recorded is not the same as nothing happened.",
  "not_included": {
    "tasks with no due date": "list_tasks",
    "contacts and conversations": "list_contacts",
    "documents": "list_documents",
    "jobs in other stages": "list_jobs"
  },
  "resume": {
    "id": "00000000-0000-4000-8000-0000000000b1",
    "name": "Sample resume"
  },
  "missing": [],
  "website_url": "https://jobhunt.example/app"
}
```

## `jobhunt activity --json [--days N] [--time-zone ZONE]`

What the app's Hunt Momentum shows, for a contribution graph: the recorded actions on each day,
across all the person's Hunts. It is the same read model as the website's heatmap
(`get_hunt_activity_v2`): an action is an application saved, a stage changed, a note or interview
feedback, a follow-up, a task completed or a record updated. It is a count of what was recorded,
never a score. There is **no streak**: JobHunt does not rank or reward consecutive days, and the app
does not show one. `active_days` and `recorded_actions` are totals over the window, nothing more.

| Field | Meaning |
| --- | --- |
| `today` | The calendar day in `time_zone`. |
| `time_zone` | `--time-zone` if given, else this computer's zone. |
| `from` | The first day of the window; `days[0].date`. |
| `days` | Every day from `from` through `today`, oldest first, exactly one entry each, `count` `0` where nothing was recorded. The length is `--days`. |
| `active_days` | How many days in the window have a `count` above `0`. |
| `recorded_actions` | The sum of `count` over the window. |

`--days` is `1` to `1098` (default `365`); `--time-zone` is an IANA name such as `America/Los_Angeles`.
The service keeps at most 1098 days; days before the account existed are `0`.

<!-- fixture: activity.json -->
```json
{
  "today": "2026-11-18",
  "time_zone": "America/Los_Angeles",
  "from": "2026-10-22",
  "days": [
    {
      "date": "2026-10-22",
      "count": 3
    },
    {
      "date": "2026-10-23",
      "count": 0
    },
    {
      "date": "2026-10-24",
      "count": 0
    },
    {
      "date": "2026-10-25",
      "count": 0
    },
    {
      "date": "2026-10-26",
      "count": 0
    },
    {
      "date": "2026-10-27",
      "count": 0
    },
    {
      "date": "2026-10-28",
      "count": 0
    },
    {
      "date": "2026-10-29",
      "count": 2
    },
    {
      "date": "2026-10-30",
      "count": 0
    },
    {
      "date": "2026-10-31",
      "count": 0
    },
    {
      "date": "2026-11-01",
      "count": 0
    },
    {
      "date": "2026-11-02",
      "count": 0
    },
    {
      "date": "2026-11-03",
      "count": 0
    },
    {
      "date": "2026-11-04",
      "count": 0
    },
    {
      "date": "2026-11-05",
      "count": 1
    },
    {
      "date": "2026-11-06",
      "count": 5
    },
    {
      "date": "2026-11-07",
      "count": 0
    },
    {
      "date": "2026-11-08",
      "count": 0
    },
    {
      "date": "2026-11-09",
      "count": 2
    },
    {
      "date": "2026-11-10",
      "count": 1
    },
    {
      "date": "2026-11-11",
      "count": 0
    },
    {
      "date": "2026-11-12",
      "count": 4
    },
    {
      "date": "2026-11-13",
      "count": 0
    },
    {
      "date": "2026-11-14",
      "count": 0
    },
    {
      "date": "2026-11-15",
      "count": 2
    },
    {
      "date": "2026-11-16",
      "count": 0
    },
    {
      "date": "2026-11-17",
      "count": 1
    },
    {
      "date": "2026-11-18",
      "count": 3
    }
  ],
  "active_days": 10,
  "recorded_actions": 24
}
```

## `jobhunt jobs save URL --json`

Saves a posting link to the person's current Hunt, in To Apply: the `save_job` tool called with only
`url`, so the behaviour is identical (an identical repeat is recognised and reported as
`already_saved: true`; the details are read from the link afterwards, `details_pending`). Returns the
tool's structured result exactly. `URL` must be a plain `http` or `https` link without a password,
at most 2000 characters. Nothing contacts an employer.

<!-- fixture: jobs-save.json -->
```json
{
  "ok": true,
  "already_saved": false,
  "job": {
    "id": "00000000-0000-4000-8000-0000000000c1",
    "title": null,
    "company": null,
    "stage": "To Apply",
    "stage_type": "saved",
    "url": "https://jobs.example/postings/123",
    "revision": 1
  },
  "details_pending": true,
  "next": "The job is saved; its details are still being read from the link, which fills in the title, company and posting text. Call get_job later to see what it found."
}
```

## Errors

<!-- fixture: error-signed-out.json -->
```json
{
  "error": {
    "code": "authentication_required",
    "status": 401
  }
}
```

<!-- fixture: error-refused.json -->
```json
{
  "error": {
    "code": "invalid_input",
    "status": 422,
    "message": "url: use a public https link to the posting."
  }
}
```
