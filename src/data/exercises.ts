export type MuscleGroup =
  | 'Quadriceps'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Chest'
  | 'Upper back'
  | 'Lats'
  | 'Rear delts'
  | 'Side delts'
  | 'Front delts'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Rectus abdominis'
  | 'Obliques'
  | 'Transverse abdominis'
  | 'Hip flexors'
  | 'Lower back';

export type ExerciseCategory = 'Legs' | 'Push' | 'Pull' | 'Arms' | 'Shoulders' | 'Core';

export interface Alternative {
  name: string;
  exerciseId?: string;
  reason: string;
}

export interface ExerciseInfo {
  id: string;
  name: string;
  category: ExerciseCategory;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: string;
  measure: 'reps' | 'time';
  perSide?: boolean;
  summary: string;
  setup: string[];
  steps: string[];
  direction: string;
  form: string[];
  breathing: string;
  mistakes: string[];
  alternatives: Alternative[];
}

/** Path (relative to the app base URL) of the static instructional illustration. */
export function mediaPath(id: string): string {
  return `media/exercises/${id}.svg`;
}

/** Path of the animated (SMIL) version of the illustration. */
export function animatedMediaPath(id: string): string {
  return `media/exercises/${id}-anim.svg`;
}

export const EXERCISES: ExerciseInfo[] = [
  {
    id: 'leg-press',
    name: 'Leg press',
    category: 'Legs',
    primary: ['Quadriceps', 'Glutes'],
    secondary: ['Hamstrings', 'Calves'],
    equipment: '45° leg press machine (plate-loaded or selectorised)',
    measure: 'reps',
    summary: 'A supported squat pattern that lets you load the legs while the back stays on the pad.',
    setup: [
      'Sit with your lower back and hips flat against the back pad.',
      'Place feet hip-to-shoulder width in the middle of the platform, toes slightly out.',
      'Release the safety handles only once you are set and holding the side grips.',
    ],
    steps: [
      'Unlock the sled and lower it under control by bending your knees toward your chest.',
      'Stop at the depth where your lower back and hips stay on the pad (often around 90° knee bend).',
      'Press through the whole foot to push the platform away.',
      'Finish just short of locked knees, then begin the next rep.',
    ],
    direction: 'Platform travels diagonally toward you (lowering) and away from you (pressing).',
    form: [
      'Knees track in line with your toes — do not let them cave inward.',
      'Keep heels in contact with the platform throughout.',
      'Control the lowering phase for about 2–3 seconds.',
    ],
    breathing: 'Inhale while lowering the sled; exhale steadily as you press away. Avoid long breath-holds.',
    mistakes: [
      'Lowering so deep that the hips curl up off the pad (lower-back rounding).',
      'Snapping the knees into full lockout.',
      'Pushing through the toes with heels lifting.',
      'Using a range of motion that changes from set to set, which makes progress hard to compare.',
    ],
    alternatives: [
      { name: 'Hack squat machine', exerciseId: 'hack-squat', reason: 'Similar quad emphasis with a more upright torso.' },
      { name: 'Leg extension', exerciseId: 'leg-extension', reason: 'Lower systemic demand if hips or back are irritated.' },
      { name: 'Bodyweight box squat', reason: 'No equipment; easy to control depth.' },
    ],
  },
  {
    id: 'machine-chest-press',
    name: 'Machine chest press',
    category: 'Push',
    primary: ['Chest'],
    secondary: ['Front delts', 'Triceps'],
    equipment: 'Seated chest press machine',
    measure: 'reps',
    summary: 'A stable horizontal press for the chest with a fixed path.',
    setup: [
      'Adjust the seat so the handles line up with the middle of your chest.',
      'Sit tall with shoulder blades gently pulled back and down, feet flat.',
    ],
    steps: [
      'Grip the handles with wrists stacked over forearms.',
      'Press the handles forward until the arms are nearly straight.',
      'Return slowly until you feel a light stretch across the chest, keeping shoulders back.',
    ],
    direction: 'Handles move straight forward away from the chest, then back toward it.',
    form: [
      'Elbows roughly 45–60° from the torso, not flared straight out.',
      'Keep your back and head against the pad.',
      'Stop the return before the shoulders roll forward.',
    ],
    breathing: 'Inhale as the handles come toward you; exhale while pressing.',
    mistakes: [
      'Seat too low or high, so the press drifts to the neck or belly.',
      'Shrugging the shoulders toward the ears.',
      'Bouncing out of the bottom position.',
    ],
    alternatives: [
      { name: 'Incline chest press machine', exerciseId: 'incline-chest-press', reason: 'Same pattern with more upper-chest emphasis.' },
      { name: 'Pec deck chest fly', exerciseId: 'pec-deck', reason: 'Chest isolation without pressing through the elbows.' },
      { name: 'Push-up (hands elevated)', reason: 'Bodyweight option with adjustable difficulty.' },
    ],
  },
  {
    id: 'chest-supported-row',
    name: 'Chest-supported row',
    category: 'Pull',
    primary: ['Upper back', 'Lats'],
    secondary: ['Rear delts', 'Biceps'],
    equipment: 'Chest-supported row machine (or T-bar with chest pad)',
    measure: 'reps',
    summary: 'A row where the chest pad removes lower-back demand so the upper back does the work.',
    setup: [
      'Set the chest pad so you can reach the handles with arms straight and shoulders slightly forward.',
      'Plant feet firmly and keep the chest in contact with the pad.',
    ],
    steps: [
      'Start by drawing the shoulder blades back.',
      'Pull the handles toward your lower ribs, driving the elbows behind you.',
      'Pause briefly, then lower until the arms are straight and the shoulder blades spread.',
    ],
    direction: 'Handles travel backward toward your torso and then forward away from it.',
    form: ['Chest stays on the pad.', 'Neck neutral — look at the floor slightly ahead.', 'Elbows travel close to the body for lat emphasis, wider for upper back.'],
    breathing: 'Exhale as you pull; inhale as the arms straighten.',
    mistakes: ['Lifting the chest off the pad to heave the weight.', 'Shrugging toward the ears.', 'Cutting the stretch short at the front.'],
    alternatives: [
      { name: 'Seated cable row', exerciseId: 'seated-cable-row', reason: 'Similar pull with a cable for constant tension.' },
      { name: 'Lat pulldown', exerciseId: 'lat-pulldown', reason: 'Vertical pull alternative.' },
      { name: 'Single-arm dumbbell row (bench-supported)', reason: 'Free-weight option with support.' },
    ],
  },
  {
    id: 'seated-leg-curl',
    name: 'Seated leg curl',
    category: 'Legs',
    primary: ['Hamstrings'],
    secondary: ['Calves'],
    equipment: 'Seated leg curl machine',
    measure: 'reps',
    summary: 'Isolates the hamstrings through knee flexion with the hips bent, which places them under a good stretch.',
    setup: [
      'Line up your knee joint with the machine pivot.',
      'Rest the lower calves (just above the heels) on the roller pad.',
      'Lower the thigh pad so it holds your thighs firmly in place.',
    ],
    steps: [
      'Hold the handles and sit tall.',
      'Bend your knees to pull the pad down and back under the seat.',
      'Squeeze briefly, then let the legs straighten slowly to the start.',
    ],
    direction: 'Lower legs sweep down and back under the seat, then return forward.',
    form: ['Hips stay down on the seat.', 'Move through the full comfortable range.', 'Control the return for 2–3 seconds.'],
    breathing: 'Exhale while curling; inhale while returning.',
    mistakes: ['Knee not aligned with the pivot.', 'Lifting the hips off the seat.', 'Letting the weight stack slam at the top.'],
    alternatives: [
      { name: 'Lying leg curl', reason: 'Same knee-flexion pattern in a prone position.' },
      { name: 'Romanian deadlift (light dumbbells)', reason: 'Hip-hinge hamstring option — only after clearance and with coaching.' },
    ],
  },
  {
    id: 'machine-lateral-raise',
    name: 'Machine lateral raise',
    category: 'Shoulders',
    primary: ['Side delts'],
    secondary: ['Upper back'],
    equipment: 'Lateral raise machine',
    measure: 'reps',
    summary: 'Targets the side of the shoulder with a guided arc.',
    setup: ['Set the seat so the machine pivot lines up with your shoulder joint.', 'Place the outside of your forearms or elbows against the pads.'],
    steps: [
      'Sit tall and brace lightly.',
      'Raise the arms out to the sides, leading with the elbows, until about shoulder height.',
      'Lower slowly until the arms are by your sides.',
    ],
    direction: 'Arms move out and up to the sides, then back down.',
    form: ['Stop around shoulder height.', 'Keep shoulders down, away from the ears.', 'Small range, controlled tempo — this is not a heavy lift.'],
    breathing: 'Exhale as the arms rise; inhale as they lower.',
    mistakes: ['Shrugging the weight up with the traps.', 'Swinging the torso.', 'Pivot misaligned with the shoulder.'],
    alternatives: [
      { name: 'Cable lateral raise', reason: 'Constant tension from the side.' },
      { name: 'Dumbbell lateral raise (light)', reason: 'Simple free-weight option.' },
    ],
  },
  {
    id: 'cable-triceps-pushdown',
    name: 'Cable triceps pushdown',
    category: 'Arms',
    primary: ['Triceps'],
    secondary: ['Forearms'],
    equipment: 'High cable pulley with rope or straight bar',
    measure: 'reps',
    summary: 'Isolates the triceps through elbow extension.',
    setup: ['Set the pulley high and attach a rope or bar.', 'Stand close with a slight forward lean and elbows at your sides.'],
    steps: [
      'Start with the elbows bent around 90°.',
      'Push the handle down by straightening the elbows.',
      'Pause at the bottom, then let the forearms rise to the start under control.',
    ],
    direction: 'Hands travel downward toward the thighs, then back up.',
    form: ['Upper arms stay pinned to your sides.', 'Wrists straight.', 'Avoid leaning your body weight onto the handle.'],
    breathing: 'Exhale while pushing down; inhale on the way up.',
    mistakes: ['Elbows drifting forward so the shoulders help.', 'Leaning over the bar.', 'Rushing the return.'],
    alternatives: [
      { name: 'Triceps extension machine', exerciseId: 'triceps-extension-machine', reason: 'Seated, supported elbow extension.' },
      { name: 'Overhead cable extension', reason: 'Trains the long head in a stretched position.' },
    ],
  },
  {
    id: 'ab-crunch-machine',
    name: 'Abdominal crunch machine',
    category: 'Core',
    primary: ['Rectus abdominis'],
    secondary: ['Obliques'],
    equipment: 'Seated abdominal crunch machine',
    measure: 'reps',
    summary: 'A loaded spinal-flexion exercise for the front of the abdomen.',
    setup: ['Adjust the seat so the pads sit on your upper chest or shoulders.', 'Hook your feet under the rollers if provided.'],
    steps: [
      'Sit tall and brace lightly.',
      'Curl your ribcage down toward your pelvis, rounding the upper spine.',
      'Squeeze the abdominals briefly, then return slowly to upright.',
    ],
    direction: 'Torso curls forward and down, then returns to upright.',
    form: ['Think "ribs to hips" rather than pulling with the arms.', 'Keep the movement smooth.', 'Use a weight you can control for the whole range.'],
    breathing: 'Exhale fully as you crunch; inhale as you return.',
    mistakes: ['Pulling with the arms or hip flexors instead of curling the spine.', 'Using momentum.', 'Holding the breath.'],
    alternatives: [
      { name: 'Cable crunch', exerciseId: 'cable-crunch', reason: 'Same flexion pattern from a kneeling position.' },
      { name: 'Reverse crunch', exerciseId: 'reverse-crunch', reason: 'Flexion from the pelvis, no equipment.' },
      { name: 'Dead bug', exerciseId: 'dead-bug', reason: 'Low-load anti-extension option.' },
    ],
  },
  {
    id: 'hack-squat',
    name: 'Hack squat machine',
    category: 'Legs',
    primary: ['Quadriceps', 'Glutes'],
    secondary: ['Hamstrings', 'Calves'],
    equipment: 'Hack squat machine',
    measure: 'reps',
    summary: 'A guided squat on an angled sled that emphasises the quadriceps.',
    setup: [
      'Stand with your back flat on the pad and shoulders under the shoulder pads.',
      'Feet shoulder-width, mid-platform, toes slightly out.',
      'Release the safety handles once set.',
    ],
    steps: [
      'Bend the knees and hips to lower the sled under control.',
      'Descend to a depth you can control with your back flat on the pad.',
      'Drive through the whole foot to stand back up, stopping just short of lockout.',
    ],
    direction: 'Body travels down and back along the sled rails, then up.',
    form: ['Knees track over toes.', 'Back stays against the pad.', 'Steady 2–3 second lowering.'],
    breathing: 'Inhale on the way down; exhale while driving up. Avoid long breath-holds.',
    mistakes: ['Heels lifting.', 'Knees caving inward.', 'Bouncing at the bottom.'],
    alternatives: [
      { name: 'Leg press', exerciseId: 'leg-press', reason: 'Similar pattern, seated and fully supported.' },
      { name: 'Goblet squat (light)', reason: 'Free-weight option once cleared.' },
    ],
  },
  {
    id: 'lat-pulldown',
    name: 'Lat pulldown',
    category: 'Pull',
    primary: ['Lats'],
    secondary: ['Upper back', 'Biceps', 'Rear delts'],
    equipment: 'Lat pulldown machine with wide or neutral bar',
    measure: 'reps',
    summary: 'A vertical pull for the lats and upper back.',
    setup: ['Adjust the knee pad so your thighs are locked under it.', 'Grip the bar slightly wider than shoulders.'],
    steps: [
      'Start with arms straight overhead and shoulders gently lifted.',
      'Pull the shoulder blades down, then pull the bar to the upper chest.',
      'Lead with the elbows toward your back pockets.',
      'Let the bar rise until arms are straight again.',
    ],
    direction: 'Bar travels straight down toward the upper chest, then back up overhead.',
    form: ['Lean back only slightly (about 10–20°).', 'Chest up, ribs down.', 'Bar to the front of the body — never behind the neck.'],
    breathing: 'Exhale while pulling down; inhale as the bar rises.',
    mistakes: ['Big body swing to move the weight.', 'Pulling behind the neck.', 'Cutting the overhead stretch short.'],
    alternatives: [
      { name: 'Chest-supported row', exerciseId: 'chest-supported-row', reason: 'Horizontal pull alternative.' },
      { name: 'Assisted pull-up machine', reason: 'Same vertical pattern with assistance.' },
    ],
  },
  {
    id: 'incline-chest-press',
    name: 'Incline chest press machine',
    category: 'Push',
    primary: ['Chest', 'Front delts'],
    secondary: ['Triceps'],
    equipment: 'Incline chest press machine',
    measure: 'reps',
    summary: 'An upward-angled press emphasising the upper chest.',
    setup: ['Set the seat so the handles are level with your upper chest.', 'Back flat on the incline pad, feet planted.'],
    steps: [
      'Grip the handles, shoulder blades back and down.',
      'Press up and forward along the machine path until arms are nearly straight.',
      'Lower under control to a light stretch.',
    ],
    direction: 'Handles move up and forward on a diagonal, then return.',
    form: ['Elbows about 45–60° from the torso.', 'Keep the head on the pad.', 'Do not let shoulders roll forward at the end.'],
    breathing: 'Inhale as the handles return; exhale while pressing.',
    mistakes: ['Arching heavily off the pad.', 'Shrugging.', 'Partial reps.'],
    alternatives: [
      { name: 'Machine chest press', exerciseId: 'machine-chest-press', reason: 'Flat pressing alternative.' },
      { name: 'Machine shoulder press', exerciseId: 'machine-shoulder-press', reason: 'Steeper pressing angle.' },
    ],
  },
  {
    id: 'reverse-pec-deck',
    name: 'Reverse pec deck',
    category: 'Shoulders',
    primary: ['Rear delts'],
    secondary: ['Upper back'],
    equipment: 'Pec deck / rear delt machine (facing the pad)',
    measure: 'reps',
    summary: 'Isolates the rear shoulders and upper back by moving the arms out and back.',
    setup: ['Sit facing the pad with your chest against it.', 'Set handles so arms are straight in front at shoulder height.'],
    steps: [
      'Hold the handles with a neutral or overhand grip.',
      'Sweep the arms out and back in a wide arc until in line with your body.',
      'Pause, then return the arms forward slowly.',
    ],
    direction: 'Arms open outward and backward, then come back together in front.',
    form: ['Slight bend in the elbows that stays constant.', 'Shoulders down, neck relaxed.', 'Move from the shoulders, not by squeezing the hands.'],
    breathing: 'Exhale while opening; inhale while returning.',
    mistakes: ['Shrugging.', 'Bending and straightening the elbows during the rep.', 'Using momentum.'],
    alternatives: [
      { name: 'Cable rear-delt fly', reason: 'Constant tension from crossed cables.' },
      { name: 'Face pull', reason: 'Rear delt and upper-back cable option.' },
    ],
  },
  {
    id: 'preacher-curl-machine',
    name: 'Preacher curl machine',
    category: 'Arms',
    primary: ['Biceps'],
    secondary: ['Forearms'],
    equipment: 'Preacher curl machine',
    measure: 'reps',
    summary: 'A supported curl that keeps the upper arms fixed on an angled pad.',
    setup: ['Adjust the seat so your armpits sit near the top of the pad.', 'Upper arms flat on the pad, elbows lined up with the pivot.'],
    steps: [
      'Start with elbows almost straight.',
      'Curl the handles toward your shoulders.',
      'Lower slowly until the elbows are nearly straight again.',
    ],
    direction: 'Forearms swing upward toward the shoulders, then back down.',
    form: ['Upper arms stay on the pad.', 'Wrists neutral.', 'Control the lowering — this is where the elbows are most exposed.'],
    breathing: 'Exhale while curling; inhale while lowering.',
    mistakes: ['Lifting the elbows off the pad.', 'Dropping quickly into the bottom.', 'Using too much load and shortening the range.'],
    alternatives: [
      { name: 'Cable biceps curl', exerciseId: 'cable-biceps-curl', reason: 'Standing curl with constant tension.' },
      { name: 'Dumbbell curl (seated)', reason: 'Simple free-weight option.' },
    ],
  },
  {
    id: 'standing-calf-raise',
    name: 'Standing calf raise',
    category: 'Legs',
    primary: ['Calves'],
    secondary: [],
    equipment: 'Standing calf raise machine (or step with support)',
    measure: 'reps',
    summary: 'Trains the calves by raising the heels from a stretched position.',
    setup: ['Stand with the balls of your feet on the edge of the platform.', 'Shoulders under the pads, knees straight but not locked.'],
    steps: [
      'Let the heels lower below the platform to a comfortable stretch.',
      'Pause for a moment at the bottom.',
      'Rise onto the balls of your feet as high as you can.',
      'Hold briefly at the top, then lower slowly.',
    ],
    direction: 'Heels travel down below the step, then up as high as possible.',
    form: ['Full range — deep stretch and high squeeze.', 'Knees stay nearly straight.', 'Even pressure across the ball of the foot.'],
    breathing: 'Exhale as you rise; inhale as you lower.',
    mistakes: ['Bouncing out of the stretch.', 'Bending the knees to push.', 'Rolling onto the outside of the foot.'],
    alternatives: [
      { name: 'Seated calf raise', reason: 'Bent-knee version (more soleus).' },
      { name: 'Calf press on leg press', exerciseId: 'leg-press', reason: 'Use the leg press platform with straight legs.' },
    ],
  },
  {
    id: 'machine-shoulder-press',
    name: 'Machine shoulder press',
    category: 'Shoulders',
    primary: ['Front delts'],
    secondary: ['Side delts', 'Triceps'],
    equipment: 'Seated shoulder press machine',
    measure: 'reps',
    summary: 'A supported overhead press for the shoulders.',
    setup: ['Adjust the seat so the handles start around shoulder height.', 'Back flat against the pad, feet planted.'],
    steps: ['Grip the handles with wrists over elbows.', 'Press upward until the arms are nearly straight overhead.', 'Lower under control back to shoulder height.'],
    direction: 'Handles travel straight up overhead, then back down.',
    form: ['Ribs down — avoid arching the lower back.', 'Elbows slightly in front of the body.', 'Head stays on the pad.'],
    breathing: 'Exhale while pressing up; inhale as the handles lower.',
    mistakes: ['Excessive lower-back arch.', 'Locking the elbows hard.', 'Starting position too low for the shoulders.'],
    alternatives: [
      { name: 'Incline chest press machine', exerciseId: 'incline-chest-press', reason: 'Less overhead range if shoulders are irritated.' },
      { name: 'Machine lateral raise', exerciseId: 'machine-lateral-raise', reason: 'Isolation for the side delts.' },
    ],
  },
  {
    id: 'seated-cable-row',
    name: 'Seated cable row',
    category: 'Pull',
    primary: ['Upper back', 'Lats'],
    secondary: ['Biceps', 'Rear delts'],
    equipment: 'Low cable row station with V-handle or wide bar',
    measure: 'reps',
    summary: 'A horizontal cable pull for the back with constant tension.',
    setup: ['Sit with feet on the footplate and knees slightly bent.', 'Hold the handle with arms straight and torso tall.'],
    steps: [
      'Brace and sit tall.',
      'Pull the handle to your lower ribs, squeezing the shoulder blades together.',
      'Pause, then let the arms extend forward with control.',
    ],
    direction: 'Handle travels backward toward the torso, then forward.',
    form: ['Torso stays roughly upright — a small lean is fine.', 'Shoulders down.', 'Elbows close to the body.'],
    breathing: 'Exhale on the pull; inhale on the return.',
    mistakes: ['Rocking the torso back and forth.', 'Rounding the lower back on the return.', 'Shrugging.'],
    alternatives: [
      { name: 'Chest-supported row', exerciseId: 'chest-supported-row', reason: 'Removes lower-back demand.' },
      { name: 'Lat pulldown', exerciseId: 'lat-pulldown', reason: 'Vertical pull alternative.' },
    ],
  },
  {
    id: 'pec-deck',
    name: 'Pec deck chest fly',
    category: 'Push',
    primary: ['Chest'],
    secondary: ['Front delts'],
    equipment: 'Pec deck / fly machine',
    measure: 'reps',
    summary: 'A chest isolation movement that brings the arms together in a hugging arc.',
    setup: ['Adjust the seat so handles are at chest height.', 'Sit with your back on the pad and shoulder blades back.'],
    steps: [
      'Hold the handles with a slight elbow bend.',
      'Bring the arms together in front of your chest in a wide arc.',
      'Squeeze, then open the arms slowly to a comfortable stretch.',
    ],
    direction: 'Arms sweep inward and forward until the hands meet, then open back out.',
    form: ['Fixed, slight elbow bend.', 'Do not let the arms go behind the body at the stretch.', 'Shoulders stay down and back.'],
    breathing: 'Exhale as the arms close; inhale as they open.',
    mistakes: ['Overstretching at the start position.', 'Turning it into a press by bending the elbows.', 'Shrugging.'],
    alternatives: [
      { name: 'Machine chest press', exerciseId: 'machine-chest-press', reason: 'Compound chest option.' },
      { name: 'Cable fly', reason: 'Adjustable angles with constant tension.' },
    ],
  },
  {
    id: 'leg-extension',
    name: 'Leg extension',
    category: 'Legs',
    primary: ['Quadriceps'],
    secondary: [],
    equipment: 'Leg extension machine',
    measure: 'reps',
    summary: 'Isolates the quadriceps by straightening the knee against resistance.',
    setup: ['Align your knee with the machine pivot.', 'Place the roller pad on the lower shin, above the ankle.'],
    steps: ['Hold the handles and sit tall.', 'Straighten the knees to lift the pad.', 'Pause near full extension, then lower slowly.'],
    direction: 'Lower legs swing forward and up, then back down.',
    form: ['Hips stay on the seat.', 'Smooth tempo, no kicking.', 'Toes pointing up or slightly out.'],
    breathing: 'Exhale while extending; inhale while lowering.',
    mistakes: ['Kicking the weight up.', 'Lifting the hips off the seat.', 'Pivot not aligned with the knee.'],
    alternatives: [
      { name: 'Leg press', exerciseId: 'leg-press', reason: 'Compound quad work.' },
      { name: 'Split squat (bodyweight)', reason: 'No equipment single-leg option.' },
    ],
  },
  {
    id: 'cable-biceps-curl',
    name: 'Cable biceps curl',
    category: 'Arms',
    primary: ['Biceps'],
    secondary: ['Forearms'],
    equipment: 'Low cable pulley with straight bar or EZ bar',
    measure: 'reps',
    summary: 'A standing curl with constant cable tension.',
    setup: ['Set the pulley low and attach a bar.', 'Stand tall, close to the pulley, elbows at your sides.'],
    steps: ['Curl the bar up toward your shoulders by bending the elbows.', 'Squeeze briefly at the top.', 'Lower slowly until arms are straight.'],
    direction: 'Hands travel up in an arc toward the shoulders, then down.',
    form: ['Elbows stay at your sides.', 'Torso still — no swinging.', 'Wrists neutral.'],
    breathing: 'Exhale while curling; inhale while lowering.',
    mistakes: ['Swinging the torso.', 'Elbows drifting forward.', 'Half reps.'],
    alternatives: [
      { name: 'Preacher curl machine', exerciseId: 'preacher-curl-machine', reason: 'Supported upper-arm position.' },
      { name: 'Dumbbell hammer curl', reason: 'Neutral grip option.' },
    ],
  },
  {
    id: 'triceps-extension-machine',
    name: 'Triceps extension machine',
    category: 'Arms',
    primary: ['Triceps'],
    secondary: [],
    equipment: 'Seated triceps extension machine',
    measure: 'reps',
    summary: 'A seated, supported elbow extension for the triceps.',
    setup: ['Adjust the seat so your elbows line up with the pivot.', 'Upper arms rest on the pad.'],
    steps: ['Start with elbows bent and hands near your shoulders.', 'Straighten the arms by pushing the handles down and forward.', 'Return slowly to the start.'],
    direction: 'Forearms move forward and down as the elbows straighten, then back.',
    form: ['Upper arms stay on the pad.', 'Shoulders down.', 'Control both directions.'],
    breathing: 'Exhale while extending; inhale on the return.',
    mistakes: ['Lifting the elbows off the pad.', 'Leaning forward to push with the body.', 'Bouncing at the bottom.'],
    alternatives: [
      { name: 'Cable triceps pushdown', exerciseId: 'cable-triceps-pushdown', reason: 'Standing cable version.' },
      { name: 'Bench dip (feet on floor)', reason: 'Bodyweight option if shoulders tolerate it.' },
    ],
  },
  // ---------- Core ----------
  {
    id: 'cable-crunch',
    name: 'Cable crunch',
    category: 'Core',
    primary: ['Rectus abdominis'],
    secondary: ['Obliques'],
    equipment: 'High cable pulley with rope attachment, kneeling mat',
    measure: 'reps',
    summary: 'Kneeling loaded spinal flexion — curl the ribs toward the pelvis against a cable.',
    setup: ['Attach a rope to a high pulley and kneel facing it.', 'Hold the rope beside your head; hips stay over knees.'],
    steps: [
      'Brace lightly with the hips stacked over the knees.',
      'Curl your ribcage down toward your pelvis by rounding the spine.',
      'Bring elbows toward the mid-thighs, pause, and return slowly.',
    ],
    direction: 'Torso curls forward and down; hips stay in place.',
    form: ['Hips do not sit back toward the heels.', 'Hands stay fixed beside the head — the spine moves, not the arms.', 'Moderate load, full curl.'],
    breathing: 'Exhale fully as you crunch down; inhale as you rise.',
    mistakes: ['Sitting back to pull with body weight.', 'Pulling with the arms.', 'Hinging at the hips instead of curling the spine.'],
    alternatives: [
      { name: 'Abdominal crunch machine', exerciseId: 'ab-crunch-machine', reason: 'Seated machine version.' },
      { name: 'Reverse crunch', exerciseId: 'reverse-crunch', reason: 'Bodyweight flexion from the pelvis.' },
    ],
  },
  {
    id: 'reverse-crunch',
    name: 'Reverse crunch',
    category: 'Core',
    primary: ['Rectus abdominis'],
    secondary: ['Obliques', 'Hip flexors'],
    equipment: 'Mat (optional bench to hold)',
    measure: 'reps',
    summary: 'Curls the pelvis toward the ribs while lying on your back.',
    setup: ['Lie on your back with hips and knees bent about 90°.', 'Arms by your sides or holding a bench behind your head.'],
    steps: [
      'Press the lower back gently toward the floor.',
      'Curl the pelvis up, lifting the hips slightly off the floor and bringing knees toward the chest.',
      'Lower the hips slowly, one vertebra at a time.',
    ],
    direction: 'Knees and hips roll up toward the chest, then back down.',
    form: ['Small, controlled movement — it is a curl, not a swing.', 'Keep knee angle constant.', 'Lower more slowly than you lift.'],
    breathing: 'Exhale as the hips curl up; inhale as you lower.',
    mistakes: ['Swinging the legs for momentum.', 'Arching the lower back on the way down.', 'Pushing hard through the arms.'],
    alternatives: [
      { name: 'Dead bug', exerciseId: 'dead-bug', reason: 'Easier anti-extension option.' },
      { name: 'Cable crunch', exerciseId: 'cable-crunch', reason: 'Loadable flexion option.' },
    ],
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    category: 'Core',
    primary: ['Transverse abdominis', 'Rectus abdominis'],
    secondary: ['Obliques', 'Hip flexors'],
    equipment: 'Mat',
    measure: 'reps',
    perSide: true,
    summary: 'An anti-extension drill: keep the trunk still while opposite arm and leg move.',
    setup: ['Lie on your back with arms pointing to the ceiling.', 'Lift your legs so hips and knees are at 90° (tabletop).'],
    steps: [
      'Flatten the lower back gently toward the floor and brace.',
      'Slowly extend one leg forward and the opposite arm overhead, hovering above the floor.',
      'Return to the start and repeat on the other side.',
    ],
    direction: 'Opposite arm and leg reach away from the body, then return.',
    form: ['Lower back stays in contact with the floor.', 'Move slowly — 2–3 seconds each way.', 'Reach only as far as you can keep the trunk still.'],
    breathing: 'Exhale as the limbs extend; inhale as they return.',
    mistakes: ['Lower back arching off the floor.', 'Moving too fast.', 'Holding the breath.'],
    alternatives: [
      { name: 'Heel taps (tabletop)', reason: 'Easier progression — legs only.' },
      { name: 'Regular plank', exerciseId: 'plank', reason: 'Isometric anti-extension.' },
    ],
  },
  {
    id: 'pallof-press',
    name: 'Pallof press',
    category: 'Core',
    primary: ['Obliques', 'Transverse abdominis'],
    secondary: ['Rectus abdominis'],
    equipment: 'Cable station or resistance band at chest height',
    measure: 'reps',
    perSide: true,
    summary: 'An anti-rotation press: resist the cable pulling you sideways.',
    setup: ['Stand side-on to a chest-height cable.', 'Hold the handle at the middle of your chest with both hands, feet hip-width.'],
    steps: [
      'Brace and step away so the cable has tension.',
      'Press the handle straight out in front of your chest.',
      'Hold for 1–2 seconds without letting the torso rotate.',
      'Bring the handle back to the chest. Repeat, then switch sides.',
    ],
    direction: 'Hands press straight forward away from the chest while the cable pulls sideways.',
    form: ['Hips and shoulders stay square to the front.', 'Ribs down, glutes lightly engaged.', 'Choose a load where you can hold perfectly still.'],
    breathing: 'Exhale as you press out; breathe normally during the hold.',
    mistakes: ['Twisting toward the cable.', 'Leaning away from it.', 'Using too much load.'],
    alternatives: [
      { name: 'Side plank', exerciseId: 'side-plank', reason: 'Bodyweight lateral stability.' },
      { name: 'Band Pallof press', reason: 'Home option with a resistance band.' },
    ],
  },
  {
    id: 'side-plank',
    name: 'Side plank',
    category: 'Core',
    primary: ['Obliques'],
    secondary: ['Transverse abdominis', 'Glutes'],
    equipment: 'Mat',
    measure: 'time',
    perSide: true,
    summary: 'An isometric hold that trains lateral trunk stability.',
    setup: ['Lie on your side with the elbow directly under the shoulder.', 'Stack the feet, or stagger them for balance.'],
    steps: [
      'Brace and lift the hips so the body forms a straight line from head to feet.',
      'Hold for the target time while breathing steadily.',
      'Lower with control and switch sides.',
    ],
    direction: 'Hips lift up off the floor into a straight line and hold.',
    form: ['Elbow under shoulder.', 'Hips stay up and forward — do not sag or pike.', 'Neck in line with the spine.'],
    breathing: 'Breathe slowly and continuously throughout the hold.',
    mistakes: ['Hips sagging toward the floor.', 'Rolling the chest toward the floor.', 'Holding the breath.'],
    alternatives: [
      { name: 'Knee side plank', reason: 'Shorter lever, easier regression.' },
      { name: 'Pallof press', exerciseId: 'pallof-press', reason: 'Standing anti-rotation option.' },
    ],
  },
  {
    id: 'plank',
    name: 'Regular plank',
    category: 'Core',
    primary: ['Rectus abdominis', 'Transverse abdominis'],
    secondary: ['Obliques', 'Glutes', 'Front delts'],
    equipment: 'Mat',
    measure: 'time',
    summary: 'An isometric front hold that trains the trunk to resist sagging.',
    setup: ['Forearms on the floor, elbows under the shoulders.', 'Legs straight behind you on the toes.'],
    steps: [
      'Lift the body so it forms a straight line from head to heels.',
      'Brace the abdominals and lightly squeeze the glutes.',
      'Hold for the target time with steady breathing, then lower.',
    ],
    direction: 'Body lifts into a straight line and holds still.',
    form: ['Ribs pulled slightly toward the pelvis.', 'Neck neutral — look at the floor.', 'Stop the set when form breaks rather than at a fixed time.'],
    breathing: 'Breathe slowly through the hold; avoid breath-holding.',
    mistakes: ['Hips sagging (lower-back arch).', 'Hips piked high.', 'Holding for very long times with poor form.'],
    alternatives: [
      { name: 'Knee plank', reason: 'Easier regression.' },
      { name: 'Dead bug', exerciseId: 'dead-bug', reason: 'Lying anti-extension drill.' },
    ],
  },
];

export const EXERCISE_MAP: Record<string, ExerciseInfo> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): ExerciseInfo | undefined {
  return EXERCISE_MAP[id];
}

export const CORE_EXERCISE_IDS = ['cable-crunch', 'reverse-crunch', 'dead-bug', 'pallof-press', 'side-plank', 'plank', 'ab-crunch-machine'];
