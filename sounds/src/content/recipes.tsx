import type { ComponentType } from "react";
import { VocoderFlow } from "~/components/diagrams";
import { CHORDS_URL, Cell, KeyBox, Row, Sheet, Steps, Task } from "~/components/ui";

export interface Recipe {
  id: string;
  title: string;
  artist: string;
  track: string;
  album: string;
  summary: string;
  Body: ComponentType;
}

// To add a recipe: add an entry here. Cite where any claim about the record comes from.

const thePeace: Recipe = {
  id: "the-peace",
  title: "Vocoder chords, like “The Peace”",
  artist: "underscores",
  track: "The Peace",
  album: "U (2026)",
  summary: "A drumless pop ballad carried by a vocoder chord progression, with reverb and harmonies building around it.",
  Body: () => (
    <>
      <p>
        On “The Peace”, from <i>U</i> (20 March 2026), underscores builds a pop ballad with no drums. The song centres on a vocoder chord progression; as it goes on, reverb and new harmonies enter while that vocoder refrain stays central. The FADER compares it to Imogen Heap and Frou Frou.
      </p>
      <p className="src">
        Description from <a href="https://www.thefader.com/2026/03/20/underscores-u-the-peace-review">The FADER’s review</a>. underscores is credited with production, mixing and mastering, but the actual chain isn’t public, so this is a way to get there in Live, by ear.
      </p>
      <Sheet head="Listen for">
        <Row>
          <Cell l="Vocoder" span={2} tone="lit">A voice singing in chords, shaped by a synth</Cell>
          <Cell l="No drums" span={2}>Pulse comes from the chords and the words</Cell>
        </Row>
        <Row>
          <Cell l="Development" span={2}>Reverb and extra harmonies arrive over time</Cell>
          <Cell l="Restraint" span={2}>Few parts, each one clear</Cell>
        </Row>
      </Sheet>
      <h3>How a vocoder works</h3>
      <p>A vocoder takes the shape of one sound (your voice, the modulator) and applies it to another (a synth, the carrier). The words come from you; the notes come from the chords you play. So the chords' voicing is the melody's harmony.</p>
      <VocoderFlow />
      <h3>Build it</h3>
      <Sheet head="1 · Carrier" sub="MIDI track “Chords”">
        <Row>
          <Cell l="Instrument">Wavetable or Drift, saw or square</Cell>
          <Cell l="Envelope">Attack 5–10 ms · full sustain</Cell>
          <Cell l="Voices">4–5 note chords</Cell>
          <Cell l="Audio To" tone="lit">Sends Only</Cell>
        </Row>
      </Sheet>
      <Sheet head="2 · Vocoder" sub="On the vocal track">
        <Row>
          <Cell l="Carrier" span={2} tone="lit">External → Chords · Post FX</Cell>
          <Cell l="Bands" num>32–40</Cell>
          <Cell l="Range" num>80 Hz – 12 kHz</Cell>
        </Row>
        <Row>
          <Cell l="Unvoiced" span={2}>Up a little, so consonants read</Cell>
          <Cell l="Enhance">On</Cell>
          <Cell l="Dry/Wet" num>100% on this copy</Cell>
        </Row>
      </Sheet>
      <Sheet head="3 · Two vocals">
        <Row>
          <Cell l="Lead" span={2}>Dry vocal · EQ · Compressor 3:1 · plate send</Cell>
          <Cell l="Vocoded" span={2} tone="lit">Duplicate of the lead · Vocoder · high-pass 150 Hz</Cell>
        </Row>
      </Sheet>
      <Steps>
        <><b>Record a vocal,</b> or use any spoken or sung take. Even talking works as a modulator; the notes come from the chords.</>
        <><b>Make the carrier.</b> A MIDI track with a bright, simple synth. Bright waveforms give the vocoder more to shape, so words stay clear.</>
        <><b>Write the chords in the key.</b> Use the chords below or a progression from <a href={CHORDS_URL}>Chords</a>. Let each chord overlap the next slightly, so the voice never drops out between them.</>
        <><b>Voice-lead smoothly.</b> A vocoder exposes every note. Move each voice as little as possible from chord to chord.</>
        <><b>Set up the Vocoder</b> on a duplicate of the vocal, using the sheet above. Then solo it and sing over the chords.</>
        <><b>Blend.</b> Try the vocoded copy alone for a refrain, then under the dry lead for a verse.</>
        <><b>Develop without drums.</b> Over the song, push the plate send up, add a second vocoded layer with a higher voicing, and open a filter on the chords.</>
      </Steps>
      <h3>Chords in this key</h3>
      <KeyBox />
      <Task>Make an 8-bar drumless refrain: vocoded chords on a vocal, a dry lead above it, and the plate send rising across the eight bars. Bounce it.</Task>
    </>
  ),
};

export const RECIPES: Recipe[] = [thePeace];

export function findRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
