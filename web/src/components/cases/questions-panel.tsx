"use client";

import { useState } from "react";
import { CheckCircle2, CircleDot, ClipboardPaste, Plus } from "lucide-react";
import { Addressee as Addressees, addresseeLabel, type Addressee, type OpenQuestion, type Proposal } from "@/contracts";
import { useApiMutation } from "@/lib/api/hooks";
import { fmtDate } from "@/lib/format";
import { sampleMeetingNotes } from "@/lib/demo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/common/badges";
import { ProposalCard } from "@/components/common/proposal-card";
import { useUsers } from "@/components/common/people";

export function QuestionsPanel({ caseId, questions, proposals, canEdit }: { caseId: string; questions: OpenQuestion[]; proposals: Proposal[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const pending = proposals.filter((p) => p.status === "pending");
  const groups = Addressees.options.map((a) => ({ a, items: questions.filter((q) => q.addressee === a) })).filter((g) => g.items.length);
  const open = questions.filter((q) => q.status === "open").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {open} open · {questions.length - open} answered
        </p>
        <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
          <ClipboardPaste className="size-3.5" /> Paste meeting notes
        </Button>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Add question
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">AI proposals waiting for you ({pending.length})</h3>
          {pending.map((p) => (
            <ProposalCard key={p.id} p={p} canDecide={canEdit} />
          ))}
        </div>
      )}

      {adding && <AddQuestion caseId={caseId} onDone={() => setAdding(false)} />}

      {groups.map((g) => (
        <div key={g.a} className="space-y-2">
          <h3 className="text-sm font-semibold">{addresseeLabel[g.a]}</h3>
          {g.items.map((q) => (
            <QuestionRow key={q.id} q={q} />
          ))}
        </div>
      ))}
      {questions.length === 0 && !adding && <p className="text-sm text-muted-foreground">No questions yet.</p>}
      <MeetingNoteDialog caseId={caseId} open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  );
}

function QuestionRow({ q }: { q: OpenQuestion }) {
  const patch = useApiMutation("patchQuestion", { success: "Answer saved" });
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const { name } = useUsers();
  const overdue = q.status === "open" && q.dueDate && q.dueDate < new Date().toISOString().slice(0, 10);
  return (
    <div className={cn("rounded-lg border bg-card p-3", q.status === "answered" && "bg-muted/30")}>
      <div className="flex items-start gap-2">
        {q.status === "answered" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleDot className="mt-0.5 size-4 shrink-0 text-amber-500" />}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{q.question}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">{q.id}</span>
            {q.contact && <span>→ {q.contact}</span>}
            <span>asked by {name(q.askedBy)}</span>
            {q.dueDate && <Pill t={overdue ? "red" : "outline"}>due {fmtDate(q.dueDate)}</Pill>}
            {q.fieldsAffected.length > 0 && <span>affects: {q.fieldsAffected.join(", ")}</span>}
          </div>
          <p className="text-xs text-muted-foreground">Why: {q.why}</p>
          {q.status === "answered" && (
            <div className="mt-1 rounded-md border-l-2 border-emerald-500 bg-emerald-50/60 px-2 py-1 text-sm dark:bg-emerald-950/30">
              {q.answer}
              <span className="ml-2 text-[11px] text-muted-foreground">
                ({q.answerSource?.replace("_", " ")}, {fmtDate(q.answeredAt)})
              </span>
            </div>
          )}
          {answering && (
            <form
              className="mt-2 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                patch.mutate({ params: { id: q.id }, body: { answer, status: "answered" } }, { onSuccess: () => setAnswering(false) });
              }}
            >
              <Textarea autoFocus rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="What did they say?" />
              <div className="flex gap-2">
                <Button size="xs" type="submit" disabled={!answer.trim()}>
                  Save answer
                </Button>
                <Button size="xs" variant="ghost" type="button" onClick={() => setAnswering(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
        {q.status === "open" && !answering && (
          <div className="flex shrink-0 gap-1">
            <Button size="xs" variant="outline" onClick={() => setAnswering(true)}>
              Log answer
            </Button>
            <Button size="xs" variant="ghost" onClick={() => patch.mutate({ params: { id: q.id }, body: { status: "dropped" } })}>
              Drop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddQuestion({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const create = useApiMutation("createQuestion", { success: "Question added" });
  const [addressee, setAddressee] = useState<Addressee>("engineering");
  const [question, setQuestion] = useState("");
  const [why, setWhy] = useState("");
  const [contact, setContact] = useState("");
  const [due, setDue] = useState("");
  return (
    <form
      className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ params: { id: caseId }, body: { addressee, question, why, contact: contact || undefined, dueDate: due || undefined } }, { onSuccess: onDone });
      }}
    >
      <div className="space-y-1.5">
        <Label>Addressee</Label>
        <Select value={addressee} onValueChange={(v) => setAddressee(v as Addressee)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Addressees.options.map((a) => (
              <SelectItem key={a} value={a}>
                {addresseeLabel[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Contact (optional)</Label>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Powertrain / HV battery" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Question</Label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What do you need to know?" />
      </div>
      <div className="space-y-1.5">
        <Label>Why it matters</Label>
        <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. defines the metric target" />
      </div>
      <div className="space-y-1.5">
        <Label>Due</Label>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button size="sm" type="submit" disabled={question.trim().length < 3 || create.isPending}>
          Add question
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MeetingNoteDialog({ caseId, open, onOpenChange }: { caseId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const add = useApiMutation("addMeetingNote", { success: (r) => `${r.proposals.length} AI proposal${r.proposals.length === 1 ? "" : "s"} from your note` });
  const sample = sampleMeetingNotes[caseId];
  const [title, setTitle] = useState("");
  const [attendees, setAttendees] = useState("");
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste meeting notes</DialogTitle>
          <DialogDescription>The AI matches the notes to this case&apos;s open questions and proposes answers and field updates. You accept each proposal; nothing changes automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {sample && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTitle(sample.title);
                setAttendees(sample.attendees.join(", "));
                setText(sample.text);
              }}
            >
              Use the demo note for this case
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Meeting</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Climate sync with engineering" />
            </div>
            <div className="space-y-1.5">
              <Label>Attendees</Label>
              <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Comma separated" />
            </div>
          </div>
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your notes or the transcript summary…" className="font-mono text-xs" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={text.trim().length < 10 || add.isPending}
            onClick={() =>
              add.mutate(
                { params: { id: caseId }, body: { title: title || "Meeting", date: new Date().toISOString().slice(0, 10), attendees: attendees.split(",").map((s) => s.trim()).filter(Boolean), text } },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    setText("");
                  },
                },
              )
            }
          >
            {add.isPending ? "Extracting…" : "Extract answers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
