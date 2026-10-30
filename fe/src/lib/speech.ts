export function speak(
  text: string,
  onEnd?: () => void,
  onError?: (message: string) => void,
  language: 'vi-VN' | 'en-US' = 'vi-VN',
) {
  if (!('speechSynthesis' in window)) {
    onError?.(
      'Trình duyệt chưa hỗ trợ đọc giọng nói. Hãy đưa màn hình chữ lớn cho cô chú xem nhé.',
    );
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = 0.86;
  const languagePrefix = language.slice(0, 2).toLowerCase();
  const voice = speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith(languagePrefix));
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = (event) => {
    onEnd?.();
    if (event.error !== 'interrupted' && event.error !== 'canceled')
      onError?.('Không phát được giọng nói. Thiết bị có thể chưa có giọng tiếng Việt.');
  };
  speechSynthesis.speak(utterance);
}
interface RecognitionResult {
  transcript: string;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: { results: { [index: number]: { [index: number]: RecognitionResult } } }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;
export function createRecognition() {
  const browser = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}
