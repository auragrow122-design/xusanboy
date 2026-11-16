import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Gamepad2,
  Menu,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  INITIAL_STUDENTS,
  LESSON_START_MINUTES,
  SHORT_DAYS,
  WEEKLY_SCHEDULE,
  type StudentRecord,
} from './data/schoolData';
import { BrandLogo } from './components/BrandLogo';
import { ZagruskaOverlay } from './components/ZagruskaOverlay';
import { AttendanceModals, type ActiveModalType } from './components/AttendanceModals';
import { DoxterGameModal } from './components/DoxterGameModal';
import { getLocalAttendance, isFileProtocol } from './utils/localFallback';

const FAQ_ITEMS = [
  {
    q: 'Ota-ona farzandi maktabga kelganini qanday biladi?',
    a: 'Tepadagi “Men ota-onaman” tugmasini bosing, ismingizni yozing va farzandingizni tanlang. Farzandingiz maktabda yuz skaneridan o‘tgan zahoti kelgan soati va rasmi sizda ko‘rinadi.',
  },
  {
    q: 'Yuz skaneri qanday ishlaydi?',
    a: 'O‘quvchi “Keldim” tugmasini bosganda kamera ochiladi. Skaner yuz nuqtalarini va jins mosligini (qiz bola yoki o‘g‘il bola) tekshiradi hamda jonli harakatni tasdiqlaydi. Skanerdan o‘tmasa, maktabga kelgani hisoblanmaydi.',
  },
  {
    q: '“O‘quvchilar bilan o‘ynash” (DOXTER) qanday ishlaydi?',
    a: 'Ustoz “O‘yin yaratish” tugmasi orqali 6 xonali kod oladi. O‘quvchilar “Qo‘shilish” tugmasini bosib o‘sha kodni kiritishadi va 10 ta savolga 20 sekunddan javob berib musobaqalashadi.',
  },
  {
    q: 'Maktab · Admin bo‘limi nima uchun kerak?',
    a: 'Maktab xodimi barcha o‘quvchilarning bugungi davomatini bitta ro‘yxatda ko‘rishi va boshqarishi uchun.',
  },
];

const UZ_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const UZ_MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentyabr',
  'oktyabr',
  'noyabr',
  'dekabr',
];

function getTodayFormatted(): string {
  const d = new Date();
  return `${UZ_DAYS[d.getDay()]}, ${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
}

function formatHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export default function App() {
  const [students, setStudents] = useState<StudentRecord[]>(() =>
    INITIAL_STUDENTS.map((s) => ({ ...s, present: false, time: null, photos: [] })),
  );
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [doxterOpen, setDoxterOpen] = useState(false);
  const [doxterInitialMode, setDoxterInitialMode] = useState<'menu' | 'create' | 'join'>('menu');

  const [zagruskaVisible, setZagruskaVisible] = useState(false);
  const [zagruskaText, setZagruskaText] = useState('Serverga ulanmoqda...');
  const [zagruskaDuration, setZagruskaDuration] = useState(4500);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const [quickSearch, setQuickSearch] = useState('');
  const [scheduleDay, setScheduleDay] = useState<number>(() => {
    const wd = new Date().getDay();
    return wd === 0 ? 0 : wd - 1;
  });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const triggerZagruska = useCallback(async (ms = 4500, text = 'Serverga ulanmoqda...') => {
    setZagruskaDuration(ms);
    setZagruskaText(text);
    setZagruskaVisible(true);
    await new Promise((resolve) => setTimeout(resolve, ms));
    setZagruskaVisible(false);
  }, []);

  const refreshAttendance = useCallback(async () => {
    if (isFileProtocol()) {
      setStudents(getLocalAttendance());
      return;
    }
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const data = (await res.json()) as { students?: StudentRecord[] };
        if (Array.isArray(data.students)) {
          setStudents(data.students);
        }
      }
    } catch {
      // Keep current state on transient error
    }
  }, []);

  useEffect(() => {
    refreshAttendance();
  }, [refreshAttendance]);

  const openModalWithLoading = async (modal: ActiveModalType, label: string) => {
    setMobileMenuOpen(false);
    await triggerZagruska(4500, label);
    await refreshAttendance();
    setActiveModal(modal);
  };

  const openDoxterWithLoading = async (mode: 'menu' | 'create' | 'join', label: string) => {
    setMobileMenuOpen(false);
    await triggerZagruska(4500, label);
    setDoxterInitialMode(mode);
    setDoxterOpen(true);
  };

  const handleDownloadHtml = async () => {
    try {
      showToast('aloqa-sayt.html fayli tayyorlanmoqda...');
      const res = await fetch('/download/aloqa-sayt.html');
      if (!res.ok) throw new Error('fetch-failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aloqa-sayt.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('aloqa-sayt.html yuklab olindi ✓');
    } catch {
      showToast('Yuklab olishda xatolik yuz berdi');
    }
  };

  const presentCount = students.filter((s) => s.present).length;

  const filteredStudents = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q),
    );
  }, [students, quickSearch]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F7FD] text-slate-900">
      {/* TOP BAR (3-Zone Contract) */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <a
            href="#top"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg"
          >
            <BrandLogo size={34} />
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-900">
              aloqa
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a
              href="#asosiy"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Asosiy
            </a>
            <a
              href="#bolimlar"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Bo‘limlar
            </a>
            <a
              href="#jadval"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Dars jadvali
            </a>
            <a
              href="#savollar"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Savollar
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openModalWithLoading('role_picker', 'Kabinetga ulanmoqda...')}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Kirish
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
              aria-label="Menyu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            <a
              href="#asosiy"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Asosiy
            </a>
            <a
              href="#bolimlar"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Bo‘limlar
            </a>
            <a
              href="#jadval"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dars jadvali
            </a>
            <a
              href="#savollar"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Savollar
            </a>
          </div>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* BRIGHT MODERN HERO WORKSPACE */}
        <section id="asosiy" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-11 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left: Crisp Airy White Hero Card with Soft Blue Accent */}
            <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-10 shadow-[0_12px_40px_rgba(37,99,235,0.06)]">
              <div>
                <p className="text-xs font-bold text-blue-600">
                  Maktab va oila platformasi · {getTodayFormatted()}
                </p>

                <h1 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                  Farzandingiz maktabda ekanini{' '}
                  <span className="text-blue-600">bir qarashda</span> biling
                </h1>

                <p className="mt-4 max-w-xl text-base sm:text-lg text-slate-600 leading-relaxed">
                  Ota-onalar bolasining kelgan vaqti va rasmini darhol ko‘radi. O‘quvchilar esa
                  kamera yuz skaneri orqali “Keldim” belgilab, dars jadvalini kuzatishadi.
                </p>

                {/* Clean 2-item feature highlight row */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-slate-600">
                  <div className="flex items-center gap-2.5 rounded-xl bg-blue-50/70 px-3.5 py-2.5 text-blue-900">
                    <Camera className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>Aqlli yuz skaneri orqali davomat</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/70 px-3.5 py-2.5 text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Ota-ona uchun tezkor xabarnoma</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openModalWithLoading('parent', 'Ota-ona kabineti ochilmoqda...')}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-blue-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all"
                >
                  <Users className="h-5 w-5" />
                  Men ota-onaman
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openModalWithLoading('student', 'O‘quvchi bo‘limi ochilmoqda...')
                  }
                  className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3.5 text-sm sm:text-base font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-all"
                >
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                  Men o‘quvchiman
                </button>
                {!isFileProtocol() && (
                  <button
                    type="button"
                    onClick={handleDownloadHtml}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-5 py-3.5 text-sm font-bold text-blue-700 hover:bg-blue-100 transition-all"
                  >
                    <Download className="h-4 w-4" />
                    Yuklab olish (.html)
                  </button>
                )}
              </div>
            </div>

            {/* Right: Crisp Live Attendance Quick-Check Panel */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_12px_40px_rgba(37,99,235,0.06)]">
              <div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50/70 p-4">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-extrabold text-slate-900">
                      Bugungi davomat
                    </h2>
                    <p className="text-xs text-slate-600">
                      Farzandingiz ismini yozib tekshiring
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-2xl font-extrabold text-blue-600 tabular-nums">
                      {presentCount}
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-400 tabular-nums">
                      /{students.length}
                    </span>
                  </div>
                </div>

                <div className="relative mt-4">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder="Ism yoki sinf (masalan: Madina)..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="mt-3 max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1">
                  {filteredStudents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      O‘quvchi topilmadi
                    </p>
                  ) : (
                    filteredStudents.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-700">
                            {s.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{s.name}</p>
                            <p className="text-xs text-slate-500">{s.className} sinf</p>
                          </div>
                        </div>
                        {s.present ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Keldi {s.time ? `· ${s.time}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 shrink-0">
                            <Clock className="h-4 w-4 text-amber-500" />
                            Kutilmoqda
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Kelganlik rasmini ko‘rish uchun</span>
                <button
                  type="button"
                  onClick={() => openModalWithLoading('parent', 'Ota-ona kabineti ochilmoqda...')}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Ota-ona kabineti →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 4 CRISP ACTION CARDS (Including DOXTER in the lower cards) */}
        <section id="bolimlar" className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Bo‘limlar
              </p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Kerakli bo‘limni tanlang
              </h2>
            </div>
            {!isFileProtocol() && (
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                Saytni yuklab olish (.html)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Ota-ona */}
            <button
              type="button"
              onClick={() => openModalWithLoading('parent', 'Ota-ona bo‘limi ochilmoqda...')}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-xs hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-slate-900">
                  Ota-ona
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Farzandingiz kelgan soati va skaner rasmini ko‘rasiz.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600">
                Kirish <ArrowRight className="h-4 w-4" />
              </span>
            </button>

            {/* 2. O'quvchi (with Face Scanner!) */}
            <button
              type="button"
              onClick={() => openModalWithLoading('student', 'O‘quvchi bo‘limi ochilmoqda...')}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-xs hover:border-emerald-500 hover:shadow-md transition-all"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Camera className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-slate-900">
                  O‘quvchi
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Yuz skaneri orqali “Keldim” belgilang va dars jadvalini ko‘ring.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                Ochish <ArrowRight className="h-4 w-4" />
              </span>
            </button>

            {/* 3. Maktab · Admin */}
            <button
              type="button"
              onClick={() => openModalWithLoading('admin', 'Admin paneli ochilmoqda...')}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-xs hover:border-slate-700 hover:shadow-md transition-all"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-slate-900">
                  Maktab · Admin
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Barcha o‘quvchilar davomatini bitta ro‘yxatda nazorat qiling.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
                Panelga kirish <ArrowRight className="h-4 w-4" />
              </span>
            </button>

            {/* 4. DOXTER — O'quvchilar bilan o'ynash */}
            <button
              type="button"
              onClick={() => openDoxterWithLoading('menu', 'DOXTER o‘yiniga ulanmoqda...')}
              className="group flex flex-col justify-between rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-left text-white shadow-md shadow-blue-600/15 hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
                  <Gamepad2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-extrabold">
                  O‘quvchilar bilan o‘ynash
                </h3>
                <p className="mt-1.5 text-sm text-blue-100">
                  DOXTER o‘yini: ustoz 6 xonali kod beradi, bolalar 10 ta savolga javob beradi.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-white">
                O‘yinni ochish <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </section>

        {/* WEEKLY SCHEDULE + 3 SIMPLE STEPS */}
        <section id="jadval" className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Schedule */}
            <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Dars jadvali
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-900">
                    Haftalik darslar
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span>Ota-ona va bola uchun</span>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-1.5 mb-5 p-1 rounded-xl bg-slate-100">
                {SHORT_DAYS.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setScheduleDay(idx)}
                    className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                      scheduleDay === idx
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-slate-100">
                {WEEKLY_SCHEDULE[scheduleDay].map((subject, idx) => {
                  const startMin = LESSON_START_MINUTES[idx];
                  const now = new Date();
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const isToday = now.getDay() !== 0 && now.getDay() - 1 === scheduleDay;
                  const isLive = isToday && nowMin >= startMin && nowMin < startMin + 45;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between py-3 px-2.5 rounded-xl ${
                        isLive ? 'bg-blue-50/80' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="font-mono text-xs font-extrabold text-blue-600 w-6">
                          0{idx + 1}
                        </span>
                        <span className="font-bold text-sm sm:text-base text-slate-900">
                          {subject}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {isLive && (
                          <span className="text-xs font-extrabold text-blue-700">
                            Hozir darsda
                          </span>
                        )}
                        <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                          {formatHHMM(startMin)} – {formatHHMM(startMin + 45)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3 Simple Steps */}
            <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Qanday ishlaydi?
                </p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-900">
                  3 ta oddiy qadam
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                <div className="py-4 first:pt-1">
                  <p className="text-xs font-bold text-blue-600">01. Farzandingizni tanlang</p>
                  <p className="mt-1 text-sm text-slate-600">
                    “Men ota-onaman” tugmasi orqali ismingizni yozib farzandingizni belgilang.
                  </p>
                </div>

                <div className="py-4">
                  <p className="text-xs font-bold text-blue-600">02. Yuz skaneridan o‘tiladi</p>
                  <p className="mt-1 text-sm text-slate-600">
                    O‘quvchi “Keldim” tugmasini bosib kamerada yuz va jonlilik tekshiruvidan o‘tadi.
                  </p>
                </div>

                <div className="py-4 last:pb-0">
                  <p className="text-xs font-bold text-blue-600">03. Darhol ko‘rasiz</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Skanerdan muvaffaqiyatli o‘tilgach, kelgan soati va rasmi sizda ko‘rinadi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="savollar" className="mx-auto max-w-6xl px-4 sm:px-6 py-8 pb-16">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Yordam</p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Ko‘p beriladigan savollar
            </h2>
          </div>

          <div className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={idx}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50/80 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-900">{item.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{item.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* CLEAN FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-6 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-2">
            <BrandLogo size={24} />
            <span className="font-bold text-slate-900">Aloqa platformasi</span>
            <span>·</span>
            <span>© 2026</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>Ota-onalar, o‘quvchilar va maktab jamoasi uchun</span>
            {!isFileProtocol() && (
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="inline-flex items-center gap-1.5 font-bold text-blue-600 hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Yuklab olish (.html)
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* MODALS & OVERLAYS */}
      <AttendanceModals
        activeModal={activeModal}
        students={students}
        onClose={() => setActiveModal(null)}
        onSwitchModal={(next) => setActiveModal(next)}
        onRefreshAttendance={refreshAttendance}
        triggerZagruska={triggerZagruska}
        showToast={showToast}
      />

      <DoxterGameModal
        open={doxterOpen}
        initialMode={doxterInitialMode}
        onClose={() => setDoxterOpen(false)}
        triggerZagruska={triggerZagruska}
        showToast={showToast}
      />

      <ZagruskaOverlay
        visible={zagruskaVisible}
        message={zagruskaText}
        durationMs={zagruskaDuration}
      />

      {/* TOAST */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
