const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
const stopWords = new Set(['继续', '上次', '昨天', '那个', '这个', '一下', '的', '聊', '聊聊']);

export function recallKeywords(text) {
  return [...new Set([...segmenter.segment(text)]
    .filter(({ segment, isWordLike }) => isWordLike && !stopWords.has(segment))
    .map(({ segment }) => segment))].join(' ');
}

async function untilAborted(signal, operation) {
  signal.throwIfAborted();
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([cancelled, operation()]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export async function decideWeixinSession({
  text, current, readContext, classify, search, recall, signal, trace = () => {},
}) {
  const finish = (result, reason) => {
    trace({ action: result.action, reason });
    return result;
  };
  if (!current) return finish({ action: 'keep' }, 'no-current-session');
  let stage = 'context';
  let round = 0;
  try {
    const deadline = AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]);
    for (let count = 1; count <= 3; count++) {
      round = count;
      stage = 'context';
      deadline.throwIfAborted();
      const context = await untilAborted(deadline, () => readContext(current, count, deadline));
      deadline.throwIfAborted();
      stage = 'classify';
      const decision = await untilAborted(deadline, () => classify({ text, ...context }, deadline));
      deadline.throwIfAborted();
      if (decision === '/new') {
        return finish({ action: 'new', skipNextRoute: true }, 'classified-new');
      }
      trace({ stage, round, contextTurns: context.turns.length,
        decision: decision === true ? 'switch' : decision === false ? 'continue' : decision === null ? 'more-context' : 'invalid' });
      if (decision === true) break;
      if (decision !== null || count === 3 || context.turns.length < count) {
        return finish({ action: 'keep' }, decision === false ? 'classified-continue'
          : decision === null ? 'context-exhausted' : 'invalid-classification');
      }
    }
  } catch (error) {
    signal?.throwIfAborted();
    trace({ stage, round, failure: error?.name === 'TimeoutError' ? 'timeout' : 'error' });
    return finish({ action: 'keep' }, stage + '-failed');
  }

  try {
    stage = 'search';
    const query = recallKeywords(text);
    if (!query) return finish({ action: 'new' }, 'no-keywords');
    const searchDeadline = AbortSignal.any([AbortSignal.timeout(5_000), ...(signal ? [signal] : [])]);
    const candidates = await untilAborted(searchDeadline, () => search(query, current, searchDeadline));
    trace({ stage, candidateCount: candidates.length });
    if (!candidates.length) return finish({ action: 'new' }, 'no-candidates');
    stage = 'recall';
    const deadline = AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]);
    const sessionId = await untilAborted(deadline, () => recall({ text, candidates }, deadline));
    deadline.throwIfAborted();
    if (sessionId === null) return finish({ action: 'new' }, 'no-clear-match');
    const match = candidates.find((candidate) => candidate.sessionId === sessionId);
    if (sessionId !== current && match) {
      return finish({ action: 'resume', sessionId, ...(match.title ? { title: match.title } : {}) }, 'matched');
    }
    return finish({ action: 'new', recallFailed: true }, 'invalid-recall-result');
  } catch (error) {
    signal?.throwIfAborted();
    trace({ stage, failure: error?.name === 'TimeoutError' ? 'timeout' : 'error' });
    return finish({ action: 'new', recallFailed: true }, stage + '-failed');
  }
}
