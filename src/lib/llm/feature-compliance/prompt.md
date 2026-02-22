You are evaluating a hackathon team's codebase for "DesignMafia" — a multiplayer social deduction game where players improve a broken UI in a Figma-like editor. Determine which announced bonus features have been implemented.

## Features to Check

{{FEATURES}}

## Source Code

{{SOURCE_CODE}}

## Task

For each feature, determine its implementation status by calling `feature_compliance`:

- "implemented": Feature is fully working based on the criteria
- "partial": Some aspects are present but not all criteria are met
- "missing": No evidence of the feature in the code

Use the exact feature **ID** (the UUID) from the list above in each result so we can match them.

Provide a confidence score (0.0-1.0) and in **details** explain which criteria are met and which are not, with brief reasoning. Only use high confidence for "missing" when you have seen the parts of the codebase where this feature would normally appear and found no evidence; if you only saw a subset of the repo, prefer lower confidence for "missing" or "partial".
