# BMW Challenge – Product Manager Interview (10.10.2026)

Cleaned from four ASR transcripts (16:05, 16:14, 16:24, 16:45). Filler words and ASR noise removed; wording lightly normalised, content unchanged. The speakers were not separated by the ASR (everything is tagged "You"), so Q = our team, A = BMW product managers (PMs). Where the audio was unclear I marked it with *[unclear]*.

This file holds both the summary (key takeaways) and the cleaned transcript. There is no separate raw transcript in `raw/`. The follow-up one-on-one with Patrick is summarised in [`2026-10-10_pm-interview-patrick_summary.md`](2026-10-10_pm-interview-patrick_summary.md).

Context: we are building an AI platform that helps BMW product managers research and define requirements for new/existing vehicles.

---

## Key takeaways

**Innovation vs. improvement**
- Platform should support both: improving existing features (driven by negative customer feedback) and innovating (new features/products).
- AI is good at fetching data and giving a **traceable** rationale for a requirement. Real innovation is harder: an LLM only recombines its training data, and innovation can't be measured → keep a **human in the loop**. Idea: the AI generates *innovation / feature / requirement candidates* and pipes them to the PM (optionally with deep research).
- BMW innovation comes mostly from **competitors, other industries and suppliers/partners** (e.g. trade fairs like CES in Las Vegas → foldable displays; the iX3 panoramic vision came from a supplier, BMW named/marketed it). PMs also watch luxury brands and market trends. PMs themselves have little contact with suppliers.
- Many cars are very similar (big screens everywhere); design differs.

**How a new model is planned**
- BMW always works on the *next generation*; the current model is fixed and in production. Model life is ~5–7 years; around year 3 there is a **life-cycle input** (e.g. two new colours, small changes). A full refresh mid-cycle is too expensive.
- A new model both innovates **and** fixes complaints from the predecessor, and may target new customers (e.g. 1 Series as entry model facing cheap Chinese competitors – must stay premium but match their feature baseline).
- Requirement sources: customer feedback, market-specific needs (e.g. China), competitor features, brand identity (e.g. rear-wheel-drive "BMW-ness"), positioning goals (e.g. move from #3 to #1 in the European segment).
- Process: define a minimum feature set to be competitive → add what makes it "BMW and best in category" → group by categories (comfort, interior, exterior …) → shape a vision → take it to engineers → negotiate where cost makes things infeasible (e.g. 900 km range acceptable, 700 km not, since Chinese competitors reach 800 km).
- Beyond **model projects** there are **option projects** (scalable supply chain, e.g. 3 seat variants, "Lego"-like configurator) and **market requirements** (Norway wants heated steering wheel, Italy wants A/C). Different PMs own different vehicle parts.
- BMW has no single documented "source of truth" for brand taste; much of it is implicit/in the PM's head. Brand traits: sporty, fast, efficiency.

**Current workflow / tools**
- Very manual: **Excel and PowerPoint** (export from source systems, analyse in Excel, put back), **Jira** (ticketing), Confluence, SharePoint with PowerPoint.
- Ideas are discussed with teammates continuously; format depends on the stage.
- Biggest pain point: **research** – combining customer feedback, social media, reviews, competitor data. Automating it makes the PM ↔ agent ↔ engineer loop faster regardless of the number of iterations.

**What the PMs want from the tool**
1. **Gather and research** from many sources (social media, reviews, competitors) automatically.
2. **Generate requirements** from the research *plus* the PM's stated preferences/priorities.
3. **Prioritisation / weighting**: PM sets what is important and how much (e.g. budget vs. speed vs. comfort); changing priorities should re-rank features. Try different priorities and see what changes (e.g. which features stay on top regardless).
4. **Full traceability**: why each requirement/ranking exists; ability to trace suggestions back and "reverse" the perspective.
5. **Human decides.** Tool recommends; PM accepts/denies. PM must be able to justify decisions to engineers who will challenge them.
6. **PM-initiated flow preferred**: the PM opens the app and states what they want (e.g. "new model focused on speed"), rather than the AI proposing a whole strategy on its own. Proactive suggestions are acceptable as input, not as decisions.
7. **Source filtering**: ability to skip/exclude sources (e.g. social-media users who aren't the target audience; focus only on current customers).
8. **Don't hide or decide on its own**: surface controversial findings (e.g. Chinese customers want X, US customers hate X) and leave the decision to the PM (which market matters more, or build two variants). Add accuracy/importance/statistics per finding or market to support that decision.
9. **Collaboration**: PM workload is large, so the tool could be shared by several PMs (e.g. one on comfort, one on speed), who can all challenge what it suggests.

**Follow-up**
- A colleague, Patrick (product manager), was to be pulled in for the innovation/supplier questions.

---

## Cleaned transcript

### Part 1 – 16:05–16:12 (starts mid-conversation)

> **Q:** …fix that, or another part which innovates, both. What's the partition there – 50/50?
>
> **A:** It depends. If a car has a lot of negative feedback, we fix more – improve existing features or drop something. Our platform should solve both. You can focus on improving existing features if you want, but ideally it's both. Innovating is also important because you need to come up with new features.
>
> **Q:** My problem is how to rely on AI to innovate for us. AI can fetch the data and give a traceable decision for why to implement a requirement in our existing product. A workflow for that is fine. But it's trickier for AI to innovate and give broad decisions like "don't focus on this BMW line, create a new product, call it this, make it similar to Chinese cars" – a whole new BMW. Product improvement and product innovation aren't the same thing. The innovation part is tricky: the LLM comes up with ideas that may come from a competitor, because it saw them on the internet or in its pre-training. You can't measure that innovation, so the human in the loop is important. Maybe we help the human innovate – produce innovation/feature/requirement candidates and pipe them to the PM, who thinks about them, or we do deep research. I agree the innovation part is tricky because an LLM doesn't come up with something truly new; it's all in the training data. Do you at BMW have a source of truth about each car – the brand's taste and preferences – so that when you innovate you always take it into account?
>
> **A:** That's fairly easy, we have sporty cars, fast cars, and efficiency. As engineers and PMs we know these as BMW fans, and there's something structured, but it's more complicated. Do you know the iX3 – did you look at it? The panoramic vision, the new head-up display: a pretty nice feature. We didn't come up with that idea; a supplier did. They innovate and offer it to us, we say "we want that" and sign a contract. We developed the name and the marketing, but they invented it.
>
> **Q:** So you also take into account partners' innovations?
>
> **A:** Yes. In innovation you always look at competitors. All cars are really much the same – every Mercedes, Audi… everything has these big screens, Mercedes even bigger; the design differs.
>
> **Q:** Do the product managers know the suppliers, e.g. for the panoramic vision?
>
> **A:** They're not suppliers as such. I don't think program managers have much to do with suppliers.
>
> **Q:** How do PMs get information about what a supplier implemented?
>
> **A:** They look into other industries and other luxury brands, market trends. I'll send you Patrick – he's the product manager and the better person for these questions. I'll reach out to him and send him here.
>
> **Q:** Thank you.

### Part 2 – 16:14–16:23

> **Q:** What we're trying to understand now is the difference in your workflow between innovating a completely new product and fixing an existing car. What's the difference?
>
> **A:** It's a tricky point. You can analyse what people like or dislike about your current model, and customer feedback comments on what they have already seen. I can't comment on future things. Innovations often come from competitors, sometimes from other industries. For example, we go to exhibitions, say in Las Vegas, and see what other industries do. Say the trend is foldable displays; we ask whether we need them, then go back to what we have and what customers ask for. If the innovation solves a big customer need, the product manager together with engineers decides. At that point it's less customer feedback and more thinking.
>
> **Q:** How does the PM decide whether a feature goes into an existing series or whether a new series is needed?
>
> **A:** We're always working on the next generation, because the current model is fixed and in production. A car is on the market about seven years, and in the middle, around year three, you have life-cycle inputs – add two colours, change a bit. It's still the same car, a bit of fixing. It's very rare to produce a new version of the same model after three and a half years; it's too expensive. BMW has long cycles of five to seven years. So if you want to invent something completely new, like the vehicle you saw on stage, you start working on the new generation immediately, and it's on the road in five years. It's rare that current innovations get built into the current model. The new model does two things: it innovates and it fixes complaints from the old cars. It depends – if there are segments we need to improve, the target of a new model can also be reaching new customers. For example, the 1 Series is an entry model, and now we face cheap new competitors. We're premium, so we have to find where it's still BMW and premium but includes the features expected from, e.g., Chinese brands at entry level.
>
> You're always trying to build a new car, and it must satisfy different criteria: customer complaints, different markets (e.g. China), things a competitor added that you want too. The requirements are based on categories of what the PM wants and what the markets want. It starts with "where are we now": e.g. the 1 Series is #3 in Europe and we want to be #1 to sell more cars. What do our customers currently like and dislike?
>
> In parallel, we look at customers moving to Chinese brands – what they have that we don't. Then we set a list of features that is the minimum to be competitive. On top you need what makes you BMW and best in category – iconic features, e.g. rear-wheel drive. You define requirements across categories (comfort, interior, exterior…) and shape the vision of the vehicle. With that I go to the engineers; they say it's too expensive or not possible. Then we define which criteria are negotiable – e.g. we don't need 1,000 km range, 900 is enough, but 700 isn't worth it because Chinese competitors reach 800. That's where you constantly balance. It's a very manual process – analysing documents, PowerPoints, the internet.
>
> **Q:** You're already doing all of this. What we want is to make this process a million times easier and faster, and hopefully better – maybe even better ideas than before. To do that we need to know your current workflow: which tools, how often you talk to teammates, what formats you use.
>
> **A:** Until very recently: Excel and PowerPoint. There are source systems, but to analyse you export to Excel, work there, and put it back. Shared platforms between PMs: Jira (a ticketing system), Confluence, SharePoint with PowerPoint.
>
> **Q:** You don't come up with requirements in a back room – you discuss ideas with teammates. What do you present to another PM and how?
>
> **A:** It depends on the stage. *[answer continues in Part 3]*

### Part 3 – 16:24–16:35

> **A:** There are other product managers responsible for different parts of the vehicle, so it's always by attributes. There are model projects and also option projects. Option projects exist because we can't produce completely new seats for every model; it has to be scalable. So we build the supply chain around, say, three seat variants (leather, other materials…). Some models, like the 7 Series, can't do cheap plastic; they insist on leather. Markets have needs too: Norway wants a heated steering wheel, Italy doesn't need heating but wants air conditioning. You try to build a program of options that works like Lego in the end – like the configurator, where you put the model together.
>
> **Q:** *(on the tool concept)* It still depends on the priority the PM chooses. If your next-generation priority is sporty cars, we give you requirements accordingly; if your priority is budget, the requirements change. Every decision has an explanation and a traceable reason, and then the PM decides. We also need to know how much the PM interacts with the software: accept/deny every requirement, or more autonomous? How autonomous should the agent be?
>
> **A:** Everything must be traceable. The tool should help me define what is important and how important. The weighting idea is good – after one or two meetings I may decide to reorder features based on budget. It sounds like the right direction. In the end the person decides based on recommendations, but must understand why features are ranked as they are.
>
> **Q:** Would you use the app by writing what you want ("a new model focused on speed, neglecting comfort"), or would you also want the platform to suggest it, e.g. based on customer reviews and competitor performance, and give you requirements unprompted?
>
> **A:** The first makes more sense. If the tool suggests something and I agree, I still go into the round with engineers, and they will challenge me and ask why I need it.
>
> I need to be able to trace back all suggestions, and also to reverse the perspective – put other priorities into the tool and see what comes up. E.g. "whether I choose speed or comfort, this feature is always on top", but if I choose budget, comfort goes down. Then it's up to us managers to decide whether that's acceptable.
>
> **Q:** So you want to work in a loop with an AI agent: it suggests a new model, you challenge it, get feedback, talk to engineers about implementation, give their input back to the agent, and so on – like an assistant in a team?
>
> **A:** That's exactly how we work today, but the information gathering and research is the bottleneck. If that is automated, it doesn't matter how many loops we make – it goes faster.
>
> **Q:** So your main pain point is research.
>
> **A:** Yes – combining lots of information from customers, social media, competitors, and redoing it every time you're challenged.
>
> **Q:** So the two main things: (1) gather information and research from very different sources (social media, reviews, competition); (2) help create requirements from that research plus your stated preferences. If you don't like them, you discuss with the agent; if you do, they go to an engineer.
>
> **A:** It's also important to be able to skip some sources. Social media users write a lot but aren't necessarily my model's audience. It's interesting as background, but sometimes I want to focus only on requirements from, say, current customers. If the agent finds people disliking a certain feature, it can't decide whether to eliminate or keep it, because it doesn't know what BMW wants – keep that decision open for the manager. The tool should not hide anything or decide on its own; it should show all controversial findings. If Chinese customers want something that US customers hate, I need to know, so I can decide which market matters more, or build two different vehicles.
>
> **Q:** Maybe add a rate of accuracy or of how important a finding is for the market, to help you decide.
>
> **A:** Yes, statistics would help – e.g. what group is saying what, and how important that market is. If only two vehicles are wanted in the US but they shout a lot, I'd probably decide against them – but we still flag it. The challenge is that the PM has to deal with every problem, and that's a lot; the tool must make it easier. The PM's job is the entire vehicle, or the tool is delegated across several PMs – e.g. I'm on comfort and a colleague is on speed. It could also be a shared product-management tool where everyone looks at it and can challenge what it decides.
>
> **Q:** Thank you, that helps. *(Thanks all round.)*

### Part 4 – 16:45–16:46 (internal side conversation after the interview)

Mostly unintelligible ASR output. Recoverable gist: discussion of the **attributes of each case/entity so they can be shown easily in the UI**, positive remarks about the concept and being aware of the users, and an attempt to try something out *[unclear]*. No decisions can be reliably extracted.

---

## Source files

- `D:\Documents\MeetingTranscripts\2026-10-10_16-05\transcript.final.md`
- `D:\Documents\MeetingTranscripts\2026-10-10_16-14\transcript.final.md`
- `D:\Documents\MeetingTranscripts\2026-10-10_16-24\transcript.final.md`
- `D:\Documents\MeetingTranscripts\2026-10-10_16-45\transcript.final.md`
