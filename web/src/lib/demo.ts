/**
 * Demo helpers owned by the UI (prefill texts for the stage demo).
 * Not part of the API contract.
 */
export const sampleMeetingNotes: Record<string, { title: string; attendees: string[]; text: string }> = {
  "CASE-G60-0005": {
    title: "Climate sync with engineering and design",
    attendees: ["Lena Hofmann", "Climate systems (Engineering)", "Interior design", "Controlling 5 Series"],
    text: `Climate sync 10.10.

- Engineering: today the G60 needs about 9 minutes to cool the cabin from 45 °C to 22 °C. The Mercedes E-Class does it in roughly 6 minutes in our benchmark. A 6-minute target is realistic with the new compressor.
- Design: a slim physical climate bar below the display is possible and fits the design language if it uses the same glass-look surface.
- Controlling: the climate bar costs about €18-25 per car.
- Next: Lena to update the case and draft a requirement.`,
  },
};
