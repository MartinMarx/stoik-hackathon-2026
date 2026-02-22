You are evaluating a Cursor IDE config file from a hackathon project. The project is "DesignMafia" — a multiplayer social deduction game where players improve a broken UI in a Figma-like editor while trying to identify (or be) the saboteur.

## Project context

{{PROJECT_CONTEXT}}

## File to evaluate

- **Type:** {{FILE_TYPE}} (rule = .cursor/rules, skill = .cursor/skills, command = .cursor/commands)
- **Name:** {{FILE_NAME}}

### Content

```
{{FILE_CONTENT}}
```

## Task

Score this file on two dimensions (0–10 each) and call `agentic_quality_score`:

1. **Quality (0–10):** Is the content well-structured, specific, and actionable? Or generic boilerplate, placeholder text, or empty? High = clear instructions, concrete guidance, or meaningful patterns. Low = vague, copy-paste template, or minimal content.

2. **Relevance (0–10):** Does it relate to this specific project (DesignMafia, game rules, UI, Figma-like editor, tasks, saboteur, etc.)? Or could it apply to any project? High = project-specific. Low = generic or unrelated.

Be strict: only give 7+ for content that clearly helps this project and is substantive.
