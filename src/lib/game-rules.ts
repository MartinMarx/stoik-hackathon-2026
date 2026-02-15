export const GAME_RULES = `---
name: game-rules
description: Reference for game rules, player roles, win conditions, and gameplay mechanics. Use when implementing game features, discussing game logic, or when the user asks about how the game works.
---

# Game Rules — Among Us for Coders

## Goal

A multiplayer social deduction game where players collaborate to fix broken TypeScript code (completing TODOs and making all tests pass) while secretly trying to identify (or be) an impostor.

## Players & Roles

- **Players:** 3-5 per match
- **Civilians (majority):** Cooperate to fix code and identify the impostor
- **Impostor (exactly 1):** Secretly sabotages code and avoids being voted out

## Setup

1. Create/join a lobby with 3-5 players
2. Start the match; roles are assigned secretly
3. Match begins with broken TypeScript code and its test suite

## Core Gameplay (Coding Phase)

### Civilians Should

- Implement missing logic (TODOs)
- Improve correctness so tests pass
- Watch changes made by others for suspicious behavior

### Impostor Should

- Introduce subtle changes that harm correctness
- Complete sabotage tasks (game-defined objectives)
- Avoid identification during discussions and votes

## Emergency Meetings

- Any player can call an Emergency Meeting to discuss suspicious behavior
- During meetings, players discuss and vote to eject a player
- Voted out players are removed from the match

## Win Conditions

### Civilians Win If

- All tests pass, OR
- The impostor is voted out

### Impostor Wins If

- Sabotage tasks are completed, OR
- They survive until time runs out

## Strategy Notes

- The game balances engineering signal (what code changes do) and social signal (what people claim / how they behave)
- Not every incorrect change proves sabotage - civilians must weigh explanations and timing
- Impostors benefit from plausible changes (small "mistakes", distractions, regressions) rather than obvious breakage`;

export const GAME_RULES_CHECKLIST = [
  { id: "lobby", rule: "Create/join a lobby with 3-5 players" },
  { id: "role-assignment", rule: "Roles assigned secretly (civilians + 1 impostor)" },
  { id: "broken-code", rule: "Match begins with broken TypeScript code and test suite" },
  { id: "civilian-fix", rule: "Civilians can implement missing logic (TODOs)" },
  { id: "civilian-tests", rule: "Civilians can improve correctness so tests pass" },
  { id: "civilian-watch", rule: "Civilians can watch changes made by others for suspicious behavior" },
  { id: "impostor-sabotage", rule: "Impostor introduces subtle changes that harm correctness" },
  { id: "impostor-tasks", rule: "Impostor has sabotage tasks (game-defined objectives)" },
  { id: "emergency-meeting", rule: "Any player can call an Emergency Meeting" },
  { id: "discussion-vote", rule: "During meetings, players discuss and vote to eject" },
  { id: "vote-removal", rule: "Voted out players are removed from the match" },
  { id: "win-tests-pass", rule: "Civilians win if all tests pass" },
  { id: "win-impostor-voted", rule: "Civilians win if impostor is voted out" },
  { id: "win-sabotage", rule: "Impostor wins if sabotage tasks completed" },
  { id: "win-timeout", rule: "Impostor wins if they survive until time runs out" },
];
