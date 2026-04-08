# Ziggy Risk Model

## Purpose

The risk model gives Ziggy a simple shared language for deciding how careful a task should be. It is intentionally lightweight in this phase: enough structure to guide review, routing, and logging without over-engineering policy enforcement.

## Risk Tiers

### Low

Low-risk work is read-only or easily reversible, with limited sensitivity.

Typical examples:

- reviewing calendar context
- summarizing inbox state
- generating notes without side effects

Expectations:

- approval may be optional
- local or external workers may be acceptable
- standard logging is enough

### Medium

Medium-risk work can prepare user-visible outputs or shape next actions, but should still pause before meaningful side effects.

Typical examples:

- drafting emails
- preparing file organization proposals

Expectations:

- approval before side effects
- routing may use external workers when allowed
- detailed logging is preferred

### High

High-risk work changes local state or touches more sensitive material.

Typical examples:

- applying approved file moves
- any future capability that modifies durable local state

Expectations:

- explicit human approval
- local execution by default
- full logging and artifact capture

### Critical

Critical risk is reserved for future capabilities that would require the narrowest boundaries and strongest review.

Expectations:

- named approval and tighter policy checks
- local execution only unless governance says otherwise
- maximum logging

## Sensitivity

For now Ziggy only uses a basic `sensitivity_level` field. The point is to establish the shape of the model early so future expansions can separate operational risk from data sensitivity without changing the runtime contract.

## Human-in-the-Loop and Risk

Risk levels are not just labels. They exist to answer practical questions:

- Should Ziggy stop for approval?
- Can this work leave the machine?
- What worker role is appropriate?
- How much evidence should be recorded?

If the system cannot answer those questions clearly, it is not ready to run the task.

## Current Status

Today, the risk model provides:

- typed task metadata
- YAML-backed governance definitions
- capability-to-risk mapping
- approval rule structure
- context defaults for future routing

This is a foundation for policy-based routing, not a finished governance engine.
