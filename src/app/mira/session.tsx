import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { ChevronRight, Crosshair, RotateCcw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import RAnimated, { LinearTransition, useAnimatedRef, useSharedValue } from 'react-native-reanimated';

import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL, fetchAnalysis, mediaSource } from '@/features/analysis/api';
import { useAnalysisDraft } from '@/features/analysis/draft';
import {
  ApiError,
  STAGE_RU,
  cancelJob,
  createJob,
  getJob,
  getSchedule,
  sendTaps,
  type Tap,
  loadLocalJobs,
  saveLocalJob,
  sendAnswers,
  upload,
  type Job,
  type LocalJob,
  retryWhileOffline,
} from '@/features/analysis/jobs';
import { type CyberState } from '@/features/analysis/components/cyber-eyes';
import { MiraHud } from '@/features/analysis/components/mira-hud';
import { DUSK, SEA } from '@/features/analysis/components/mira-theme';
import { QualityModal } from '@/features/analysis/components/quality-modal';
import { PointsSheet } from '@/features/analysis/components/points-sheet';
import { SIDES } from '@/features/analysis/choices';
import { Dots, Ring, Rise, Scan, mira, type EyesMode } from '@/features/analysis/components/mira';
import {
  ANALYSIS,
  LINES,
  Q_RESULT,
  Q_SIDE,
  Q_TECHNIQUE,
  Q_WRIST,
  Q_FATIGUE,
  Q_CENTER,
  Q_GO,
  REAL,
  kingsQuestions,
  type Question,
} from '@/features/analysis/script';
import type { AnalysisResult, Answers, KingsQuestion, Quality } from '@/features/analysis/types';
import { TopUpSheet } from '@/features/tokens/top-up-sheet';
import { VIDEO_FILL } from '@/features/analysis/video-size';
import {
  canPrepareOnPhone, extractIntroFrames, prepareVideo, releaseIntroFrames, scanPeople, type IntroFrames, type ScannedPerson,
} from '../../../modules/video-prep';
import { ScanPeople } from '@/features/analysis/components/scan-people';
import { AimReticle } from '@/features/analysis/components/aim-reticle';
import { AIM_LEAD_S } from '@/features/analysis/components/scan-timing';
import { deviceTier } from '@/features/analysis/components/device-tier';
import { IntroBlend } from '@/features/analysis/components/intro-blend';
import { UserError, userMessage } from '@/lib/user-error';

// Демо: настоящего анализа загруженного видео пока нет — какое бы видео ни выбрали, показывается пример clip0
// (вступление со слоу-мо, затем само видео), в конце открывается его готовый разбор. С карточки готового разбора
// («Пройти с MIRA», ?demo=clipN.mp4) — разговор по этому клипу; у clip32 MIRA спросит и про кингсмув
// визор сворачивается / раскрывается — видео, шаги и чат переезжают пружиной (сдвигом, без перераскладки на каждом кадре)
const MOVE = LinearTransition.springify().damping(22).stiffness(170).mass(1);

const DEMO_DEFAULT = 'clip0.mp4';
const INTRO_S = 2.2; // длина нарезки: 1 с схватки, замедление, 0.4 с замерший кадр

/** upload — под текстом сообщения: кольцо с процентом загрузки видео и скорость отправки. */
type Msg = { mine: boolean; text: string; upload?: boolean };
/** Этап отправки видео: сжатие на телефоне → отправка кусками → загружено. */
type UpStage = 'prep' | 'send' | 'done';

/** Скорость отправки: «640 КБ/с», «1,4 МБ/с». */
const fmtSpeed = (bps: number) =>
  bps < 1024 * 1024 ? `${Math.max(1, Math.round(bps / 1024))} КБ/с` : `${(bps / 1024 / 1024).toFixed(1).replace('.', ',')} МБ/с`;
type Phase = 'upload' | 'chat' | 'analyze' | 'queued' | 'done';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HUD_PAD = 16; // визор — как на экране расписания
const FREEZE_ZOOM = 1.07; // «наезд» камеры на замерший кадр (скан и прицел идут уже по увеличенному кадру)

/**
 * Вступление и «скан» по классу телефона (эксперт, 2026-11-18). Дорогое — только поиск людей (MediaPipe: 4–4,5 с
 * процессора на 8 человек на Galaxy S23 Ultra, ~50 МБ моделей) и кадры слоу-мо (~60 МБ картинок):
 *   high — всё: слоу-мо со смешиванием, скан до 8 силуэтов, прицел;
 *   mid  — слоу-мо, скан по 4 самым уверенно найденным фигурам (обычно борцы и судья) и не дольше 8 с: вышло время —
 *          поиск останавливается на телефоне (экономит процессор) и скан идёт по готовым силуэтам; ни одного — без скана;
 *   low  — без кадров слоу-мо и поиска людей (2 ГБ памяти — система может закрыть приложение): замерший кадр с «наездом».
 */
const INTRO_BY_TIER = {
  high: { frames: true, people: 8, scanWaitMs: 0 },
  mid: { frames: true, people: 4, scanWaitMs: 8000 },
  low: { frames: false, people: 0, scanWaitMs: 0 },
} as const;

/** Вступление: готовая нарезка со слоу-мо (сервер досчитал кадры, annotator/make_intro.py) — первая секунда как
 *  есть, затем плавное замедление до замершего кадра. Плеер сам плавно не замедлит: без промежуточных кадров
 *  «падает fps». Конец нарезки — замерший кадр; его подчёркивает наезд камеры. */
async function introPlayback(player: VideoPlayer, alive: () => boolean, freeze: () => void) {
  player.currentTime = 0;
  player.playbackRate = 1;
  player.play();
  await sleep(INTRO_S * 1000 - 600);
  if (!alive()) return;
  freeze();
  await sleep(600);
  player.pause();
}

/** Разбор как разговор с MIRA (макет «MIRA Analysis», вариант 2a). */

// режим диалога → состояние глаз 4a (шаблон «MIRA Analysis.dc (2).html»). Только шесть состояний 4a: отдельного
// «сканирует» в шаблоне нет — пока MIRA смотрит видео, она «думает» (эксперт, 2026-10-20)
const CY_MAP: Record<EyesMode, CyberState> = { look: 'attention', scan: 'thinking', think: 'speaking', happy: 'emotion' };

export default function Session() {
  const draft = useAnalysisDraft();
  const { setAnswer } = draft;
  const { demo: demoParam, job: jobParam } = useLocalSearchParams<{ demo?: string; job?: string }>();
  // своё видео: только что выбрано (черновик) или задача из «Моих разборов» (?job=…) — загрузка и расчёт настоящие
  const real = !demoParam && (!!jobParam || !!draft.videoUri);
  const demo = demoParam ?? DEMO_DEFAULT;
  // разбор демо-клипа: видео, размер кадра и какие вопросы про кингсмув задать
  const [meta, setMeta] = useState<AnalysisResult | null>(null);
  const [metaError, setMetaError] = useState<string>();
  const [local, setLocal] = useState<LocalJob | null>(null); // своё видео: задача на сервере
  const [failed, setFailed] = useState<string>();
  // оценка видео — модалкой поверх готового размытого фона (под модалкой всё на паузе)
  const [qm, setQm] = useState<{ q: Quality } | null>(null);
  const qRes = useRef<((go: boolean) => void) | null>(null);
  // «продолжить к разбору» стоит токен (сервер списывает его на ответе go — видео встаёт в очередь); не хватило — шторка
  const [needTok, setNeedTok] = useState(false);
  const tokRes = useRef<((bought: boolean) => void) | null>(null);
  // доп. настройка «где я, где соперник» точками на трёх кадрах (вкладка под видео, пока MIRA спрашивает «где ты»)
  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsErr, setPointsErr] = useState<string>();
  const [asleep, setAsleep] = useState(false); // вне окна разбора: видео в очереди, MIRA спит
  const [extraQ, setExtraQ] = useState(0); // вопросы сервера по ходу расчёта (кингсмув, центр)
  useEffect(() => {
    if (real) return;
    fetchAnalysis(demo)
      .then(setMeta)
      .catch((e) => setMetaError(userMessage(e)));
  }, [demo, real]);
  const videoUri = real
    ? (local?.uri ?? draft.videoUri ?? null)
    : meta
      ? API_URL + (meta.introUrl ?? meta.videoUrl) // вступление, а если его нет — само видео
      : null;
  const videoRatio = (real ? (local?.ratio ?? draft.videoRatio) : meta?.videoRatio) ?? 16 / 9;
  // вертикальное видео (телефон): кадр во всю ширину, квадратный, видео «cover» — обрезаются верх и низ, а ширина
  // кадра видна целиком, поэтому половины «Я слева / Я справа» — это настоящие левая и правая половины кадра
  const vertical = videoRatio < 0.9;
  // высота кадра — не больше трети экрана, чтобы оставался диалог; ширина — вся (у вертикального видео «cover»
  // обрезает верх и низ, половины «слева / справа» по-прежнему настоящие)
  const { height: screenH, width: screenW } = useWindowDimensions();
  const videoBox = { height: Math.round(Math.min(vertical ? 320 : 200, screenH * (vertical ? 0.32 : 0.26))) };
  const player = useVideoPlayer(null, (p) => {
    p.muted = true;
  });

  const [phase, setPhase] = useState<Phase>('upload');
  const [u, setU] = useState(0); // загрузка, %
  const [upStage, setUpStage] = useState<UpStage>('prep');
  const [speed, setSpeed] = useState<number | null>(null); // байт/с, сглажено
  const [offline, setOffline] = useState(false); // пропала связь при загрузке — ждём и продолжаем сами
  // вступление своего видео: кадры секунды схватки со смешиванием (телефон сам, без сервера)
  const [intro, setIntro] = useState<{ f: IntroFrames; freeze: () => void; done: () => void } | null>(null);
  // «скан» людей на замершем кадре после вступления (силуэты — по последнему кадру вступления, считает телефон)
  const [scan, setScan] = useState<{ people: ScannedPerson[]; w: number; h: number } | null>(null);
  // прицел MIRA — только в первом круге скана: вылетает из левого глаза MIRA (или точки статуса на плашке) к силуэтам
  const [aim, setAim] = useState(false);
  const scanClock = useSharedValue(-1);              // начало скана — общее у вспышек и прицела
  const scanBoxes = useSharedValue<number[]>([]);    // рамки силуэтов в точках рамки видео
  const hudEye = useSharedValue({ x: 0, y: 0 });     // центр прицела левого глаза MIRA в блоке визора
  const hudCv = useSharedValue(0);                   // визор свёрнут 0…1
  const hudGaze = useSharedValue({ x: 0, on: 0 });   // глаза MIRA — за прицелом (первый круг скана)
  const hudRef = useAnimatedRef<RAnimated.View>();
  const hudDotRef = useAnimatedRef<RAnimated.View>();
  const videoRef = useAnimatedRef<RAnimated.View>();
  const [w, setW] = useState(0); // анализ, %
  const [step, setStep] = useState('Присматриваюсь');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [happy, setHappy] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [run, setRun] = useState(0); // ↺ перезапуск
  const resolver = useRef<((v: { key: string; label: string }) => void) | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const zoom = useState(() => new Animated.Value(0))[0]; // 0 → 1: наезд камеры при замирании кадра

  const answer = useCallback(
    (key: string, label: string) => {
      if (!resolver.current || !question) return;
      setAnswer(question.key, key as never);
      setMsgs((m) => [...m, { mine: true, text: label }]);
      setQuestion(null);
      setAnswered((n) => n + 1);
      setHappy(true);
      setTimeout(() => setHappy(false), 900);
      const r = resolver.current;
      resolver.current = null;
      r({ key, label });
    },
    [question, setAnswer],
  );

  // ---------- своё видео: загрузка и расчёт по-настоящему ----------
  useEffect(() => {
    if (!real) return;
    // токен отмены разговора: ушли с экрана — обрываются сжатие на телефоне, отправка видео, опрос сервера, ответы и
    // паузы MIRA (расчёт на сервере при этом идёт дальше — разговор можно продолжить из «Моих разборов»)
    const ac = new AbortController();
    const signal = ac.signal;
    let alive = true;
    signal.addEventListener('abort', () => (alive = false));
    // папка кадров вступления: стереть, как только вступление сыграно или ушли с экрана
    let introDir: string | null = null;
    const dropIntro = () => {
      if (introDir) releaseIntroFrames(introDir);
      introDir = null;
    };
    const sleep = (ms: number) =>
      new Promise<void>((res) => {
        const t = setTimeout(res, ms);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          res();
        }, { once: true });
      });
    const say = async (text: string, upload = false) => {
      if (!alive) return;
      setTyping(true);
      await sleep(650 + Math.min(900, text.length * 14));
      if (!alive) return;
      setTyping(false);
      setMsgs((m) => [...m, { mine: false, text, upload }]);
      await sleep(420 + Math.min(1400, text.length * 16));
    };
    const ask = async (q: Question, more = false) => {
      await say(q.text);
      if (!alive) return null;
      setQuestion(q);
      const a = await new Promise<{ key: string; label: string }>((res) => (resolver.current = res));
      await sleep(380);
      await say(more && q.ackMore ? q.ackMore(a.label, a.key) : q.ack(a.label, a.key));
      return a;
    };

    (async () => {
      setMsgs([]);
      setAnswered(0);
      setQuestion(null);
      setFailed(undefined);
      setStep('Присматриваюсь');
      // задача: новая (видео только что выбрали) или прежняя (вернулись из «Моих разборов» — продолжаем с того места)
      let resumed: LocalJob | undefined;
      let job: Job | null = null;
      try {
        if (jobParam) {
          // разбор — с сервера (только свой: чужой сервер не отдаст); файл на телефоне — если загружали отсюда
          job = await getJob(jobParam, signal);
          resumed = (await loadLocalJobs()).find((j) => j.id === jobParam) ?? {
            id: job.id, uri: '', name: job.name, size: job.size, created: (job.created ?? 0) * 1000, state: job.state,
          };
          if (!resumed.uri && job.state === 'uploading') {
            throw new UserError('Видео загружалось с другого телефона и не догружено — удали этот разбор и загрузи видео заново.');
          }
          setLocal(resumed);
        }
      } catch (e) {
        if (alive) setFailed(userMessage(e));
        return;
      }
      if (!alive) return;
      const shownStart = resumed ? (resumed.trim?.[0] ?? 0) : (draft.trim?.[0] ?? 0);
      // видео: файл на телефоне, а если разбор начат с другого телефона — с сервера (с токеном входа)
      if (resumed && !resumed.uri) player.replace(mediaSource(`/api/jobs/${resumed.id}/video`));
      else player.replace(resumed?.uri ?? draft.videoUri!);
      setTimeout(() => {
        if (!alive) return;
        player.currentTime = shownStart;
        player.pause();
      }, 300);
      // вступление: видео на телефоне (только что выбранное или недосланное при возврате к разбору) — кадры первой секунды
      // схватки достаёт телефон, пока MIRA
      // здоровается (параллельно со сжатием); видео с сервера или из Expo Go — без вступления
      const introSrc = resumed ? resumed.uri : draft.videoUri;
      const tierPlan = INTRO_BY_TIER[deviceTier()];
      const introReady: Promise<IntroFrames | null> =
        tierPlan.frames && canPrepareOnPhone && introSrc && /^(file|content):/.test(introSrc)
          ? extractIntroFrames(introSrc, shownStart, signal).then((r) => {
              if (r && alive) introDir = r.dir;
              else if (r) releaseIntroFrames(r.dir);
              return alive ? r : null;
            })
          : Promise.resolve(null);
      const playIntro = async () => {
        if (!tierPlan.frames) {
          // слабый телефон: без слоу-мо и скана — кадр уже стоит, камера наезжает
          if (alive) Animated.timing(zoom, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
          return;
        }
        const f = await Promise.race([introReady, sleep(4000).then(() => null)]);
        if (!f || !alive) {
          void introReady.then(() => dropIntro()); // не успели — кадры не нужны
          return;
        }
        // силуэты для скана — по замершему кадру, пока играет вступление (папку кадров стираем после обоих);
        // средний телефон — меньше людей и не дольше scanWaitMs (поиск сам останавливается, готовое — в скан)
        const scanned = scanPeople(f.frames[f.frames.length - 1], tierPlan.people, tierPlan.scanWaitMs, signal);
        await new Promise<void>((done) =>
          setIntro({
            f,
            // кадр замер: под вступлением плеер встаёт на тот же кадр, камера наезжает
            freeze: () => {
              player.currentTime = shownStart + (f.frames.length - 1) / f.fps;
              player.pause();
              Animated.timing(zoom, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
            },
            done,
          }),
        );
        setIntro(null); // картинки освобождаются при размонтировании
        void scanned
          .then((people) => {
            if (alive && people?.length) {
              setScan({ people, w: f.width, h: f.height });
              setAim(true);
            }
          })
          .finally(dropIntro);
      };
      setPhase('chat');
      const uploaded = !!job && job.state !== 'uploading';
      setU(uploaded ? 100 : Math.round(((job?.received ?? 0) / (resumed?.size || 1)) * 100));
      setUpStage(uploaded ? 'done' : canPrepareOnPhone && !resumed ? 'prep' : 'send');
      // скорость отправки: по фактически ушедшим байтам раз в секунду, сглажено (без скачков от кусков по 2 МБ)
      let mark: { t: number; bytes: number } | null = null;
      let rate: number | null = null;
      const onSent = (lj: LocalJob, p: number) => {
        if (!alive) return;
        const bytes = p * lj.size;
        const now = Date.now();
        if (!mark) mark = { t: now, bytes };
        else if (now - mark.t >= 1000) {
          const r = ((bytes - mark.bytes) * 1000) / (now - mark.t);
          rate = rate == null ? r : 0.6 * rate + 0.4 * r;
          setSpeed(rate);
          mark = { t: now, bytes };
        }
      };

      // пока человек отвечает MIRA: телефон обрезает и сжимает видео (своя сборка; в Expo Go — нет, это сделает
      // сервер), создаёт задачу и отправляет видео кусками
      let upError: string | undefined;
      let prepShare = 0; // доля полосы «Видео», отведённая под сжатие
      const ready: Promise<LocalJob | null> = resumed
        ? Promise.resolve(resumed)
        : (async () => {
            let uri = draft.videoUri!;
            let bytes = draft.videoBytes ?? 0;
            let trim = draft.trim;
            if (canPrepareOnPhone) {
              prepShare = 30;
              const p = await prepareVideo(uri, trim, (x) => alive && setU(Math.round(x * prepShare)), signal);
              if (!alive) return null;
              if (p) {
                uri = p.uri;
                bytes = p.bytes;
                trim = undefined; // уже обрезано на телефоне
              }
            }
            const nl = await retryWhileOffline(
              () => createJob(uri, bytes, draft.videoName, draft.videoRatio, trim, signal), signal, (w) => alive && setOffline(w),
            );
            if (alive) setLocal(nl);
            return nl;
          })().catch((e) => {
            upError = userMessage(e);
            return null;
          });
      const sending = ready.then((lj) => {
        if (!lj) return undefined;
        if (alive) setUpStage('send');
        // связь пропала — не ошибка: ждём интернет и досылаем с того места, где сервер остановился
        return retryWhileOffline(() => upload(lj, (p) => {
          if (!alive) return;
          setU(Math.round(prepShare + p * (100 - prepShare)));
          onSent(lj, p);
        }, signal), signal, (w) => alive && setOffline(w))
          .then(() => alive && setUpStage('done'))
          .catch((e) => {
            if (alive) upError = userMessage(e);
          });
      });

      const have: Answers = { ...(job?.answers ?? {}) };
      // ответ — на сервер, как только есть задача; не дошёл — повторим перед расчётом
      const post = (a: Partial<Answers>) => ready.then((lj) => lj && sendAnswers(lj.id, a, signal)).catch(() => {});
      // окно разбора 21:00–06:00 МСК: открыто — сначала оценка видео, «Продолжить», затем вопросы про схватку;
      // закрыто — вопросы, пока видео грузится, и очередь (оценку покажем по ходу, если она плохая)
      const sch = await getSchedule(signal);
      if (!alive) return;
      const sleepNow = (inS: number) => {
        setAsleep(true);
        setPhase('queued');
        return say(REAL.sleeping(inS));
      };
      // «продолжить к разбору»: видео встаёт в очередь, сервер списывает токен (сбой расчёта — вернёт; отмена — нет).
      // Не хватает (402) — шторка пополнения; купил — отправляем снова; закрыл — разбор ждёт в «Моих разборах».
      // Другие ошибки (связь) — как раньше: ответ дошлётся позже, сервер спросит «продолжить» ещё раз.
      const sendGo = async (lj: LocalJob, go: NonNullable<Answers['go']>): Promise<boolean> => {
        for (;;) {
          try {
            await sendAnswers(lj.id, { go }, signal);
            return true;
          } catch (e) {
            if (!(e instanceof ApiError && e.status === 402)) return true;
          }
          if (!alive) return false;
          player.pause();
          await say(REAL.needToken);
          const bought = await new Promise<boolean>((res) => {
            tokRes.current = res;
            setNeedTok(true);
          });
          setNeedTok(false);
          if (!alive) return false;
          if (!bought) {
            await say(REAL.noToken);
            setPhase('queued');   // кнопка «Готово» → к разборам
            return false;
          }
          await say(REAL.gotToken);
        }
      };
      // оценка видео и «Продолжаем?»; false — спортсмен выбрал другое видео (задача отменена)
      const goStep = async (lj: LocalJob, j: Job) => {
        let a: { key: string; label: string } | null;
        if (j.precheck) {
          player.pause();
          const go = await new Promise<boolean>((res) => {
            qRes.current = res;
            setQm({ q: j.precheck! });
          });
          setQm(null);
          const o = Q_GO.options[go ? 0 : 1];
          setMsgs((m) => [...m, { mine: true, text: o.label }]);
          await sleep(380);
          await say(Q_GO.ack(o.label, o.key));
          a = o;
        } else {
          a = await ask(Q_GO);
        }
        if (!a || !alive) return false;
        if (a.key !== 'yes') {
          // «Загрузить другое видео»: разбор удаляется — сервер останавливает расчёт и стирает видео
          await cancelJob(lj.id).catch(() => {});
          router.replace('/mira/schedule');
          return false;
        }
        have.go = 'yes';
        return sendGo(lj, 'yes');
      };
      const precheckFirst = sch.open && !have.go;
      let askedNow = precheckFirst; // спортсмен отвечал сейчас — сказать, сколько ждать
      await say(jobParam ? REAL.resume : precheckFirst ? REAL.openIntro : sch.open ? LINES.loaded : REAL.closedIntro, !uploaded);
      await playIntro();
      if (precheckFirst) {
        // сначала видео целиком на сервере и оценка качества, только потом вопросы про схватку
        const lj0 = await ready;
        await sending;
        if (!lj0 || upError) {
          setFailed(upError ?? REAL.failed);
          return;
        }
        await say(REAL.checking);
        setStep('Проверяю качество видео');
        let j0: Job | null = null;
        while (alive) {
          try {
            j0 = await getJob(lj0.id, signal);
          } catch {
            j0 = null;
          }
          if (j0 && (j0.precheck || j0.state === 'failed' || j0.state === 'cancelled')) break;
          await sleep(2500);
        }
        if (!alive || !j0) return;
        if (j0.state === 'failed' || j0.state === 'cancelled') {
          await saveLocalJob({ ...lj0, state: j0.state });
          setFailed(j0.error ?? REAL.failed);
          return;
        }
        if (!(await goStep(lj0, j0))) return;
      }
      for (const q of [Q_SIDE, Q_RESULT, Q_TECHNIQUE, Q_WRIST, Q_FATIGUE]) {
        if (have[q.key]) {
          setAnswered((n) => n + 1);
          continue;
        }
        if (q === Q_TECHNIQUE) await say(LINES.see);
        askedNow = true;
        const a = await ask(q, q === Q_WRIST);   // после кисти — ещё вопрос про руку: короткое «Спасибо»
        if (!a || !alive) return;
        (have as Record<string, string>)[q.key] = a.key;
        void post({ [q.key]: a.key } as Partial<Answers>);
      }
      const lj = await ready;
      if (!lj) {
        setFailed(upError ?? REAL.failed);
        return;
      }
      // вне окна разбора оценку видео спортсмен не видел: считаем, если она нормальная, иначе спросим по ходу
      if (!have.go && !sch.open) have.go = 'auto';
      // ответы точно на сервере (если какой-то не дошёл из-за связи); «продолжить» — отдельно: оно стоит токен
      const { go: goNow, ...rest } = have;
      await sendAnswers(lj.id, rest, signal).catch(() => {});
      if (goNow && !(await sendGo(lj, goNow))) return;

      if (!upError && (await Promise.race([sending.then(() => true), sleep(300).then(() => false)])) === false) {
        await say(REAL.waitUpload);
      }
      await sending;
      if (upError) {
        setFailed(upError);
        return;
      }
      if (!alive) return;
      if (!sch.open && !jobParam) {
        await sleepNow(sch.changeInS);
        return;
      }
      {
        const j1 = await getJob(lj.id, signal).catch(() => null);
        if (!alive) return;
        if (j1?.state === 'queued' && j1.window && !j1.window.open) {
          await sleepNow(j1.window.opensInS ?? sch.changeInS);
          return;
        }
        const dur = resumed ? 0 : draft.trim ? draft.trim[1] - draft.trim[0] : (draft.videoDuration ?? 20);
        const eta = j1?.etaS ?? 97 + 13.7 * (dur || 20);
        if (!jobParam || askedNow) await say(REAL.eta(Math.max(2, Math.round(eta / 60))));
      }
      setPhase('analyze');
      Animated.timing(zoom, { toValue: 0, duration: 600, useNativeDriver: false }).start();
      setTimeout(() => {
        if (!alive) return;
        player.playbackRate = 0.5;
        player.loop = true;
        player.play();
      }, 300);

      // расчёт: состояние с сервера; вопросы по ходу (кингсмув — по углу, центр — если вывод держится на центре)
      let lastStage = '';
      let line = 0;
      while (alive) {
        let j: Job;
        try {
          j = await getJob(lj.id, signal);
        } catch {
          await sleep(4000); // нет связи — пробуем ещё (отмена прерывает и паузу, и запрос)
          continue;
        }
        setW(Math.round((j.progress ?? 0) * 100));
        if (j.stage && j.stage !== lastStage) {
          lastStage = j.stage;
          setStep(STAGE_RU[j.stage] ?? 'Считаю');
          if (line < ANALYSIS.length - 1) await say(ANALYSIS[line++].text);
        }
        if (j.state === 'needs_input' && j.questions.includes('go')) {
          if (!(await goStep(lj, j))) return;
          continue;
        }
        if (j.state === 'needs_input') {
          const qs: Question[] = [
            ...kingsQuestions(j.questions.filter((k): k is KingsQuestion => k === 'kingsMe' || k === 'kingsOpp')),
            ...(j.questions.includes('center') ? [Q_CENTER] : []),
          ];
          setExtraQ((n) => n + qs.length);
          for (let i = 0; i < qs.length && alive; i++) {
            const a = await ask(qs[i], i < qs.length - 1);
            if (!a) return;
            await sendAnswers(lj.id, { [qs[i].key]: a.key } as Partial<Answers>, signal).catch(() => {});
          }
          continue;
        }
        if (j.state === 'failed' || j.state === 'cancelled') {
          await saveLocalJob({ ...lj, state: j.state });
          setFailed(j.error ?? REAL.failed);
          return;
        }
        if (j.state === 'done') {
          await saveLocalJob({ ...lj, state: 'done' });
          break;
        }
        await sleep(3000);
      }
      if (!alive) return;
      player.pause();
      setW(100);
      setPhase('done');
      await say(LINES.done);
    })();
    return () => {
      ac.abort();
      resolver.current = null;
      setIntro(null);
      setScan(null);
      setAim(false);
      dropIntro();
    };
  }, [real, jobParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (real || !meta || !videoUri) return;
    const intro = mediaSource(meta.introUrl ?? meta.videoUrl); // с токеном входа
    const video = mediaSource(meta.videoUrl);
    const kings = kingsQuestions(meta.kingsQuestions);
    let alive = true;
    const isAlive = () => alive;
    const say = async (text: string) => {
      if (!alive) return;
      setTyping(true);
      await sleep(650 + Math.min(900, text.length * 14));
      if (!alive) return;
      setTyping(false);
      setMsgs((m) => [...m, { mine: false, text }]);
      await sleep(420 + Math.min(1400, text.length * 16));
    };
    // more — дальше будут ещё вопросы: отклик без «сверяю ответы с видео»
    const ask = async (q: Question, more = false) => {
      await say(q.text);
      if (!alive) return null;
      setQuestion(q);
      const a = await new Promise<{ key: string; label: string }>((res) => (resolver.current = res));
      await sleep(380);
      await say(more && q.ackMore ? q.ackMore(a.label, a.key) : q.ack(a.label, a.key));
      return a;
    };

    (async () => {
      setPhase('upload');
      setU(0);
      setW(0);
      setMsgs([]);
      setAnswered(0);
      setQuestion(null);
      setStep('Присматриваюсь');
      zoom.setValue(0);
      player.replace(intro);
      const greeting = say(LINES.upload);
      for (let p = 0; p <= 100 && alive; p += 2) {
        setU(p);
        await sleep(55);
      }
      await greeting;
      if (!alive) return;
      setPhase('chat');
      await introPlayback(player, isAlive, () =>
        Animated.parallel([
          Animated.timing(zoom, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]).start(),
      );
      await say(LINES.loaded);
      await ask(Q_SIDE);
      await ask(Q_RESULT);
      await say(LINES.see);
      await say(LINES.interesting);
      await ask(Q_TECHNIQUE);
      await say(kings.length ? LINES.exactMore : LINES.exact);
      await ask(Q_WRIST, kings.length > 0);
      // кингсмув — только если сервер спросил (по позам долго очень открыт угол)
      for (let i = 0; i < kings.length && alive; i++) await ask(kings[i], i < kings.length - 1);
      if (!alive) return;
      setPhase('analyze');
      Animated.timing(zoom, { toValue: 0, duration: 600, useNativeDriver: false }).start();
      player.replace(video); // после вступления — само видео, медленно, под сканом
      // скорость и запуск — после перерисовки: на вебе VideoView заново ставит src тегу <video>, тот перезагружается,
      // сбрасывает скорость на 1 и обрывает play() — видео стояло на первом кадре (и с clip0)
      setTimeout(() => {
        if (!alive) return;
        player.playbackRate = 0.5;
        player.loop = true;
        player.play();
      }, 300);
      await say(LINES.understood);
      for (let i = 0; i < ANALYSIS.length && alive; i++) {
        setStep(ANALYSIS[i].step);
        const sayIt = say(ANALYSIS[i].text);
        const from = Math.round((i / ANALYSIS.length) * 100);
        const to = Math.round(((i + 1) / ANALYSIS.length) * 100);
        for (let p = from; p <= to && alive; p++) {
          setW(p);
          await sleep(28);
        }
        await sayIt;
      }
      if (!alive) return;
      player.pause();
      setPhase('done');
      await say(LINES.done);
    })();
    return () => {
      alive = false;
      resolver.current = null;
    };
  }, [run, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = phase === 'done' && !typing;
  // визор свёрнут в плашку, пока MIRA ждёт действия спортсмена (вопрос, нажатие на себя в кадре, кнопка) — видео и чат
  // поднимаются, видео крупнее; ответил — визор раскрывается и включается заново (эксперт, 2026-11-15)
  const needUser = !!question || done || !!failed || !!qm;
  const mode: EyesMode = done || happy ? 'happy' : typing && phase !== 'upload' ? 'think' : question ? 'look' : 'scan';
  const status = asleep
    ? 'спит · разбор с 21:00 МСК'
    : done
    ? 'разбор готов'
    : typing
      ? 'печатает…'
      : question
        ? 'ждёт ответа'
        : phase === 'upload'
          ? 'смотрит видео'
          : phase === 'analyze'
            ? 'анализирует'
            : 'присматривается';
  const statusColor = question ? DUSK.attention : done ? mira.text : mira.muted;
  const totalQ = 4 + (real ? extraQ : (meta?.kingsQuestions.length ?? 0));
  const prog = [u, (answered / totalQ) * 100, phase === 'analyze' || phase === 'done' ? w : 0, done ? 100 : 0];
  const sideQ = question?.tapOnVideo;
  // точки отправлены → сторона известна по ним (точка «я» левее точки соперника на среднем кадре) — ответ на «где ты»
  const pointsDone = async (taps: Tap[]) => {
    if (!local) return;
    setPointsErr(undefined);
    try {
      await sendTaps(local.id, taps);
      await sendAnswers(local.id, { points: 'yes' });
    } catch (e) {
      setPointsErr(userMessage(e));
      return;
    }
    const mid = taps[Math.floor(taps.length / 2)];
    const o = SIDES[mid.me[0] < mid.opp[0] ? 0 : 1];
    setPointsOpen(false);
    answer(o.key, o.label);
  };
  const opts = question && !sideQ ? question.options : [];

  // пока не пришёл разбор клипа (доли секунды) — пустой экран: размер кадра и глаз зависит от видео
  if (!real && !meta) {
    return (
      <SafeAreaView style={[styles.root, styles.wait]} edges={['top', 'bottom']}>
        {metaError ? <Text style={styles.waitText}>Нет связи с сервером анализа: {metaError}</Text> : null}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* HUD шлема MIRA (вариант D): глаза, прицелы, рамка-утолщения, шкалы; MIRA и статус — внизу рамки.
          Как на экране расписания (эксперт, 2026-11-16): на почти чёрном фоне, без дымки MIRA (на ней неон «растворялся»),
          ширина экрана минус отступы 16 */}
      <View style={{ paddingHorizontal: HUD_PAD }}>
        <MiraHud state={CY_MAP[mode]} width={screenW - HUD_PAD * 2} down={mode === 'scan'} statusText={status}
          rootRef={hudRef} dotRef={hudDotRef} eyeOut={hudEye} cvOut={hudCv} gazeIn={hudGaze}
          statusColor={asleep ? mira.dim : statusColor} collapsed={needUser} sleep={asleep} />
      </View>
      {real ? null : (
        <Pressable style={[styles.restart, styles.restartAbs]} onPress={() => setRun((r) => r + 1)} accessibilityLabel="Начать заново">
          <RotateCcw size={14} color="#A3A4AB" strokeWidth={1.8} />
        </Pressable>
      )}

      {/* видео, шаги и чат — один блок: при сворачивании / раскрытии визора переезжает целиком одной пружиной */}
      <RAnimated.View layout={MOVE} style={{ flex: 1 }}>
      <View style={[styles.video, videoBox]}>
        {/* рамка видео для прицела (measure каждый кадр — едет вместе с визором) */}
        <RAnimated.View ref={videoRef} pointerEvents="none" style={StyleSheet.absoluteFill} />
        {videoUri ? (
          <Animated.View
            style={[
              VIDEO_FILL,
              { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, FREEZE_ZOOM] }) }] },
            ]}>
            <VideoView
            player={player}
            style={VIDEO_FILL}
            contentFit={vertical ? 'cover' : 'contain'}
            nativeControls={false}
          />
            {intro ? (
              <IntroBlend intro={intro.f} fit={vertical ? 'cover' : 'contain'} onFreeze={intro.freeze} onDone={intro.done} />
            ) : null}
            {/* скан — пока кадр стоит (разговор); пошёл разбор и видео поехало — убираем */}
            {scan && phase === 'chat' && !qm && !failed ? (
              <ScanPeople people={scan.people} imgW={scan.w} imgH={scan.h} fit={vertical ? 'cover' : 'contain'}
                clock={scanClock} lead={AIM_LEAD_S} boxesOut={scanBoxes} />
            ) : null}
            <Animated.View
              pointerEvents="none"
              style={[VIDEO_FILL, { backgroundColor: '#000', opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }) }]}
            />
          </Animated.View>
        ) : null}
        {!done && phase !== 'upload' && !qm ? <Scan /> : null}
        {phase === 'upload' ? (
          <View style={styles.uploading}>
            <Ring pct={u} size={44} />
            <View>
              <Text style={styles.pct}>{u}%</Text>
              <Text style={styles.uploadText}>загружаю видео</Text>
            </View>
          </View>
        ) : null}
        {phase === 'analyze' ? (
          <View style={styles.stepBar}>
            <Text style={styles.stepText}>{step}</Text>
            <Text style={styles.stepText}>{w}%</Text>
          </View>
        ) : null}
        {sideQ ? (
          <Rise style={styles.halves}>
            {question!.options.map((o, i) => (
              <Pressable
                key={o.key}
                onPress={() => answer(o.key, o.label)}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.half,
                  i === 0 && styles.halfDivider,
                  (hovered || pressed) && styles.halfHover,
                ]}>
                <View style={styles.halfLabel}>
                  <Text style={styles.halfText}>Я {o.label.toLowerCase()}</Text>
                </View>
              </Pressable>
            ))}
          </Rise>
        ) : null}
      </View>

      {real && sideQ && local ? (
        // доп. настройка: если кто-то закрывает борцов — отметить себя и соперника точками
        <Pressable style={styles.pointsTab} onPress={() => setPointsOpen(true)}>
          <Crosshair size={16} color={mira.ind} strokeWidth={1.8} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pointsTabText}>Отметить себя и соперника точками</Text>
            <Text style={styles.pointsTabSub}>если кто-то или что-то закрывает борцов</Text>
          </View>
          <ChevronRight size={16} color={mira.muted} strokeWidth={1.8} />
        </Pressable>
      ) : null}
      <View style={styles.steps}>
        {['Видео', 'Вопросы', 'Анализ', 'Разбор'].map((l, i) => (
          <View key={l} style={{ flex: 1 }}>
            <View style={styles.stepTrack}>
              <View style={[styles.stepFill, { width: `${prog[i]}%`, backgroundColor: i === 3 ? mira.text : mira.ind }]} />
            </View>
            <Text style={[styles.stepLabel, { color: prog[i] > 0 ? mira.soft : mira.dim }]}>{l}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chat}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        onLayout={() => scroll.current?.scrollToEnd({ animated: false })}>
        {msgs.map((m, i) => (
          <Rise key={i} style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
            <Text style={[styles.bubbleText, m.mine && styles.mineText]}>{m.text}</Text>
            {m.upload ? (
              <View style={styles.upRow}>
                <Ring pct={upStage === 'done' ? 100 : u} size={44}>
                  <Text style={styles.upPct}>{upStage === 'done' ? 100 : u}%</Text>
                </Ring>
                <Text style={styles.upSpeed}>
                  {upStage === 'done'
                    ? 'видео загружено'
                    : offline
                      ? 'нет интернета — жду связь…'
                      : upStage === 'prep'
                      ? 'сжимаю видео'
                      : speed != null
                        ? fmtSpeed(speed)
                        : 'отправляю…'}
                </Text>
              </View>
            ) : null}
          </Rise>
        ))}
        {typing ? (
          <View style={[styles.bubble, styles.theirs, styles.typing]}>
            <Dots />
          </View>
        ) : null}
      </ScrollView>
      </View>
      </RAnimated.View>

      <View style={styles.bottom}>
        {sideQ ? (
          <Rise style={styles.hint}>
            <Text style={styles.hintText}>Тапни на себя в кадре ↑</Text>
          </Rise>
        ) : null}
        {opts.length ? (
          <Rise style={styles.opts}>
            {opts.map((o) => (
              <Pressable
                key={o.key}
                disabled={o.disabled}
                onPress={() => answer(o.key, o.label)}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.opt,
                  question!.cols === 2 && (question!.options.length > 4 ? styles.optThird : styles.optHalf),
                  question!.options.length > 4 && styles.optSmall,
                  (hovered || pressed) && styles.optHover,
                  o.disabled && { opacity: 0.4 },
                ]}>
                {o.hint ? (
                  <View style={styles.optRow}>
                    {o.color ? <View style={[styles.optDot, { backgroundColor: o.color }]} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optText, styles.optTextLeft]}>{o.label}</Text>
                      <Text style={styles.optHint}>{o.hint}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.optText}>{o.label}</Text>
                )}
              </Pressable>
            ))}
          </Rise>
        ) : null}
        {failed ? (
          <Rise style={{ gap: 8 }}>
            <Text style={styles.failText}>{failed}</Text>
            <Pressable style={styles.open} onPress={() => router.dismissTo('/analysis')}>
              <Text style={styles.openText}>К разборам</Text>
            </Pressable>
          </Rise>
        ) : null}
        {phase === 'queued' && !typing ? (
          <Rise>
            <Pressable style={styles.open} onPress={() => router.dismissTo('/analysis')}>
              <Text style={styles.openText}>Готово</Text>
            </Pressable>
          </Rise>
        ) : null}
        {done && !failed ? (
          <Rise>
            <Pressable
              style={styles.open}
              onPress={() =>
                real && local
                  ? router.replace(`/mira/result/${local.id}`)
                  : router.replace(`/mira/result/${encodeURIComponent(demo)}`)
              }>
              <Text style={styles.openText}>Открыть разбор</Text>
            </Pressable>
          </Rise>
        ) : null}
      </View>
    </SafeAreaView>
      {qm ? (
        <QualityModal
          q={qm.q}
          onGo={() => qRes.current?.(true)}
          onOther={() => qRes.current?.(false)}
        />
      ) : null}
      <TopUpSheet visible={needTok} onClose={() => tokRes.current?.(false)} onBought={() => tokRes.current?.(true)}
        accent={SEA.sea} onAccent={SEA.onSea} reason="Для разбора нужен 1 токен." />
      {/* прицел MIRA — поверх всего экрана (летит из визора в кадр), только первый круг скана */}
      {scan && aim && phase === 'chat' && !qm && !failed ? (
        <AimReticle clock={scanClock} boxes={scanBoxes} videoRef={videoRef} hudRef={hudRef} dotRef={hudDotRef}
          eye={hudEye} cv={hudCv} hudScale={(screenW - HUD_PAD * 2) / 390} zoom={FREEZE_ZOOM} gazeOut={hudGaze}
          onDone={() => {
            hudGaze.set({ x: 0, on: 0 });
            setAim(false);
          }} />
      ) : null}
      {pointsOpen && local ? (
        <PointsSheet jobId={local.id} error={pointsErr} onDone={pointsDone}
          onClose={() => { setPointsOpen(false); setPointsErr(undefined); }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mira.bg },
  pointsTab: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, borderColor: '#2E2E33', backgroundColor: '#111114',
  },
  pointsTabText: { fontFamily: mira.fontSemi, fontSize: 13, color: mira.text },
  pointsTabSub: { fontFamily: mira.font, fontSize: 11, color: mira.muted, marginTop: 1 },
  wait: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  waitText: { fontFamily: mira.font, fontSize: 13, lineHeight: 19, color: mira.muted, textAlign: 'center' },
  top: { height: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 22 },
  restartAbs: { position: 'absolute', top: 44, right: 16 },
  restart: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyes: { height: 104, alignItems: 'center', justifyContent: 'center' },
  eyesSmall: { height: 84 },
  nameRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  name: { fontFamily: mira.display, fontSize: 17, letterSpacing: 1.7, color: mira.name },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  status: { fontFamily: mira.font, fontSize: 12 },
  video: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#232327',
  },
  uploading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(10,10,11,.5)',
  },
  pct: { fontFamily: mira.display, fontSize: 22, color: mira.text },
  uploadText: { fontFamily: mira.font, fontSize: 12, color: '#A3A4AB' },
  stepBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,.55)',
  },
  stepText: { fontFamily: mira.fontSemi, fontSize: 11, color: mira.soft },
  halves: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  half: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14 },
  halfDivider: { borderRightWidth: 1, borderRightColor: 'rgba(244,244,245,.25)', borderStyle: 'dashed' },
  halfHover: { backgroundColor: 'rgba(103,193,215,.18)' },
  halfLabel: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,11,.82)',
    borderWidth: 1,
    borderColor: '#3A3B40',
  },
  halfText: { fontFamily: mira.displayBold, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: mira.text },
  steps: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingTop: 10 },
  stepTrack: { height: 3, borderRadius: 2, backgroundColor: mira.track, overflow: 'hidden' },
  stepFill: { height: '100%' },
  stepLabel: { fontFamily: mira.font, fontSize: 11, marginTop: 5 },
  chat: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 7 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  theirs: { alignSelf: 'flex-start', backgroundColor: mira.bubble, borderWidth: 1, borderColor: mira.bubbleBorder, borderBottomLeftRadius: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: mira.text, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: mira.font, fontSize: 14, lineHeight: 20, color: mira.text },
  mineText: { color: mira.bg },
  typing: { paddingVertical: 13, paddingHorizontal: 16 },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  upPct: { fontFamily: mira.fontSemi, fontSize: 11, color: mira.text },
  upSpeed: { fontFamily: mira.font, fontSize: 13, color: mira.muted },
  bottom: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 20, minHeight: 50 },
  hint: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#24505F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: { fontFamily: mira.font, fontSize: 14, color: '#67C1D7' },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opt: {
    minHeight: 46,
    flexBasis: '100%',
    flexGrow: 1,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mira.chipBorder,
    backgroundColor: mira.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optHalf: { flexBasis: '45%' },
  optThird: { flexBasis: '30%' },
  optSmall: { minHeight: 38, paddingHorizontal: 6 },
  optHover: { backgroundColor: '#1E1E21', borderColor: mira.ind },
  optText: { fontFamily: mira.fontSemi, fontSize: 14, color: mira.text, textAlign: 'center' },
  // вариант с пояснением (рука перед схваткой): цветная точка, название и подсказка слева
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  optDot: { width: 10, height: 10, borderRadius: 5 },
  optTextLeft: { textAlign: 'left' },
  optHint: { fontFamily: mira.font, fontSize: 12, lineHeight: 16, color: mira.muted, marginTop: 2 },
  open: { height: 54, borderRadius: 14, backgroundColor: mira.text, alignItems: 'center', justifyContent: 'center' },
  failText: { fontFamily: mira.font, fontSize: 14, lineHeight: 20, color: mira.text, textAlign: 'center' },
  openText: { fontFamily: mira.displayBold, fontSize: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: mira.bg },
});
