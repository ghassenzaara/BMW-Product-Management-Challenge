# Meeting Summary: Demo Feedback from Thomas (BMW AI Engineer), 10.10.2026

**Who:** Thomas, AI engineer at BMW, and our team. Two demos were shown:
- **Demo A:** a teammate's dashboard (lead-PM review, cases, requirements).
- **Demo B:** the `web/` demo (signal radar, persona Lena Hofmann).

**Length:** about 26 minutes (English).
**Source:** [`raw/2026-10-10_2308_thomas-demo-feedback_transcript.md`](raw/2026-10-10_2308_thomas-demo-feedback_transcript.md). It was transcribed with Whisper and the speakers are not labelled, so who said what is inferred from context. 23:08 is when the WhatsApp recording was saved, not necessarily when the meeting started. Timestamps `[mm:ss]` point into the transcript.

## TL;DR
1. **The data structure is right:** Signals → (aggregated signals) → Case → Requirements. "The basic data structure is good and it looks good."
2. **Less is more.** The app does too much and is "a bit overwhelming". A PM must understand it "in one look". Cut features and streamline.
3. **One kanban only, for cases.** Requirements belong to a case and are the end goal, so they get a list or review board, not a second kanban. Combine the vehicle plan with requirements.
4. **Use a fixed taxonomy.** Agents must classify into a predefined category list (derived from the VFC topics in the feedback CSV) instead of inventing themes. It is a classification problem.
5. **No colleague-to-colleague chat** (they have Microsoft Teams). Do keep comments, @mentions and notifications.
6. **The AI chat should be a colleague:** big context (BMW identity, series, RAG, signals, chat history), interactive, asks the PM questions and proposes actions. The PM accepts or rejects, and everything goes back into the context.
7. **Pitch:** a collaboration platform for the whole product development process, built on the kanban and Jira habits PMs already have.

## Key points

### 1. Demo A: agents, lead-PM review, cases [00:00–05:20]
- **Competitor agent, always running:** it flags when a competitor (e.g. Porsche) does something that goes against a requirement we agreed on in the past. The example was a range target of WLTP ≥ 750 km against a competitor at about 792 km. The PM adds their own remark ("this is dumb, we won't follow") and it is fed back to the agent. Market conflicts are flagged the same way.
- **Lead-PM view:** colleagues hand off finished requirements to the lead PM for review. There is also a list of the PM's own requirements and the ones they delegate.
- **Signals as inputs to a case:** dealer calls (51), owner reviews, the customer study, competitors, YouTube reviews. Each signal has the original text (e.g. the exact customer conversation) plus a summary.
- **Cases:** each is assigned to a colleague and has a state, and everyone sees what the others work on. A "done" case shows the requirements built from it, by the AI and by colleagues. The seed data is not accurate; the focus is on UX.
- **Thomas:** likes the charts that show **signal strength**. Likes **cases** as "an overall topic that you have to deep dive into". The extra signal → case abstraction "makes sense".

### 2. Demo B: signal radar and the case flow [06:10–11:53]
- **Signal radar:** "Refresh" shows which agents ran, what they fetched and what it cost. The feed by agent covers trends, the innovation scout and the BMW CSVs, with web sources such as YouTube and articles. Signals are clustered into themes. In this demo the themes came from the CSV data and the AI's clustering.
- **Thomas's main tip: use a fixed taxonomy** [07:51–09:53]. A free-running agent invents a new category for something we already have under another name, so we get ten categories that mean the same. Instead:
  - Derive a fixed list from the customer-feedback CSV (the **VFC level 2 / level 3** columns, i.e. category and component).
  - Have the agents **map every signal onto that list**: "a classification, not a regression problem."
  - Team: "I'm going to add that."
- **Case flow, as shown:**
  1. Signals → a candidate case (e.g. luggage loading), state *New / Investigating*.
  2. The case page has the problem, who is affected, a summary, and all signals with links to the source.
  3. Open questions for engineering or finance, with the case waiting for answers.
  4. *Ready to decide*, after the PM's meetings.
  5. Outcome: build requirements, **refer to another PM**, or park in an **innovation pool**. The pool is shared by many PMs; Lena Hofmann, for example, only owns the 5 Series.
- **Requirement lifecycle shown:** draft → in discussion → approved by the PM → signed off (exact cost, exact plan) → planned. Planned requirements land in the **vehicle plan** for the next generation, an overview of upcoming features in which every requirement has its own ID.

### 3. The AI assistant [11:53–15:05]
- Each case has its own chat. The model needs a **big context**:
  - general BMW identity
  - the specific model and series
  - RAG over the knowledge base
  - all signals
  - the chat history so far
- It should be **interactive, not "a chatbot sitting there"** (the example given was "like Claude"). It asks the PM questions and can **act**: add open questions, refer the case, send it to someone.
- Example: it drafts questions for engineering ("what target for …?") and finance ("what should they investigate with the engineers?"). The PM **accepts or rejects** each one, and it all goes into the context.
- (The team mentioned "GPT-5" or similar as the model, as a placeholder; it is not a decision.)

### 4. One board or two? [15:05–20:10]
- Question: should the kanban show cases or requirements? Two boards are "a double" and confusing.
- **Answer: cases.** PMs work on cases. Requirements are "the end goal". They are related to a case and appear when you open it.
- **Thomas on structure:** keep few data structures and keep them straightforward:
  - signals, which he likes
  - aggregated signals, "fine as well, you need that layer"
  - case
  - requirement
- **How a case becomes requirements (team):**
  - The case is the research from the signals.
  - The PM adds what is in their head as context, e.g. "this model is US-focused, we don't optimize for that market, cost matters less, we want it more luxurious".
  - From the case plus that context the requirements are built: **one case → n requirements**.
  - The requirements are handed to engineering and the other parties, and their feedback goes back into the case.
- **Requirements view:** "Do we really need a second kanban board? We don't." A simple **list or review board** for requirements instead. Thomas likes the visual distinction between categories. Proposal: **put the vehicle plan and requirements together**.

### 5. "Less is more" [19:43–20:10, 22:59–23:48]
- "You have a lot of features, which is good, but you shouldn't have too much … it's a bit overwhelming what you can do in your app." Streamline and focus on the most important data sources.
- "Don't overcomplicate the feature set … less is more. Really think deep: do we need this, or is that too much?" A PM "needs to understand it in one look".
- The team agreed and said it would merge the two demos (they "were working with different focuses").

### 6. Merged flow the team proposed [20:16–22:37]
- From Demo B, keep the **innovation pool** and the **vehicle plan built from requirements**.
- **Case page:**
  1. A "Work this case" button.
  2. The case as an md file: a thorough analysis of all its signals.
  3. Alongside it, a **questionnaire** that captures as much of the PM's knowledge as possible.
  4. A **Create requirements** button.
  5. **AI chat to harden the requirements**: "the app is your colleague". The PM pushes back and forth and decides which requirements to keep, drop or edit.
- Result: one list of requirements per case, plus a page with all inputs and the resulting requirements.

### 7. Pitch advice [22:37–24:31]
- "You're building a collaboration platform for the whole department … a whole suite for the product development process." Say that in the pitch.
- Sell the **kanban**: PMs already know it from Jira, they can assign cases to each other, and "we are just working into what they already do, optimizing it."

### 8. Chat between colleagues? [24:31–25:37]
- **No.** "In the end you have Microsoft Teams." Jira doesn't have chat either.
- **Yes** to notifications (signals, new mentions) and **comments**.
- An in-app chat makes it sound like "a massive product".

## What this means for our `web/` demo
| Thomas's point | Status in `web/` today | Suggested change |
|---|---|---|
| Kanban for cases only | Kanban **and** ranked list for both cases and requirements | Requirements page becomes a ranked list or review table (no kanban); keep the case kanban |
| Vehicle plan together with requirements | Separate `/plan/[series]` page | Make "Vehicle plan" a view or tab of the requirements page |
| Fixed taxonomy | Cases and requirements already use a fixed `CarArea` enum (11 values). Signals carry BMW's VFC level-2 `topic` (about 225 distinct values in the CSV) but are not mapped to it | **Done:** [`taxonomy/`](../../taxonomy/README.md) maps all 226 VFC level-2 labels onto 219 topics in the 11 car areas, with a closed-enum classifier schema and an eval against BMW labels. Next, Ghassen wires it into the agents |
| Less is more | 16 screens; sidebar has desk, inbox, radar, cases, requirements, plan, innovation, questions, portfolio, approvals, settings, audit | Cut to about 5 entries: **Desk, Radar, Cases, Requirements (+ plan), Innovation pool**, plus **Approvals** for the head. Fold Inbox into the bell, Meeting prep into the case's questions tab, Audit into each object's activity, Portfolio into Approvals |
| AI as colleague that asks questions and acts | Proposals (questions, diffs, drafts), meeting-note extraction, scripted research | Add a short **PM-context questionnaire** on the case (market focus, cost sensitivity, positioning). The answers feed the context pack and the requirement draft. Let the chat ask the PM follow-up questions |
| No colleague chat; comments and notifications yes | Comments with @mentions, notifications, no DM chat | Nothing to change. This matches |
| Competitor agent flags agreed requirements | Monitor alerts (e.g. Xiaomi SU7 800 km CLTC vs our 750 km target), PM verdict with remark | Nothing to change. Show it early in the demo |
| Pitch: a collaboration platform like Jira | Personas, referrals, sign-off, escalations | Lead the pitch with the case kanban and the hand-offs between PMs |

## Open questions
- Who takes the lead UI when the two demos are merged, Demo A or `web/`?
- Does the fixed taxonomy use BMW's VFC level 2 directly (about 225 labels, too many for chips) or our 11 car areas with a mapping? Recommended: car areas for the UI, with the VFC label kept on each signal for traceability.
- Is the head of product line (portfolio, sign-off) still in the demo after cutting, or only mentioned in the pitch?

## Cleaned transcript (paraphrased, ASR noise removed)
> Speakers are inferred. "Team" covers whichever of us was presenting.

**[00:00] Team (Demo A):** Here are the flags from the agents. Some requirements belong to a field where we agreed on a requirement in the past. A competitor agent is always running. If a competitor like Porsche does something new that goes against our requirement, it flags it. Here it says a competitor now exceeds our range target: we had WLTP ≥ 750 km, and the competitor is at about 792 km. So we don't stay behind and can catch up quickly. The PM gives a remark, maybe "this is dumb, we won't do it", and that is fed back to the agent. The agent also flags market conflicts.

**[01:41] Team:** These are requirements from a colleague that I review as the lead PM. Teammates hand them to me when they're done. And these are the ones I work on myself or delegate.

**[02:11] Team:** These are the cases. A case is based on research, i.e. different inputs: dealer calls (51 here), owner reviews, the customer study, competitors, YouTube reviews. These are all signals. Each one has the exact conversation with the customer, for example, plus a summary. From all of that input we get a case, e.g. "owners say there's too much …". Each case is assigned to a colleague and has a state, and you always see what your colleagues work on. Then you work on the case and build requirements from it. It isn't finalized. What do you think of this format?

**[04:22] Thomas:** I like the idea a lot, those charts, because you can see how strong a signal is. And I like the cases, because a case is an overall topic that you have to deep dive into.

**[04:49] Team:** This is a done case: from it we built these requirements, by the AI and by colleagues. The data here are seeds and not accurate; we're working on the UX. These are abstractions of the original sources. We could have built the case directly from the signals, but this layer adds clarity. That's how the model will work: get the signals, interpret them, build the case.

**[06:06] Thomas:** Makes sense.

**[06:10] Team (Demo B):** I built a lot on top of this. Same idea: start with the case, and if it's decided and doable it becomes a requirement. I added a signal radar. You can refresh, and you see which agents fetched data, how much it cost and what they did. Everything goes into a database, so you see the newest events: trends, innovation scout, signals from the CSV files, and sources like YouTube videos and articles. Here you see how many signals are clustered into the same theme.

**[07:21] Thomas:** Where do these categories come from, the CSV files or the VFC levels?

**[07:34] Team:** From the CSV, and the AI clusters them into categories.

**[07:51] Thomas:** I think you need a fixed taxonomy, a fixed list of categories. An agent invents new categories that mean the same thing, and you will face that problem. You get customer feedback, it invents another category, but we already have something similar named differently. So just have predefined categories. Look at the customer-feedback CSV and analyse VFC level 2 and level 3, the category and the component. That gives you a fixed list to use for the themes.

**[09:13] Team:** Like a taxonomy, and we map to it.

**[09:34] Thomas:** Exactly. It's a classification problem, not a regression problem. Otherwise you end up with ten categories that mean the same thing but are written differently, because the agent doesn't know which categories we have. Just a tip.

**[09:47] Team:** Good, I'm going to add that. From the signals we generate a candidate case, e.g. luggage loading, state New, then Investigating, where you ask what exactly the problem is. Here: it doesn't feel sporty to repeat customers, who is affected, a summary, and all the signals, e.g. from the feedback CSV or a website you can click through to. We can leave open questions for an engineer and wait for answers. Then we decide if it's feasible: ready to decide, after the PM's meetings. Then build the requirements, or refer it to another PM. Maybe we also add a chat with other PMs for collaboration, since all they do is talk and have meetings. If it doesn't fit this series (Lena Hofmann, for example, only owns the 5 Series), you can park it in an innovation pool shared by many PMs.

**[11:53] Team:** The requirements page works the same way: draft, then in discussion with engineering and finance, then approved by the PM, signed off with exact cost and plan, then planned. A planned requirement goes into the next generation of the series, so we have a vehicle plan, an overview of upcoming features. Each requirement has its own ID, and you see which are planned and which are about to be.

**[12:54] Team:** Each case has a chat inside. The AI needs a big context and a big model, maybe GPT-5, I don't know, we'd need to try. It always has the general BMW identity and the specific model and series. So it's a big RAG with knowledge, all the signals, and the existing chat, so it knows what you're talking about. It should be able to ask you questions, like Claude does: "Can you tell me if this is feasible?" The AI should be interactive and smart, not just a chatbot sitting there. It can act: add questions, refer this to someone, send it to someone. Here it added questions for engineering and finance, e.g. "ask engineering what target for …" and "ask finance what they should investigate with the engineers". You accept or reject, and it all goes into the context.

**[15:05] Team:** Question: should the kanban board be about the cases or the requirements? It's a double and could be confusing.

**[15:19] Thomas:** Having two boards is confusing. I like the cases one.

**[15:33] Team:** Requirements are about the cases. Once you click a case, you get its requirements. They're the end goal.

**[15:47] Thomas:** Right. You have signals, then a layer where you aggregate signals, then cases. Keep it to few data structures and make it straightforward. Signals I like, of course. The aggregated signals are fine as well, you need that layer. Then you have a case. And how do you get from a case to a requirement?

**[16:29] Team:** The case is the research from the signals. Then we add what the PM knows: this model is mostly for the US market and we don't optimize for that one; we don't care as much about cost and want it more luxurious. All those details PMs hold in their heads, we add as context. From the case plus that knowledge we build the requirements. One case can have n requirements.

**[17:24] Thomas:** And the vehicle plan consists of requirements?

**[17:39] Team:** Yes. Requirements go to people, are handed off to engineering for planning, all parties agree, and their feedback goes back into the case. These are the requirements that came out of this one case.

**[18:39] Team:** Do we really need a second kanban board? We don't. It's confusing, so we only keep cases on the board. For requirements, maybe just a list, like a review board the PM looks at.

**[19:09] Thomas:** I like this one more [the list]. I like the visual distinction between the categories. Maybe put the vehicle plan and requirements together. You have a lot of features, which is good, but you shouldn't have too many. It's a bit overwhelming what you can do in your app. Streamline it and focus on the most important data sources.

**[20:10] Team:** We'll combine them; we worked with different focuses. From Demo B, the innovation pool and the vehicle plan based on requirements should go in. Once I have a case, there's a "Work this case" button. On the case page there's the md file, the thorough analysis of all the signals. Alongside it, a questionnaire that tries to collect as much of the PM's knowledge as possible, where they type in input. Then a "Create requirements" button gives all the requirements for this case. Then you start chatting with the AI about the draft, pushing back and forth.

**[21:41] Thomas:** So the chat is there to harden the requirement.

**[21:49] Team:** Exactly. The app is your colleague. You get the first draft, keep discussing the logic based on everything you know and whatever you think is sketchy, and decide which requirements to keep, drop or edit. Per case you end up with a list of requirements, plus a page with all the inputs and the resulting requirements.

**[22:37] Thomas:** I like that you're building a real collaboration platform for the whole department. Mention that in your pitch: a whole suite for the product development process. But again, don't overcomplicate the feature set. Less is more. Really think: do we need this, or is it too much? To be honest, it's a bit overwhelming what your web app can do. A PM should understand it in one look.

**[23:42] Team:** We got many points to remove; we'll simplify.

**[23:48] Thomas:** The basic data structure is good and it looks good. In your pitch, sell it as a collaboration platform for the whole product life cycle or development process. Sell the kanban, because PMs already use it in Jira and know it. They can assign each other cases. You're working with what they already do, just optimizing it.

**[24:31] Team:** Is a chat between colleagues inside the app overkill?

**[24:35] Thomas:** It makes sense for a collaboration platform, but in the end they have Microsoft Teams, so they won't chat in your app. Jira doesn't have a discussion feature either. Notifications, e.g. for signals and new mentions from comments, yes. I like the comment function, keep that. Chat is a nice feature, but it makes it sound like a massive product.

**[25:37]** End.
