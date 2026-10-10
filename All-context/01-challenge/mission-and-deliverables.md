# Mission, Scope and Deliverables

Second challenge document (the mission sheet), complementing [`hackathon-briefing.md`](hackathon-briefing.md).

## 1. Your mission

Build an AI-powered application that ingests heterogeneous data, derives customer requirements for a vehicle, prioritizes them, and puts a product manager (PM) in the loop at the decisions that matter.

The app should be able to:
- Ingest the provided data and enrich it with structured knowledge from the web.
- Extract signals such as recurring complaints, unmet needs, competitor advantages and market trends, each linked to its sources.
- Derive requirements from those findings: clear, actionable, customer-facing and realistic.
- Prioritize them with a logic you define and can explain.
- Involve the PM to approve, reject, edit or challenge requirements and their rationale and evidence.
- Record everything in an **audit trail**: a complete, chronological record of all actions, changes and access events within the system.

## 2. Scope

**In scope**: customer requirements on the product:
- Features, equipment, comfort, space, usability
- Infotainment and digital services
- Design and quality perception, driving experience
- Range and charging as experienced by the customer
- Variant and package offering, etc.

**Out of scope**:
- Regulatory and homologation requirements (e.g. safety, emissions, type approval)
- Technical and engineering requirements (e.g. component specs, architecture, supplier topics)
- Pricing, business case and cost calculation (cost or effort may be used as a *rough* prioritization factor)

## 3. Make it yours

- Demonstrate the application for **at least one derivative in one market**, but do not design it as a one-off: it should adapt to other BMW vehicles and markets. The remaining datasets are available for optional testing.
- The challenge is broad, so focus where your team can contribute most. For example, go deep on web research and turn external information into usable evidence, or on integrating and interpreting the provided BMW data.
- You do not need every capability at the same depth. Show how your focus connects the path **from evidence to a PM decision**.

## 4. Expected deliverables

1. **Concept and demonstrable prototype** of an AI-powered product requirements application that processes heterogeneous inputs, derives requirements, supports prioritization and integrates human review.
2. **Structured sample list of derived requirements.** Each requirement includes:
   - a unique identifier
   - a clear, actionable description
   - linked findings and sources
   - a priority or score
   - the prioritization rationale applied
   - an evidence level
   - key future-facing assumptions and uncertainties
   - its current decision status
3. **End-to-end workflow** showing how inputs become proposed and prioritized requirements, which activities the AI performs autonomously, and where human review is mandatory.
4. **Demonstrable audit trail** making each requirement traceable from its underlying findings and sources through consolidation, scoring, prioritization and human decision. It should record relevant changes to requirement content, scores, priorities, evidence and status, including **who or what** initiated each change, **when**, and the documented **rationale**.

> Teams are free to choose their technical approach, architecture, prioritization logic and user experience. The deliverables describe the capabilities and outcomes to demonstrate, not a prescribed solution. They may be presented as one integrated solution or a combination of connected concepts, prototypes, models and visualizations.
