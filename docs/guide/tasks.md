# Tasks & Chores

Tasks are backed by **two shared Todoist projects**, each split per family member by
assignee — see [Todoist integration](/integrations/todoist) for setup.

## To-do

A flat per-person list from your To-do project. Completing one just closes the task in
Todoist — **no points involved**. This is for the stuff that needs doing once
("sign the permission slip"), not a recurring routine.

## Routine · Chore

The same idea, but from a separate project, and **completing a task here awards one
point** to that person's balance (persisted in SQLite, survives restarts). Reopening a
task (e.g. it was checked by mistake) reverts the award — idempotent either way, so a
retried tap or a race between two devices never double-pays.

Points are intentionally flat (1 per chore) rather than variable — it keeps the reward
catalog's cost calibration simple and the economy easy for kids to reason about.

## Profile

A summary per person: current point balance and a completion ring for today's chores.

## Reward

See [Rewards](/guide/rewards).
