import {
  initialize,
  MidiClip,
  type ActivationContext,
  type Handle,
  type NoteDescription,
} from "@ableton-extensions/sdk";

const COMMAND_ID = "reverse-midi.reverse";

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  // The command that does the work. Live passes the right-clicked object's
  // Handle as the first argument for object-scoped context menu actions.
  context.commands.registerCommand(COMMAND_ID, (arg: unknown) => {
    const clip = context.getObjectFromHandle(arg as Handle, MidiClip);
    const notes = clip.notes;

    if (notes.length === 0) {
      console.log("Reverse MIDI: this clip has no notes to reverse.");
      return;
    }

    // Reverse within the bounding box of the existing notes: the span from the
    // earliest note start to the latest note end. Mirroring inside this window
    // keeps the result self-contained and independent of loop/marker settings.
    const spanStart = Math.min(...notes.map((n) => n.startTime));
    const spanEnd = Math.max(...notes.map((n) => n.startTime + n.duration));

    const reversed: NoteDescription[] = notes.map((n) => ({
      ...n,
      // New start = mirror the note's end across the span, so a note that
      // finished late now begins early, and its duration is preserved.
      startTime: spanStart + spanEnd - (n.startTime + n.duration),
    }));

    // Group the change into a single user-facing undo step.
    context.withinTransaction(() => {
      clip.notes = reversed;
    });

    console.log(
      `Reverse MIDI: reversed ${notes.length} note(s) across beats ` +
        `${spanStart.toFixed(3)}–${spanEnd.toFixed(3)}.`,
    );
  });

  // Add the action to the right-click menu of any MIDI clip.
  context.ui.registerContextMenuAction("MidiClip", "Reverse Notes", COMMAND_ID);

  console.log("reverse-midi extension activated.");
}
