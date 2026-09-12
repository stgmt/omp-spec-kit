---
name: spec-elicitation
description: Before the first creation of specification Markdown, assess sources and gaps and ask only decision-changing questions.
---

# Specification elicitation

Operating procedure for creating specification documents:

1. **Trigger:** Trigger before the first content creation in any canonical Markdown document in a specification.
2. **Read sources first:** Read the available sources first: user request, linked issues, code, documents, and existing specification documents. Name each source in the eventual research text.
3. **Separate facts from gaps:** Separate known facts from missing decisions and rank missing decisions as blocking or merely useful.
4. **Targeted questions:** Use `ask` only for a blocking gap. Every question must name the gap and explain which requirement, non-functional requirement, or acceptance criterion changes for each answer.
5. **No dumb or redundant questions:** Ask no question when the answer is already in a source, when the answer would not change a requirement or acceptance criterion, or when the question is generic and has no named gap. Use zero questions when there are zero blocking gaps.
6. **Write after answers or explicit directive:** After answers, write the specification. If the user explicitly says to proceed without questions, write immediately but use only sourced facts, mark unknowns as unknown, and list concrete risks with a source link; never invent a number or present an unchecked fact as verified.

The MCP refusal is a one-time nudge, not proof that the agent used this memo. The only code-side pointer is `skill://spec-elicitation`.
