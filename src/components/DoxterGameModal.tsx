import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Crown,
  Gamepad2,
  Lock,
  Play,
  PlusCircle,
  Trophy,
  UserPlus,
  Users,
  X,
  XCircle,
  Clock,
  Pencil,
  ArrowRight,
} from 'lucide-react';
import {
  DOXTER_QUESTION_COUNT,
  DOXTER_SECONDS_PER_QUESTION,
  QUIZ_PACKS,
  type DoxterRoomState,
  type QuizQuestion,
} from '../data/schoolData';
import { isFileProtocol, LocalDoxterBridge } from '../utils/localFallback';

interface DoxterGameModalProps {
  open: boolean;
  initialMode?: 'menu' | 'create' | 'join';
  onClose: () => void;
  triggerZagruska: (ms?: number, text?: string) => Promise<void>;
  showToast: (msg: string) => void;
}

type LocalStep = 'menu' | 'create_setup' | 'join_form' | 'room';

const OPTION_THEMES = [
  {
    letter: 'A',
    symbol: '▲',
    btn: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700',
    readOnly: 'bg-rose-50 text-rose-900 border-rose-200',
    badge: 'bg-rose-700/30 text-white',
    badgeReadOnly: 'bg-rose-600 text-white',
  },
  {
    letter: 'B',
    symbol: '◆',
    btn: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700',
    readOnly: 'bg-blue-50 text-blue-900 border-blue-200',
    badge: 'bg-blue-700/30 text-white',
    badgeReadOnly: 'bg-blue-600 text-white',
  },
  {
    letter: 'C',
    symbol: '●',
    btn: 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600',
    readOnly: 'bg-amber-50 text-amber-950 border-amber-200',
    badge: 'bg-amber-700/20 text-slate-950',
    badgeReadOnly: 'bg-amber-500 text-slate-950',
  },
  {
    letter: 'D',
    symbol: '■',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700',
    readOnly: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    badge: 'bg-emerald-700/30 text-white',
    badgeReadOnly: 'bg-emerald-600 text-white',
  },
];

export const DoxterGameModal: React.FC<DoxterGameModalProps> = ({
  open,
  initialMode = 'menu',
  onClose,
  triggerZagruska,
  showToast,
}) => {
  const [step, setStep] = useState<LocalStep>('menu');
  const [selectedPackId, setSelectedPackId] = useState<string>(QUIZ_PACKS[0].id);
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [customTitle, setCustomTitle] = useState(QUIZ_PACKS[0].title);
  const [customQuestions, setCustomQuestions] = useState<QuizQuestion[]>(
    () => QUIZ_PACKS[0].questions.map((q) => ({ ...q, options: [...q.options] as [string, string, string, string] })),
  );

  const [joinCode, setJoinCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [roomState, setRoomState] = useState<DoxterRoomState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const localBridgeRef = useRef<LocalDoxterBridge | null>(null);
  const sessionRef = useRef<{ code: string; clientId: string } | null>(null);

  // Sync initialMode when opening
  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (roomState) {
      setStep('room');
    } else if (initialMode === 'create') {
      setStep('create_setup');
    } else if (initialMode === 'join') {
      setStep('join_form');
    } else {
      setStep('menu');
    }
  }, [open, initialMode, roomState]);

  // 100ms ticker for smooth 20s timer bar
  useEffect(() => {
    if (!open || !roomState || (roomState.phase !== 'question' && roomState.phase !== 'question_result')) {
      return;
    }
    const id = setInterval(() => setNowMs(Date.now()), 120);
    return () => clearInterval(id);
  }, [open, roomState]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (localBridgeRef.current) {
        localBridgeRef.current.close();
        localBridgeRef.current = null;
      }
    };
  }, []);

  const selectedPack = useMemo(
    () => QUIZ_PACKS.find((p) => p.id === selectedPackId) ?? QUIZ_PACKS[0],
    [selectedPackId],
  );

  const handleSelectPack = (packId: string) => {
    const pack = QUIZ_PACKS.find((p) => p.id === packId) ?? QUIZ_PACKS[0];
    setSelectedPackId(pack.id);
    setCustomTitle(pack.title);
    setCustomQuestions(
      pack.questions.map((q) => ({ ...q, options: [...q.options] as [string, string, string, string] })),
    );
  };

  function handleIncomingSocketMsg(data: { type?: string; code?: string; clientId?: string; state?: DoxterRoomState; message?: string }) {
    if (data.type === 'joined' && data.code && data.clientId) {
      sessionRef.current = { code: data.code, clientId: data.clientId };
    } else if (data.type === 'room_state' && data.state) {
      setRoomState(data.state);
      setStep('room');
      setErrorMsg('');
    } else if (data.type === 'error') {
      setErrorMsg(data.message || 'Xatolik yuz berdi');
      showToast(data.message || 'Xatolik yuz berdi');
    }
  }

  function connectAndSend(payload: Record<string, unknown>, onReady?: () => void) {
    setErrorMsg('');
    if (isFileProtocol()) {
      if (!localBridgeRef.current) {
        localBridgeRef.current = new LocalDoxterBridge(handleIncomingSocketMsg);
      }
      localBridgeRef.current.send(payload);
      onReady?.();
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      onReady?.();
      return;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify(payload));
      onReady?.();
    };

    ws.onmessage = (event) => {
      try {
        handleIncomingSocketMsg(JSON.parse(String(event.data)));
      } catch {
        // Ignore invalid frame
      }
    };

    ws.onerror = () => {
      setErrorMsg('Server bilan aloqa uzildi. Qayta urinib ko‘ring.');
    };
  }

  const handleCreateGame = async () => {
    await triggerZagruska(4500, 'DOXTER xonasi yaratilmoqda...');
    connectAndSend({
      type: 'create_room',
      topicId: selectedPackId,
      customTitle,
      customQuestions,
    });
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setErrorMsg('Iltimos, 6 xonali kodni to‘liq kiriting');
      return;
    }
    if (studentName.trim().length < 2) {
      setErrorMsg('Ismingizni kiriting (kamida 2 ta harf)');
      return;
    }
    await triggerZagruska(4500, 'O‘yinga ulanmoqda...');
    connectAndSend({
      type: 'join_room',
      code: cleanCode,
      name: studentName.trim(),
    });
  };

  const sendAction = (payload: Record<string, unknown>) => {
    if (isFileProtocol()) {
      localBridgeRef.current?.send(payload);
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (sessionRef.current) {
        connectAndSend({ type: 'rejoin_room', ...sessionRef.current }, () => {
          wsRef.current?.send(JSON.stringify(payload));
        });
      }
      return;
    }
    wsRef.current.send(JSON.stringify(payload));
  };

  const handleLeaveRoom = async () => {
    await triggerZagruska(4500, 'O‘yindan chiqilmoqda...');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (localBridgeRef.current) {
      localBridgeRef.current.close();
      localBridgeRef.current = null;
    }
    sessionRef.current = null;
    setRoomState(null);
    setStep('menu');
    setErrorMsg('');
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Kod nusxalandi: ${code}`);
    } catch {
      showToast(`O‘yin kodi: ${code}`);
    }
  };

  if (!open) return null;

  const remainingSeconds =
    roomState?.phase === 'question' && roomState.questionEndsAt
      ? Math.max(0, Math.ceil((roomState.questionEndsAt - nowMs) / 1000))
      : 0;

  const timerPct =
    roomState?.phase === 'question' && roomState.questionEndsAt
      ? Math.max(
          0,
          Math.min(100, ((roomState.questionEndsAt - nowMs) / (DOXTER_SECONDS_PER_QUESTION * 1000)) * 100),
        )
      : 0;

  const autoNextSeconds =
    roomState?.phase === 'question_result' && roomState.autoNextAt
      ? Math.max(0, Math.ceil((roomState.autoNextAt - nowMs) / 1000))
      : 0;

  const selfPlayer =
    roomState?.yourPlayerId ? roomState.players.find((p) => p.id === roomState.yourPlayerId) : undefined;
  const selfRank =
    selfPlayer && roomState
      ? roomState.players.findIndex((p) => p.id === selfPlayer.id) + 1
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 sm:p-7">
        {/* Top Modal Bar */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                DOXTER
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                O‘quvchilar bilan jonli viktorina · 10 ta savol · Har savolga 20 sekund
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* STEP 1: MENU (2 buttons: Qo'shilish & O'yin yaratish) */}
        {step === 'menu' && (
          <div className="mt-6">
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Qanday o‘ynaladi?</p>
              <p className="mt-1">
                Ustoz <strong>“O‘yin yaratish”</strong> tugmasini bosib <strong>6 xonali kod</strong> oladi.
                O‘quvchilar <strong>“Qo‘shilish”</strong> tugmasini bosib o‘sha kodni kiritishadi va
                10 ta savolga 20 sekund ichida javob berib musobaqalashadi.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={async () => {
                  await triggerZagruska(4500, 'Qo‘shilish oynasi ochilmoqda...');
                  setErrorMsg('');
                  setStep('join_form');
                }}
                className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-blue-200 bg-white p-6 text-left hover:border-blue-600 hover:bg-blue-50/40 transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-lg font-extrabold text-slate-900">Qo‘shilish</span>
                  <span className="mt-1 block text-sm text-slate-600">
                    O‘quvchi sifatida 6 xonali kod orqali o‘yinga kiring
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await triggerZagruska(4500, 'O‘yin yaratish tayyorlanmoqda...');
                  setErrorMsg('');
                  setStep('create_setup');
                }}
                className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 bg-slate-900 p-6 text-left text-white hover:bg-slate-800 transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white">
                  <PlusCircle className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-lg font-extrabold">O‘yin yaratish</span>
                  <span className="mt-1 block text-sm text-slate-300">
                    Ustoz sifatida 6 xonali kod yarating va o‘quvchilarni boshqaring
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2A: TEACHER CREATE SETUP */}
        {step === 'create_setup' && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Mavzuni tanlang (10 ta savol)</h3>
                <p className="text-sm text-slate-500">
                  Har bir savolga 20 sekund beriladi. Ustoz javob tanlamaydi, faqat nazorat qiladi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuestions((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                {editingQuestions ? 'Ro‘yxatni yopish' : 'Savollarni ko‘rish / tahrirlash'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUIZ_PACKS.map((pack) => {
                const active = pack.id === selectedPackId;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => handleSelectPack(pack.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{pack.title}</span>
                      <span className="font-mono text-xs font-semibold text-blue-700">10 savol</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{pack.description}</p>
                  </button>
                );
              })}
            </div>

            {editingQuestions && (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    O‘yin nomi
                  </label>
                  <input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-blue-600 focus:outline-none"
                  />
                </div>
                {customQuestions.map((q, qIdx) => (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>{qIdx + 1}-savol (20 sekund)</span>
                      <span>To‘g‘ri javobni belgilang</span>
                    </div>
                    <input
                      value={q.question}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomQuestions((prev) =>
                          prev.map((item, idx) => (idx === qIdx ? { ...item, question: val } : item)),
                        );
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold focus:border-blue-600 focus:outline-none"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correctIndex === oIdx}
                            onChange={() => {
                              setCustomQuestions((prev) =>
                                prev.map((item, idx) =>
                                  idx === qIdx ? { ...item, correctIndex: oIdx } : item,
                                ),
                              );
                            }}
                            title="To‘g‘ri javob"
                          />
                          <input
                            value={opt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomQuestions((prev) =>
                                prev.map((item, idx) => {
                                  if (idx !== qIdx) return item;
                                  const nextOpts = [...item.options] as [string, string, string, string];
                                  nextOpts[oIdx] = val;
                                  return { ...item, options: nextOpts };
                                }),
                              );
                            }}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-blue-600 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-medium text-rose-700">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('menu')}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                ← Orqaga
              </button>
              <button
                type="button"
                onClick={handleCreateGame}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                O‘yin yaratish va 6 xonali kod olish
              </button>
            </div>
          </div>
        )}

        {/* STEP 2B: STUDENT JOIN FORM */}
        {step === 'join_form' && (
          <form onSubmit={handleJoinGame} className="mt-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">DOXTER o‘yiniga qo‘shilish</h3>
              <p className="text-sm text-slate-500">
                Ustoz bergan 6 xonali raqamli kodni va ismingizni kiriting.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="doxter-code" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  6 xonali o‘yin kodi
                </label>
                <input
                  id="doxter-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Masalan: 482915"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-xl font-bold tracking-widest text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <div>
                <label htmlFor="doxter-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Ismingiz
                </label>
                <input
                  id="doxter-name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Masalan: Madina"
                  maxLength={28}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-medium text-rose-700">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('menu')}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                ← Orqaga
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Qo‘shilish
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: LIVE MULTIPLAYER ROOM */}
        {step === 'room' && roomState && (
          <div className="mt-5 space-y-5">
            {/* Room Top Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-slate-900">{roomState.topicTitle}</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono font-bold text-blue-700">Kod: {roomState.code}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600 font-medium">
                  {roomState.yourRole === 'teacher' ? 'Ustoz rejimi' : 'O‘quvchi rejimi'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="text-xs font-bold text-rose-600 hover:text-rose-700"
              >
                O‘yindan chiqish
              </button>
            </div>

            {/* PHASE 1: LOBBY */}
            {roomState.phase === 'lobby' && (
              <div className="space-y-5">
                {roomState.yourRole === 'teacher' ? (
                  <div className="rounded-2xl bg-blue-600 p-6 text-white text-center">
                    <p className="text-sm font-semibold text-blue-100">
                      O‘quvchilar ushbu 6 xonali kod orqali “Qo‘shilish” tugmasidan kirishadi:
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="font-mono text-4xl sm:text-5xl font-extrabold tracking-[0.18em] tabular-nums">
                        {roomState.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(roomState.code)}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 text-sm font-bold text-white hover:bg-white/25 transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        Nusxalash
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-blue-100">
                      Jami {roomState.totalQuestions} ta savol · Har bir savolga {roomState.secondsPerQuestion} sekund
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-blue-50 border border-blue-200 p-6 text-center">
                    <p className="text-lg font-extrabold text-slate-900">
                      Siz o‘yinga qo‘shildingiz!
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Ustoz “O‘yinni boshlash” tugmasini bosishini kuting. Jami 10 ta savol bo‘ladi.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <Users className="h-4 w-4 text-blue-600" />
                      Qo‘shilgan o‘quvchilar ({roomState.players.length})
                    </span>
                  </div>
                  {roomState.players.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      Hozircha o‘quvchilar qo‘shilmadi. Kodni o‘quvchilarga bering: <strong className="font-mono text-slate-900">{roomState.code}</strong>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {roomState.players.map((p) => (
                        <div
                          key={p.id}
                          className={`rounded-xl border px-3.5 py-2.5 text-sm font-bold ${
                            p.id === roomState.yourPlayerId
                              ? 'border-blue-500 bg-blue-50 text-blue-900'
                              : 'border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          {p.name}
                          {p.id === roomState.yourPlayerId ? ' (Siz)' : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {roomState.yourRole === 'teacher' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Eslatma: O‘yin boshlangach ustoz javob tanlay olmaydi — faqat savol va natijalarni boshqaradi.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await triggerZagruska(4500, '1-savol boshlanmoqda...');
                        sendAction({ type: 'start_game' });
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      O‘yinni boshlash ({roomState.players.length} o‘quvchi)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PHASE 2: ACTIVE QUESTION (20 seconds) */}
            {roomState.phase === 'question' && roomState.currentQuestion && (
              <div className="space-y-5">
                {/* Question Counter & 20s Timer */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-extrabold text-slate-700">
                    Savol <span className="font-mono text-blue-600">{roomState.questionIndex + 1} / {roomState.totalQuestions}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500">
                      Javob berdi: {roomState.answeredCount} / {roomState.players.length}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-base font-extrabold tabular-nums ${
                        remainingSeconds <= 5
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                      {remainingSeconds}s
                    </span>
                  </div>
                </div>

                {/* 20s Progress Bar */}
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-100 ${
                      remainingSeconds <= 5 ? 'bg-rose-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${timerPct}%` }}
                  />
                </div>

                {/* Question Text */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                    {roomState.currentQuestion.question}
                  </h3>
                </div>

                {/* TEACHER VIEW: Read-only! Cannot select answers */}
                {roomState.yourRole === 'teacher' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs sm:text-sm font-semibold text-amber-900">
                      <Lock className="h-4 w-4 shrink-0 text-amber-700" />
                      Ustoz rejimi: Siz javoblarni tanlay olmaysiz — o‘quvchilar 20 sekund ichida javob berishmoqda.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 select-none">
                      {roomState.currentQuestion.options.map((opt, idx) => {
                        const theme = OPTION_THEMES[idx];
                        return (
                          <div
                            key={idx}
                            aria-disabled="true"
                            className={`flex items-center gap-3 rounded-xl border p-4 opacity-90 cursor-not-allowed ${theme.readOnly}`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${theme.badgeReadOnly}`}
                            >
                              {theme.symbol}
                            </span>
                            <span className="font-bold text-sm sm:text-base">{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* STUDENT VIEW: Clickable 4 Answer Buttons */
                  <div className="space-y-3">
                    {roomState.yourSelectedOption !== null ? (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
                        <p className="text-base font-extrabold text-blue-900">
                          Javobingiz qabul qilindi: {OPTION_THEMES[roomState.yourSelectedOption].letter} variant!
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                          20 sekund tugashini kuting ({remainingSeconds}s qoldi)...
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {roomState.currentQuestion.options.map((opt, idx) => {
                          const theme = OPTION_THEMES[idx];
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => sendAction({ type: 'submit_answer', optionIndex: idx })}
                              className={`flex items-center gap-3 rounded-xl border-b-4 p-4 text-left font-bold transition-transform active:scale-[0.98] ${theme.btn}`}
                            >
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${theme.badge}`}
                              >
                                {theme.symbol}
                              </span>
                              <span className="text-sm sm:text-base leading-snug">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PHASE 3: QUESTION RESULT */}
            {roomState.phase === 'question_result' && roomState.currentQuestion && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-slate-700">
                    {roomState.questionIndex + 1}-savol natijasi ({roomState.questionIndex + 1} / {roomState.totalQuestions})
                  </span>
                  <span className="font-mono text-xs font-semibold text-blue-700">
                    {roomState.questionIndex + 1 < roomState.totalQuestions
                      ? `Keyingi savol ${autoNextSeconds}s da...`
                      : `Yakuniy natija ${autoNextSeconds}s da...`}
                  </span>
                </div>

                {/* Student's own result banner */}
                {roomState.yourRole === 'student' && selfPlayer && (
                  <div
                    className={`flex items-center gap-3 rounded-xl p-4 border ${
                      selfPlayer.lastCorrect
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {selfPlayer.lastCorrect ? (
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-6 w-6 shrink-0 text-rose-600" />
                    )}
                    <div>
                      <p className="font-extrabold text-sm sm:text-base">
                        {selfPlayer.lastCorrect
                          ? `To‘g‘ri javob! +${selfPlayer.lastPointsEarned} ball`
                          : roomState.yourSelectedOption === null
                            ? 'Vaqt tugadi — javob tanlanmadi'
                            : 'Noto‘g‘ri javob'}
                      </p>
                      <p className="text-xs opacity-85">
                        Jami ballingiz: {selfPlayer.score} · Hozirgi o‘rningiz: {selfRank}-o‘rin
                      </p>
                    </div>
                  </div>
                )}

                {/* Options with correct answer highlighted */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {roomState.currentQuestion.options.map((opt, idx) => {
                    const isCorrect = roomState.currentQuestion?.correctIndex === idx;
                    const votes = roomState.optionCounts ? roomState.optionCounts[idx] : 0;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-3.5 ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-extrabold">
                            {OPTION_THEMES[idx].letter}
                          </span>
                          <span className="text-sm">{opt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold tabular-nums">
                            {votes} ta
                          </span>
                          {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Top 5 Leaderboard */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Reyting jadvali
                  </h4>
                  <div className="space-y-1.5">
                    {roomState.players.slice(0, 5).map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-extrabold text-slate-400 w-5">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-slate-900">
                            {p.name}
                            {p.id === roomState.yourPlayerId ? ' (Siz)' : ''}
                          </span>
                        </div>
                        <span className="font-mono font-extrabold text-blue-700 tabular-nums">
                          {p.score} ball
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {roomState.yourRole === 'teacher' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => sendAction({ type: 'next_question' })}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      {roomState.questionIndex + 1 < roomState.totalQuestions
                        ? 'Keyingi savolga o‘tish'
                        : 'Yakuniy natijalarni ko‘rish'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PHASE 4: FINISHED (After all 10 questions) */}
            {roomState.phase === 'finished' && (
              <div className="space-y-5 text-center">
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
                  <Trophy className="mx-auto h-12 w-12 text-amber-300" />
                  <h3 className="mt-3 text-2xl font-extrabold">DOXTER o‘yini yakunlandi!</h3>
                  <p className="mt-1 text-sm text-blue-100">
                    Barcha {roomState.totalQuestions} ta savol tugadi. G‘oliblar bilan tanishing!
                  </p>
                </div>

                {/* Top 3 Podium */}
                {roomState.players.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {roomState.players.slice(0, 3).map((p, idx) => (
                      <div
                        key={p.id}
                        className={`rounded-2xl border p-4 ${
                          idx === 0
                            ? 'border-amber-300 bg-amber-50'
                            : idx === 1
                              ? 'border-slate-300 bg-slate-50'
                              : 'border-orange-200 bg-orange-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-slate-700">
                          {idx === 0 && <Crown className="h-4 w-4 text-amber-500" />}
                          <span>{idx + 1}-o‘rin</span>
                        </div>
                        <p className="mt-1 text-base font-extrabold text-slate-900 truncate">{p.name}</p>
                        <p className="mt-0.5 font-mono text-sm font-bold text-blue-700 tabular-nums">
                          {p.score} ball
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full Leaderboard */}
                {roomState.players.length > 3 && (
                  <div className="space-y-1.5 text-left">
                    {roomState.players.slice(3).map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                      >
                        <span className="font-semibold text-slate-800">
                          {idx + 4}. {p.name}
                        </span>
                        <span className="font-mono font-bold text-slate-600 tabular-nums">
                          {p.score} ball
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Yangi o‘yin / Menyu
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
