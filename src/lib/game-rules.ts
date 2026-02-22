export const GAME_RULES = `---
name: game-rules
description: Reference for game rules, player roles, win conditions, and gameplay mechanics. Use when implementing game features, discussing game logic, or when the user asks about how the game works. Also guides creative freedom and Cursor-assisted development (skills, rules, commands, MCP).
---

# Game Rules — DesignMafia

DesignMafia follows the same structure as **Among Us**: crewmates complete tasks and try to find the impostor; the saboteur (impostor) secretly introduces regressions and tries to blend in.

## 1) Goal of the game

DesignMafia is a **multiplayer social deduction** game where players collaborate to **improve a broken interface** inside a Figma-like editor while trying to identify (or be) the saboteur.

- **Crewmates:** see a **list of tasks** to complete. A **progress bar** shows overall task completion (how many tasks have been done by the whole crew).
- **Saboteur:** sees a **secret list of regressions** to introduce. They also see a **fake task list** (same format as crewmates) so they can pretend to do tasks and act like a crewmate during discussions and voting.

## 2) Players & roles

- **Players:** 3–5
- **Roles:**
  - **Crewmates (majority):** complete their own task list and identify the saboteur.
  - **Saboteur (exactly 1):** secretly introduces regressions from their list and tries to avoid being voted out.

## 3) Setup

1. Create/join a **lobby** with 3–5 players.
2. Start the match; roles are assigned secretly.
3. **Duration:** 5 minutes per match.
4. **Tasks:** Each crewmate gets **3 tasks** drawn from a **shared task pool**. Tasks are not shared: every player has their own list. The saboteur receives a **fake task list** (3 fake tasks) so they can act as if they were a crewmate during the debrief.
5. The match loads a **broken UI file** in a Figma-like editor. The game **map** is that design: it looks like a **Figma design** made of **multiple web UI components and layouts** (buttons, cards, sections, etc.), not an abstract play area.
6. **Progress:** A **progress bar** shows how many tasks have been completed by the crew (out of the total). Everyone sees this bar; saboteurs see it too (and their secret regression list).

## 4) UI: canvas and movement

The play area is a **full-page canvas** that looks like a **Figma design**: multiple **web UI components and layouts** (e.g. headers, cards, forms, grids). It is large enough that players can spread out and work in different areas.

- **Movement:** Same behaviour as **Figma**: users pan around the canvas to change their view (e.g. on Mac, two fingers on the trackpad). The viewport moves; there is no avatar. Movement speed is **capped** so players cannot cross the canvas too quickly.
- **Camera:** Players **cannot zoom out** to see the whole canvas at once; they see their own viewport. Zoom may be limited to keep the map from being fully visible.
- **Other players:** Each player sees the **live position** of every other player on the canvas (e.g. cursor or viewport indicator), so they can see who is where and who was near which area.
- **Editing:** When a player is at a task location, they can perform edits. Other players can see who is editing (selection, focus) in real time.

## 5) Core gameplay (editing phase)

All players can move on the canvas and edit the same UI file in real time.

### Crewmate objectives

- Complete **your own 3 tasks** from your list (each task is tied to a location/area on the canvas).
- Use the **progress bar** to see how the crew is doing.
- Communicate intent and watch for suspicious behaviour: someone near task areas without progress, or regressions appearing after someone was there.

### Saboteur objectives

- Introduce **regressions** from your secret list (e.g. misalignments, wrong styles, off colors) while staying believable.
- Use your **fake task list** to go to plausible places and pretend to work.
- Avoid being voted out before time runs out or before you’ve caused enough confusion.

## 6) Emergency reviews, discussion, and voting

- Any player can call an **Emergency Review** at any time.
- During the review:
  - Players discuss what they observed (who was where, progress bar changes, suspicious edits).
  - Everyone votes to **eject** one player.
- An ejected player is out for the rest of the match (and their role is revealed if your variant uses that rule).

## 7) Win conditions

### Crewmates win if **either**:

- The **progress bar is filled** (all crewmate tasks completed), **OR**
- The **saboteur is ejected**.

### Saboteur wins if **either**:

- The **5-minute timer ends** with the progress bar not filled and the saboteur not ejected, **OR**
- They meet any **sabotage/regression objectives** defined for the round (if used).

## 8) Practical clarifications

- The game mirrors **Among Us**: individual task lists, progress bar, one impostor, meetings, voting, and time limit.
- A wrong or slow change is not proof of sabotage. Look for patterns, weak explanations, and who was near regressions.
- Best sabotage is **plausible**: changes that look like mistakes or WIP, so the saboteur can blend in during discussion.

## 9) Creative freedom and development

The goal is to build something **creative**; the only limit is imagination.

- **Credentials:** The project has a **Railway token** and **Anthropic API key** available (in \`.env\` as \`RAILWAY_TOKEN\` and \`ANTHROPIC_API_KEY\`) when needed for deployment or AI features.
- **Packages and features:** Developers may add any packages and implement extra features that make the game better, the UI cleaner, or the experience more polished (e.g. animations, sound, accessibility, new mechanics).
- **Cursor-assisted development:** Take full advantage of Cursor tooling: define and use **skills** for domain knowledge and workflows, **rules** for conventions and patterns, **commands** for repeatable actions, and **MCP** (Model Context Protocol) for integrations (browser, APIs, docs, etc.). Use these to move faster and keep the codebase consistent.
`;

export const GAME_RULES_CHECKLIST = [
  {
    id: "lobby",
    rule: "Create/join a lobby with 3-5 players",
    description:
      "Players need a way to start or join a game session. Size of the group matters for balance.",
    criteria: [
      "UI or flow to create a new game lobby",
      "UI or flow to join an existing lobby",
      "Player count enforced between 3 and 5",
    ],
  },
  {
    id: "role-assignment",
    rule: "Roles assigned secretly (crewmates + 1 saboteur)",
    description:
      "Who is crewmate and who is saboteur is decided at match start and hidden from others.",
    criteria: [
      "Exactly one saboteur and the rest crewmates per match",
      "Roles not visible to other players (secret assignment)",
      "Assignment happens at match start",
    ],
  },
  {
    id: "broken-ui",
    rule: "Match loads a broken UI file in a Figma-like canvas editor",
    description:
      "The play area is a design canvas with something wrong that crewmates fix and the saboteur can worsen.",
    criteria: [
      "Match starts with a broken UI design (e.g. misalignments, wrong styles)",
      "Play area is a Figma-like canvas with web UI components/layouts",
      "Design file or canvas is loadable at match start",
    ],
  },
  {
    id: "task-lists",
    rule: "Each crewmate gets 3 tasks; saboteur gets 3 fake tasks",
    description:
      "Crewmates have concrete tasks; the saboteur has a list that looks the same but is for cover.",
    criteria: [
      "Crewmates receive individual task lists (3 tasks each from shared pool)",
      "Task lists are unique per player (drawn from shared pool, not duplicated across crewmates)",
      "Saboteur receives a fake task list in same format as crewmates",
      "Tasks are tied to locations/areas on the canvas",
      "Task completion is validated (e.g. visual diff, automated check, not just self-reported)",
    ],
  },
  {
    id: "progress-bar",
    rule: "Progress bar shows overall crew task completion",
    description:
      "Everyone can see how far the crew has gotten. Used for win condition and suspicion.",
    criteria: [
      "A progress bar or equivalent shows how many crew tasks are completed",
      "Progress is visible to all players (crewmates and saboteur)",
      "Progress updates as crewmates complete their tasks",
    ],
  },
  {
    id: "match-timer",
    rule: "5-minute match timer visible to all players",
    description:
      "The match has a fixed time limit displayed to all players. The timer drives urgency and is a key win condition for the saboteur.",
    criteria: [
      "Timer starts at match begin and counts down from 5 minutes",
      "Timer is visible to all players at all times",
      "Timer reaching zero triggers end-of-match evaluation (saboteur win if not ejected and progress bar not full)",
    ],
  },
  {
    id: "canvas-navigation",
    rule: "Figma-like panning with capped speed and limited zoom",
    description:
      "Moving around the canvas feels like a design tool, with limits so the map is not trivial to survey.",
    criteria: [
      "Players pan around the canvas to change view (viewport moves, no avatar)",
      "Movement speed is capped so players cannot cross canvas too quickly",
      "Zoom is limited (e.g. cannot zoom out to see whole canvas at once)",
    ],
  },
  {
    id: "player-visibility",
    rule: "Live player positions/cursors visible on canvas",
    description:
      "You can see where others are and what they are doing to spot suspicious behavior.",
    criteria: [
      "Each player sees the live position of every other player on the canvas",
      "Cursor or viewport indicator shows who is where",
      "Editing/selection focus visible in real time to other players",
    ],
  },
  {
    id: "realtime-editing",
    rule: "All players edit the same canvas in real time with synchronized state",
    description:
      "The game requires multiplayer real-time collaboration: edits by one player are immediately visible to all others.",
    criteria: [
      "Multiple players can edit the canvas simultaneously",
      "Edits propagate to all connected clients in real time",
      "Canvas state is consistent across all players (no desync or conflicts)",
    ],
  },
  {
    id: "saboteur-regressions",
    rule: "Saboteur introduces visual regressions from secret list",
    description:
      "The saboteur can make the design worse in subtle ways from a hidden list of objectives.",
    criteria: [
      "Saboteur can introduce regressions (e.g. misalignments, wrong styles, off colors)",
      "Saboteur has a secret list of regression objectives",
      "Regressions are plausible and not trivially obvious",
    ],
  },
  {
    id: "saboteur-cover",
    rule: "Saboteur uses fake task list to blend in",
    description:
      "The saboteur can act like a crewmate using a fake task list so they are not obvious.",
    criteria: [
      "Saboteur can go to plausible places using fake task list",
      "Saboteur can pretend to work like a crewmate during editing phase",
      "Fake task list supports acting believably during discussion and voting",
    ],
  },
  {
    id: "emergency-review",
    rule: "Any player can call an Emergency Review",
    description:
      "At any time someone can trigger a pause for discussion and voting.",
    criteria: [
      "UI or action to call an Emergency Review at any time",
      "Any player (crewmate or saboteur) can trigger it",
      "Review leads to discussion and vote phase",
      "Cooldown or limit on emergency reviews to prevent abuse",
    ],
  },
  {
    id: "discussion-vote",
    rule: "During review, players discuss and vote to eject",
    description:
      "Players talk about what they saw and vote to remove one player from the match.",
    criteria: [
      "Discussion phase where players share observations (who was where, suspicious edits)",
      "Vote to eject one player",
      "Vote outcome determines who is ejected",
      "Tie vote handling is defined (e.g. no ejection on tie, or random)",
      "Option to skip vote / vote for no ejection",
    ],
  },
  {
    id: "vote-removal",
    rule: "Ejected player is removed from the match",
    description:
      "Whoever is voted out stops playing; the match continues without them.",
    criteria: [
      "Ejected player is removed from active play",
      "Removal is enforced (no further edits or votes from ejected player)",
      "Match state reflects removal",
      "Ejected player's role is revealed (or explicitly hidden per game variant)",
      "Game handles incomplete tasks of ejected crewmates (e.g. tasks redistributed or progress bar goal adjusted)",
    ],
  },
  {
    id: "win-progress",
    rule: "Crewmates win if progress bar is filled",
    description:
      "Crewmates win when all their tasks are done, regardless of the saboteur.",
    criteria: [
      "Win condition: crewmates win when all crew tasks are completed (progress bar full)",
      "Progress bar filled state is detectable",
      "Game ends or declares crewmate victory when condition is met",
    ],
  },
  {
    id: "win-saboteur-ejected",
    rule: "Crewmates win if saboteur is ejected",
    description:
      "Crewmates also win if they vote out the saboteur before time or completion.",
    criteria: [
      "Win condition: crewmates win if saboteur is ejected",
      "Ejecting the saboteur is detectable",
      "Game ends or declares crewmate victory when saboteur is voted out",
    ],
  },
  {
    id: "win-saboteur",
    rule: "Saboteur wins if timer ends or sabotage objectives are met",
    description:
      "The saboteur wins by surviving until the end or by completing their secret objectives.",
    criteria: [
      "Match has a 5-minute time limit; saboteur wins if time runs out and not ejected (see match-timer)",
      "Saboteur wins if all crewmates are ejected",
      "Saboteur can also win if sabotage/regression objectives are met (if used)",
      "Game ends or declares saboteur victory when condition is met",
    ],
  },
];
