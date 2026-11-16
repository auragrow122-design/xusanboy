export interface StudentRecord {
  id: number;
  name: string;
  className: string;
  initials: string;
  gender: 'qiz' | 'o‘gil';
  present: boolean;
  time: string | null;
  photos: string[];
}

export const INITIAL_STUDENTS: Omit<StudentRecord, 'present' | 'time' | 'photos'>[] = [
  { id: 0, name: 'Madina Karimova', className: '5-A', initials: 'MK', gender: 'qiz' },
  { id: 1, name: 'Asadbek Rahimov', className: '6-B', initials: 'AR', gender: 'o‘gil' },
  { id: 2, name: 'Ziyoda Aliyeva', className: '4-A', initials: 'ZA', gender: 'qiz' },
  { id: 3, name: 'Jasur Tursunov', className: '7-V', initials: 'JT', gender: 'o‘gil' },
  { id: 4, name: 'Mohira Islomova', className: '5-B', initials: 'MI', gender: 'qiz' },
  { id: 5, name: 'Sardor Qodirov', className: '5-A', initials: 'SQ', gender: 'o‘gil' },
  { id: 6, name: 'Dilnoza Yusupova', className: '6-B', initials: 'DY', gender: 'qiz' },
  { id: 7, name: 'Bobur Ergashev', className: '4-A', initials: 'BE', gender: 'o‘gil' },
  { id: 8, name: 'Shahlo Nazarova', className: '7-V', initials: 'SN', gender: 'qiz' },
  { id: 9, name: 'Otabek Saidov', className: '5-B', initials: 'OS', gender: 'o‘gil' },
  { id: 10, name: 'Nilufar Hamidova', className: '6-A', initials: 'NH', gender: 'qiz' },
  { id: 11, name: 'Sherzod Abdullayev', className: '7-V', initials: 'SA', gender: 'o‘gil' },
];

export const WEEKLY_SCHEDULE: string[][] = [
  ['Ona tili', 'Matematika', 'Ingliz tili', 'Tabiiy fan', 'Jismoniy tarbiya'],
  ['Matematika', 'O‘qish', 'Rus tili', 'Tasviriy san’at', 'Informatika'],
  ['Ona tili', 'Matematika', 'Tarix', 'Ingliz tili', 'Musiqa'],
  ['Matematika', 'Ona tili', 'Tabiiy fan', 'Ingliz tili', 'Mehnat'],
  ['O‘qish', 'Matematika', 'Rus tili', 'Jismoniy tarbiya', 'Sinf soati'],
  ['Ona tili', 'Matematika', 'Ingliz tili', 'Tabiiy fan'],
];

export const LESSON_START_MINUTES = [8 * 60 + 30, 9 * 60 + 25, 10 * 60 + 20, 11 * 60 + 25, 12 * 60 + 20];
export const SHORT_DAYS = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];

export interface QuizQuestion {
  id: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface QuizPack {
  id: string;
  title: string;
  subject: string;
  description: string;
  questions: QuizQuestion[];
}

export const DOXTER_QUESTION_COUNT = 10;
export const DOXTER_SECONDS_PER_QUESTION = 20;

export const QUIZ_PACKS: QuizPack[] = [
  {
    id: 'general',
    title: 'Umumiy bilimlar',
    subject: 'Aralash fanlar',
    description: 'Maktab o‘quvchilari uchun qiziqarli 10 ta savoldan iborat viktorina.',
    questions: [
      {
        id: 1,
        question: 'O‘zbekiston Respublikasining poytaxti qaysi shahar?',
        options: ['Samarqand', 'Toshkent', 'Buxoro', 'Xiva'],
        correctIndex: 1,
      },
      {
        id: 2,
        question: 'Quyosh sistemasidagi eng katta sayyora qaysi?',
        options: ['Mars', 'Saturn', 'Yupiter', 'Yer'],
        correctIndex: 2,
      },
      {
        id: 3,
        question: '1 kilometr necha metrga teng?',
        options: ['100 metr', '500 metr', '1000 metr', '10000 metr'],
        correctIndex: 2,
      },
      {
        id: 4,
        question: 'Suvning kimyoviy formulasi qaysi?',
        options: ['CO₂', 'H₂O', 'O₂', 'NaCl'],
        correctIndex: 1,
      },
      {
        id: 5,
        question: 'Alisher Navoiy qaysi shaharda tug‘ilgan?',
        options: ['Hirot', 'Buxoro', 'Samarqand', 'Termiz'],
        correctIndex: 0,
      },
      {
        id: 6,
        question: 'Bir yilda nechta fasl bor?',
        options: ['2 ta', '3 ta', '4 ta', '6 ta'],
        correctIndex: 2,
      },
      {
        id: 7,
        question: 'Dunyodagi eng uzun daryo qaysi?',
        options: ['Amudaryo', 'Nil', 'Volga', 'Dunay'],
        correctIndex: 1,
      },
      {
        id: 8,
        question: 'Kompyuterning "miyasi" deb ataladigan asosiy qism nima?',
        options: ['Monitor', 'Klaviatura', 'Protsessor (CPU)', 'Printer'],
        correctIndex: 2,
      },
      {
        id: 9,
        question: 'O‘zbekiston bayrog‘ida nechta yulduz tasvirlangan?',
        options: ['10 ta', '12 ta', '7 ta', '5 ta'],
        correctIndex: 1,
      },
      {
        id: 10,
        question: 'Qaysi hayvon sutemizuvchilar sinfiga kiradi, lekin ucha oladi?',
        options: ['Burgut', 'Ko‘rshapalak', 'Pingvin', 'Tovus'],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'math',
    title: 'Matematika va mantiq',
    subject: 'Matematika',
    description: 'Hisob-kitob va mantiqiy fikrlashni sinovchi 10 ta savol.',
    questions: [
      {
        id: 1,
        question: '15 × 4 nechaga teng?',
        options: ['45', '50', '60', '65'],
        correctIndex: 2,
      },
      {
        id: 2,
        question: 'Uchburchakning ichki burchaklari yig‘indisi necha gradus?',
        options: ['90°', '180°', '270°', '360°'],
        correctIndex: 1,
      },
      {
        id: 3,
        question: '144 ning kvadrat ildizi nechaga teng?',
        options: ['11', '12', '13', '14'],
        correctIndex: 1,
      },
      {
        id: 4,
        question: 'Agar 3x = 27 bo‘lsa, x nechaga teng?',
        options: ['6', '7', '8', '9'],
        correctIndex: 3,
      },
      {
        id: 5,
        question: 'Tomoni 5 sm bo‘lgan kvadratning perimetri qancha?',
        options: ['15 sm', '20 sm', '25 sm', '10 sm'],
        correctIndex: 1,
      },
      {
        id: 6,
        question: 'Eng kichik tub son qaysi?',
        options: ['0', '1', '2', '3'],
        correctIndex: 2,
      },
      {
        id: 7,
        question: '200 ning 25 foizi nechaga teng?',
        options: ['25', '40', '50', '75'],
        correctIndex: 2,
      },
      {
        id: 8,
        question: '1 soat necha sekunddan iborat?',
        options: ['600', '1800', '3600', '7200'],
        correctIndex: 2,
      },
      {
        id: 9,
        question: 'Ketma-ketlikni davom ettiring: 2, 6, 12, 20, ...',
        options: ['28', '30', '32', '24'],
        correctIndex: 1,
      },
      {
        id: 10,
        question: '7² − 9 nechaga teng?',
        options: ['38', '40', '42', '49'],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'science',
    title: 'Tabiiy fanlar va IT',
    subject: 'Biologiya, Fizika, Informatika',
    description: 'Tabiat qonunlari va zamonaviy texnologiyalar bo‘yicha 10 ta savol.',
    questions: [
      {
        id: 1,
        question: 'O‘simliklar quyosh nuri yordamida oziq modda hosil qilish jarayoni nima deyiladi?',
        options: ['Nafas olish', 'Fotosintez', 'Bug‘lanish', 'Diffuziya'],
        correctIndex: 1,
      },
      {
        id: 2,
        question: 'Ikkilik sanoq tizimida qaysi raqamlar ishlatiladi?',
        options: ['1 va 2', '0 va 1', '0 dan 9 gacha', '1 dan 10 gacha'],
        correctIndex: 1,
      },
      {
        id: 3,
        question: 'Yorug‘lik tezligi vakuumda taxminan qanchaga teng?',
        options: ['300 km/s', '3 000 km/s', '300 000 km/s', '30 000 km/s'],
        correctIndex: 2,
      },
      {
        id: 4,
        question: 'Inson tanasidagi eng katta a’zo (organ) qaysi?',
        options: ['Jigar', 'Teri', 'Yurak', 'O‘pka'],
        correctIndex: 1,
      },
      {
        id: 5,
        question: 'HTML qisqartmasi nimani anglatadi?',
        options: [
          'HyperText Markup Language',
          'High Tech Machine Logic',
          'Home Tool Markup Link',
          'Hyper Transfer Main Line',
        ],
        correctIndex: 0,
      },
      {
        id: 6,
        question: 'Havoning asosiy qismini qaysi gaz tashkil qiladi (~78%)?',
        options: ['Kislorod', 'Azot', 'Karbonat angidrid', 'Vodorod'],
        correctIndex: 1,
      },
      {
        id: 7,
        question: '1 bayt necha bitdan iborat?',
        options: ['4 bit', '8 bit', '16 bit', '32 bit'],
        correctIndex: 1,
      },
      {
        id: 8,
        question: 'Elektr tokining o‘lchov birligi nima?',
        options: ['Volt', 'Amper', 'Vatt', 'Om'],
        correctIndex: 1,
      },
      {
        id: 9,
        question: 'Qaysi sayyora "Qizil sayyora" nomi bilan mashhur?',
        options: ['Venera', 'Merkuriy', 'Mars', 'Neptun'],
        correctIndex: 2,
      },
      {
        id: 10,
        question: 'Yurak qonni tanaga haydashda qaysi tomirlar orqali chiqaradi?',
        options: ['Venalar', 'Arteriyalar', 'Limfa tomirlari', 'Bronxlar'],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'history',
    title: 'Tarix va Geografiya',
    subject: 'Tarix & Geografiya',
    description: 'Buyuk ajdodlarimiz va dunyo xaritasi bo‘yicha 10 ta savol.',
    questions: [
      {
        id: 1,
        question: 'Amir Temur qaysi yilda tug‘ilgan?',
        options: ['1336-yil', '1346-yil', '1370-yil', '1405-yil'],
        correctIndex: 0,
      },
      {
        id: 2,
        question: 'Yer yuzida nechta materik (qit’a) mavjud?',
        options: ['5 ta', '6 ta', '7 ta', '8 ta'],
        correctIndex: 1,
      },
      {
        id: 3,
        question: '"Tib qonunlari" asari muallifi kim?',
        options: ['Al-Xorazmiy', 'Abu Ali ibn Sino', 'Mirzo Ulug‘bek', 'Al-Beruniy'],
        correctIndex: 1,
      },
      {
        id: 4,
        question: 'Dunyodagi eng katta okean qaysi?',
        options: ['Atlantika', 'Hind', 'Tinch', 'Shimoliy Muz'],
        correctIndex: 2,
      },
      {
        id: 5,
        question: 'O‘zbekiston mustaqilligi qachon e’lon qilingan?',
        options: ['1990-yil 20-iyun', '1991-yil 31-avgust', '1992-yil 8-dekabr', '1991-yil 1-noyabr'],
        correctIndex: 1,
      },
      {
        id: 6,
        question: 'Registon maydoni qaysi shaharda joylashgan?',
        options: ['Buxoro', 'Xiva', 'Samarqand', 'Shahrisabz'],
        correctIndex: 2,
      },
      {
        id: 7,
        question: 'Mirzo Ulug‘bek observatoriyasi qayerda qurilgan?',
        options: ['Toshkent', 'Samarqand', 'Farg‘ona', 'Qo‘qon'],
        correctIndex: 1,
      },
      {
        id: 8,
        question: 'O‘zbekiston nechta davlat bilan chegaradosh?',
        options: ['4 ta', '5 ta', '6 ta', '7 ta'],
        correctIndex: 1,
      },
      {
        id: 9,
        question: 'Algebra faniga asos solgan buyuk alloma kim?',
        options: ['Al-Farg‘oniy', 'Muhammad al-Xorazmiy', 'Imom Buxoriy', 'Zahiriddin Bobur'],
        correctIndex: 1,
      },
      {
        id: 10,
        question: 'Dunyodagi eng baland tog‘ cho‘qqisi qaysi?',
        options: ['Elbrus', 'Jomolungma (Everest)', 'Kilimanjaro', 'Monblan'],
        correctIndex: 1,
      },
    ],
  },
];

export type DoxterPhase = 'lobby' | 'question' | 'question_result' | 'finished';

export interface DoxterPlayerPublic {
  id: string;
  name: string;
  score: number;
  answeredCurrent: boolean;
  lastCorrect: boolean | null;
  lastPointsEarned: number;
}

export interface DoxterRoomState {
  code: string;
  topicTitle: string;
  phase: DoxterPhase;
  questionIndex: number; // 0-based (0..9)
  totalQuestions: number; // 10
  questionEndsAt: number | null; // epoch ms
  autoNextAt: number | null; // epoch ms
  secondsPerQuestion: number;
  currentQuestion: {
    question: string;
    options: [string, string, string, string];
    correctIndex?: number; // only revealed in question_result / finished
  } | null;
  players: DoxterPlayerPublic[];
  answeredCount: number;
  optionCounts: [number, number, number, number] | null;
  yourRole: 'teacher' | 'student';
  yourPlayerId: string | null;
  yourSelectedOption: number | null;
}
