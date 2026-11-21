// Chapter 4 "Mains & Rectifiers" (tickets 4-1 .. 4-5): cards, specs, hints, Wren's coach steps, the mains safety card, the plain-words explainers and the exam debrief. `{name}` marks a variable.
export const ch4En: Record<string, string> = {
  'chapter.4.title': 'Mains & Rectifiers',
  'chapter.4.blurb': "{mentor}'s fourth page: five jobs at {stall}, {lane}, with rain on the awnings. Rebuild a wall-wart's rectifier on the safe side of a simulated, isolated mains, hold a radio's rail with a Zener, keep a regulator cool, set an LM317 to 3.3 V, then sit the Zener exam.",
  'ticket.4-1.title': 'Wall Wart',
  'ticket.4-1.brief': 'x', 'ticket.4-1.short': 'x', 'ticket.4-1.spec.ripple': 'x', 'ticket.4-1.spec.mean': 'x', 'ticket.4-1.hint.nudge': 'x', 'ticket.4-1.hint.equation': 'x',
  'ticket.4-1.sel.mains': 'MAINS', 'ticket.4-1.sel.mains.lo': '207 V', 'ticket.4-1.sel.mains.nom': '230 V', 'ticket.4-1.sel.mains.hi': '253 V', 'ticket.4-1.sel.load': 'LOAD', 'ticket.4-1.sel.load.100': '100 mA', 'ticket.4-1.sel.load.0': 'none',
  'coach.4-1.s1': 'x', 'coach.4-1.s2': 'x', 'coach.4-1.s3': 'x', 'coach.4-1.s4': 'x', 'coach.4-1.s5': 'x', 'coach.4-1.s6': 'x',
  'err.selector.unknown': "There is no switch '{id}' on this bench. Switches: {known}.",
  'err.selector.range': "The switch '{id}' has positions 0 to {max}.",
  'selector.set': '{label}.',
  'err.safety.none': 'Ticket {id} is not a mains ticket, so there is no safety card to read.',
  'safety.read': 'Safety card read. The bench is yours.',
  'safety.unread': 'Read the safety card first (it is the first thing on this ticket).',
  'err.keepout.part': 'That is inside the red hatched keep-out (the mains section): nothing goes there, not even on a simulated bench. Pad {pad}.',
  'err.keepout.wire': 'A wire may not enter the red hatched keep-out (the mains section). Pad {pad}.',
  'rating.diode.peak': '{Part} carried pulses of {value} A, but its repetitive peak current is only {limit} A (its average was {avg} A). A rectifier into a capacitor takes short, tall pulses.',
};
