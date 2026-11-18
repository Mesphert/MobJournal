// Market sessions in each exchange's local time (DST handled automatically).
export const SESSION_SEEDS = [
  { key: 'sydney',  name: 'Sydney',       tz: 'Australia/Sydney', start: '07:00', end: '16:00', color: '#38bdf8' },
  { key: 'asia',    name: 'Asia (Tokyo)', tz: 'Asia/Tokyo',       start: '09:00', end: '18:00', color: '#f472b6' },
  { key: 'london',  name: 'London',       tz: 'Europe/London',    start: '08:00', end: '17:00', color: '#fbbf24' },
  { key: 'newyork', name: 'New York',     tz: 'America/New_York', start: '08:00', end: '17:00', color: '#34d399' },
];

// ICT ranges in New York time. EDITABLE DATA: verify against your own notes.
const NY = 'America/New_York';
const WEEK = '1,2,3,4,5';
const r = (key, name, kind, start, end, days = WEEK) => ({ key, name, kind, tz: NY, start, end, days });

export const ICT_SEEDS = [
  r('kz_asia',   'Asia Killzone',         'killzone', '20:00', '00:00', '0,1,2,3,4'),
  r('kz_london', 'London Killzone',       'killzone', '02:00', '05:00'),
  r('kz_ny',     'New York Killzone',     'killzone', '07:00', '10:00'),
  r('kz_lclose', 'London Close Killzone', 'killzone', '10:00', '12:00'),
  r('sb_london', 'London Silver Bullet',  'silver_bullet', '03:00', '04:00'),
  r('sb_nyam',   'NY AM Silver Bullet',   'silver_bullet', '10:00', '11:00'),
  r('sb_nypm',   'NY PM Silver Bullet',   'silver_bullet', '14:00', '15:00'),
  r('mc_0233', 'Macro 02:33', 'macro', '02:33', '03:00'),
  r('mc_0403', 'Macro 04:03', 'macro', '04:03', '04:30'),
  r('mc_0850', 'Macro 08:50', 'macro', '08:50', '09:10'),
  r('mc_0950', 'Macro 09:50', 'macro', '09:50', '10:10'),
  r('mc_1050', 'Macro 10:50', 'macro', '10:50', '11:10'),
  r('mc_1150', 'Macro 11:50', 'macro', '11:50', '12:10'),
  r('mc_1310', 'Macro 13:10', 'macro', '13:10', '13:40'),
  r('mc_1450', 'Macro 14:50', 'macro', '14:50', '15:10'),
  r('mc_1515', 'Macro 15:15', 'macro', '15:15', '15:45'),
];
