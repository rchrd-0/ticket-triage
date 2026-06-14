# ticket-triage

AI-powered support ticket triage capstone built with TypeScript, Bun, and Mastra.

Current workflow:

```text
ticket -> classify -> route
  -> draft: investigate with read-only tools -> draft grounded reply
  -> human_review: omit automated reply
```

The draft branch uses a bounded local investigator with read-only KB, SOP, and order-status tools.
Tool results are normalized into investigation sources, and drafted replies return
`groundingSourceIds` that must come from the supplied sources. The internal workflow uses local
Mastra tools; external tool exposure can be added as a separate adapter.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun start
```

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
