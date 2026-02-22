---
name: game-rules
description: Reference for game rules, player roles, win conditions, and gameplay mechanics. Use when implementing game features, discussing game logic, or when the user asks about how the game works.
---

# Game Rules — DesignMafia

## Goal

A multiplayer social deduction game where players collaborate to improve a broken UI in a Figma-like editor while trying to identify (or be) the saboteur.

## Players & Roles

- **Players:** 3-5 per match
- **Crewmates (majority):** Complete their task list and identify the saboteur
- **Saboteur (exactly 1):** Secretly introduces visual regressions and avoids being voted out

## Setup

1. Create/join a lobby with 3-5 players
2. Start the match; roles are assigned secretly
3. Match loads a broken UI file in a Figma-like canvas editor (web UI components, layouts)
4. Each crewmate gets 3 tasks from a shared pool; saboteur gets a fake task list (3 fake tasks)
5. Progress bar shows overall crew task completion (visible to all)

## UI: Canvas and Movement

- Full-page Figma-like canvas; pan to move viewport (speed capped, no zoom-out to see whole canvas)
- Live positions of other players visible on canvas (cursor/viewport indicator)
- Real-time editing: who is editing/selected is visible to others

## Core Gameplay (Editing Phase)

### Crewmates

- Complete your own 3 tasks (each tied to a location on the canvas)
- Use progress bar to see crew progress
- Watch for suspicious behaviour (e.g. someone near task areas without progress, regressions after someone was there)

### Saboteur

- Introduce regressions from secret list (misalignments, wrong styles, off colors) while staying believable
- Use fake task list to go to plausible places and pretend to work
- Avoid being voted out before time runs out

## Emergency Reviews and Voting

- Any player can call an Emergency Review at any time
- During review: players discuss observations, then everyone votes to eject one player
- Ejected player is removed from the match

## Win Conditions

### Crewmates Win If

- Progress bar is filled (all crewmate tasks completed), OR
- The saboteur is ejected

### Saboteur Wins If

- 5-minute timer ends with progress bar not filled and saboteur not ejected, OR
- Sabotage/regression objectives for the round are met (if used)

## Strategy Notes

- A wrong or slow change is not proof of sabotage; look for patterns, weak explanations, and who was near regressions
- Best sabotage is plausible (looks like mistakes or WIP) so the saboteur can blend in during discussion
