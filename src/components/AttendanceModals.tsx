import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  LESSON_START_MINUTES,
  SHORT_DAYS,
  WEEKLY_SCHEDULE,
  type StudentRecord,
} from '../data/schoolData';
import { FaceScanner } from './FaceScanner';
import {
  isFileProtocol,
  localCheckinStudent,
  localToggleStudent,
} from '../utils/localFallback';

export type ActiveModalType = null | 'role_picker' | 'parent' | 'student' | 'admin';

interface AttendanceModalsProps {
  activeModal: ActiveModalType;
  students: StudentRecord[];
  onClose: () => void;
  onSwitchModal: (next: ActiveModalType) => void;
  onRefreshAttendance: () => Promise<void>;
  triggerZagruska: (ms?: number, text?: string) => Promise<void>;
  showToast: (msg: string) => void;
}

const PARENT_STORAGE_KEY = 'aloqa_parent_profile_v2';
const STUDENT_STORAGE_KEY = 'aloqa_student_profile_v2';

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

function todayUzString(): string {
  const d = new Date();
  return `${UZ_DAYS[d.getDay()]}, ${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
}

function formatHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export const AttendanceModals: React.FC<AttendanceModalsProps> = ({
  activeModal,
  students,
  onClose,
  onSwitchModal,
  onRefreshAttendance,
  triggerZagruska,
  showToast,
}) => {
  // Parent state
  const [parentProfile, setParentProfile] = useState<{ name: string; childId: number } | null>(() => {
    try {
      const raw = localStorage.getItem(PARENT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [parentNameInput, setParentNameInput] = useState('');
  const [parentSearch, setParentSearch] = useState('');

  // Student state
  const [studentProfileId, setStudentProfileId] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(STUDENT_STORAGE_KEY);
      return raw !== null ? Number(raw) : null;
    } catch {
      return null;
    }
  });
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const wd = new Date().getDay();
    return wd === 0 ? 0 : wd - 1;
  });
  const [scannerOpen, setScannerOpen] = useState(false);

  // Admin state
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');

  useEffect(() => {
    if (activeModal !== 'student') {
      setScannerOpen(false);
    }
  }, [activeModal]);

  if (!activeModal) return null;

  const saveParentProfile = (profile: { name: string; childId: number } | null) => {
    setParentProfile(profile);
    try {
      if (profile) localStorage.setItem(PARENT_STORAGE_KEY, JSON.stringify(profile));
      else localStorage.removeItem(PARENT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const saveStudentProfile = (id: number | null) => {
    setStudentProfileId(id);
    try {
      if (id !== null) localStorage.setItem(STUDENT_STORAGE_KEY, String(id));
      else localStorage.removeItem(STUDENT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleSelectChild = async (childId: number) => {
    const cleanName = parentNameInput.trim();
    if (!cleanName) {
      showToast('Avval ismingizni yozing');
      return;
    }
    await triggerZagruska(4500, 'Farzand ma’lumotlari yuklanmoqda...');
    saveParentProfile({ name: cleanName, childId });
    await onRefreshAttendance();
    showToast('Ota-ona profili saqlandi');
  };

  const handleSelectStudent = async (id: number) => {
    await triggerZagruska(4500, 'Dars jadvali yuklanmoqda...');
    saveStudentProfile(id);
    setScannerOpen(false);
    await onRefreshAttendance();
    showToast('O‘quvchi profiliga kirdingiz');
  };

  const handleFaceScanSuccess = async (studentId: number, photos: string[]) => {
    await triggerZagruska(4500, 'Davomat serverga yuborilmoqda...');
    if (isFileProtocol()) {
      localCheckinStudent(studentId, photos);
      setScannerOpen(false);
      await onRefreshAttendance();
      showToast('Yuz tasdiqlandi — maktabga keldingiz!');
      return;
    }
    const res = await fetch('/api/attendance/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, photos }),
    });
    if (res.ok) {
      setScannerOpen(false);
      await onRefreshAttendance();
      showToast('Yuz tasdiqlandi — maktabga keldingiz!');
    } else {
      showToast('Serverga ulanishda xatolik');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await triggerZagruska(4500, 'Admin paroli tekshirilmoqda...');
    if (isFileProtocol()) {
      if (adminPassword === '1979') {
        setAdminAuthed(true);
        await onRefreshAttendance();
        showToast('Admin paneliga xush kelibsiz');
      } else {
        showToast('Parol noto‘g‘ri');
      }
      return;
    }
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword }),
    });
    if (res.ok) {
      setAdminAuthed(true);
      await onRefreshAttendance();
      showToast('Admin paneliga xush kelibsiz');
    } else {
      showToast('Parol noto‘g‘ri');
    }
  };

  const handleAdminToggle = async (studentId: number) => {
    if (isFileProtocol()) {
      localToggleStudent(studentId);
      await onRefreshAttendance();
      showToast('Davomat holati yangilandi');
      return;
    }
    const res = await fetch('/api/attendance/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password: adminPassword || '1979' }),
    });
    if (res.ok) {
      await onRefreshAttendance();
      showToast('Davomat holati yangilandi');
    }
  };

  const parentChild = parentProfile
    ? students.find((s) => s.id === parentProfile.childId) ?? null
    : null;
  const currentStudent =
    studentProfileId !== null ? students.find((s) => s.id === studentProfileId) ?? null : null;

  const presentCount = students.filter((s) => s.present).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setScannerOpen(false);
          onClose();
        }
      }}
    >
      <section className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 p-5 sm:p-7">
        {/* ROLE PICKER */}
        {activeModal === 'role_picker' && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Platformaga kirish
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  O‘zingizga mos bo‘limni tanlang.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={async () => {
                  await triggerZagruska(4500, 'Ota-ona bo‘limi ochilmoqda...');
                  onSwitchModal('parent');
                }}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-600 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="block font-bold text-slate-900">Ota-ona</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Farzand kelganini ko‘rish
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await triggerZagruska(4500, 'O‘quvchi bo‘limi ochilmoqda...');
                  onSwitchModal('student');
                }}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-600 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="block font-bold text-slate-900">O‘quvchi</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Dars jadvali va yuz skaneri
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await triggerZagruska(4500, 'Admin paneli ochilmoqda...');
                  onSwitchModal('admin');
                }}
                className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-600 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="block font-bold text-slate-900">Maktab · Admin</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Umumiy davomat nazorati
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* PARENT FLOW */}
        {activeModal === 'parent' && (
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Ota-ona bo‘limi</h2>
                <p className="text-sm text-slate-500">{todayUzString()}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!parentProfile || !parentChild ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="p-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    1-qadam: Ism va familiyangiz
                  </label>
                  <input
                    id="p-name"
                    value={parentNameInput}
                    onChange={(e) => setParentNameInput(e.target.value)}
                    placeholder="Masalan: Dilnoza Karimova"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    2-qadam: Farzandingizni tanlang
                  </label>
                  <div className="relative mb-2.5">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      value={parentSearch}
                      onChange={(e) => setParentSearch(e.target.value)}
                      placeholder="Ism yoki sinf bo‘yicha qidirish..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {students
                      .filter(
                        (s) =>
                          !parentSearch.trim() ||
                          s.name.toLowerCase().includes(parentSearch.toLowerCase()) ||
                          s.className.toLowerCase().includes(parentSearch.toLowerCase()),
                      )
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-700">
                              {s.initials}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{s.name}</p>
                              <p className="text-xs text-slate-500">
                                {s.className} sinf · {s.gender === 'qiz' ? 'Qiz bola' : 'O‘g‘il bola'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectChild(s.id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Mening bolam
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-700">
                    Ota-ona: <strong className="text-slate-900">{parentProfile.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => saveParentProfile(null)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-600"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Chiqish
                  </button>
                </div>

                <div
                  className={`rounded-2xl border p-5 ${
                    parentChild.present
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-base font-extrabold text-blue-700 border border-slate-200">
                      {parentChild.initials}
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">{parentChild.name}</h3>
                      <p className="text-xs font-medium text-slate-600">
                        {parentChild.className} sinf
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white/90 p-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-500">Bugungi holat</span>
                      <p className="text-lg font-extrabold text-slate-900">
                        {parentChild.present ? 'Maktabga keldi' : 'Hozircha kelmagan'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {parentChild.present
                          ? `Kelgan vaqti: soat ${parentChild.time ?? '08:05'}`
                          : 'Yuz skaneridan hali o‘tilmagan'}
                      </p>
                    </div>
                    {parentChild.present ? (
                      <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-600" />
                    ) : (
                      <Clock className="h-9 w-9 shrink-0 text-amber-600" />
                    )}
                  </div>

                  {parentChild.present && parentChild.photos.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-slate-600 mb-2">
                        Skaner paytida olingan rasmlar ({parentChild.time})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {parentChild.photos.map((src, idx) => (
                          <img
                            key={idx}
                            src={src}
                            alt={`${parentChild.name} tasdiq rasmi ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="aspect-[3/4] w-full rounded-lg object-cover border border-slate-200"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await triggerZagruska(4500, 'Holat yangilanmoqda...');
                    await onRefreshAttendance();
                    showToast('Ma’lumot yangilandi');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Holatni yangilash
                </button>
              </div>
            )}
          </div>
        )}

        {/* STUDENT FLOW */}
        {activeModal === 'student' && (
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {scannerOpen ? 'Yuzni skanerlash' : 'O‘quvchi bo‘limi'}
                </h2>
                <p className="text-sm text-slate-500">
                  {currentStudent
                    ? `${currentStudent.name} · ${currentStudent.className} sinf`
                    : 'Ro‘yxatdan o‘zingizni tanlang'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScannerOpen(false);
                  onClose();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!currentStudent ? (
              <div className="mt-5 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Ismingizni yozing..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {students
                    .filter(
                      (s) =>
                        !studentSearch.trim() ||
                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                        s.className.toLowerCase().includes(studentSearch.toLowerCase()),
                    )
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-700">
                            {s.initials}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{s.name}</p>
                            <p className="text-xs text-slate-500">
                              {s.className} sinf · {s.gender === 'qiz' ? 'Qiz bola' : 'O‘g‘il bola'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(s.id)}
                          className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          Bu menman
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            ) : scannerOpen ? (
              <div className="mt-5">
                <FaceScanner
                  student={currentStudent}
                  onSuccess={(photos) => handleFaceScanSuccess(currentStudent.id, photos)}
                  onCancel={() => setScannerOpen(false)}
                />
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-700">
                    {currentStudent.name} · {currentStudent.className}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerOpen(false);
                      saveStudentProfile(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-600"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Akkauntdan chiqish
                  </button>
                </div>

                {/* Strict Face-Scanner Check-in Card */}
                {currentStudent.present ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                    <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-extrabold text-sm">
                        Yuz skanerdan o‘tdingiz — bugun maktabga keldingiz!
                      </p>
                      <p className="text-xs text-emerald-700">
                        Soat {currentStudent.time} da tasdiqlandi · Ota-onangiz buni ko‘rib turibdi.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">
                          Yuz skaneri orqali “Keldim” belgilash
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Kamera yuzingizni va jins mosligini tekshiradi. Skanerdan o‘tmasangiz
                          maktabga kelganingiz hisoblanmaydi.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScannerOpen(true)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        <Camera className="h-4 w-4" />
                        Keldim
                      </button>
                    </div>
                  </div>
                )}

                {/* Schedule */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">Haftalik dars jadvali</h3>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5 mb-3">
                    {SHORT_DAYS.map((day, idx) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(idx)}
                        className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                          selectedDay === idx
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {WEEKLY_SCHEDULE[selectedDay].map((lesson, idx) => {
                      const startMin = LESSON_START_MINUTES[idx];
                      const now = new Date();
                      const nowMin = now.getHours() * 60 + now.getMinutes();
                      const isToday = now.getDay() !== 0 && now.getDay() - 1 === selectedDay;
                      const isLive = isToday && nowMin >= startMin && nowMin < startMin + 45;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm ${
                            isLive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-700">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">{lesson}</p>
                              <p className="font-mono text-xs text-slate-500">
                                {formatHHMM(startMin)} – {formatHHMM(startMin + 45)}
                              </p>
                            </div>
                          </div>
                          {isLive && (
                            <span className="text-xs font-extrabold text-blue-700">Hozir</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADMIN FLOW */}
        {activeModal === 'admin' && (
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Maktab · Admin paneli</h2>
                <p className="text-sm text-slate-500">
                  {adminAuthed
                    ? `Bugungi hisobot: ${presentCount} / ${students.length} keldi`
                    : 'Kirish uchun parolni kiriting'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!adminAuthed ? (
              <form onSubmit={handleAdminLogin} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="adm-pass" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Admin paroli
                  </label>
                  <input
                    id="adm-pass"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Admin parolini kiriting"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Admin paneliga kirish
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                    <span className="text-xs font-semibold text-emerald-700">Kelganlar</span>
                    <p className="mt-0.5 font-mono text-2xl font-extrabold text-emerald-900 tabular-nums">
                      {presentCount} nafar
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <span className="text-xs font-semibold text-slate-600">Kutilmoqda</span>
                    <p className="mt-0.5 font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                      {students.length - presentCount} nafar
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="O‘quvchini qidirish..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {students
                    .filter(
                      (s) =>
                        !adminSearch.trim() ||
                        s.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
                        s.className.toLowerCase().includes(adminSearch.toLowerCase()),
                    )
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-700">
                            {s.initials}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{s.name}</p>
                            <p className="text-xs text-slate-500">
                              {s.className} sinf ·{' '}
                              {s.present ? `Keldi (${s.time ?? 'bugun'})` : 'Kelmadi'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdminToggle(s.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                            s.present
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {s.present ? '✓ Keldi' : 'Belgilash'}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
