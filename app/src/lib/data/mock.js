// Illustrative mock data for the screens (replaced by live adapters per the PRD:
// iCal / Todoist / Mealie / Grocy / Monarch / OpenWeatherMap).

export const members = [
  { id: 'dad', name: 'Dad', color: '#2E8BC0', tint: '#E7F1F8', tintBorder: '#CDE4F2', mono: 'D' },
  { id: 'mom', name: 'Mom', color: '#E0699A', tint: '#FDEFF5', tintBorder: '#F4D3E2', mono: 'M' },
  { id: 'kid1', name: 'Mia', color: '#E0A11B', tint: '#FFF6E6', tintBorder: '#F4E3BD', mono: 'M', kid: true },
  { id: 'kid2', name: 'Leo', color: '#2FA37C', tint: '#EAF6F0', tintBorder: '#CDE9DD', mono: 'L', kid: true }
];

export const byId = Object.fromEntries(members.map((m) => [m.id, m]));

// Category icon palette for task/reward tiles (color, tintBg).
export const cat = {
  sky: ['#2E8BC0', '#E7F1F8'],
  fern: ['#2FA37C', '#EAF6F0'],
  iris: ['#8E6FD8', '#EFEAFB'],
  coral: ['#E0664B', '#FBE9E4'],
  gold: ['#C9A24B', '#F3E9CF']
};

export const clock = { time: '09:27', date: 'Wednesday, May 8', timeShort: '9:35' };
// place is intentionally blank: the wall renders this mock first, then hydrates
// to real weather. A placeholder city name here would flash a fake location
// (e.g. "Example City") before the real one loads; WeatherToday hides the label
// while place is empty, so the city only ever appears from real data.
export const weather = { wx: 'sunny', temp: 48, hi: 54, lo: 41, place: '' };
export const weatherWeek = [
  { day: 'SUN', wx: 'partly', hi: 62, lo: 48 },
  { day: 'MON', wx: 'sunny', hi: 66, lo: 50 },
  { day: 'TUE', wx: 'rain', hi: 58, lo: 47 },
  { day: 'WED', wx: 'sunny', hi: 54, lo: 41, today: true },
  { day: 'THU', wx: 'cloudy', hi: 60, lo: 46 },
  { day: 'FRI', wx: 'partly', hi: 63, lo: 49 },
  { day: 'SAT', wx: 'rain', hi: 57, lo: 45 }
];

// May 2024: May 1 = Wednesday (firstDay index 3, Sun=0). today = 8.
export const month = {
  label: 'May',
  year: '2024',
  firstDay: 3,
  daysInMonth: 31,
  today: 8,
  dots: {
    2: ['#2E8BC0'],
    3: ['#E0699A'],
    6: ['#E0A11B', '#2FA37C'],
    8: ['#2E8BC0', '#E0699A'],
    9: ['#2FA37C'],
    12: ['#E0A11B'],
    14: ['#8E6FD8'],
    15: ['#2E8BC0', '#E0664B'],
    17: ['#E0699A'],
    20: ['#2FA37C'],
    22: ['#E0A11B', '#2E8BC0'],
    24: ['#8E6FD8'],
    27: ['#E0699A', '#2FA37C'],
    28: ['#2E8BC0'],
    30: ['#E0A11B']
  },
  // Full-month event pills: day -> [{ color, title }]
  events: {
    1: [{ color: '#2E8BC0', title: 'Standup' }],
    2: [{ color: '#2FA37C', title: 'Soccer 4pm' }],
    3: [{ color: '#E0699A', title: 'Book club' }],
    6: [
      { color: '#E0A11B', title: 'Piano' },
      { color: '#2FA37C', title: 'Game night' }
    ],
    8: [
      { color: '#2E8BC0', title: 'Team 1:1' },
      { color: '#E0699A', title: 'Dentist 3pm' }
    ],
    10: [{ color: '#E0A11B', title: 'Field trip' }],
    13: [{ color: '#8E6FD8', title: 'Date night' }],
    15: [
      { color: '#2E8BC0', title: 'Flight 6am' },
      { color: '#E0664B', title: 'Deadline' }
    ],
    17: [{ color: '#E0699A', title: 'Brunch' }],
    20: [{ color: '#2FA37C', title: 'Swim meet' }],
    22: [
      { color: '#E0A11B', title: 'Recital' },
      { color: '#2E8BC0', title: 'Review' }
    ],
    24: [{ color: '#8E6FD8', title: 'Movie night' }],
    27: [
      { color: '#E0699A', title: 'Picnic' },
      { color: '#2FA37C', title: 'BBQ' }
    ],
    29: [{ color: '#2E8BC0', title: 'Conference' }],
    31: [{ color: '#E0A11B', title: 'Yard cleanup' }]
  }
};

export const agendaColumns = [
  {
    id: 'dad',
    groups: [
      { label: 'Today', events: [{ time: '1:00', title: 'Team 1:1' }] },
      { label: 'Thu 9', events: [{ time: '6:00', title: 'Conf call' }] },
      { label: 'Fri 10', events: [{ time: '6:00a', title: 'Flight to SFO' }] }
    ]
  },
  {
    id: 'mom',
    groups: [
      { label: 'Today', events: [{ time: '10:30', title: 'Book club' }] },
      { label: 'Thu 9', events: [{ time: '12:00', title: 'Lunch w/ Sara' }] },
      { label: 'Sat 11', events: [{ time: '11:00', title: 'Brunch' }] }
    ]
  },
  {
    id: 'kid1',
    groups: [
      { label: 'Today', events: [{ time: '3:00', title: 'Dentist' }] },
      { label: 'Thu 9', events: [{ time: '4:00', title: 'Piano' }] },
      { label: 'Fri 10', events: [{ time: '10:00', title: 'Field trip' }] }
    ]
  },
  {
    id: 'kid2',
    groups: [
      { label: 'Today', events: [{ time: '4:00', title: 'Soccer' }] },
      { label: 'Sat 11', events: [{ time: '9:00', title: 'Swim meet' }] },
      { label: 'Sun 12', events: [{ time: '2:00', title: 'Playdate' }] }
    ]
  }
];

// Time-of-day routine segments shown on PersonCards.
export const segments = [
  { icon: 'wb_twilight', active: true },
  { icon: 'light_mode', active: false },
  { icon: 'bedtime', active: false }
];

export const choreCards = [
  {
    id: 'dad',
    points: 800,
    completion: 0.5,
    earnedToday: 30,
    tasks: [
      { title: 'Take out trash', icon: 'delete', catKey: 'sky', points: 15, done: true },
      { title: 'Sweep kitchen', icon: 'cleaning_services', catKey: 'fern', points: 15, done: true },
      { title: 'Mow the lawn', icon: 'grass', catKey: 'fern', points: 20, done: false },
      { title: 'Wash the car', icon: 'local_car_wash', catKey: 'sky', points: 15, done: false }
    ]
  },
  {
    id: 'mom',
    points: 640,
    completion: 0.6,
    earnedToday: 25,
    tasks: [
      { title: 'Meal prep', icon: 'restaurant', catKey: 'fern', points: 15, done: true },
      { title: 'Fold laundry', icon: 'local_laundry_service', catKey: 'iris', points: 10, done: true },
      { title: 'Water plants', icon: 'potted_plant', catKey: 'fern', points: 10, done: false },
      { title: 'Grocery run', icon: 'shopping_cart', catKey: 'sky', points: 15, done: false }
    ]
  },
  {
    id: 'kid1',
    points: 320,
    completion: 0.4,
    earnedToday: 15,
    tasks: [
      { title: 'Make bed', icon: 'bed', catKey: 'iris', points: 10, done: true },
      { title: 'Brush teeth', icon: 'dentistry', catKey: 'sky', points: 5, done: true },
      { title: 'Practice piano', icon: 'piano', catKey: 'gold', points: 15, done: false },
      { title: 'Feed the dog', icon: 'pets', catKey: 'coral', points: 10, done: false }
    ]
  },
  {
    id: 'kid2',
    points: 510,
    completion: 0.6,
    earnedToday: 20,
    tasks: [
      { title: 'Set the table', icon: 'restaurant', catKey: 'fern', points: 10, done: true },
      { title: 'Homework', icon: 'school', catKey: 'sky', points: 20, done: false },
      { title: 'Walk the dog', icon: 'directions_walk', catKey: 'iris', points: 10, done: false },
      { title: 'Tidy room', icon: 'checkroom', catKey: 'gold', points: 15, done: false }
    ]
  }
];

export const rewardRows = [
  {
    id: 'dad',
    balance: 800,
    rewards: [
      { name: 'Pub night', icon: 'sports_bar', catKey: 'iris', cost: 300 },
      { name: 'Concert', icon: 'music_note', catKey: 'coral', cost: 500 },
      { name: 'Headphones', icon: 'headphones', catKey: 'sky', cost: 950 }
    ]
  },
  {
    id: 'kid1',
    balance: 320,
    rewards: [
      { name: 'Ice cream', icon: 'icecream', catKey: 'coral', cost: 50 },
      { name: 'New game', icon: 'sports_esports', catKey: 'sky', cost: 250 },
      { name: 'Theme park', icon: 'attractions', catKey: 'sky', cost: 500 }
    ]
  },
  {
    id: 'kid2',
    balance: 510,
    rewards: [
      { name: 'Movie night', icon: 'movie', catKey: 'gold', cost: 100 },
      { name: 'LEGO set', icon: 'toys', catKey: 'coral', cost: 450 },
      { name: 'New bike', icon: 'pedal_bike', catKey: 'sky', cost: 900 }
    ]
  }
];

export const todoColumns = [
  {
    id: 'dad',
    items: [
      { title: 'Call plumber', due: 'Today', overdue: true, done: false },
      { title: 'Renew passport', due: 'Fri', done: false },
      { title: 'Car service', due: 'Mon', done: false }
    ]
  },
  {
    id: 'mom',
    items: [
      { title: 'Reply to school', due: 'Today', overdue: true, done: false },
      { title: 'Book flights', due: 'Wed', done: false },
      { title: 'Gym signup', due: 'Sat', done: true }
    ]
  },
  {
    id: 'kid1',
    items: [
      { title: 'Science project', due: 'Thu', done: false },
      { title: 'Return library books', due: 'Fri', done: false }
    ]
  },
  {
    id: 'kid2',
    items: [
      { title: 'Spelling list', due: 'Today', overdue: true, done: false },
      { title: 'Pack soccer kit', due: 'Sat', done: false }
    ]
  }
];

export const dashboard = {
  todos: {
    items: [
      { title: 'Sign permission slip', done: false },
      { title: 'Call the plumber', done: false },
      { title: 'Return library books', done: true }
    ],
    left: '2 left today'
  },
  grocery: {
    items: [
      { title: 'Carrots', done: false },
      { title: 'Yogurt', done: false },
      { title: 'Olive oil', done: false }
    ],
    count: '8 items'
  },
  meal: { slot: 'Dinner', dish: 'Sheet-pan salmon', detail: '6:30pm · 4 servings' }
};

// Budget: category budget/spent/left + a true-net total, matching the shape
// server/sources/monarch.js's mapBudget returns.
export const budget = {
  updated: new Date().toISOString(),
  demo: true,
  totals: { budget: 2100, spent: 1258, left: 842 },
  // icon/catKey mirror server/config/budget-categories.js's curated map —
  // kept in sync by hand (small, static, changes rarely).
  budgets: [
    { category: 'Groceries', budget: 460, spent: 340, left: 120, icon: 'local_grocery_store', catKey: 'fern' },
    { category: 'Dining Out', budget: 200, spent: 210, left: -10, icon: 'restaurant', catKey: 'coral' },
    { category: 'Kids Activities', budget: 200, spent: 102, left: 98, icon: 'sports_soccer', catKey: 'iris' },
    { category: 'Household', budget: 300, spent: 189, left: 111, icon: 'home', catKey: 'sky' },
    { category: 'Gas', budget: 150, spent: 90, left: 60, icon: 'local_gas_station', catKey: 'gold' },
    { category: 'Gifts', budget: 150, spent: 0, left: 150, icon: 'redeem', catKey: 'coral' }
  ]
};

// Journal: a small demo feed (May 2024, same "today" the rest of mock.js
// uses) so the screen is browsable out of the box.
export const journal = {
  entries: [
    {
      id: 1,
      authorId: 'mom',
      text: 'Rainy Saturday pancakes 🥞',
      tag: null,
      photoPath: '/demo/journal/pancakes.png',
      hearts: 2,
      localDate: '2024-05-04',
      createdAt: '2024-05-04T15:00:00.000Z',
      memberIds: ['mom', 'dad', 'kid1', 'kid2']
    },
    {
      id: 2,
      authorId: 'dad',
      text: 'Mia lost her first tooth today! 🦷',
      tag: 'milestone',
      photoPath: null,
      hearts: 3,
      localDate: '2024-05-06',
      createdAt: '2024-05-06T18:30:00.000Z',
      memberIds: ['kid1']
    },
    {
      id: 3,
      authorId: 'mom',
      text: '"I\'m not tired, I\'m just resting my eyes" — Leo',
      tag: 'quote',
      photoPath: null,
      hearts: 5,
      localDate: '2024-05-07',
      createdAt: '2024-05-07T20:15:00.000Z',
      memberIds: ['kid2']
    },
    {
      id: 4,
      authorId: 'dad',
      text: 'First day back at school after break',
      tag: 'school',
      photoPath: null,
      hearts: 1,
      localDate: '2024-05-08',
      createdAt: '2024-05-08T08:00:00.000Z',
      memberIds: ['kid1', 'kid2']
    }
  ],
  onThisDay: [
    {
      id: 99,
      authorId: 'mom',
      text: "Mia's first steps! 👣",
      tag: 'milestone',
      photoPath: null,
      hearts: 8,
      localDate: '2023-05-08',
      createdAt: '2023-05-08T10:00:00.000Z',
      memberIds: ['kid1']
    }
  ],
  tags: [
    { id: 'milestone', label: 'Milestone', icon: 'military_tech', catKey: 'gold' },
    { id: 'quote', label: 'Funny Quote', icon: 'chat_bubble', catKey: 'iris' },
    { id: 'school', label: 'School', icon: 'backpack', catKey: 'sky' },
    { id: 'health', label: 'Health', icon: 'favorite', catKey: 'coral' }
  ]
};

// Meal grid is Sun→Sat × 4 slots. A small rotation of weekly menus so paging
// weeks shows variety until the Mealie adapter replaces it; selection by
// week-of-year lives in calendar.js (mealsForWeek).
// Illustrated demo thumbnails for a few common dishes, keyed by the exact menu
// name below. They dress up the fallback meal grid so it isn't all striped
// placeholders before a real Mealie plan (which brings its own photos) lands.
export const DEMO_MEAL_IMAGES = {
  Pancakes: '/demo/meals/pancakes.png',
  Waffles: '/demo/meals/pancakes.png',
  Salmon: '/demo/meals/salmon.png',
  Tacos: '/demo/meals/tacos.png',
  'Pizza night': '/demo/meals/pizza.png',
  'Pasta bake': '/demo/meals/pasta.png',
  Lasagna: '/demo/meals/pasta.png',
  Burgers: '/demo/meals/burgers.png'
};

export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
export const MEAL_MENUS = [
  [
    ['Oatmeal', 'Leftovers', 'Roast chicken', 'Apples'],
    ['Yogurt bowl', 'Wraps', 'Pasta bake', 'Hummus'],
    ['Pancakes', 'Soup', 'Tacos', 'Trail mix'],
    ['Smoothie', 'Salad', 'Salmon', 'Cheese'],
    ['Eggs', 'Sandwich', 'Stir-fry', 'Yogurt'],
    ['Bagels', 'Mac & cheese', 'Pizza night', 'Popcorn'],
    ['Waffles', 'Picnic', 'BBQ', 'Fruit']
  ],
  [
    ['Granola', 'Quesadilla', 'Pot roast', 'Banana'],
    ['Toast & eggs', 'Bento box', 'Curry night', 'Crackers'],
    ['Muffins', 'Ramen', 'Burgers', 'Granola bar'],
    ['Acai bowl', 'Caesar salad', 'Lasagna', 'Grapes'],
    ['Cereal', 'Pho', 'Sheet-pan veg', 'Almonds'],
    ['French toast', 'Burritos', 'Fish & chips', 'Pretzels'],
    ['Omelette', 'Charcuterie', 'Grill night', 'Berries']
  ]
];
