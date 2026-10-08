/* Typing Pals: content data (letters, voice lines, ninja academy missions). */
(function () {
  'use strict';
  var D = {};

  /* ---------- Letter Explorer ---------- */
  // Teaching order: common early-phonics order (SATPIN first), then the rest.
  D.ORDER = 'SATPINMDGOCKEURHBFLJVWXYZQ'.split('');
  // say = how the speech engine should pronounce the letter name on its own.
  // m = the "mini moment" animation, s = its sound.
  D.LETTERS = {
    A: { say: 'Ay',  w: 'Apple',      e: '\u{1F34E}', m: 'drop',   s: 'boing' },
    B: { say: 'Bee', w: 'Ball',       e: '\u26BD',    m: 'bounce', s: 'boing' },
    C: { say: 'See', w: 'Cat',        e: '\u{1F408}', m: 'walk',   s: 'meow' },
    D: { say: 'Dee', w: 'Dinosaur',   e: '\u{1F996}', m: 'stomp',  s: 'stomp' },
    E: { say: 'Ee',  w: 'Elephant',   e: '\u{1F418}', m: 'stomp',  s: 'trumpet' },
    F: { say: 'Eff', w: 'Fish',       e: '\u{1F420}', m: 'swim',   s: 'bubble' },
    G: { say: 'Jee', w: 'Giraffe',    e: '\u{1F992}', m: 'peek',   s: 'boing' },
    H: { say: 'Aitch', w: 'Helicopter', e: '\u{1F681}', m: 'fly',  s: 'whoosh' },
    I: { say: 'Eye', w: 'Ice cream',  e: '\u{1F366}', m: 'grow',   s: 'sparkle' },
    J: { say: 'Jay', w: 'Jet',        e: '\u2708\uFE0F', m: 'fly', s: 'whoosh' },
    K: { say: 'Kay', w: 'Kite',       e: '\u{1FA81}', m: 'kite',   s: 'whoosh' },
    L: { say: 'Ell', w: 'Lion',       e: '\u{1F981}', m: 'peek',   s: 'roar' },
    M: { say: 'Em',  w: 'Monkey',     e: '\u{1F412}', m: 'bounce', s: 'boing' },
    N: { say: 'En',  w: 'Ninja',      e: '\u{1F977}', m: 'spin',   s: 'whoosh' },
    O: { say: 'Oh',  w: 'Octopus',    e: '\u{1F419}', m: 'swim',   s: 'bubble' },
    P: { say: 'Pee', w: 'Penguin',    e: '\u{1F427}', m: 'waddle', s: 'boing' },
    Q: { say: 'Cue', w: 'Queen',      e: '\u{1F451}', m: 'grow',   s: 'sparkle' },
    R: { say: 'Are', w: 'Rocket',     e: '\u{1F680}', m: 'blast',  s: 'blast' },
    S: { say: 'Ess', w: 'Snake',      e: '\u{1F40D}', m: 'swim',   s: 'hiss' },
    T: { say: 'Tee', w: 'Train',      e: '\u{1F682}', m: 'walk',   s: 'choo' },
    U: { say: 'You', w: 'Umbrella',   e: '\u2602\uFE0F', m: 'float', s: 'sparkle' },
    V: { say: 'Vee', w: 'Volcano',    e: '\u{1F30B}', m: 'erupt',  s: 'rumble' },
    W: { say: 'Double you', w: 'Whale', e: '\u{1F433}', m: 'swim', s: 'bubble' },
    X: { say: 'Ex',  w: 'Xylophone',  e: 'XYLO',      m: 'grow',   s: 'xylo' },
    Y: { say: 'Why', w: 'Yo-yo',      e: '\u{1FA80}', m: 'yoyo',   s: 'boing' },
    Z: { say: 'Zee', w: 'Zebra',      e: '\u{1F993}', m: 'walk',   s: 'gallop' }
  };
  D.KID_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  D.KID_CHEERS = ['Yay!', 'You did it!', 'Awesome!', 'High five!', 'Super duper!', 'Wow, great job!',
    'Roar-some!', 'You are a letter superstar!', 'Woo hoo!', 'Amazing!', 'Ka-boom! You found it!', 'Hooray!'];
  D.KID_OOPS = ['Oopsie! That is {X}. Let\u2019s find {T}!', 'Hmm, that is {X}. Can you find {T}?',
    'Almost! Look for the glowing {T}!', 'Silly me! That is {X}. Where is {T}?'];
  D.KID_TICKLE = ['Hee hee! That tickles!', 'Boop! You booped me!', 'Ha ha! Again! Again!', 'Hi friend!', 'Let\u2019s play!', 'Wheee!'];
  D.KID_NICKS = ['Dino Champ', 'Super Star', 'Captain Rocket', 'Little Lion', 'Turbo', 'Buddy Bear'];

  /* ---------- Ninja Academy ---------- */
  D.FINGER = { q: 'lp', a: 'lp', z: 'lp', w: 'lr', s: 'lr', x: 'lr', e: 'lm', d: 'lm', c: 'lm',
    r: 'li', f: 'li', v: 'li', t: 'li', g: 'li', b: 'li', y: 'ri', h: 'ri', n: 'ri', u: 'ri', j: 'ri', m: 'ri',
    i: 'rm', k: 'rm', ',': 'rm', o: 'rr', l: 'rr', '.': 'rr', p: 'rp', ';': 'rp', '/': 'rp', ' ': 'th' };
  D.FINGER_NAME = { lp: 'Left pinky', lr: 'Left ring', lm: 'Left middle', li: 'Left pointer',
    ri: 'Right pointer', rm: 'Right middle', rr: 'Right ring', rp: 'Right pinky', th: 'Thumb' };
  D.NINJA_ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'];

  D.BELTS = [
    { n: 'White Belt', xp: 0, c: '#f1f3f5' }, { n: 'Yellow Belt', xp: 300, c: '#ffd43b' },
    { n: 'Orange Belt', xp: 800, c: '#ff922b' }, { n: 'Green Belt', xp: 1600, c: '#51cf66' },
    { n: 'Blue Belt', xp: 2800, c: '#339af0' }, { n: 'Purple Belt', xp: 4200, c: '#9775fa' },
    { n: 'Red Belt', xp: 6000, c: '#f03e3e' }, { n: 'Brown Belt', xp: 8000, c: '#a0522d' },
    { n: 'Black Belt', xp: 10500, c: '#212529' }
  ];

  // Each zone: missions (3-5) + a boss. Text uses only keys unlocked so far (checked by the test suite).
  D.ZONES = [
    { id: 'z1', name: 'Home Row Dojo', icon: '\u{1F3EF}', color: '#ff6b6b', newKeys: 'asdfjkl; ',
      missions: [
        { id: 'z1m1', name: 'Find the Bumps', keys: 'fj', lines: ['fff jjj fff jjj', 'fj fj jf jf fj jf', 'f j ff jj fjf jfj'] },
        { id: 'z1m2', name: 'Left Hand Base', keys: 'asdf', lines: ['asdf asdf fdsa', 'aa ss dd ff asdf', 'sad dad fad add'] },
        { id: 'z1m3', name: 'Right Hand Base', keys: 'jkl;', lines: ['jkl; jkl; ;lkj', 'jj kk ll ;; jkl;', 'jk kl l; lk kj'] },
        { id: 'z1m4', name: 'Home Row Combo', keys: '', lines: ['asdf jkl; asdf jkl;', 'fall lass add all', 'a lad; a sad lad;'] },
        { id: 'z1m5', name: 'Home Row Words', keys: '', lines: ['dad asks a lad', 'all lads fall; ask dad', 'a flask; a salad; alfalfa'] }
      ],
      boss: { id: 'z1b', name: 'Dojo Guardian', icon: '\u{1F479}', shields: 8, lines: ['a lad asks dad;', 'all fads fall;', 'dad adds a flask;', 'a sad lass asks all;'] } },
    { id: 'z2', name: 'Sky Temple', icon: '\u26E9\uFE0F', color: '#4dabf7', newKeys: 'eirutygh',
      missions: [
        { id: 'z2m1', name: 'E and I', keys: 'ei', lines: ['ded kik ded kik', 'eee iii ei ie', 'lid sea fed side idea', 'a lake; a kid sees a seal'] },
        { id: 'z2m2', name: 'R and U', keys: 'ru', lines: ['frf juj frf juj', 'fur sure rude ride', 'a real red ruler', 'dear user; a red lure'] },
        { id: 'z2m3', name: 'T and Y', keys: 'ty', lines: ['ftf jyj ftf jyj', 'try yet stay tiles', 'a tidy yard; a tasty date', 'kitty tries art at dusk'] },
        { id: 'z2m4', name: 'G and H', keys: 'gh', lines: ['fgf jhj fgf jhj', 'high light; a huge hug', 'he has a red hat', 'giraffes are tall'] },
        { id: 'z2m5', name: 'Word Run', keys: '', lines: ['the sky is high', 'a great tiger rushes ahead', 'she said the giraffe is tall', 'jets fly higher still'] }
      ],
      boss: { id: 'z2b', name: 'Sky Serpent', icon: '\u{1F409}', shields: 8, lines: ['the tiger leads a great hike;', 'jets drift higher at dusk;', 'a huge red kite flies high;', 'rise; strike fast; first day;'] } },
    { id: 'z3', name: 'Shadow Forest', icon: '\u{1F332}', color: '#51cf66', newKeys: 'owpq',
      missions: [
        { id: 'z3m1', name: 'O and W', keys: 'ow', lines: ['lol sws lol sws', 'slow word owl show', 'we were so glad', 'a wise owl flew far'] },
        { id: 'z3m2', name: 'P and Q', keys: 'pq', lines: [';p; aqa ;p; aqa', 'quip pour equip quiet', 'a quiet pup plays', 'pirates quite like gold'] },
        { id: 'z3m3', name: 'Top Row Run', keys: '', lines: ['your power is quite great', 'two people wrote a story', 'please keep your sword ready'] }
      ],
      boss: { id: 'z3b', name: 'Shadow Wolf', icon: '\u{1F43A}', shields: 8, lines: ['shadows hide upstairs;', 'a quiet ghost wears a red hood;', 'pirates sail past the port;', 'we fight with speed; ships go fast;'] } },
    { id: 'z4', name: 'Meteor Canyon', icon: '\u2604\uFE0F', color: '#ff922b', newKeys: 'cvmbnxz,.',
      missions: [
        { id: 'z4m1', name: 'C and Comma', keys: 'c,', lines: ['dcd k,k dcd k,k', 'cat, cow, car, cake', 'a cool cat, a cute cow', 'catch it, quick'] },
        { id: 'z4m2', name: 'V and M', keys: 'vm', lines: ['fvf jmj fvf jmj', 'move more, vivid mom', 'five vests, some mugs', 'save my video game'] },
        { id: 'z4m3', name: 'B and N', keys: 'bn', lines: ['fbf jnj fbf jnj', 'big bin, brown bun', 'bring ten bananas', 'a banana boat in the bay'] },
        { id: 'z4m4', name: 'X, Z and Period', keys: 'xz.', lines: ['sxs l.l aza l.l', 'fox. box. zebra. lazy.', 'six zebras zoom by.', 'the zoo has a fox.'] },
        { id: 'z4m5', name: 'Full Keyboard', keys: '', lines: ['the quick brown fox jumps over the lazy dog.', 'pack my box with five dozen jugs.', 'zany robots make cool music.'] }
      ],
      boss: { id: 'z4b', name: 'Meteor King', icon: '\u{1F47E}', shields: 8, lines: ['meteors zoom over the canyon.', 'dodge them, block them, blast them.', 'a brave pilot never quits.', 'victory comes with six quick moves.'] } },
    { id: 'z5', name: 'Grandmaster Summit', icon: '\u{1F3D4}\uFE0F', color: '#9775fa', newKeys: '',
      missions: [
        { id: 'z5m1', name: 'Sentence Sprint', keys: '', lines: ['i can type with all ten fingers.', 'my eyes stay on the screen.', 'home row is my base.'] },
        { id: 'z5m2', name: 'Story Mode', keys: '', lines: ['a ninja crept into the castle at night.', 'he typed a secret code on the wall.', 'the door slid open without a sound.'] },
        { id: 'z5m3', name: 'Speed Lab', keys: '', lines: ['fast fingers, calm mind.', 'practice makes progress.', 'reach, tap, and return home.'] }
      ],
      boss: { id: 'z5b', name: 'Grandmaster Panda', icon: '\u{1F43C}', shields: 8, lines: ['the grandmaster bows and smiles.', 'you have trained hard, young ninja.', 'ten fingers move like a quiet storm.', 'now go and type with honor.'] } }
  ];

  D.TIPS = ['\u{1F440} Eyes on the screen, not the keys!', '\u{1F3E0} Home base: A S D F + J K L ;',
    '\u{1F446} Feel the bumps on F and J', '\u{1F422} Accurate first. Speed comes later.',
    '\u{1F44D} Thumbs rest on the space bar', '\u{1F4AA} Reach, tap, return home',
    '\u{1F9D8} Relax your shoulders, curve your fingers', '\u{1F3AF} Use the glowing finger, every time'];

  D.BADGES = [
    { id: 'first', icon: '\u{1F393}', name: 'First Mission', desc: 'Finish your first mission' },
    { id: 'bumps', icon: '\u{1F446}', name: 'Bump Finder', desc: 'Find the F and J bumps' },
    { id: 'perfect', icon: '\u{1F48E}', name: 'Flawless', desc: '100% accuracy on a mission' },
    { id: 'combo25', icon: '\u{1F525}', name: 'On Fire', desc: '25 key combo' },
    { id: 'combo50', icon: '\u26A1', name: 'Lightning', desc: '50 key combo' },
    { id: 'combo100', icon: '\u{1F31F}', name: 'Unstoppable', desc: '100 key combo' },
    { id: 'wpm15', icon: '\u{1F6B2}', name: 'Speedy', desc: 'Reach 15 WPM' },
    { id: 'wpm25', icon: '\u{1F3CE}\uFE0F', name: 'Turbo', desc: 'Reach 25 WPM' },
    { id: 'wpm35', icon: '\u{1F680}', name: 'Rocket Hands', desc: 'Reach 35 WPM' },
    { id: 'boss1', icon: '\u{1F94B}', name: 'Dojo Champion', desc: 'Defeat your first boss' },
    { id: 'bossall', icon: '\u{1F3C6}', name: 'Grandmaster', desc: 'Defeat every boss' },
    { id: 'arcade', icon: '\u2604\uFE0F', name: 'Meteor Blaster', desc: 'Score 500 in Meteor Strike' },
    { id: 'streak3', icon: '\u{1F4C5}', name: '3-Day Streak', desc: 'Practice 3 days in a row' },
    { id: 'zone3star', icon: '\u2B50', name: 'Star Zone', desc: '3 stars on every mission in a zone' }
  ];
  D.NINJA_NICKS = ['Shadow', 'Blaze', 'Viper', 'Ace', 'Thunder', 'Comet', 'Ghost', 'Turbo'];
  D.NINJA_AVATARS = ['\u{1F977}', '\u{1F468}\u200D\u{1F680}', '\u{1F409}', '\u{1F98A}', '\u{1F43A}', '\u{1F916}', '\u{1F985}', '\u{1F47D}'];
  D.KID_AVATARS = ['dino', 'robot'];
  D.COLORS = ['#51cf66', '#339af0', '#ff6b6b', '#ff922b', '#9775fa', '#f783ac', '#20c997', '#fcc419'];

  window.TP_DATA = D;
})();
