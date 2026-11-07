# Acceptance Criteria

## AC-1.1: Executable task checks

**GIVEN** a task declaring a verify command with a timeout
**WHEN** the task listing is read
**THEN** the command, its flags and its timeout SHALL be readable
**AND** a task without a check SHALL appear with no check rather than as complete

## AC-2.1: Run under an allowlist and a timeout

**GIVEN** a verify command whose executable is not allowlisted and one that hangs past its timeout
**WHEN** each run is attempted
**THEN** the first SHALL be refused before any spawn
**AND** the second SHALL terminate at the timeout with partial output recorded

## AC-3.1: Evidence records

**GIVEN** a completed run
**WHEN** the evidence is read for that task
**THEN** the record SHALL carry the commit, the dirty state, the exit code, the duration, the output tail and the output hash
**AND** the history query SHALL return the run in order

## AC-4.1: Completion requires a fresh green run

**GIVEN** a task with no green record for the current commit
**WHEN** its status is set to done
**THEN** the transition SHALL be refused and the refusal SHALL name the missing record

## AC-4.2: Override is recorded

**GIVEN** an explicit override with a written reason
**WHEN** the transition is applied
**THEN** the receipt SHALL carry the reason and the history SHALL show the exception

## AC-5.1: Spend authorization

**GIVEN** a command marked as spending and no authorization record
**WHEN** the run is attempted
**THEN** it SHALL be refused and the refusal SHALL name the missing authorization
**AND** the same command without the flag SHALL run without authorization

## AC-6.1: External writers and last-green

**GIVEN** two runs producing scenario results at different commits
**WHEN** a scenario is queried
**THEN** it SHALL report the last green run with its commit and timestamp
**AND** both runs SHALL remain in the history
