@endpoint-resilience
Feature: Service endpoint resilience across installs
  A consumer's MCP config and a published host port must never silently diverge.
  Reinstalling the stack while a port is occupied, replacing a native service
  with a dockerized one, or sharing a machine with a second stack all leave
  users with dead or misrouted client configs. The installer must prove the
  port it publishes, the manifest must record it, and the doctor must repair
  stale entries — including entries that still answer but route to the wrong
  instance.

  # ---- allocation: prove the port before binding ----

  Scenario: A free preferred port is used as-is
    Given port 8644 accepts no connections and answers nothing
    When the endpoint allocator runs
    Then the allocation chooses 8644
    And nothing is recorded as skipped

  Scenario: A busy preferred port falls to the next free port
    Given port 8644 accepts no connections for our service but is bound by another process
    When the endpoint allocator runs
    Then the allocation chooses 8645
    And port 8644 is recorded as skipped with reason "busy"

  Scenario: A port answering as a foreign service is skipped, not adopted
    Given port 8644 answers a health probe as a foreign service
    When the endpoint allocator runs
    Then the allocation chooses 8645
    And port 8644 is recorded as skipped with reason "foreign-service"

  Scenario: A live port owned by the same stack is reattached, not skipped
    Given port 8644 answers a health probe as our service with our instance fingerprint
    When the endpoint allocator runs
    Then the allocation chooses 8644 with outcome "reattached"
    And nothing is recorded as skipped

  Scenario: Port exhaustion fails loudly instead of binding over a foreign service
    Given every probed port answers as a foreign service
    When the endpoint allocator runs with 3 attempts
    Then the allocation fails reporting no free port
    And no port is claimed

  # ---- manifest: record what was actually published ----

  Scenario: The manifest records the port that was actually published
    Given the allocator yielded port 8647 after skipping two candidates
    When the runtime manifest is written
    Then hostUrl becomes "http://127.0.0.1:8647"
    And the container-internal URL stays a separate field

  Scenario: A legacy manifest without hostUrl is upgraded in place
    Given a runtime manifest written before hostUrl existed
    When the runtime manifest is reloaded
    Then hostUrl is derived from the published port
    And the rest of the manifest is preserved byte-for-byte

  # ---- doctor: repair stale configs, including half-alive ones ----

  Scenario: A dead endpoint is re-pointed at the manifest host URL
    Given an MCP config pointing at a port that accepts no connections
    And a runtime manifest declaring the live host URL
    When the registry doctor repairs the config
    Then the entry URL becomes the manifest host URL
    And a fresh token replaces the stale one

  Scenario: An answering endpoint with the wrong instance fingerprint is re-pointed too
    Given an MCP config whose URL answers 200 but reports a different service fingerprint
    And a runtime manifest declaring the live host URL
    When the registry doctor repairs the config
    Then the entry URL becomes the manifest host URL
    And the diagnosis records "wrong-instance", not "ok"

  Scenario: An endpoint answering 401 with our fingerprint is re-issued a token, not re-pointed
    Given an MCP config whose URL answers 401 while reporting our instance fingerprint
    And a runtime manifest declaring the live host URL
    When the registry doctor repairs the config
    Then the entry URL is unchanged
    And a fresh token replaces the stale one

  Scenario: A healthy entry is untouched by repair
    Given an MCP config whose URL answers with our instance fingerprint
    And a runtime manifest declaring the live host URL
    When the registry doctor repairs the config
    Then the config bytes are unchanged
    And no token is re-issued

  Scenario: A token stored via file indirection is repaired in the file, not inline
    Given an MCP config whose Authorization references a token file
    And a runtime manifest declaring the live host URL
    When the registry doctor repairs the config
    Then the token file contains the fresh token
    And the config keeps its file reference instead of inlining the secret

  Scenario: Doctor dry-run reports without writing
    Given an MCP config pointing at a port that accepts no connections
    And a runtime manifest declaring the live host URL
    When the registry doctor runs in dry-run mode
    Then the config bytes are unchanged
    And the report lists the entry as needing repair

  Scenario: A missing manifest fails loudly instead of guessing a URL
    Given an MCP config pointing at a port that accepts no connections
    And no runtime manifest exists
    When the registry doctor repairs the config
    Then the repair fails reporting the manifest is missing
    And the config bytes are unchanged

  Scenario: A manifest declaring a network-internal host URL is refused
    Given an MCP config pointing at a port that accepts no connections
    And a runtime manifest whose hostUrl is a compose-network hostname
    When the registry doctor repairs the config
    Then the repair fails reporting an internal URL
    And the config bytes are unchanged

  # ---- onboarding: never mint a host snippet with a network-internal URL ----

  Scenario: Onboarding refuses a compose-network hostname for a host snippet
    Given a caller requesting a host-facing MCP snippet
    When the supplied service URL is a compose-network hostname
    Then onboarding fails loudly instead of writing a dead config

  Scenario: Onboarding accepts loopback and DNS names for a host snippet
    Given a caller requesting a host-facing MCP snippet
    When the supplied service URL is a loopback or DNS name
    Then the snippet carries that URL unchanged
