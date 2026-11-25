import type { ComponentType } from "react";
import { Arrangement, EqChart, Rack, SignalMap } from "~/components/diagrams";
import { CHORDS_URL, Cell, KeyBox, Note, Row, Sheet, Steps, Task } from "~/components/ui";
import { useValues } from "~/lib/store";

export interface Lesson {
  id: string;
  title: string;
  Body: ComponentType;
}

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  lessons: Lesson[];
  /** Lessons outlined but not written yet. */
  planned: string[];
  /** Shown on a theme with no lessons yet. */
  Extra?: ComponentType;
}

// To add a lesson: add an entry to a theme's `lessons`, and remove it from `planned`.

const sound: Theme = {
  id: "sound",
  name: "Sound quality",
  blurb: "Gain, listening, EQ, compression, saturation, space and loudness: the habits behind audio that sounds expensive.",
  planned: [],
  lessons: [
    {
      id: "gain",
      title: "Gain staging",
      Body: () => (
        <>
          <p>Every device in a chain reacts to how loud its input is. Saturation drives harder, compressors grab more, and the master clips. Gain staging means keeping every track at a sensible level so devices behave the way their defaults expect.</p>
          <Sheet head="Targets" sub="Peaks, dBFS">
            <Row>
              <Cell l="Recording" num>−10 dBFS peaks</Cell>
              <Cell l="Each track" num tone="lit">−12 to −6 dBFS</Cell>
              <Cell l="Master, before mastering" num>about −6 dBFS</Cell>
              <Cell l="Format" num>48 kHz · 24-bit</Cell>
            </Row>
          </Sheet>
          <Steps>
            <><b>Set the format once.</b> Settings → Audio: sample rate 48 kHz. Settings → Record, Warp &amp; Launch: bit depth 24.</>
            <><b>Gain at the start of the chain.</b> Put Utility first on each track and set its Gain so the track peaks in the target range. Leave the fader near 0 dB for mixing.</>
            <><b>Match in and out on every device.</b> Toggle a device off and on. If it gets louder, it isn't better yet: lower its output until bypass sounds the same level, then judge.</>
            <><b>When the master turns red, turn tracks down,</b> not the master. Select all tracks and pull them down together.</>
          </Steps>
          <Note label="Why it matters:">Live mixes in 32-bit float, so internal clipping is rarely permanent. Analog-modelled plugins like Decapitator and Saturn still react to level, though, and a quiet mix leaves room for the master chain.</Note>
          <Task>Open the Fog set. Get every track peaking between −12 and −6 dBFS with Utility, and the master peaking near −6 dBFS.</Task>
        </>
      ),
    },
    {
      id: "listen",
      title: "Listening and references",
      Body: () => (
        <>
          <p>You can only fix what you hear. Most mix decisions go wrong because of loudness: louder always sounds better for a moment, so compare everything at the same level.</p>
          <Sheet head="Listening setup">
            <Row>
              <Cell l="Volume" span={2}>Low to moderate, the same every session</Cell>
              <Cell l="Mono check" span={2} tone="lit">Utility on master · Width 0%</Cell>
            </Row>
            <Row>
              <Cell l="References" span={2}>Two tracks you love, in Live</Cell>
              <Cell l="Other speakers" span={2}>Phone, earbuds, laptop</Cell>
            </Row>
          </Sheet>
          <Steps>
            <><b>Put references in the set.</b> Drag a track you love onto its own audio track. Turn it down until it sounds as loud as your mix, then mute it when you're not comparing.</>
            <><b>Switch, don't blend.</b> Solo your mix, then solo the reference, a few seconds each. Listen for one thing at a time: low end, vocal level, brightness, width.</>
            <><b>Check in mono.</b> Utility on the master with Width at 0%. If a pad disappears in mono, its stereo trick is cancelling itself out.</>
            <><b>Rest your ears.</b> After 45 minutes, take a break before any big decision.</>
          </Steps>
          <Task>Add “The Peace” and one ambient record as references. Match their loudness by ear, then write down one difference in low end and one in brightness.</Task>
        </>
      ),
    },
    {
      id: "eq",
      title: "EQ that clears space",
      Body: () => (
        <>
          <p>EQ is mostly about removing what each sound doesn't need, so the important part of every other sound comes through. Cut narrow and boost wide.</p>
          <EqChart />
          <Steps>
            <><b>High-pass anything that isn't bass or kick.</b> Pads, vocals and textures usually start around 100–150 Hz. Sweep up until it thins, then back off a little.</>
            <><b>Find a resonance with a narrow boost.</b> In EQ Eight, raise one band by about 10 dB with a high Q and sweep slowly. Where it rings or honks, cut 3–6 dB instead.</>
            <><b>Boost wide and gently.</b> A broad 1–2 dB shelf for air above 10 kHz does more than a sharp 6 dB peak.</>
            <><b>Judge at matched loudness.</b> Use EQ Eight's Output so bypass sounds the same level.</>
          </Steps>
          <Task>Clean the Tape Pad: high-pass it, find and cut one resonance, then compare against bypass at matched loudness.</Task>
        </>
      ),
    },
    {
      id: "comp",
      title: "Compression",
      Body: () => (
        <>
          <p>A compressor turns loud moments down so a sound sits steady in the mix. Too much flattens it; the right amount makes a voice feel close and confident.</p>
          <Sheet head="The controls">
            <Row>
              <Cell l="Threshold">Level where it starts working</Cell>
              <Cell l="Ratio">How hard: 2:1 gentle, 4:1 firm</Cell>
              <Cell l="Attack">How fast it grabs</Cell>
              <Cell l="Release">How fast it lets go</Cell>
            </Row>
          </Sheet>
          <Sheet head="Starting points" sub="Reduction is how many dB it turns down">
            <Row>
              <Cell l="Vocal" tone="lit">Compressor</Cell>
              <Cell l="Ratio" num>3:1</Cell>
              <Cell l="Attack / release" num>10–20 ms / 60–100 ms</Cell>
              <Cell l="Reduction" num>3–6 dB</Cell>
            </Row>
            <Row>
              <Cell l="Drum group" tone="lit">Glue Compressor</Cell>
              <Cell l="Ratio" num>2:1</Cell>
              <Cell l="Attack / release" num>10 ms / Auto</Cell>
              <Cell l="Reduction" num>1–2 dB</Cell>
            </Row>
            <Row>
              <Cell l="Parallel drums" tone="lit">Compressor</Cell>
              <Cell l="Ratio" num>8:1 or more</Cell>
              <Cell l="Dry/Wet" num>30–50%</Cell>
              <Cell l="Reduction" num>8–10 dB</Cell>
            </Row>
          </Sheet>
          <Steps>
            <><b>Start with ratio and threshold.</b> Lower the threshold until the meter shows the reduction above on the loudest moments.</>
            <><b>Shape with attack.</b> Slower attack lets the start of each note through, which keeps punch and consonants.</>
            <><b>Set release to breathe with the tempo.</b> The meter should return to zero before the next phrase or hit.</>
            <><b>Match the level</b> with Makeup and compare against bypass.</>
          </Steps>
          <Task>Put a Compressor on a vocal or the Pad. Aim for 3–6 dB of reduction, match the level, and A/B it. Note what changed.</Task>
        </>
      ),
    },
    {
      id: "saturation",
      title: "Saturation and harmonics",
      Body: () => (
        <>
          <p>Saturation adds harmonics: extra frequencies that make a sound feel warmer, denser and audible on small speakers. A little goes a long way; use the Mix control.</p>
          <Sheet head="What you have">
            <Row>
              <Cell l="Decapitator" span={2} tone="lit">Analog drive, five styles. Great on drums and bass</Cell>
              <Cell l="Radiator" span={2}>Gentle tube warmth for pads and keys</Cell>
            </Row>
            <Row>
              <Cell l="Saturn 2" span={2} tone="lit">Multiband: warm the lows, leave the highs clean</Cell>
              <Cell l="Roar" span={2}>Live 12's own, from subtle to wild</Cell>
            </Row>
          </Sheet>
          <Steps>
            <><b>Drive until you hear it, then halve it.</b></>
            <><b>Use Mix around 20–40%</b> for parallel warmth that keeps the original clean.</>
            <><b>Go multiband for pads.</b> In Saturn 2, saturate only below about 500 Hz for warmth without fizz.</>
            <><b>Check on phone speakers.</b> A bass line that disappears there usually needs harmonics, not more low end.</>
          </Steps>
          <Task>Make the sub bass audible on your phone with Decapitator or Saturn 2, without making it louder on the meter.</Task>
        </>
      ),
    },
    {
      id: "space",
      title: "Space: reverb and delay",
      Body: () => {
        const v = useValues();
        return (
          <>
            <p>Put reverb and delay on return tracks, not on each track, so every sound shares one room. That shared room is most of what makes a mix feel glued.</p>
            <Sheet head="Timing" sub={v.bpm}>
              <Row>
                <Cell l="¼ note" num tone="lit">{v.quarter}</Cell>
                <Cell l="Dotted ⅛" num>{v.dotted}</Cell>
                <Cell l="⅛ note" num>{v.eighth}</Cell>
                <Cell l="1 bar" num>{v.bar}</Cell>
                <Cell l="Pre-delay" num>{v.pre}</Cell>
              </Row>
            </Sheet>
            <Sheet head="Returns">
              <Row>
                <Cell l="A · Plate" span={2} tone="cool">SuperPlate · vocals, snare</Cell>
                <Cell l="Decay">1–1.5 s</Cell>
                <Cell l="Filter" num>HP 250 Hz · LP 7 kHz</Cell>
              </Row>
              <Row>
                <Cell l="B · Hall" span={2} tone="cool">Hybrid Reverb · pads, textures</Cell>
                <Cell l="Decay">2 bars</Cell>
                <Cell l="Pre-delay" num>{v.pre}</Cell>
              </Row>
              <Row>
                <Cell l="C · Echo" span={2} tone="cool">EchoBoy or Timeless 3</Cell>
                <Cell l="Time" num>{v.dotted}</Cell>
                <Cell l="Feedback" num>35–45%</Cell>
              </Row>
            </Sheet>
            <Steps>
              <><b>Returns fully wet.</b> Dry/Wet at 100% on every return; the send knob sets how much.</>
              <><b>EQ the returns.</b> High-pass reverbs around 250 Hz so the low end stays clear.</>
              <><b>Pre-delay keeps things close.</b> A short gap before the tail keeps vocals and hits in front.</>
              <><b>Automate the sends,</b> not the reverb. Pushing a send for one phrase is how a song breathes.</>
            </Steps>
            <Task>Build the three returns and mix a loop using only send levels. No reverb on individual tracks.</Task>
          </>
        );
      },
    },
    {
      id: "loudness",
      title: "Loudness and the bounce",
      Body: () => (
        <>
          <p>Streaming services turn loud tracks down, so crushing a master buys nothing. Aim for a healthy level with dynamics intact, and never clip.</p>
          <Sheet head="Targets">
            <Row>
              <Cell l="Pop" num tone="lit">−10 to −8 LUFS</Cell>
              <Cell l="Ambient" num tone="lit">−16 to −14 LUFS</Cell>
              <Cell l="Ceiling" num>−1 dBTP</Cell>
              <Cell l="Master file" num>WAV · 24-bit · 48 kHz</Cell>
            </Row>
          </Sheet>
          <Steps>
            <><b>Measure integrated loudness</b> across the whole song with a loudness meter. Ozone Elements has one, and the free Youlean Loudness Meter works well.</>
            <><b>Limit last.</b> A limiter at the end of the master, ceiling −1 dBTP, pushing only a few dB.</>
            <><b>Export with File → Export Audio/Video:</b> WAV, 24-bit, 48 kHz, Normalize off. Dither only when exporting to 16-bit.</>
            <><b>Compare against your references</b> at matched loudness one last time.</>
          </Steps>
          <Task>Bounce the fog vignette at 24-bit, 48 kHz. Measure its integrated loudness and true peak, and write both down.</Task>
        </>
      ),
    },
  ],
};

const melody: Theme = {
  id: "melody",
  name: "Melody & harmony",
  blurb: "Music theory in practice: scales, chords, voice leading and hooks. Pairs with Chords.",
  lessons: [],
  planned: [
    "Scales and modes, by ear",
    "Diatonic chords and Roman numerals",
    "Voice leading for pads and vocoders",
    "Writing a melody: contour, motif, repetition",
    "Pop hooks: rhythm first, then pitch",
    "Borrowed chords and colour",
  ],
  Extra: KeyBox,
};

const songs: Theme = {
  id: "songs",
  name: "Songwriting & arrangement",
  blurb: "Pop structure, contrast between sections, and keeping energy moving over time.",
  planned: [
    "Pop song structure: verse, pre, chorus, bridge",
    "Contrast: what changes between sections",
    "Builds and drops without drums",
    "Writing toplines over loops",
    "Finishing: from loop to song",
  ],
  lessons: [
    {
      id: "vignette",
      title: "A 2½-minute vignette",
      Body: () => (
        <>
          <p>The shape that works for short pieces: the weather first, then the harmony, then the pulse. Take it away before the end.</p>
          <Arrangement />
          <Steps>
            <><b>Bars 1–8, fog.</b> One bed loop, filtered dark, opening slowly.</>
            <><b>Bars 9–16, pad.</b> The progression arrives, one chord every two bars.</>
            <><b>Bars 17–32, pulse.</b> Kick and bass together, hats four bars later.</>
            <><b>Bars 33–36, strip back.</b> Drums and bass out, space up.</>
            <><b>Bars 37–40, last swell.</b> Everything back.</>
            <><b>Bars 41–44, tail.</b> Fade the bed; don't cut it.</>
          </Steps>
          <Note label="Shortcut:">the ambient extension's Template tab builds a set with these six scenes already named.</Note>
          <Task>Arrange the fog vignette to this map and bounce a WAV you'd play for someone.</Task>
        </>
      ),
    },
  ],
};

const scapes: Theme = {
  id: "scapes",
  name: "Soundscapes",
  blurb: "Textures, generated audio, playable pads, and the five-layer map behind slow, wide music.",
  planned: [],
  lessons: [
    {
      id: "map",
      title: "The five-layer map",
      Body: () => (
        <>
          <p>Beds, pads, drums, bass and space. Each layer has one job; most mix problems come from two layers doing the same one.</p>
          <SignalMap />
          <Sheet head="Layers" sub="Where each one lives">
            <Row>
              <Cell l="Beds" tone="cool">The weather</Cell>
              <Cell l="Range" num>200 Hz – 8 kHz</Cell>
              <Cell l="Start from" span={2}>AI Textures · Beds track</Cell>
            </Row>
            <Row>
              <Cell l="Pads" tone="cool">Harmony you play</Cell>
              <Cell l="Range" num>150 Hz – 4 kHz</Cell>
              <Cell l="Start from" span={2}>Tape Pad · <a href={CHORDS_URL}>Chords</a></Cell>
            </Row>
            <Row>
              <Cell l="Drums" tone="lit">Pulse and grain</Cell>
              <Cell l="Range" num>40 Hz – 12 kHz</Cell>
              <Cell l="Start from" span={2}>Drums &amp; groove theme</Cell>
            </Row>
            <Row>
              <Cell l="Bass" tone="lit">Weight under the root</Cell>
              <Cell l="Range" num>35 – 150 Hz</Cell>
              <Cell l="Start from" span={2}>Low end lesson</Cell>
            </Row>
          </Sheet>
          <Task>Build the five layers in one set. The ambient extension's Template tab does most of it in one click.</Task>
        </>
      ),
    },
    {
      id: "textures",
      title: "Textures as instruments",
      Body: () => {
        const v = useValues();
        return (
          <>
            <p>A generated file becomes useful when you can play it. Each use needs the file made differently.</p>
            <Sheet head="Played pad" sub="Simpler · Classic">
              <Row>
                <Cell l="Loop">On · fade 35%</Cell>
                <Cell l="Attack / release">Slow / long</Cell>
                <Cell l="Transpose" num tone="lit">{v.transpose}</Cell>
                <Cell l="Warp">Off</Cell>
              </Row>
              <Row>
                <Cell l="Generate" num span={4}>{v.cmdPads}</Cell>
              </Row>
            </Sheet>
            <Sheet head="Bed loop" sub="Audio clip · Session">
              <Row>
                <Cell l="Length" num>14 bars</Cell>
                <Cell l="Duration" num>{v.loopSecs}</Cell>
                <Cell l="Warp">On · 1.1.1 at start</Cell>
                <Cell l="Follow action">Next · 14 bars</Cell>
              </Row>
              <Row>
                <Cell l="Generate" num span={4}>{v.cmdLoops}</Cell>
              </Row>
            </Sheet>
            <Steps>
              <><b>Generate in the key, then check by ear.</b> The script retries until a clip measures in key, but the measurement is rough.</>
              <><b>Play intervals, not full chords.</b> The texture already holds a chord; root and fifth stays clear.</>
              <><b>Genopatch it in Synplant</b> when you want something cleaner to play polyphonically.</>
            </Steps>
            <Task>Generate a pad in this key, load it into Simpler, and play a progression from <a href={CHORDS_URL}>Chords</a> on it.</Task>
          </>
        );
      },
    },
    {
      id: "bass",
      title: "Low end",
      Body: () => {
        const v = useValues();
        return (
          <>
            <p>Felt more than heard. It holds the root, moves rarely, and steps aside for the kick.</p>
            <Sheet head="Bass" sub="Operator · sine">
              <Row>
                <Cell l="Root note" num tone="lit">{v.bassRoot}</Cell>
                <Cell l="Utility" num>Bass Mono · 120 Hz</Cell>
                <Cell l="Sidechain">Drums · kick</Cell>
                <Cell l="Compressor" num>4:1 · release 80 ms</Cell>
              </Row>
              <Row>
                <Cell l="Everything else" span={4}>High-pass beds and pads around 150 Hz. Only kick and bass get the bottom octave.</Cell>
              </Row>
            </Sheet>
            <Task>Sidechain the bass and beds to the kick, then A/B it at matched volume.</Task>
          </>
        );
      },
    },
    {
      id: "live",
      title: "Playing it live",
      Body: () => {
        const v = useValues();
        return (
          <>
            <p>The same layers as a Push 3 rig: launch the weather, play the harmony, tap through the chords.</p>
            <Sheet head="Push 3 rig">
              <Row>
                <Cell l="Scenes">One per section</Cell>
                <Cell l="Beds">Follow Action · Next</Cell>
                <Cell l="Scale mode" num tone="lit">{v.keyName}</Cell>
                <Cell l="Encoders">Sends A · B · C</Cell>
              </Row>
            </Sheet>
            <Note label="Shortcut:">the ambient extension's Perform generator builds this rig in one step.</Note>
            <Task>Perform the vignette from Push without touching the laptop.</Task>
          </>
        );
      },
    },
  ],
};

const drums: Theme = {
  id: "drums",
  name: "Drums & groove",
  blurb: "A kit that sits inside the mix: tuned kicks, grainy snares, hats from noise, and swing.",
  planned: ["Pop drums: programming a chorus that lifts", "Generative drums with MIDI Tools: Euclidean, Seed, Recombine"],
  lessons: [
    {
      id: "rack",
      title: "The rack",
      Body: () => (
        <>
          <p>One Drum Rack, laid out the same way every time so your hands learn it on Push. C1 is the bottom-left pad. The ambient extension's Template tab builds this exact rack.</p>
          <Rack />
          <p className="src">Yellow: body sounds from the Core Library. Blue: empty Simplers for slices of your own textures.</p>
          <Task>Generate the Template, then replace two blue pads with slices from your rain or city texture.</Task>
        </>
      ),
    },
    {
      id: "kick",
      title: "A kick in the key",
      Body: () => {
        const v = useValues();
        return (
          <>
            <p>At slow tempos a kick rings for a whole beat, so a wrong pitch clashes with the bass for that long. Tune it.</p>
            <Sheet head="Kick" sub="Pad C1">
              <Row>
                <Cell l="Sample">Kick 49 Hz (G1)</Cell>
                <Cell l="Root" num tone="lit">{v.kickRoot}</Cell>
                <Cell l="Or the fifth" num>{v.kickFifth}</Cell>
                <Cell l="Note" num>{v.kickNote}</Cell>
              </Row>
              <Row>
                <Cell l="Decay">Ends before the next ⅛</Cell>
                <Cell l="⅛ note" num>{v.eighth}</Cell>
                <Cell l="Saturation">Decapitator · A · 3</Cell>
                <Cell l="Sends">None, keep it dry</Cell>
              </Row>
            </Sheet>
            <Steps>
              <><b>Tune to the root</b> shown above, or the fifth if the root disappears on small speakers.</>
              <><b>Shorten the tail</b> until it stops before the next eighth note.</>
              <><b>Add weight with saturation, not EQ,</b> so it reads on laptop speakers.</>
            </Steps>
            <Task>Tune the kick to the root and the fifth. Keep the one that sits better under the bass.</Task>
          </>
        );
      },
    },
    {
      id: "grain",
      title: "Snares and hats from noise",
      Body: () => {
        const v = useValues();
        return (
          <>
            <p>Stock hats sit on top of a mix. Slices of your own textures sound like they belong to the record.</p>
            <Sheet head="Hats">
              <Row>
                <Cell l="Source" tone="cool">City or rain, sliced</Cell>
                <Cell l="Velocity" num>40 – 70</Cell>
                <Cell l="Chance" num>60% on offbeats</Cell>
                <Cell l="Swing" num>16th · 55–60%</Cell>
              </Row>
              <Row>
                <Cell l="Feel" span={2}>
                  Hats at <span className="mono">{v.doubleBpm}</span>, backbeat at <span className="mono">{v.bpm}</span>
                </Cell>
                <Cell l="High-pass" num span={2}>400 Hz</Cell>
              </Row>
            </Sheet>
            <Steps>
              <><b>Slice a texture into 16</b> in Simpler's Slice mode and keep the brightest four.</>
              <><b>Layer a snare:</b> body from a sample, grain from a 100 ms texture slice.</>
              <><b>Lower the Chance</b> on every other hat so the pattern breathes.</>
              <><b>Drag a 16th swing</b> from the Groove Pool.</>
            </Steps>
            <Task>Program hats at double time over a half-time backbeat. Add Chance and swing until it breathes.</Task>
          </>
        );
      },
    },
    {
      id: "glue",
      title: "Glue the kit",
      Body: () => {
        const v = useValues();
        return (
          <>
            <Sheet head="Drum group" sub="After the rack">
              <Row>
                <Cell l="Drum Buss" num>Drive 15% · Soft</Cell>
                <Cell l="Boom" num tone="lit">{v.kickRoot}</Cell>
                <Cell l="Glue Compressor" num>2:1 · 1–2 dB</Cell>
                <Cell l="Attack" num>10 ms</Cell>
              </Row>
            </Sheet>
            <Steps>
              <><b>Resample for character.</b> Record the drum group through EchoBoy or Crystallizer onto a new track, then chop the best bars back into the rack.</>
            </Steps>
            <Task>Make one 4-bar beat three ways: dry, through Drum Buss, and resampled. Keep the best.</Task>
          </>
        );
      },
    },
  ],
};

const mix: Theme = {
  id: "mix",
  name: "Mixing & mastering",
  blurb: "Balance, the vocal chain, bus processing and a gentle master, checked against references.",
  lessons: [],
  planned: [
    "A static mix: faders and panning only",
    "The vocal chain, start to finish",
    "Bus processing: drums, music, vocals",
    "Width and depth without phase problems",
    "Mastering with Ozone Elements or by hand",
    "Recipes for Saturn 2 and Timeless 3",
  ],
};

export const THEMES: Theme[] = [sound, melody, songs, scapes, drums, mix];

export function findTheme(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

export function lessonKey(theme: Theme, lesson: Lesson): string {
  return `${theme.id}.${lesson.id}`;
}
