# Hackathon Admin Dashboard - Design Document

## Overview

Admin dashboard for a 30-hour hackathon where 4-6 teams of JS devs / PMs / Designers / DevOps build "Among Us for Coders" using Cursor. The app tracks progress, runs AI analysis, manages bonus features, and gamifies the competition with achievements.

## Architecture

**Monolith Next.js** deployed on Vercel with Neon (PostgreSQL) via Drizzle ORM. Long-running AI analyses handled via `waitUntil` / streaming.

### Stack

- Next.js 16 (App Router)
- Drizzle ORM + Neon (PostgreSQL)
- shadcn/ui + Tailwind CSS
- Recharts (graphs)
- Octokit (GitHub API)
- @slack/web-api (Slack)
- @anthropic-ai/sdk (Claude Opus 4.6)

### Environment Variables

```
DATABASE_URL=           # Neon connection string
GITHUB_TOKEN=           # PAT with access to all team repos
GITHUB_WEBHOOK_SECRET=  # HMAC secret for webhook verification
ANTHROPIC_API_KEY=      # Anthropic API key
SLACK_BOT_TOKEN=        # Slack bot token
SLACK_CHANNEL_ID=       # Slack channel ID for announcements
```

## Data Model

### `teams`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| name | text, unique | Team display name |
| repo_url | text | Full GitHub repo URL |
| repo_owner | text | GitHub owner (org/user) |
| repo_name | text | GitHub repo name |
| created_at | timestamp | |

### `features`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| title | text | Feature title |
| description | text | Full description |
| criteria | jsonb (string[]) | Evaluation criteria |
| points | integer | Points awarded |
| difficulty | text (easy/medium/hard) | Difficulty level |
| status | text (draft/announced/archived) | Publication status |
| created_at | timestamp | |
| announced_at | timestamp, nullable | When announced on Slack |
| announced_by | text, nullable | Who announced it |

### `analyses`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| team_id | uuid, FK teams | |
| triggered_by | text | "webhook" / "manual" / "cron" |
| commit_sha | text | Last commit SHA analyzed |
| status | text | pending / running / completed / failed |
| result | jsonb | Full structured analysis result |
| started_at | timestamp, nullable | |
| completed_at | timestamp, nullable | |
| created_at | timestamp | |

### `cursor_metrics`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| team_id | uuid, FK teams | |
| analysis_id | uuid, FK analyses | |
| total_prompts | integer | Total prompts sent |
| total_tool_uses | integer | Total tool uses |
| tool_use_breakdown | jsonb | { Shell: n, Read: n, Write: n, ... } |
| total_sessions | integer | Distinct sessions |
| models_used | text[] | Models used |
| agent_thoughts_count | integer | |
| file_edits_count | integer | |
| shell_executions_count | integer | |
| mcp_executions_count | integer | |
| avg_response_time_ms | float | |
| total_events | integer | Total events in events.jsonl |
| first_event_at | timestamp | |
| last_event_at | timestamp | |
| raw_stats | jsonb | Additional stats |
| created_at | timestamp | |

### `achievements`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| team_id | uuid, FK teams | |
| achievement_id | text | Reference to static definition |
| unlocked_at | timestamp | |
| data | jsonb | Contextual details |
| notified | boolean | Sent to Slack? |

### `events`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| team_id | uuid, FK teams | |
| type | text | commit / achievement / feature_completed / analysis / score_change |
| data | jsonb | Event-specific data |
| points | integer, nullable | Points associated |
| created_at | timestamp | |

### `scores`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid, PK | |
| team_id | uuid, FK teams | |
| breakdown | jsonb | ScoreBreakdown object |
| total | integer | Total score |
| recorded_at | timestamp | |

### `feature_completions`
| Column | Type | Description |
|--------|------|-------------|
| team_id | uuid, FK teams | PK (composite) |
| feature_id | uuid, FK features | PK (composite) |
| status | text | missing / partial / implemented |
| confidence | float | AI confidence 0-1 |
| details | text, nullable | AI explanation |
| updated_at | timestamp | |

## Analysis Pipeline

Triggered by GitHub webhook (push event) with 2-minute debounce per team.

1. **Receive** webhook at `/api/webhooks/github`, verify HMAC signature
2. **Identify** team by matching `repo_owner/repo_name` in `teams` table
3. **Debounce** - create/update `analyses` record with status `pending`. If one exists for this team within 2 min, update SHA instead of creating new
4. **Execute** (after debounce, via `waitUntil`):
   a. Fetch repo contents via GitHub API (`.cursor/`, `events.jsonl`, source files)
   b. Parse `events.jsonl` -> extract Cursor metrics -> store in `cursor_metrics`
   c. Analyze Cursor structure (rules, skills, commands) -> agentic metrics
   d. Fetch commits via GitHub API -> git metrics
   e. Send code to Claude Opus 4.6 for AI evaluation (game rules implementation, code quality, bugs, bonus features)
   f. Calculate score (scoring engine)
   g. Evaluate achievements (badge engine)
   h. Persist everything in DB (analyses, scores, achievements, events, feature_completions)
   i. Notify Slack for new achievements

## Scoring System

### Categories (100 fixed points)

| Category | Max | What it measures |
|----------|-----|------------------|
| Implementation | 35 | Game rules implemented (evaluated by Claude Opus) |
| Agentic Engineering | 25 | Cursor rules/skills/commands count and quality |
| Code Quality | 15 | TypeScript strict, no `any`, tests, structure, bugs |
| Git Activity | 10 | Commits, contributors, regularity, clean history |
| Cursor Usage | 15 | Prompts, tool uses, model diversity, sessions (from events.jsonl) |

**Plus variable points:** Features bonus (per-feature points) + Achievements (common:1, rare:2, epic:4, legendary:6)

## Achievements

### Implementation
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| first-blood | First Blood | common | 1 | First game rule implemented |
| game-on | Game On | rare | 2 | Playable game (lobby + roles + vote) |
| full-house | Full House | epic | 4 | All base rules implemented |
| beyond-rules | Beyond the Rules | epic | 4 | 3+ bonus features implemented |
| masterpiece | Masterpiece | legendary | 6 | Implementation score > 30/35 |

### Git - Commits (multi-level)
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| active | Active | common | 1 | 20+ commits |
| commit-machine | Commit Machine | rare | 2 | 60+ commits |
| git-maniac | Git Maniac | epic | 4 | 120+ commits |
| commit-legend | Commit Legend | legendary | 6 | 200+ commits |

### Git - Other
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| night-owl | Night Owl | rare | 2 | 3+ commits between 10 PM and 6 AM |
| clean-history | Clean History | rare | 2 | No "fix typo/wip/oops" in commit messages |
| refactor-king | Refactor King | rare | 2 | 300+ lines deleted in a single commit |
| atomic-habits | Atomic Habits | epic | 4 | 20+ commits under 50 lines each |
| big-bang | Big Bang | rare | 2 | 1000+ lines modified in a single commit |
| poet | Poet | common | 1 | All commit messages contain an emoji |
| shakespeare | Shakespeare | epic | 4 | Longest meaningful commit message (>200 chars) |
| marathon-runner | Marathon Runner | epic | 4 | Commits over 4+ consecutive hours |

### Cursor / Agentic - Rules (multi-level)
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| rule-apprentice | Rule Apprentice | common | 1 | 3+ custom rules |
| rule-master | Rule Master | rare | 2 | 6+ custom rules |
| rule-overlord | Rule Overlord | epic | 4 | 10+ custom rules |

### Cursor / Agentic - Skills (multi-level)
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| skill-novice | Skill Novice | common | 1 | 2+ custom skills |
| skill-master | Skill Master | rare | 2 | 5+ custom skills |
| skill-architect | Skill Architect | epic | 4 | 8+ custom skills |

### Cursor / Agentic - Commands (multi-level)
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| commander | Commander | common | 1 | 2+ custom commands |
| command-center | Command Center | rare | 2 | 4+ custom commands |
| automation-king | Automation King | epic | 4 | 7+ custom commands |

### Cursor / Agentic - Other
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| prompt-architect | Prompt Architect | legendary | 6 | 10+ rules + 8+ skills + 7+ commands |
| prompt-engineer | Prompt Engineer | epic | 4 | Skill with 500+ character instructions |

### Cursor Usage - events.jsonl (multi-level)
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| cursor-user | Cursor User | common | 1 | 100+ events |
| cursor-enthusiast | Cursor Enthusiast | rare | 2 | 500+ events |
| cursor-addict | Cursor Addict | epic | 4 | 1500+ events |

### Cursor Usage - Prompts (multi-level)
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| chatterbox | Chatterbox | common | 1 | 50+ prompts |
| prompt-hacker | Prompt Hacker | rare | 2 | 150+ prompts |
| ai-whisperer | AI Whisperer | epic | 4 | 300+ prompts |

### Cursor Usage - Other
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| tool-collector | Tool Collector | rare | 2 | 5+ different tool use types |
| mcp-explorer | MCP Explorer | epic | 4 | MCP usage detected |
| speed-coder | Speed Coder | rare | 2 | 10+ file edits in <5 minutes |
| tab-master | Tab Master | common | 1 | Tab completions used |
| multi-model | Multi-Model | rare | 2 | 2+ different models used |

### Code Quality
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| typescript-purist | TypeScript Purist | rare | 2 | No `any` in codebase |
| test-architect | Test Architect | epic | 4 | 10+ test scenarios |
| doc-writer | Doc Writer | rare | 2 | Documentation / JSDoc present |
| zero-bug | Zero Bug | legendary | 6 | No bugs detected by AI analysis |

### Design / UX
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| pixel-perfect | Pixel Perfect | rare | 2 | Animation library detected (framer-motion, etc.) |
| dark-side | Dark Side | rare | 2 | Dark/light theme implemented |
| responsive-hero | Responsive Hero | epic | 4 | Responsive layout detected |
| accessible | Accessible | epic | 4 | ARIA attributes / a11y labels detected |
| eye-candy | Eye Candy | legendary | 6 | High aesthetic score (evaluated by Claude) |

### Collaboration
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| full-squad | Full Squad | epic | 4 | 4+ active contributors (3+ commits each) |

### Speed
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| quick-start | Quick Start | common | 1 | First commit < 15 min after start |
| speed-runner | Speed Runner | rare | 2 | Feature complete in < 1h |
| first-to-ship | First to Ship | legendary | 6 | First team with a functional game |

### Features
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| feature-hunter | Feature Hunter | epic | 4 | Most bonus features implemented (relative) |
| point-machine | Point Machine | legendary | 6 | Highest total bonus feature points (relative) |

### Fun / Easter Eggs
| ID | Name | Rarity | Pts | Condition |
|----|------|--------|-----|-----------|
| copy-pasta | Copy-Pasta | common | 1 | A file with 500+ lines |
| overkill | Overkill | rare | 2 | 30+ npm dependencies added |
| minimalist | Minimalist | rare | 2 | < 5 npm dependencies added |
| readme-warrior | README Warrior | common | 1 | README.md > 1000 characters |
| git-flow | Git Flow | rare | 2 | 3+ branches in repo |
| one-prompt-wonder | One-Prompt Wonder | legendary | 6 | 500+ line commit followed by no fix for 30 min |
| perfectionist | Perfectionist | epic | 4 | 5+ fix/refactor commits after first big commit |
| conference-call | Conference Call | rare | 2 | 3+ simultaneous Cursor sessions detected |
| easter-egg-hunter | Easter Egg Hunter | legendary | 6 | Found a hidden easter egg (manual award) |

## Pages

### `/` - Admin Dashboard
- Leaderboard with scores, trends, contributor avatars, recent badges
- Score velocity graph (recharts) - team progression over time
- Activity feed - live timeline (commits, achievements, features) with auto-refresh
- Features board - mini overview of bonus features with completion counts
- Quick actions: Refresh All, Send Leaderboard to Slack, New Feature

### `/teams/[slug]` - Team Detail (Admin)
- Score breakdown (radar/bar chart by category)
- Achievement wall (grid: greyed = locked, colored = unlocked with timestamp)
- Cursor metrics (from events.jsonl: prompts, tool uses, sessions, models)
- Git stats (commits, contributors, additions/deletions, hourly distribution)
- AI analysis (latest Claude evaluation: rules status, quality, bugs, recommendations)
- Feature progress (per-feature status: missing/partial/implemented)
- Timeline (chronological event feed for this team)

### `/features` - Feature Management (Admin)
- Feature list with title, points, difficulty, status, completion count per team
- Create form: title + description (admin writes), "Assist with AI" button for criteria + points suggestion + wording polish
- "Announce on Slack" button per feature (rich Block Kit message)
- Inline editing for title/description/points

### `/settings` - Settings (Admin)
- Team management: add/remove teams (repo URL)
- Slack config verification
- Manual analysis trigger (per team or all)
- Hackathon start time (for countdown and time-based achievements)

### `/live` - Public View (projector)
- Animated leaderboard with rank change transitions
- Achievement feed (large format with animation on unlock)
- Hackathon countdown timer
- Auto-refresh every 15-30s
- Fullscreen mode (F key or button)

## Integrations

### GitHub (Octokit)
- Webhook at `/api/webhooks/github` with HMAC verification
- Contents API to fetch repo files
- Commits API for git metrics
- One PAT with access to all team repos

### Slack (@slack/web-api)
- Dedicated channel for hackathon announcements
- Messages: new feature announcements (Block Kit), achievement unlocks, periodic leaderboard
- Config: SLACK_BOT_TOKEN + SLACK_CHANNEL_ID

### Anthropic (Claude Opus 4.6)
- Code analysis: evaluate game rules implementation, code quality, bugs, bonus features, UX/design
- Feature assist: suggest evaluation criteria and points for new features, polish wording
- Config: ANTHROPIC_API_KEY

## Key Design Decisions

1. **One repo per team** (not branches) - each team has its own GitHub repo
2. **Webhook + debounce (2 min)** for analysis triggers - balances real-time updates with API costs
3. **events.jsonl analysis** - Cursor hooks in boilerplate log all activity, committed with each push
4. **Multi-level achievements** for skills/rules/commands/commits/cursor events/prompts
5. **Admin + public views** - admin controls everything, public `/live` view for projection
6. **AI-assisted feature creation** - admin writes, AI suggests criteria/points/polishes wording
7. **Claude Opus 4.6** for maximum analysis reliability (important: teams with similar code need differentiation)
