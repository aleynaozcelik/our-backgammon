import roomStyles from './GameRoomBoard.module.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { GameState, Player, Move } from '@/types/game';
import { PointUI } from './PointUI';
import { Checker } from './Checker';
import { Die } from './Dice';
import { getAllLegalMoves, getMaxPlayableMoveCount, validateMoveRule } from '@/lib/game/engine';
import { playFeedback } from '@/lib/game/feedback';
import { applyMove } from '@/lib/game/moves';

interface BoardProps {
  gameState: GameState;
  onConfirmMoves: (moves: Move[]) => Promise<void>;
  onPendingMovesChange: (moves: Move[]) => void;
  viewerPlayer: Player | 'spectator';
  hectorPlayer: Player | null;
  connected?: boolean;
}

type SelectedPoint = number | 'bar' | null;

type HectorCaptureMedia = {
  id: number;
  kind: 'video' | 'image';
  src: string;
  label: string;
  startsAt: number;
};

const HECTOR_FIRST_CAPTURE_VIDEO = '/assets/images/badMoves/bad-move.mp4';
const HECTOR_LATER_CAPTURE_IMAGES = [
  '/assets/images/badMoves/bad-move2.jfif',
  '/assets/images/badMoves/bad_move3.jfif',
  '/assets/images/badMoves/bad-move5.gif',
  '/assets/images/badMoves/bad-move6.jpeg',
  '/assets/images/badMoves/bad-move7.jpeg',
  '/assets/images/badMoves/bad-move8.jpeg',
  '/assets/images/badMoves/bad-move9.jpeg',
  '/assets/images/badMoves/bad-move10.jfif',
  '/assets/images/badMoves/bad-move11.jfif',
] as const;
const NICE_CAPTURE_IMAGES = [
  '/assets/images/niceMoves/nice-move.jfif',
  '/assets/images/niceMoves/nice-move2.jpeg',
  '/assets/images/niceMoves/nice-move3.jpeg',
  '/assets/images/niceMoves/nice-move4.jfif',
  '/assets/images/niceMoves/nice-move5.jfif',
] as const;
const HECTOR_CAPTURE_IMAGE_DURATION_MS = 2400;
const HECTOR_CAPTURE_EXIT_DURATION_MS = 450;
const THINK_VIDEO_SRC = '/assets/images/think/think.mov';
const CONFIRM_REMINDER_DELAY_MS = 15_000;

export function BackgammonBoard({ gameState, onConfirmMoves, onPendingMovesChange, viewerPlayer, hectorPlayer, connected = true }: BoardProps) {
  const [selectedPointState, setSelectedPointState] = useState<{ version: number; point: SelectedPoint }>({
    version: gameState.version,
    point: null,
  });
  const [pendingMoveState, setPendingMoveState] = useState<{ version: number; moves: Move[] }>({
    version: gameState.version,
    moves: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hectorPlaybackQueue, setHectorPlaybackQueue] = useState<HectorCaptureMedia[]>([]);
  const [isHectorPlaybackLeaving, setIsHectorPlaybackLeaving] = useState(false);
  const [readyCaptureId, setReadyCaptureId] = useState<number | null>(null);
  const [loadedCaptureId, setLoadedCaptureId] = useState<number | null>(null);
  const [timedOutConfirmationKey, setTimedOutConfirmationKey] = useState<string | null>(null);
  const [dismissedConfirmationKey, setDismissedConfirmationKey] = useState<string | null>(null);
  const lastDiceTurn = useRef<number | null>(null);
  useEffect(() => {
    if (gameState.dice.length === 2 && lastDiceTurn.current !== gameState.turnNumber) {
      lastDiceTurn.current = gameState.turnNumber;
      playFeedback('dice');
    }
  }, [gameState.dice.length, gameState.turnNumber]);
  const previousGameStateRef = useRef<GameState | null>(null);
  const lastCaptureKeyRef = useRef<string | null>(null);
  const hectorPlaybackSequenceRef = useRef(0);
  const publishedPendingMovesRef = useRef<string | null>(null);

  const finishHectorPlayback = React.useCallback(() => {
    setIsHectorPlaybackLeaving(true);
  }, []);

  const currentHectorPlayback = hectorPlaybackQueue[0] ?? null;

  useEffect(() => {
    if (!currentHectorPlayback) return;
    const timer = window.setTimeout(() => {
      setReadyCaptureId(currentHectorPlayback.id);
    }, Math.max(0, currentHectorPlayback.startsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [currentHectorPlayback]);

  useEffect(() => {
    if (!isHectorPlaybackLeaving) return;

    const timer = window.setTimeout(() => {
      setHectorPlaybackQueue((currentQueue) => currentQueue.slice(1));
      setIsHectorPlaybackLeaving(false);
    }, HECTOR_CAPTURE_EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isHectorPlaybackLeaving]);

  useEffect(() => {
    if (!currentHectorPlayback || currentHectorPlayback.kind !== 'image' ||
      loadedCaptureId !== currentHectorPlayback.id) return;

    const timer = window.setTimeout(finishHectorPlayback,
      Math.max(HECTOR_CAPTURE_IMAGE_DURATION_MS,
        currentHectorPlayback.startsAt + HECTOR_CAPTURE_IMAGE_DURATION_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [currentHectorPlayback, finishHectorPlayback, loadedCaptureId]);

  const pendingMoves = useMemo(
    () => pendingMoveState.version === gameState.version ? pendingMoveState.moves : [],
    [gameState.version, pendingMoveState.moves, pendingMoveState.version]
  );
  const selectedPoint = selectedPointState.version === gameState.version ? selectedPointState.point : null;

  const setPendingMoves = (update: React.SetStateAction<Move[]>) => {
    setPendingMoveState((current) => {
      const currentMoves = current.version === gameState.version ? current.moves : [];
      const nextMoves = typeof update === 'function'
        ? (update as (moves: Move[]) => Move[])(currentMoves)
        : update;

      return {
        version: gameState.version,
        moves: nextMoves,
      };
    });
  };

  const setSelectedPoint = (point: SelectedPoint) => {
    setSelectedPointState({
      version: gameState.version,
      point,
    });
  };

  useEffect(() => {
    const previousGameState = previousGameStateRef.current;
    // Ignore delayed snapshots so the same committed turn cannot trigger again.
    if (previousGameState && gameState.version < previousGameState.version) return;

    const hasStartedNewGame = previousGameState && (
      gameState.turnNumber < previousGameState.turnNumber ||
      (previousGameState.status === 'FINISHED' && gameState.status === 'PLAYING')
    );
    if (hasStartedNewGame) {
      lastCaptureKeyRef.current = null;
      setHectorPlaybackQueue([]);
      setIsHectorPlaybackLeaving(false);
    }

    previousGameStateRef.current = gameState;

    if (!previousGameState || viewerPlayer === 'spectator' || !hectorPlayer) return;

    const capture = gameState.lastCapture;
    if (!capture || (capture.turnNumber >= gameState.turnNumber && gameState.status !== 'FINISHED')) return;
    const captureKey = `${capture.player}:${capture.turnNumber}:${capture.startsAt}`;
    if (lastCaptureKeyRef.current === captureKey) return;
    const capturingPlayer = capture.player;
    const isHectorCapture = capturingPlayer === hectorPlayer;
    lastCaptureKeyRef.current = captureKey;
    // Do not replay an old reaction when reconnecting to a room.
    if (Date.now() - capture.startsAt > 60_000) return;
    // Show one reaction per committed turn, regardless of how many checkers were hit.
    // Use persisted game data so refreshes and separate clients choose the same media.
    const isFirstHectorCapture = isHectorCapture &&
      gameState.firstCaptureTurn?.[capturingPlayer] === capture.turnNumber;
    hectorPlaybackSequenceRef.current += 1;
    const captureImages = isHectorCapture ? HECTOR_LATER_CAPTURE_IMAGES : NICE_CAPTURE_IMAGES;
    const captureMedia: HectorCaptureMedia = {
      id: hectorPlaybackSequenceRef.current,
      startsAt: capture.startsAt,
      kind: isFirstHectorCapture ? 'video' : 'image',
      src: isFirstHectorCapture
        ? HECTOR_FIRST_CAPTURE_VIDEO
        : captureImages[capture.turnNumber % captureImages.length],
      label: isHectorCapture ? 'Hector has captured a checker' : 'Nice move! Hector’s checker was captured',
    };

    setHectorPlaybackQueue((currentQueue) => [...currentQueue, captureMedia]);
  }, [gameState, hectorPlayer, viewerPlayer]);

  const localPreviewState = pendingMoves.reduce((state, move) => applyMove(state, move), gameState);
  const remotePendingMoves =
    gameState.pendingPreview && gameState.pendingPreview.player !== viewerPlayer
      ? gameState.pendingPreview.moves
      : [];
  const visiblePendingMoves = pendingMoves.length > 0 ? pendingMoves : remotePendingMoves;
  const previewState = visiblePendingMoves.reduce((state, move) => applyMove(state, move), gameState);

  useEffect(() => {
    if (
      viewerPlayer === 'spectator' ||
      gameState.currentPlayer !== viewerPlayer ||
      gameState.status !== 'PLAYING' ||
      isSubmitting
    ) {
      return;
    }

    const pendingMovesKey = JSON.stringify(pendingMoves);
    if (publishedPendingMovesRef.current === pendingMovesKey) return;

    const timer = window.setTimeout(() => {
      publishedPendingMovesRef.current = pendingMovesKey;
      onPendingMovesChange(pendingMoves);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [gameState.currentPlayer, gameState.status, isSubmitting, onPendingMovesChange, pendingMoves, viewerPlayer]);

  // Derive legal moves if it's viewer's turn
  const isMyTurn = viewerPlayer === localPreviewState.currentPlayer;
  const isRolledTurn = gameState.dice.length === 2;
  const maxPlayableMoveCount = isRolledTurn ? getMaxPlayableMoveCount(gameState) : 0;
  const canInteractWithBoard =
    connected && isMyTurn &&
    isRolledTurn &&
    gameState.status === 'PLAYING' &&
    !isSubmitting &&
    pendingMoves.length < maxPlayableMoveCount;

  // All immediate moves for current state
  const legalMoves = canInteractWithBoard ? getAllLegalMoves(localPreviewState) : [];
  const canUndo = pendingMoves.length > 0 && !isSubmitting;
  const canConfirmMoves =
    connected && pendingMoves.length > 0 &&
    !isSubmitting &&
    (localPreviewState.status === 'FINISHED' || pendingMoves.length >= maxPlayableMoveCount);
  const showMoveControls = viewerPlayer !== 'spectator' && isMyTurn && gameState.status === 'PLAYING' && !isSubmitting;
  const sharedPendingPreview = gameState.pendingPreview;
  const sharedPendingMoves = sharedPendingPreview?.moves ?? [];
  const sharedPreviewState = sharedPendingMoves.reduce((state, move) => applyMove(state, move), gameState);
  const sharedPreviewCanConfirm = Boolean(
    sharedPendingPreview &&
    sharedPendingPreview.player === gameState.currentPlayer &&
    sharedPendingMoves.length > 0 &&
    (sharedPreviewState.status === 'FINISHED' || sharedPendingMoves.length >= maxPlayableMoveCount)
  );
  const confirmationKey =
    viewerPlayer !== 'spectator' &&
    connected &&
    gameState.status === 'PLAYING' &&
    isRolledTurn &&
    sharedPreviewCanConfirm &&
    sharedPendingPreview
    ? `${gameState.turnNumber}:${gameState.currentPlayer}:${sharedPendingPreview.updatedAt}`
    : null;
  const confirmationUpdatedAt = confirmationKey ? sharedPendingPreview?.updatedAt ?? null : null;
  const shouldShowThinkReminder =
    confirmationKey !== null &&
    timedOutConfirmationKey === confirmationKey &&
    dismissedConfirmationKey !== confirmationKey;

  const dismissThinkReminder = React.useCallback(() => {
    if (confirmationKey) setDismissedConfirmationKey(confirmationKey);
  }, [confirmationKey]);

  useEffect(() => {
    if (
      !confirmationKey ||
      confirmationUpdatedAt === null ||
      timedOutConfirmationKey === confirmationKey ||
      dismissedConfirmationKey === confirmationKey
    ) {
      return;
    }

    const delay = Math.max(0, confirmationUpdatedAt + CONFIRM_REMINDER_DELAY_MS - Date.now());
    const timer = window.setTimeout(() => {
      setTimedOutConfirmationKey(confirmationKey);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [confirmationKey, confirmationUpdatedAt, dismissedConfirmationKey, timedOutConfirmationKey]);

  // Filter for currently selected piece
  const highlightedDestinations = selectedPoint !== null
    ? legalMoves.filter(m => m.from === selectedPoint && validateMoveRule(localPreviewState, m))
    : [];
  const getBearOffMove = (from: SelectedPoint) => {
    if (from === null || from === 'bar' || viewerPlayer === 'spectator') return null;

    const bearingDistance = viewerPlayer === 'player1' ? 24 - from : from + 1;
    return legalMoves
      .filter((move) => move.from === from && move.to === 'borneOff')
      .filter((move) => validateMoveRule(localPreviewState, move))
      .sort((first, second) => {
        const score = (move: Move) => {
          const exactPenalty = move.dieValue === bearingDistance ? 0 : 100;
          return exactPenalty + move.dieValue;
        };

        return score(first) - score(second);
      })[0] ?? null;
  };
  const selectedBearOffMove = getBearOffMove(selectedPoint);
  const canBearOffSelected = selectedBearOffMove !== null;

  const playMove = (move: Move) => {
    playFeedback("move");
    setPendingMoves((moves) => [...moves, move]);
    setSelectedPoint(null);
  };

  const handlePointClick = (index: number) => {
    if (!canInteractWithBoard) return;

    // A highlighted destination keeps priority over selecting a new source.
    // Otherwise, one tap on an eligible checker bears it off using the same
    // validated move / pending preview / undo flow as a normal board move.
    const destinationMove = highlightedDestinations.find(move => move.to === index);
    if (!destinationMove) {
      const bearOffMove = getBearOffMove(index);
      if (bearOffMove) {
        playMove(bearOffMove);
        return;
      }
    }

    // If already selected, try to move to this point
    if (selectedPoint !== null) {
      if (selectedPoint === index) {
        setSelectedPoint(null); // deselect
        return;
      }

      const move = highlightedDestinations.find(m => m.to === index);
      if (move) {
        // Enforce large dice rule if needed
        if (validateMoveRule(localPreviewState, move)) {
          playMove(move);
        } else {
          alert("Invalid move: you must play the larger die.");
        }
        return;
      }

      // If clicked elsewhere but it's not a valid destination, select the new point if it has our checker
      if (localPreviewState.board[index].player === viewerPlayer && localPreviewState.board[index].count > 0) {
        setSelectedPoint(index);
      } else {
        setSelectedPoint(null);
      }
    } else {
      // Nothing selected, try to select
      // But check if we HAVE to play from bar
      if (localPreviewState.bar[viewerPlayer] > 0) {
        // Can only select bar
        return;
      }

      if (localPreviewState.board[index].player === viewerPlayer && localPreviewState.board[index].count > 0) {
        setSelectedPoint(index);
      }
    }
  };

  const handleBarClick = (player: Player) => {
    if (!canInteractWithBoard || player !== viewerPlayer) return;
    if (localPreviewState.bar[viewerPlayer] > 0) {
      setSelectedPoint('bar');
    }
  };

  const canClickSourceChecker = (index: number) => {
    if (!canInteractWithBoard) return false;
    if (localPreviewState.bar[viewerPlayer] > 0) return false;
    if (localPreviewState.board[index].player !== viewerPlayer) return false;
    if (localPreviewState.board[index].count === 0) return false;

    return selectedPoint === index || legalMoves.some((move) => move.from === index);
  };

  const canClickBarChecker = (player: Player) => (
    canInteractWithBoard &&
    viewerPlayer === player &&
    localPreviewState.bar[player] > 0 &&
    legalMoves.some((move) => move.from === 'bar')
  );

  const renderBarCheckers = (player: Player) => {
    const count = previewState.bar[player];
    const canClickTopBarChecker = canClickBarChecker(player);

    return (
      <button
        type="button"
        className="bar-hitbox relative flex h-full min-h-0 w-full flex-col items-center overflow-hidden rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
        style={{ justifyContent: player === 'player2' ? 'flex-start' : 'flex-end' }}
        disabled={!canClickTopBarChecker}
        aria-label={`Select ${player === 'player1' ? 'white' : 'blue'} checkers on bar, ${count} checkers`}
        aria-pressed={selectedPoint === 'bar' && viewerPlayer === player}
        onClick={() => handleBarClick(player)}
      >
        {count > 0 && (
          <Checker
            player={player}
            count={count}
            isSelected={selectedPoint === 'bar' && viewerPlayer === player}
          />
        )}
      </button>
    );
  };

  const handleBearOffClick = () => {
    if (!canInteractWithBoard || !selectedBearOffMove) return;
    playMove(selectedBearOffMove);
  };

  const renderHalfBoard = (indices: number[], isTop: boolean) => {
    return (
      <div className={roomStyles.gameRoomHalf}>
        {indices.map((idx) => {
          const destinationMoves = highlightedDestinations.filter(m => m.to === idx);
          const isHighlighted = destinationMoves.length > 0;
          const isSelected = selectedPoint === idx;
          const checkerCanBeClicked = isHighlighted || canClickSourceChecker(idx);

          return (
            <div key={idx} className={roomStyles.gameRoomPoint} data-room-point>
              <PointUI
                pointIndex={idx}
                pointData={previewState.board[idx]}
                isTop={isTop}
                isEven={idx % 2 === 0}
                isHighlighted={isHighlighted}
                highlightValues={destinationMoves.map((move) => move.dieValue)}
                selectedChecker={isSelected}
                onPointClick={() => handlePointClick(idx)}
                onCheckerClick={() => handlePointClick(idx)}
                isCheckerClickable={checkerCanBeClicked}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const topIndicesLeft = [11, 10, 9, 8, 7, 6];
  const topIndicesRight = [5, 4, 3, 2, 1, 0];
  const bottomIndicesLeft = [12, 13, 14, 15, 16, 17];
  const bottomIndicesRight = [18, 19, 20, 21, 22, 23];
  const renderBorneOffPieces = (player: Player, count: number) => {
    const isPlayer1 = player === 'player1';

    return Array.from({ length: count }).map((_, index) => (
      <div
        key={`${player}-${index}`}
        className={[
          'bear-off-piece h-2 w-10 rounded-full border shadow-sm sm:h-2.5 sm:w-14',
          isPlayer1
            ? 'border-[var(--coral)] bg-[var(--sand)]'
            : 'border-[var(--teal)] bg-[var(--ocean)]',
        ].join(' ')}
      />
    ));
  };

  return (
    <div className={roomStyles.gameRoomFrame}>
      <div className={roomStyles.gameRoomBoard}>

        {gameState.dice.length === 2 && (
          <div key={gameState.turnNumber} className={`dice-roll ${roomStyles.gameRoomDice}`}>
            <Die value={gameState.dice[0]} isUsed={!previewState.remainingMoves.includes(gameState.dice[0])} className={roomStyles.gameRoomDie} />
            <Die value={gameState.dice[1]} isUsed={!previewState.remainingMoves.includes(gameState.dice[1])} className={roomStyles.gameRoomDie} />
          </div>
        )}

        {/* Board Layout */}
        <div className={roomStyles.gameRoomInner}>

          {/* Top Half */}
          <div className={roomStyles.gameRoomRow}>
            {renderHalfBoard(topIndicesLeft, true)}

            {/* BAR */}
            <div
              className={roomStyles.gameRoomBar}
            >
              {/* Player 2 Bar */}
              {renderBarCheckers('player2')}
            </div>

            {renderHalfBoard(topIndicesRight, true)}
          </div>

          {/* Middle Hinge Line */}
          <div className={roomStyles.gameRoomCenter}>
            <div className="h-px w-full bg-[var(--sand)] shadow-sm sm:h-[2px]" />
          </div>

          {/* Bottom Half */}
          <div className={roomStyles.gameRoomRow}>
            {renderHalfBoard(bottomIndicesLeft, false)}

            {/* BAR */}
            <div
              className={roomStyles.gameRoomBar}
            >
              {/* Player 1 Bar */}
              {renderBarCheckers('player1')}
            </div>

            {renderHalfBoard(bottomIndicesRight, false)}
          </div>

        </div>

        {showMoveControls && (
          <div className={`board-move-controls ${roomStyles.gameRoomMoveControls}`}>
            <button
              type="button"
              onClick={() => {
                setPendingMoves((moves) => moves.slice(0, -1));
                setSelectedPoint(null);
              }}
              disabled={!canUndo}
              className="pointer-events-auto rounded-lg border border-[var(--line)] bg-[var(--navy)] px-4 py-2 text-xs font-bold text-[var(--sand)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canConfirmMoves) return;
                setIsSubmitting(true);
                void onConfirmMoves(pendingMoves).finally(() => {
                  setIsSubmitting(false);
                });
              }}
              disabled={!canConfirmMoves}
              className="pointer-events-auto rounded-lg bg-[var(--coral)] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSubmitting ? 'Confirming...' : 'Confirm'}
            </button>
          </div>
        )}
      </div>

      <aside
        role="button"
        tabIndex={canBearOffSelected ? 0 : -1}
        aria-label="Bear off selected checker"
        aria-disabled={!canBearOffSelected}
        onKeyDown={(event) => {
          if (canBearOffSelected && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            handleBearOffClick();
          }
        }}
        onClick={canBearOffSelected ? handleBearOffClick : undefined}
        className={[
          roomStyles.gameRoomTray,
          canBearOffSelected ? 'cursor-pointer ring-2 ring-[var(--coral)] shadow-[0_0_18px_rgba(217,130,112,0.35)]' : '',
        ].join(' ')}
      >
        <div className="bear-off-pieces absolute inset-2 flex min-h-0 flex-col items-center gap-2 sm:inset-3">
          <div className="bear-off-stack bear-off-stack-player2 flex min-h-0 flex-1 flex-col items-center justify-end gap-0.5">
            <span className="tray-count">{previewState.borneOff.player2.toString().padStart(2, '0')}</span>
            {renderBorneOffPieces('player2', previewState.borneOff.player2)}
          </div>
          <div className="bear-off-divider h-0.5 w-full shrink-0 bg-[var(--navy)]/45" />
          <div className="bear-off-stack bear-off-stack-player1 flex min-h-0 flex-1 flex-col items-center justify-start gap-0.5">
            {renderBorneOffPieces('player1', previewState.borneOff.player1)}
            <span className="tray-count">{previewState.borneOff.player1.toString().padStart(2, '0')}</span>
          </div>
        </div>
      </aside>

      {currentHectorPlayback && readyCaptureId === currentHectorPlayback.id && (
        <div
          key={currentHectorPlayback.id}
          className={`hector-capture-overlay ${isHectorPlaybackLeaving ? 'hector-capture-leaving' : ''} pointer-events-none fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--navy)]/70 p-6`}
        >
          {currentHectorPlayback.kind === 'video' ? (
            <video
              key={currentHectorPlayback.id}
              src={currentHectorPlayback.src}
              aria-label={currentHectorPlayback.label}
              onLoadedData={(event) => {
                const video = event.currentTarget;
                if (video.dataset.playbackStarted) return;
                video.dataset.playbackStarted = 'true';
                const elapsed = Math.max(0, (Date.now() - currentHectorPlayback.startsAt) / 1000);
                // A delayed download must not skip the entire reaction.
                video.currentTime = Number.isFinite(video.duration) && elapsed < video.duration - 1
                  ? elapsed : 0;
                void video.play().catch(() => {
                  // Mobile browsers may block sound on remotely triggered playback.
                  video.muted = true;
                  void video.play().catch(finishHectorPlayback);
                });
              }}
              onEnded={finishHectorPlayback}
              onError={finishHectorPlayback}
              loop={false}
              playsInline
              className="hector-capture max-h-[78vh] w-[min(82vw,460px)] object-cover shadow-2xl"
            />
          ) : (
            <Image
              key={currentHectorPlayback.id}
              src={currentHectorPlayback.src}
              alt={currentHectorPlayback.label}
              unoptimized={currentHectorPlayback.src.endsWith('.gif')}
              width={736}
              height={552}
              onLoad={() => setLoadedCaptureId(currentHectorPlayback.id)}
              onError={finishHectorPlayback}
              className="hector-capture max-h-[78vh] w-[min(82vw,460px)] object-cover shadow-2xl"
            />
          )}
        </div>
      )}

      {shouldShowThinkReminder && (
        <div className="pointer-events-none fixed inset-0 z-[2100] flex items-center justify-center bg-[var(--navy)]/70 p-6">
          <video
            key={confirmationKey ?? 'think-reminder'}
            src={THINK_VIDEO_SRC}
            aria-label="Confirm your move reminder"
            onLoadedData={(event) => {
              const video = event.currentTarget;
              if (video.dataset.playbackStarted) return;
              video.dataset.playbackStarted = 'true';
              const elapsed = Math.max(0, (Date.now() - ((confirmationUpdatedAt ?? Date.now()) + CONFIRM_REMINDER_DELAY_MS)) / 1000);
              if (Number.isFinite(video.duration) && elapsed >= video.duration) {
                dismissThinkReminder();
                return;
              }
              video.currentTime = elapsed;
              void video.play().catch(() => {
                // Mobile browsers may block sound on an automatic reminder.
                video.muted = true;
                void video.play().catch(dismissThinkReminder);
              });
            }}
            onEnded={dismissThinkReminder}
            onError={dismissThinkReminder}
            loop={false}
            playsInline
            className="hector-capture max-h-[78vh] w-[min(82vw,460px)] object-contain shadow-2xl"
          />
        </div>
      )}

    </div>
  );
}
